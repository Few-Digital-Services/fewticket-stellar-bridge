import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Decimal from 'decimal.js';
import { DataSource, Repository } from 'typeorm';
import {
	OrderEntity,
	OrderStatus,
	OrderSettlementStatus,
	ServiceType,
} from './order.entity';
import {
	StellarTransactionEntity,
	StellarTransactionStatus,
	StellarTransactionType,
} from '../stellar-transaction/stellar-transaction.entity';
import { CreateStellarOrderDto } from './dto/create-stellar-order.dto';
import { VerifyOrderTransactionDto } from './dto/verify-order-transaction.dto';
import { WebhookJob, WebhookQueue } from '../queue/queue.constants';
import { WebhookEntity, WebhookStatus, WebhookType } from '../webhook/webhook.entity';
import { CreateBridgeVirtualAccountOrderDto } from './dto/create-bridge-virtual-account-order.dto';

import { BridgeVirtualAccountEntity } from 'src/bridge-virtual-account/bridge-virtual-account.entity';
import { BridgeVirtualAccountService } from 'src/bridge-virtual-account/bridge-virtual-account.service';
import { StellarService } from '../stellar/stellar.service';


type ApplyIncomingPaymentInput = {
	memo: string;
	currency: string;
	amount: string | number;
	transactionHash?: string;
	// Receiving account (defaults to the order's public address).
	to?: string;
	// Sender account; stored as the counterparty on the credit row.
	from?: string;
	network?: string;
	rawPayload?: Record<string, unknown>;
};

type ApplyIncomingPaymentResult =
	| 'paid'
	| 'partial_paid'
	| 'mismatch'
	| 'duplicate'
	| 'overpaid';

@Injectable()
export class OrderService {
	constructor(
		@InjectRepository(OrderEntity)
		private readonly orderRepo: Repository<OrderEntity>,
		@InjectRepository(StellarTransactionEntity)
		private readonly stellarTransactionRepo: Repository<StellarTransactionEntity>,
		@InjectRepository(WebhookEntity)
		private readonly webhookRepo: Repository<WebhookEntity>,
		@InjectQueue(WebhookQueue.name)
		private readonly webhookQueue: Queue,
		private readonly dataSource: DataSource,

		private readonly bridgeVirtualAccountService: BridgeVirtualAccountService,
		private readonly stellarService: StellarService,
	) { }

	findByMemoOrReference(memo: string) {
		return this.orderRepo.findOne({
			where: [{ memo }, { reference: memo }],
		});
	}

	async createBridgeVirtualAccountOrder(dto: CreateBridgeVirtualAccountOrderDto) {
		const faitAmount = dto.fait_amount;
		if (!faitAmount) {
			throw new BadRequestException('fait amount is required');
		}

		//unique reference before generating memo to avoid unnecessary db query if reference is not unique
		const existingReference = await this.orderRepo.findOne({
			where: { reference: dto.reference, faitCurrency: dto.fait_currency, serviceType: ServiceType.BRIDGE_VIRTUAL_ACCOUNT },
			select: ['id', 'reference', 'memo', 'publicAddress', 'assetAmount', 'faitAmount', 'currency', 'network', 'faitCurrency', 'settlementStatus', 'virtualAccount'],
			relations: ['virtualAccount'],
		});

	

		if (existingReference) {
			return {
				message: 'Order created successfully',
				data: {
					reference: existingReference.reference,
					payment_instructions: existingReference?.virtualAccount?.instructions ? JSON.parse(existingReference.virtualAccount.instructions) : null,
					memo: existingReference.memo,
					public_address: existingReference.publicAddress,
					fait_amount: existingReference.faitAmount,
					currency: existingReference.currency,
					network: existingReference.network,
					fait_currency: existingReference.faitCurrency,
				}

			};
		}

		const memo = await this.generateUniqueMemo();
		const bridgePublicAddress = process.env.STELLAR_BRIDGE_PUBLIC_KEY;
		const customerId = process.env.BRIDGE_COMPANY_CUSTOMER_ID!;

		const generateVirtualAccount = await this.bridgeVirtualAccountService.generateVirtualAccountNumberForNewOrder({
			reference: dto.reference,
			customerId: customerId,
			faitCurrency: dto.fait_currency?.toLowerCase() as any,
			destinationCurrency: 'usdc' as any,
			destinationPaymentRail: 'stellar' as any,
			blockchainMemo: memo, //81147319
			destinationAddress: bridgePublicAddress,
		});


		if (generateVirtualAccount) {

			const conflictKey = generateVirtualAccount.id;
			return await this.dataSource.transaction(async (manager) => {

				//create or update bridge virtual account details
				await manager.upsert(
					BridgeVirtualAccountEntity,
					{
						bridgeVirtualAccount: generateVirtualAccount.id,
						accountNumber: generateVirtualAccount.payment_instructions?.account_number || generateVirtualAccount.payment_instructions?.bank_account_number || '',
						bankName: generateVirtualAccount.payment_instructions?.bank_name || '',
						faitCurrency: dto.fait_currency?.toLowerCase() as any,
						instructions: JSON.stringify(generateVirtualAccount.payment_instructions),
						destination: generateVirtualAccount.destination,
					},
					['bridgeVirtualAccount'] // conflict column
				);

				const savedVirtualAccount = await manager.findOne(
					BridgeVirtualAccountEntity,
					{
						where: { bridgeVirtualAccount: conflictKey },
					}
				);
				const order = await manager.create(OrderEntity, {
					reference: dto.reference,
					faitAmount: String(faitAmount),
					assetAmount: '0',
					faitCurrency: dto.fait_currency,
					currency: 'usdc',
					network: 'stellar',
					publicAddress: bridgePublicAddress,
					memo: memo,
					paidAmount: '0',
					status: OrderStatus.PENDING,
					settlementStatus: OrderSettlementStatus.PENDING,
					serviceType:ServiceType.BRIDGE_VIRTUAL_ACCOUNT,
					virtualAccount: { id: savedVirtualAccount ? savedVirtualAccount.id : null } as any,
				});

				const savedOrder = await manager.save(order);

				return {
					message: 'Order created successfully',
					data: {
						reference: savedOrder.reference,
						payment_instructions: savedVirtualAccount && savedVirtualAccount.instructions ? JSON.parse(savedVirtualAccount.instructions) : null,
						memo: savedOrder.memo,
						public_address: savedOrder.publicAddress,
						fait_amount: savedOrder.faitAmount,
						currency: savedOrder.currency,
						network: savedOrder.network,
						fait_currency: savedOrder.faitCurrency,
					}

				};
			});
		}


	}



	private buildStellarOrderResponse(order: OrderEntity) {
		return {
			message: 'Order created successfully',
			data: {
				reference: order.reference,
				memo: order.memo,
				public_address: order.publicAddress,
				asset_amount: order.assetAmount,
				fait_amount: order.faitAmount,
				currency: order.currency,
				network: order.network,
				fait_currency: order.faitCurrency,
			},
		};
	}

	private async reconcileExistingOnChainPayment(order: OrderEntity): Promise<OrderEntity> {
		if (order.serviceType !== ServiceType.STELLAR || !order.memo) {
			return order;
		}

		if (order.status === OrderStatus.PAID) {
			await this.ensurePaidWebhookDispatched(order);
			return order;
		}

		const publicKey = order.publicAddress || process.env.STELLAR_PUBLIC_KEY;
		if (!publicKey) {
			return order;
		}

		const expectedCurrency = String(order.currency ?? 'usdc').toUpperCase();
		const matchingPayments = await this.stellarService.findPaymentsMatchingMemo(
			publicKey,
			order.memo,
			{ assetCode: expectedCurrency },
		);

		for (const payment of matchingPayments) {
			const existingTx = await this.stellarTransactionRepo.findOne({
				where: { transactionHash: payment.transactionHash },
			});

			if (existingTx?.orderId && existingTx.orderId !== order.id) {
				continue;
			}

			if (existingTx && !existingTx.orderId) {
				existingTx.orderId = order.id;
				await this.stellarTransactionRepo.save(existingTx);
			}

			const paymentInput = {
				memo: payment.memo,
				currency: payment.currency,
				amount: payment.amount,
				transactionHash: payment.transactionHash,
				to: payment.to,
				from: payment.from,
			};

			await this.applyIncomingPayment(order, paymentInput);

			const refreshed = await this.orderRepo.findOne({ where: { id: order.id } });
			if (refreshed) {
				Object.assign(order, refreshed);
			}

			if (refreshed?.status === OrderStatus.PAID) {
				await this.ensurePaidWebhookDispatched(
					order,
					payment.transactionHash,
					payment.memo,
				);
				break;
			}
		}

		return order;
	}

	async createOrder(dto: CreateStellarOrderDto) {
		const faitAmount = dto.fait_amount;
		if (!faitAmount) {
			throw new BadRequestException('fait amount is required');
		}
	

		//unique reference before generating memo to avoid unnecessary db query if reference is not unique
		const existingReference = await this.orderRepo.findOne({
			where: { reference: dto.reference , serviceType: ServiceType.STELLAR },
			select: ['id', 'reference', 'memo', 'publicAddress', 'assetAmount', 'faitAmount', 'currency', 'network', 'faitCurrency', 'status', 'paidAmount', 'serviceType'],
		});

		if (existingReference) {
			const reconciled = await this.reconcileExistingOnChainPayment(existingReference);
			return this.buildStellarOrderResponse(reconciled);
		}

		const memo = await this.generateUniqueMemo();

		const order = new OrderEntity();
		order.reference = dto.reference;
		order.faitAmount = String(faitAmount);
		order.assetAmount = String(dto.asset_amount);
		order.faitCurrency = dto.fait_currency;
		order.currency = 'usdc';
		order.network = 'stellar';
		order.publicAddress = process.env.STELLAR_PUBLIC_KEY;
		order.memo = memo;
		order.paidAmount = '0';
		order.status = OrderStatus.PENDING;
		order.serviceType = ServiceType.STELLAR;

		const savedOrder = await this.orderRepo.save(order);
		const reconciled = await this.reconcileExistingOnChainPayment(savedOrder);
		return this.buildStellarOrderResponse(reconciled);
	}

	async markAsPaid(order: OrderEntity) {
		order.status = OrderStatus.PAID;
		const savedOrder = await this.orderRepo.save(order);

		return savedOrder;
	}

	/**
	 * Apply an on-chain payment to an order, idempotently.
	 *
	 * Each payment is recorded once as a CREDIT row in stellar_transactions
	 * (unique on transactionHash + publicAddress + type) linked to the order.
	 * paid_amount is then recomputed from the SUM of the order's linked credits
	 * instead of being incremented, so replaying the same payment (listener
	 * restart, duplicate stream, queue retry, reconcile) never double counts.
	 * The order row is locked for the duration of the update.
	 */
	async applyIncomingPayment(
		order: OrderEntity,
		input: ApplyIncomingPaymentInput,
	): Promise<ApplyIncomingPaymentResult> {
		const memo = String(input.memo ?? '').trim();
		const currency = String(input.currency ?? '').trim().toUpperCase();
		const transactionHash = String(input.transactionHash ?? '').trim();

		// Without a transaction hash a payment cannot be de-duplicated, so it is never counted.
		if (!transactionHash) {
			return 'mismatch';
		}

		const outcome = await this.dataSource.transaction(async (manager) => {
			const locked = await manager.getRepository(OrderEntity).findOne({
				where: { id: order.id },
				lock: { mode: 'pessimistic_write' },
			});

			if (!locked) {
				return { result: 'mismatch' as ApplyIncomingPaymentResult, saved: null as OrderEntity | null, becamePaid: false };
			}

			const expectedCurrency = String(locked.currency ?? '').trim().toUpperCase();
			const memoMatches = memo === locked.reference || memo === locked.memo;
			if (!memoMatches || currency !== expectedCurrency) {
				return { result: 'mismatch' as ApplyIncomingPaymentResult, saved: locked, becamePaid: false };
			}

			const publicAddress = String(
				input.to || locked.publicAddress || process.env.STELLAR_PUBLIC_KEY || '',
			);
			const txRepo = manager.getRepository(StellarTransactionEntity);

			const existing = await txRepo.findOne({
				where: {
					transactionHash,
					publicAddress,
					type: StellarTransactionType.CREDIT,
				},
				lock: { mode: 'pessimistic_write' },
			});

			let isNewCredit = false;
			if (existing) {
				if (existing.orderId && existing.orderId !== locked.id) {
					// Already counted towards a different order.
					return { result: 'duplicate' as ApplyIncomingPaymentResult, saved: locked, becamePaid: false };
				}
				if (!existing.orderId) {
					existing.orderId = locked.id;
					await txRepo.save(existing);
					isNewCredit = true;
				}
			} else {
				await txRepo.save(
					txRepo.create({
						orderId: locked.id,
						transactionHash,
						amount: new Decimal(String(input.amount ?? '0')).toFixed(6),
						type: StellarTransactionType.CREDIT,
						currency,
						status: StellarTransactionStatus.CONFIRMED,
						network: input.network,
						publicAddress,
						counterpartyAddress: input.from,
						memo,
						rawPayload: input.rawPayload,
					}),
				);
				isNewCredit = true;
			}

			const sumRow = await txRepo
				.createQueryBuilder('t')
				.select('COALESCE(SUM(t.amount), 0)', 'total')
				.where('t.orderId = :orderId', { orderId: locked.id })
				.andWhere('t.type = :type', { type: StellarTransactionType.CREDIT })
				.andWhere('UPPER(t.currency) = :currency', { currency: expectedCurrency })
				.getRawOne<{ total: string }>();

			const paidAmount = new Decimal(String(sumRow?.total ?? '0'));
			const expectedAmount = new Decimal(String(locked.assetAmount ?? '0'));
			const wasPaid = locked.status === OrderStatus.PAID;

			locked.paidAmount = paidAmount.toFixed(6);

			let result: ApplyIncomingPaymentResult;
			if (paidAmount.gte(expectedAmount)) {
				locked.status = OrderStatus.PAID;
				result = paidAmount.gt(expectedAmount) ? 'overpaid' : 'paid';
			} else {
				// Never downgrade an order that is already PAID.
				if (!wasPaid) {
					locked.status = OrderStatus.PARTIAL_PAID;
				}
				result = 'partial_paid';
			}

			const saved = await manager.getRepository(OrderEntity).save(locked);
			return { result: isNewCredit ? result : ('duplicate' as ApplyIncomingPaymentResult), saved, becamePaid: !wasPaid && saved.status === OrderStatus.PAID };
		});

		if (outcome.saved) {
			Object.assign(order, outcome.saved);
		}

		// Dispatch after commit. ensurePaidWebhookDispatched is itself a no-op once a webhook was SENT.
		if (outcome.saved && outcome.saved.status === OrderStatus.PAID) {
			await this.ensurePaidWebhookDispatched(outcome.saved, transactionHash, memo);
		}

		return outcome.result;
	}

	private async ensurePaidWebhookDispatched(
		order: OrderEntity,
		transactionHash?: string,
		memo?: string,
	): Promise<void> {
		if (order.status !== OrderStatus.PAID) {
			return;
		}

		const sentWebhook = await this.webhookRepo.findOne({
			where: {
				reference: order.reference,
				type: WebhookType.STELLAR,
				status: WebhookStatus.SENT,
			},
		});

		if (sentWebhook) {
			return;
		}

		const linkedTx = transactionHash
			? null
			: await this.stellarTransactionRepo.findOne({
				where: { orderId: order.id },
				order: { createdAt: "DESC" },
			});

		const hash = transactionHash || linkedTx?.transactionHash;
		if (!hash) {
			return;
		}

		await this.dispatchPaidWebhook(order, hash, memo || order.memo || "");
	}

	private async dispatchPaidWebhook(
		order: OrderEntity,
		transactionHash: string,
		memo: string,
	): Promise<void> {
		await this.webhookQueue.add(
			WebhookJob.send,
			{
				type: WebhookType.STELLAR,
				reference: order.reference,
				payload: {
					reference: order.reference,
					transaction_hash: transactionHash,
					memo: memo || order.memo,
					// asset_amount stays the EXPECTED amount so the current Laravel handler is unchanged.
					asset_amount: order.assetAmount,
					expected_asset_amount: order.assetAmount,
					// Actual on-chain amount received for this order (sum of linked credits).
					received_asset_amount: order.paidAmount,
					fait_amount: order.faitAmount,
					asset_currency: order.currency,
					status: 'paid',
				},
			},
			{
				attempts: 5,
				backoff: {
					type: 'exponential',
					delay: 2000,
				},
				removeOnComplete: true,
			},
		);
	}

	/**
	 * Verify that a transaction is completed for the given reference
	 * Called by Laravel before processing tickets
	 */

	async getStellarOrderDiagnostics(reference: string) {
		const order = await this.orderRepo.findOne({
			where: { reference, serviceType: ServiceType.STELLAR },
		});

		if (!order) {
			return {
				message: 'Diagnostics retrieved',
				data: {
					order_found: false,
					reference,
				},
			};
		}

		const publicKey = order.publicAddress || process.env.STELLAR_PUBLIC_KEY;
		const expectedCurrency = String(order.currency ?? 'usdc').toUpperCase();
		let matchingPayments: Array<{
			transactionHash: string;
			amount: string;
			memo: string;
			currency: string;
			from: string;
			to: string;
			createdAt: string | null;
		}> = [];

		if (order.memo && publicKey) {
			matchingPayments = await this.stellarService.findPaymentsMatchingMemo(
				publicKey,
				order.memo,
				{ assetCode: expectedCurrency },
			);
		}

		const totalReceived = matchingPayments.reduce(
			(sum, payment) => sum.plus(String(payment.amount ?? '0')),
			new Decimal(0),
		);

		const stellarTransactions = await this.stellarTransactionRepo.find({
			where: { orderId: order.id },
			order: { createdAt: 'DESC' },
			take: 10,
		});

		const latestWebhook = await this.webhookRepo.findOne({
			where: { reference: order.reference, type: WebhookType.STELLAR },
			order: { createdAt: 'DESC' },
		});

		return {
			message: 'Diagnostics retrieved',
			data: {
				order_found: true,
				reference: order.reference,
				memo: order.memo,
				status: order.status,
				asset_amount: order.assetAmount,
				paid_amount: order.paidAmount,
				public_address: order.publicAddress,
				order_created_at: order.createdAt
					? order.createdAt.toISOString()
					: null,
				on_chain: {
					matching_payments: matchingPayments.map((payment) => ({
						transaction_hash: payment.transactionHash,
						amount: payment.amount,
						created_at: payment.createdAt,
					})),
					total_received: totalReceived.toFixed(6),
				},
				stellar_transactions: stellarTransactions.map((tx) => ({
					transaction_hash: tx.transactionHash,
					type: tx.type,
					status: tx.status,
					amount: tx.amount,
				})),
				webhook: latestWebhook
					? {
							last_sent_at: latestWebhook.updatedAt
								? latestWebhook.updatedAt.toISOString()
								: latestWebhook.createdAt?.toISOString?.() ?? null,
							last_reference: latestWebhook.reference ?? null,
							status: latestWebhook.status,
						}
					: null,
			},
		};
	}

	async verifyTransaction(
		reference: string,
		input?: VerifyOrderTransactionDto,
	) {
		const order = await this.orderRepo.findOne({
			where: { reference },
		});

		if (!order) {
			throw new BadRequestException('Order not found');
		}

		const incomingStatus = String(input?.status ?? '').toLowerCase();
		if (incomingStatus && !['paid', 'completed'].includes(incomingStatus)) {
			throw new BadRequestException('Webhook status is not paid/completed');
		}

		const incomingMemo = String(input?.memo ?? '').trim();
		if (incomingMemo && incomingMemo !== order.memo && incomingMemo !== order.reference) {
			throw new BadRequestException('Webhook memo does not match order');
		}

		if (order.status !== OrderStatus.PAID) {
			throw new BadRequestException(
				`Order is not paid. Current status: ${order.status}`,
			);
		}

		const incomingHash = String(input?.transaction_hash ?? '').trim();
		if (incomingHash) {
			const tx = await this.stellarTransactionRepo.findOne({
				where: {
					transactionHash: incomingHash,
					orderId: order.id,
					type: StellarTransactionType.CREDIT,
					status: StellarTransactionStatus.CONFIRMED,
				},
			});

			if (!tx) {
				throw new BadRequestException('Transaction hash not found for order');
			}
		}

		return {
			message: 'Transaction verified successfully',
			data: {
				is_valid: true,
				reference: order.reference,
				memo: order.memo,
				status: order.status,
				asset_amount: order.assetAmount,
				fait_amount: order.faitAmount,
				paid_amount: order.paidAmount,
			},
		};
	}

	private async generateUniqueMemo(): Promise<string> {
		for (let attempt = 0; attempt < 10; attempt++) {
			const memo = Math.floor(10000000 + Math.random() * 90000000).toString();

			const existing = await this.orderRepo.findOne({
				where: { memo },
				select: ['id'],
			});

			if (!existing) {
				return memo;
			}
		}

		throw new BadRequestException('Unable to generate unique memo');
	}
}

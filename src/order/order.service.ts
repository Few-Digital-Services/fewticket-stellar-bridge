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
} from './order.entity';
import {
	StellarTransactionEntity,
	StellarTransactionStatus,
	StellarTransactionType,
} from '../stellar-transaction/stellar-transaction.entity';
import { CreateStellarOrderDto } from './dto/create-stellar-order.dto';
import { VerifyOrderTransactionDto } from './dto/verify-order-transaction.dto';
import { WebhookJob, WebhookQueue } from '../queue/queue.constants';
import { WebhookType } from '../webhook/webhook.entity';
import { CreateBridgeVirtualAccountOrderDto } from './dto/create-bridge-virtual-account-order.dto';

import { BridgeVirtualAccountEntity } from 'src/bridge-virtual-account/bridge-virtual-account.entity';
import { BridgeVirtualAccountService } from 'src/bridge-virtual-account/bridge-virtual-account.service';


type ApplyIncomingPaymentInput = {
	memo: string;
	currency: string;
	amount: string | number;
	transactionHash?: string;
};

type ApplyIncomingPaymentResult =
	| 'paid'
	| 'partial_paid'
	| 'mismatch'
	| 'overpaid';

@Injectable()
export class OrderService {
	constructor(
		@InjectRepository(OrderEntity)
		private readonly orderRepo: Repository<OrderEntity>,
		@InjectRepository(StellarTransactionEntity)
		private readonly stellarTransactionRepo: Repository<StellarTransactionEntity>,
		@InjectQueue(WebhookQueue.name)
		private readonly webhookQueue: Queue,
		private readonly dataSource: DataSource,

		private readonly bridgeVirtualAccountService: BridgeVirtualAccountService,
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
			where: { reference: dto.reference, faitCurrency: dto.fait_currency},
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


	async createOrder(dto: CreateStellarOrderDto) {
		const faitAmount = dto.fait_amount;
		if (!faitAmount) {
			throw new BadRequestException('fait amount is required');
		}

		//unique reference before generating memo to avoid unnecessary db query if reference is not unique
		const existingReference = await this.orderRepo.findOne({
			where: { reference: dto.reference },
			select: ['id', 'reference', 'memo', 'publicAddress', 'assetAmount', 'faitAmount', 'currency', 'network', 'faitCurrency'],
		});

		if (existingReference) {
			return {
				message: 'Order created successfully',
				data: {
					reference: existingReference.reference,
					memo: existingReference.memo,
					public_address: existingReference.publicAddress,
					asset_amount: existingReference.assetAmount,
					fait_amount: existingReference.faitAmount,
					currency: existingReference.currency,
					network: existingReference.network,
					fait_currency: existingReference.faitCurrency,
				}

			};
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

		const savedOrder = await this.orderRepo.save(order);
		return {
			message: 'Order created successfully',
			data: {
				reference: savedOrder.reference,
				memo: savedOrder.memo,
				public_address: savedOrder.publicAddress,
				asset_amount: savedOrder.assetAmount,
				fait_amount: savedOrder.faitAmount,
				currency: savedOrder.currency,
				network: savedOrder.network,
				fait_currency: savedOrder.faitCurrency,
			}

		};


	}

	async markAsPaid(order: OrderEntity) {
		order.paidAmount = String(order.assetAmount ?? '0');
		order.status = OrderStatus.PAID;
		const savedOrder = await this.orderRepo.save(order);

		return savedOrder;
	}

	async applyIncomingPayment(
		order: OrderEntity,
		input: ApplyIncomingPaymentInput,
	): Promise<ApplyIncomingPaymentResult> {
		const wasAlreadyPaid = order.status === OrderStatus.PAID;
		const memo = String(input.memo ?? '').trim();
		const currency = String(input.currency ?? '').trim().toUpperCase();
		const expectedCurrency = String(order.currency ?? '').trim().toUpperCase();

		const memoMatches = memo === order.reference || memo === order.memo;
		if (!memoMatches || currency !== expectedCurrency) {
			return 'mismatch';
		}

		const currentPaidAmount = new Decimal(String(order.paidAmount ?? '0'));
		const incomingPaidAmount = new Decimal(String(input.amount ?? '0'));
		const paidAmount = currentPaidAmount.plus(incomingPaidAmount);
		const expectedAmount = new Decimal(String(order.assetAmount ?? '0'));

		order.paidAmount = paidAmount.toFixed(6);
		//greater or equal to expected amount is considered paid, even if it's overpaid
		if (paidAmount.gte(expectedAmount)) {
			order.status = OrderStatus.PAID;
			const savedOrder = await this.orderRepo.save(order);

			if (!wasAlreadyPaid && input.transactionHash) {
				await this.dispatchPaidWebhook(savedOrder, input.transactionHash, memo);
			}
			return 'paid';
		}

		if (paidAmount.lt(expectedAmount)) {
			order.status = OrderStatus.PARTIAL_PAID;
			await this.orderRepo.save(order);
			return 'partial_paid';
		}

		order.status = OrderStatus.PAID;
		if(!order.virtualAccount) {
			order.settlementStatus = OrderSettlementStatus.SETTLED;
		}
		await this.orderRepo.save(order);

		return 'overpaid';
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
					asset_amount: order.assetAmount,
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

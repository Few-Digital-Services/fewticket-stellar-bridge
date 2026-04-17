import { InjectQueue } from '@nestjs/bullmq';
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	Horizon,
	Keypair,
	Memo,
	Networks,
	TransactionBuilder,
	Operation,
	Asset,
} from 'stellar-sdk';
import axios from 'axios';
import Decimal from 'decimal.js';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { StellarListenerStateService } from '../stellar-listener-state/stellar-listener-state.service';
import {
	IncomingTransactionJob,
	IncomingTransactionQueue,
} from '../queue/queue.constants';
import { WalletEntity } from '../wallet/wallet.entity';

@Injectable()
export class StellarService implements OnModuleInit {
	private readonly logger = new Logger(StellarService.name);
	private readonly server: Horizon.Server;
	private readonly networkPassphrase: string;
	private readonly platformPublic?: string;
	private readonly trackedAddressRefreshMs: number;
	private readonly trackedAddressSet = new Set<string>();
	private lastTrackedAddressRefreshAt = 0;

	constructor(
		private readonly configService: ConfigService,
		private readonly dataSource: DataSource,
		@InjectQueue(IncomingTransactionQueue.name)
		private readonly incomingTransactionQueue: Queue,
		private readonly listenerStateService: StellarListenerStateService,
	) {
		this.server = new Horizon.Server(
			this.configService.get<string>(
				'STELLAR_HORIZON_URL',
				'https://horizon-testnet.stellar.org',
			),
		);

		const networkName = this.configService
			.get<string>('STELLAR_NETWORK', 'TESTNET')
			.toUpperCase();
		this.networkPassphrase =
			networkName === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET;

		this.platformPublic = this.configService.get<string>('STELLAR_PUBLIC_KEY');
		const refreshMs = Number(
			this.configService.get<string>('STELLAR_TRACKED_ADDRESS_REFRESH_MS', '30000'),
		);
		this.trackedAddressRefreshMs = Number.isNaN(refreshMs) ? 30000 : refreshMs;
	}

	async onModuleInit() {
		if (!this.platformPublic) {
			this.logger.warn(
				'STELLAR_PUBLIC_KEY is not set. Platform-specific matching will be limited.',
			);
		}

		// Load the last saved cursor position for recovery after restarts
		const resumeCursor = await this.listenerStateService.getResumeCursor();
		await this.refreshTrackedAddressCache(true);
		this.startListener(resumeCursor);
	}

	generateWallet() {
		const pair = Keypair.random();

		return {
			publicKey: pair.publicKey(),
			secret: pair.secret(),
		};
	}

	async fundTestnetWallet(publicKey: string) {
		await axios.get(`https://friendbot.stellar.org?addr=${publicKey}`);
	}

	async fundTestnetWalletByUserId(
		userId: string,
		options?: {
			assetCode?: 'XLM' | 'USDC';
			amount?: string;
		},
	) {
		const wallet = await this.dataSource.getRepository(WalletEntity).findOne({
			where: { userId },
			select: ['publicKey'],
		});

		if (!wallet?.publicKey) {
			throw new NotFoundException(`wallet not found for user ${userId}`);
		}

		const assetCode = (options?.assetCode ?? 'USDC').toUpperCase();
		const amount = String(options?.amount ?? '10');

		if (assetCode === 'XLM') {
			await this.fundTestnetWallet(wallet.publicKey);
			return {
				userId,
				publicKey: wallet.publicKey,
				assetCode: 'XLM',
				amount,
				txHash: null,
			};
		}

		if (assetCode !== 'USDC') {
			throw new BadRequestException(`unsupported testnet asset ${assetCode}`);
		}

		const platformSecret = this.configService.get<string>('STELLAR_SECRET_KEY');
		const usdcIssuer = this.configService.get<string>('STELLAR_USDC_ISSUER');

		if (!platformSecret) {
			throw new BadRequestException('STELLAR_SECRET_KEY is not configured');
		}

		if (!usdcIssuer) {
			throw new BadRequestException('STELLAR_USDC_ISSUER is not configured');
		}

		await this.ensureTestnetDestinationAccount(wallet.publicKey);

		const txHash = await this.sendPayment(platformSecret, wallet.publicKey, amount, {
			assetCode: 'USDC',
			assetIssuer: usdcIssuer,
			memo: `fund-${userId}`,
		});

		return {
			userId,
			publicKey: wallet.publicKey,
			assetCode: 'USDC',
			amount,
			txHash,
		};
	}

	private async ensureTestnetDestinationAccount(publicKey: string): Promise<void> {
		if (this.networkPassphrase !== Networks.TESTNET) {
			throw new BadRequestException(
				'fundTestnetWalletByUserId supports auto-activation only on TESTNET',
			);
		}

		try {
			await this.server.loadAccount(publicKey);
			return;
		} catch (error) {
			const status = (error as any)?.response?.status;
			if (status !== 404) {
				throw error;
			}
		}

		await this.fundTestnetWallet(publicKey);

		try {
			await this.server.loadAccount(publicKey);
		} catch {
			throw new BadRequestException(
				`wallet account ${publicKey} is not yet active on testnet; retry in a few seconds`,
			);
		}
	}

	async sendPayment(
		secret: string,
		destination: string,
		amount: string,
		options?: {
			assetCode?: string;
			assetIssuer?: string;
			memo?: string;
		},
	) {
		const source = Keypair.fromSecret(secret);
		const account = await this.server.loadAccount(source.publicKey());

		let asset = Asset.native();
		if (options?.assetCode && options.assetCode.toUpperCase() !== 'XLM' && options?.assetIssuer) {
			asset = new Asset(options.assetCode.toUpperCase(), options.assetIssuer);
		}

		const builder = new TransactionBuilder(account, {
			fee: '100',
			networkPassphrase: this.networkPassphrase,
			...(options?.memo ? { memo: Memo.text(options.memo) } : {}),
		})
			.addOperation(
				Operation.payment({
					destination,
					asset,
					amount,
				}),
			)
			.setTimeout(30);

		const tx = builder.build();
		tx.sign(source);

		const res = await this.server.submitTransaction(tx);

		return res.hash;
	}

	async getWalletBalances(publicKey: string): Promise<Record<string, string>> {
		try {
			const account = await this.server.loadAccount(publicKey);
			const balanceMap: Record<string, Decimal> = {
				XLM: new Decimal(0),
			};

			for (const balance of account.balances as Array<any>) {
				if (balance.asset_type === 'native') {
					balanceMap.XLM = new Decimal(String(balance.balance ?? '0'));
					continue;
				}

				const code = String(balance.asset_code ?? '').toUpperCase();
				if (!code) {
					continue;
				}

				const current = balanceMap[code] ?? new Decimal(0);
				balanceMap[code] = current.plus(String(balance.balance ?? '0'));
			}

			return Object.entries(balanceMap).reduce<Record<string, string>>(
				(result, [currency, amount]) => {
					result[currency] = amount.toFixed(8);
					return result;
				},
				{},
			);
		} catch (error) {
			const status = (error as any)?.response?.status;

			if (status === 404) {
				// New or unfunded wallet accounts may not exist on Horizon yet.
				return {
					XLM: '0',
					USDC: '0',
				};
			}

			this.logger.error(
				`Unable to fetch wallet balances for ${publicKey}: ${this.stringifyError(error)}`,
			);
			throw error;
		}
	}

	// Listen for all network payments and enqueue them for async processing.
	// Resumes from last saved cursor position on restart.
	private startListener(startCursor: string = 'now') {
		this.server
			.payments()
			.cursor(startCursor)
			.stream({
				onmessage: async (payment: any) => {
					try {
						await this.refreshTrackedAddressCache();

						if (
							payment.type !== 'payment' ||
							!payment.transaction_hash ||
							!payment.from ||
							!payment.to
						) {
							if (payment.paging_token) {
								await this.listenerStateService.updateCursor(
									payment.paging_token,
									Number(payment.ledger_attr ?? 0),
								);
							}
							return;
						}

				

						const from = String(payment.from);
						const to = String(payment.to);
						if (
							!this.trackedAddressSet.has(from) &&
							!this.trackedAddressSet.has(to)
						) {
							if (payment.paging_token) {
								await this.listenerStateService.updateCursor(
									payment.paging_token,
									Number(payment.ledger_attr ?? 0),
								);
							}
							return;
						}

						await this.incomingTransactionQueue.add(
							IncomingTransactionJob.stellarPaymentDetected,
							{
								transactionHash: payment.transaction_hash,
								amount: payment.amount,
								from,
								to,
								assetType: payment.asset_type,
								assetCode: payment.asset_code,
								memo: payment.memo,
								pagingToken: payment.paging_token,
								network:
									this.networkPassphrase === Networks.PUBLIC
										? 'PUBLIC'
										: 'TESTNET',
								rawPayload: {
									id: payment.id,
									transaction_hash: payment.transaction_hash,
									from,
									to,
									amount: payment.amount,
									asset_type: payment.asset_type,
									asset_code: payment.asset_code,
									paging_token: payment.paging_token,
								},
							},
							{
								jobId: `stellar-payment-${String(payment.paging_token ?? payment.transaction_hash)}`,
								removeOnComplete: {
									count: Number(
										this.configService.get<string>(
											'BULL_INCOMING_REMOVE_ON_COMPLETE_COUNT',
											'50',
										),
									),
								},
								removeOnFail: {
									count: Number(
										this.configService.get<string>(
											'BULL_INCOMING_REMOVE_ON_FAIL_COUNT',
											'200',
										),
									),
								},
							},
						);

						if (payment.paging_token) {
							await this.listenerStateService.updateCursor(
								payment.paging_token,
								Number(payment.ledger_attr ?? 0),
							);
						}
					} catch (error) {
						this.logger.error(
							`Failed to process stellar payment stream event: ${this.stringifyError(error)}`,
						);
					}
				},
				onerror: (event: MessageEvent<any>) => {
					const errorData = this.stringifyError(event?.data);
					this.logger.error(`Horizon stream error: ${errorData}`);
				},
			});

		this.logger.log('Stellar Horizon listener started');
	}

	private async refreshTrackedAddressCache(force = false): Promise<void> {
		const now = Date.now();
		if (!force && now - this.lastTrackedAddressRefreshAt < this.trackedAddressRefreshMs) {
			return;
		}

		const wallets = await this.dataSource.getRepository(WalletEntity).find({
			select: ['publicKey'],
		});

		this.trackedAddressSet.clear();
		for (const wallet of wallets) {
			if (wallet.publicKey) {
				this.trackedAddressSet.add(wallet.publicKey);
			}
		}

		if (this.platformPublic) {
			this.trackedAddressSet.add(this.platformPublic);
		}

		this.lastTrackedAddressRefreshAt = now;
	}

	private stringifyError(value: unknown): string {
		if (value instanceof Error) {
			return value.message;
		}

		if (typeof value === 'string') {
			return value;
		}

		if (value === undefined || value === null) {
			return 'unknown error';
		}

		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}
}

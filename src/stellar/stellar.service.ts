import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	Horizon,
	Keypair,
	Networks,
	TransactionBuilder,
	Operation,
	Asset,
} from 'stellar-sdk';
import axios from 'axios';
import { Queue } from 'bullmq';
import {
	IncomingTransactionJob,
	IncomingTransactionQueue,
} from '../queue/queue.constants';
import { StellarListenerStateService } from '../stellar-listener-state/stellar-listener-state.service';

@Injectable()
export class StellarService implements OnModuleInit {
	private readonly logger = new Logger(StellarService.name);
	private readonly server: Horizon.Server;
	private readonly networkPassphrase: string;
	private readonly platformPublic?: string;

	constructor(
		private readonly configService: ConfigService,
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
	}

	async onModuleInit() {
		if (!this.platformPublic) {
			this.logger.warn(
				'STELLAR_PUBLIC_KEY is not set. Horizon listener was not started.',
			);
			return;
		}

		const canStart = await this.ensurePlatformAccountExists(this.platformPublic);
		if (!canStart) {
			return;
		}

		// Load the last saved cursor position for recovery after restarts
		const resumeCursor = await this.listenerStateService.getResumeCursor();
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

	async sendPayment(secret: string, destination: string, amount: string) {
		const source = Keypair.fromSecret(secret);
		const account = await this.server.loadAccount(source.publicKey());

		const tx = new TransactionBuilder(account, {
			fee: '100',
			networkPassphrase: this.networkPassphrase,
		})
			.addOperation(
				Operation.payment({
					destination,
					asset: Asset.native(),
					amount,
				}),
			)
			.setTimeout(30)
			.build();

		tx.sign(source);

		const res = await this.server.submitTransaction(tx);

		return res.hash;
	}

	// Listen for new payments to platform address and send to BullMQ for processing.
	// Resumes from last saved cursor position on restart.
	private startListener(startCursor: string = 'now') {
		this.server
			.payments()
			.forAccount(this.platformPublic!)
			.cursor(startCursor)
			.stream({
				onmessage: async (payment: any) => {
					try {
						if (payment.type !== 'payment' || !payment.transaction_hash) {
							return;
						}

						const tx = await this.server
							.transactions()
							.transaction(payment.transaction_hash)
							.call();

						const memo = tx.memo ?? undefined;

						await this.incomingTransactionQueue.add(
							IncomingTransactionJob.stellarPaymentDetected,
							{
								transactionHash: payment.transaction_hash,
								amount: payment.amount,
								from: payment.from,
								to: payment.to,
								assetType: payment.asset_type,
								assetCode: payment.asset_code,
								memo,
								network:
									this.networkPassphrase === Networks.PUBLIC
										? 'PUBLIC'
										: 'TESTNET',
								rawPayload: payment,
							},
							{
								jobId: payment.transaction_hash,
								removeOnComplete: 100,
								removeOnFail: 100,
							},
						);

						// Save cursor position for recovery after restart
						// payment.paging_token is the Horizon cursor
						if (payment.paging_token) {
							await this.listenerStateService.updateCursor(
								payment.paging_token,
								tx.ledger_attr,
							);
						}
					} catch (error) {
						this.logger.error(
							`Failed to enqueue stellar payment: ${this.stringifyError(error)}`,
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

	private async ensurePlatformAccountExists(publicKey: string): Promise<boolean> {
		try {
			await this.server.loadAccount(publicKey);
			return true;
		} catch (error) {
			const status = (error as any)?.response?.status;

			if (status === 404) {
				this.logger.error(
					`Platform account ${publicKey} was not found on Horizon. Fund or create the account before starting listener.`,
				);
				return false;
			}

			this.logger.error(
				`Unable to validate platform account before listener start: ${this.stringifyError(error)}`,
			);
			return false;
		}
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

// src/queue/mail.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { StellarOrderService } from '../stellar-order/stellar-order.service';
import { StellarTransactionService } from '../stellar-transaction/stellar-transaction.service';
import {
  IncomingTransactionJob,
  IncomingTransactionQueue,
} from './queue.constants';


@Injectable()
@Processor(IncomingTransactionQueue.name)
export class TransactionProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(
    private readonly stellarOrderService: StellarOrderService,
    private readonly stellarTransactionService: StellarTransactionService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>) {
    if (job.name !== IncomingTransactionJob.stellarPaymentDetected) {
      this.logger.warn(`Skipping unsupported job name: ${job.name}`);
      return;
    }

    const { transactionHash, amount, memo, to, network, rawPayload, assetType, assetCode } =
      job.data;

    const currency = assetCode
      ? String(assetCode).toUpperCase()
      : assetType === 'native'
        ? 'XLM'
        : 'UNKNOWN';

    try {
      const existing =
        await this.stellarTransactionService.findByHash(transactionHash);

      if (existing) {
        this.logger.log(`Transaction already exists: ${transactionHash}`);
        return;
      }

      if (!memo) {
        this.logger.warn(
          `Transaction ${transactionHash} has no memo; skipping order linking`,
        );
        return;
      }

      const order = await this.stellarOrderService.findByMemoOrReference(memo);

      if (!order) {
        await this.stellarTransactionService.createConfirmedTransaction({
          transactionHash,
          amount,
          currency,
          network,
          publicAddress: to,
          memo,
          rawPayload,
        });

        this.logger.warn(
          `No stellar order found for memo/reference: ${memo} (${transactionHash})`,
        );

        this.logger.log(
          `Recorded unlinked stellar tx ${transactionHash} with memo ${memo}`,
        );

        return;
      }

      await this.stellarTransactionService.createConfirmedTransaction({
        orderId: order.id,
        transactionHash,
        amount,
        currency,
        network,
        publicAddress: to,
        memo,
        rawPayload,
      });

      const orderUpdateResult = await this.stellarOrderService.applyIncomingPayment(
        order,
        {
          memo,
          currency,
          amount,
        },
      );

      if (orderUpdateResult === 'paid') {
        this.logger.log(
          `Stellar tx ${transactionHash} linked to order ${order.reference} and marked paid`,
        );
        return;
      }

      if (orderUpdateResult === 'partial_paid') {
        this.logger.warn(
          `Stellar tx ${transactionHash} linked to order ${order.reference} as partial payment`,
        );
        return;
      }

      if (orderUpdateResult === 'mismatch') {
        this.logger.warn(
          `Stellar tx ${transactionHash} linked to order ${order.reference} but memo/currency mismatch prevented paid status`,
        );
        return;
      }

      this.logger.log(
        `Stellar tx ${transactionHash} linked to order ${order.reference} but exceeds expected amount`,
      );
    } catch (error) {
      this.logger.error(`Failed to process incoming stellar transaction`, error);
      throw error;
    }
  }
}

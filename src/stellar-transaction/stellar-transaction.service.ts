import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StellarTransactionEntity,
  StellarTransactionStatus,
} from './stellar-transaction.entity';

type IncomingTransactionPayload = {
  orderId?: string;
  transactionHash: string;
  amount: string | number;
  currency?: string;
  network?: string;
  publicAddress?: string;
  memo?: string;
  rawPayload?: Record<string, unknown>;
};

@Injectable()
export class StellarTransactionService {
  constructor(
    @InjectRepository(StellarTransactionEntity)
    private readonly stellarTransactionRepo: Repository<StellarTransactionEntity>,
  ) {}

  findByHash(transactionHash: string) {
    return this.stellarTransactionRepo.findOne({
      where: { transactionHash },
    });
  }

  createConfirmedTransaction(payload: IncomingTransactionPayload) {
    const transaction = this.stellarTransactionRepo.create({
      orderId: payload.orderId,
      transactionHash: payload.transactionHash,
      amount: String(payload.amount ?? '0'),
      currency: payload.currency ?? 'XLM',
      status: StellarTransactionStatus.CONFIRMED,
      network: payload.network,
      publicAddress: payload.publicAddress,
      memo: payload.memo,
      rawPayload: payload.rawPayload,
    });

    return this.stellarTransactionRepo.save(transaction);
  }
}

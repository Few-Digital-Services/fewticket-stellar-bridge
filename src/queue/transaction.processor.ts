// src/queue/mail.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';


@Injectable()
@Processor('incoming-transaction-queue')
export class TransactionProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor() {
    super();
  }

  async process(job: Job<any, any, string>) {
    const { name, id } = job;
    const { data } = job.data;

    try {
    

      this.logger.log(`Search result processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process search result`, error);
    }
  }
}

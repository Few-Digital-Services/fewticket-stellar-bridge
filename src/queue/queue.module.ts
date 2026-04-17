import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailProcessor } from './mail.processor';
import { MailModule } from '../mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TransactionProcessor } from './transaction.processor';
import { WebhookProcessor } from './webhook.processor';
import { CacheModule } from '@nestjs/cache-manager';
import { IncomingTransactionQueue, MailQueue, WebhookQueue } from './queue.constants';
import { StellarOrderModule } from '../stellar-order/stellar-order.module';
import { StellarTransactionModule } from '../stellar-transaction/stellar-transaction.module';
import { WalletModule } from '../wallet/wallet.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { WebhookEntity } from '../webhook/webhook.entity';
import { WebhookService } from '../webhook/webhook.service';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register(),
    HttpModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([WebhookEntity]),
    StellarOrderModule,
    StellarTransactionModule,
    WalletModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          username: config.get<string>('REDIS_USERNAME') || undefined,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB') ?? 0,
           maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          removeOnComplete: {
            count: Number(
              config.get<string>('BULL_DEFAULT_REMOVE_ON_COMPLETE_COUNT', '50'),
            ),
          },
          removeOnFail: {
            count: Number(
              config.get<string>('BULL_DEFAULT_REMOVE_ON_FAIL_COUNT', '200'),
            ),
          },
        },
      }),
    }),
    BullModule.registerQueue({
      name: MailQueue.name,
    }),
    BullModule.registerQueue({
      name: IncomingTransactionQueue.name,
    }),
    BullModule.registerQueue({
      name: WebhookQueue.name,
    }),
    MailModule,
  ],
  providers: [
    MailProcessor,
    TransactionProcessor,
    WebhookProcessor,
    WebhookService,
  ],
  exports: [BullModule, TypeOrmModule],
})
export class QueueModule {}

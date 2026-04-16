import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailProcessor } from './mail.processor';
import { MailService } from '../mail/mail.service';
import { MailModule } from '../mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TransactionProcessor } from './transaction.processor';
import { CacheModule } from '@nestjs/cache-manager';
import { IncomingTransactionQueue, MailQueue } from './queue.constants';
import { StellarOrderModule } from '../stellar-order/stellar-order.module';
import { StellarTransactionModule } from '../stellar-transaction/stellar-transaction.module';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register(),
    JwtModule.register({}),
    StellarOrderModule,
    StellarTransactionModule,
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
      }),
    }),
    BullModule.registerQueue({
      name: MailQueue.name,
    }),
    BullModule.registerQueue({
      name: IncomingTransactionQueue.name,
    }),
    MailModule,
  ],
  providers: [MailProcessor, TransactionProcessor],
  exports: [BullModule],
})
export class QueueModule {}

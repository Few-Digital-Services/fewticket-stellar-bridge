import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './order.entity';
import { StellarTransactionEntity } from '../stellar-transaction/stellar-transaction.entity';
import { AuthModule } from '../auth/auth.module';
import { WebhookQueue } from '../queue/queue.constants';
import { BridgeModule } from '../bridge/bridge.module';
import { BridgeVirtualAccountModule } from 'src/bridge-virtual-account/bridge-virtual-account.module';
import { StellarModule } from '../stellar/stellar.module';
import { WebhookEntity } from '../webhook/webhook.entity';

@Module({
  imports: [
    AuthModule,
    BridgeModule,
    BridgeVirtualAccountModule,
    StellarModule,
    TypeOrmModule.forFeature([OrderEntity, StellarTransactionEntity, WebhookEntity]),
    BullModule.registerQueue({
      name: WebhookQueue.name,
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService,],
  exports: [OrderService],
})
export class OrderModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StellarOrderController } from './stellar-order.controller';
import { StellarOrderService } from './stellar-order.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarOrderEntity } from './stellar-order.entity';
import { StellarTransactionEntity } from '../stellar-transaction/stellar-transaction.entity';
import { AuthModule } from '../auth/auth.module';
import { WebhookQueue } from '../queue/queue.constants';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([StellarOrderEntity, StellarTransactionEntity]),
    BullModule.registerQueue({
      name: WebhookQueue.name,
    }),
  ],
  controllers: [StellarOrderController],
  providers: [StellarOrderService],
  exports: [StellarOrderService],
})
export class StellarOrderModule {}

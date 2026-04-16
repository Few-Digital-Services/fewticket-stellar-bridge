import { Module } from '@nestjs/common';
import { StellarController } from './stellar.controller';
import { StellarService } from './stellar.service';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { StellarListenerStateModule } from '../stellar-listener-state/stellar-listener-state.module';

@Module({
  imports: [ConfigModule, QueueModule, StellarListenerStateModule],
  controllers: [StellarController],
  providers: [StellarService],
})
export class StellarModule {}

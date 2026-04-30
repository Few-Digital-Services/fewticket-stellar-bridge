import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BridgeTransactionController } from './bridge-transaction.controller';
import { BridgeTransactionService } from './bridge-transaction.service';
import { BridgeTransactionEntity } from './bridge-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BridgeTransactionEntity])],
  controllers: [BridgeTransactionController],
  providers: [BridgeTransactionService]
})
export class BridgeTransactionModule {}

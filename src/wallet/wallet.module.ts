import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarModule } from '../stellar/stellar.module';
import { StellarOrderModule } from '../stellar-order/stellar-order.module';
import { WalletBalanceEntity } from './wallet-balance.entity';
import { WalletEntity } from './wallet.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletEntity, WalletBalanceEntity]),
    StellarModule,
    StellarOrderModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
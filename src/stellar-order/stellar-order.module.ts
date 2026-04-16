import { Module } from '@nestjs/common';
import { StellarOrderController } from './stellar-order.controller';
import { StellarOrderService } from './stellar-order.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarOrderEntity } from './stellar-order.entity';
import { AuthService } from 'src/auth/auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([StellarOrderEntity])],
  controllers: [StellarOrderController],
  providers: [StellarOrderService,  AuthService],
  exports: [StellarOrderService],
})
export class StellarOrderModule {}

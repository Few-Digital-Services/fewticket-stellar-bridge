import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BridgeVirtualAccountService } from './bridge-virtual-account.service';
import { BridgeVirtualAccountEntity } from './bridge-virtual-account.entity';
import { BridgeModule } from 'src/bridge/bridge.module';

@Module({
  imports: [TypeOrmModule.forFeature([BridgeVirtualAccountEntity]), BridgeModule],
  providers: [BridgeVirtualAccountService],
  exports: [BridgeVirtualAccountService],
})
export class BridgeVirtualAccountModule {}

import { Module } from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { BridgeController } from './bridge.controller';
import { BridgeClient } from './bridge.client';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [BridgeService, BridgeClient],
  controllers: [BridgeController],
  exports: [BridgeService],
})
export class BridgeModule {}

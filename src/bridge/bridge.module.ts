import { Module } from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { BridgeController } from './bridge.controller';
import { BridgeClient } from './bridge.client';
import { AuthService } from 'src/auth/auth.service';

@Module({
  providers: [BridgeService,BridgeClient, AuthService],
  controllers: [BridgeController]
})
export class BridgeModule {}

import { Module } from '@nestjs/common';
import { BridgeWebhookController } from './bridge-webhook.controller';
import { BridgeWebhookService } from './bridge-webhook.service';

@Module({
  controllers: [BridgeWebhookController],
  providers: [BridgeWebhookService]
})
export class BridgeWebhookModule {}

import { Test, TestingModule } from '@nestjs/testing';
import { BridgeWebhookController } from './bridge-webhook.controller';

describe('BridgeWebhookController', () => {
  let controller: BridgeWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BridgeWebhookController],
    }).compile();

    controller = module.get<BridgeWebhookController>(BridgeWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

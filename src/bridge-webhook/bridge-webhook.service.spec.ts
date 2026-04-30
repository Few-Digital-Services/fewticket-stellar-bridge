import { Test, TestingModule } from '@nestjs/testing';
import { BridgeWebhookService } from './bridge-webhook.service';

describe('BridgeWebhookService', () => {
  let service: BridgeWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BridgeWebhookService],
    }).compile();

    service = module.get<BridgeWebhookService>(BridgeWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

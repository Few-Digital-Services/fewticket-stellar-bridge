import { Test, TestingModule } from '@nestjs/testing';
import { BridgeTransactionService } from './bridge-transaction.service';

describe('BridgeTransactionService', () => {
  let service: BridgeTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BridgeTransactionService],
    }).compile();

    service = module.get<BridgeTransactionService>(BridgeTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

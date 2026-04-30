import { Test, TestingModule } from '@nestjs/testing';
import { BridgeVirtualAccountService } from './bridge-virtual-account.service';

describe('BridgeVirtualAccountService', () => {
  let service: BridgeVirtualAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BridgeVirtualAccountService],
    }).compile();

    service = module.get<BridgeVirtualAccountService>(BridgeVirtualAccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

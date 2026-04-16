import { Test, TestingModule } from '@nestjs/testing';
import { StellarOrderService } from './stellar-order.service';

describe('StellarOrderService', () => {
  let service: StellarOrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StellarOrderService],
    }).compile();

    service = module.get<StellarOrderService>(StellarOrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

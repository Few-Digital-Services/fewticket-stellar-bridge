import { Test, TestingModule } from '@nestjs/testing';
import { StellarOrderController } from './stellar-order.controller';

describe('StellarOrderController', () => {
  let controller: StellarOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StellarOrderController],
    }).compile();

    controller = module.get<StellarOrderController>(StellarOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BridgeTransactionController } from './bridge-transaction.controller';

describe('BridgeTransactionController', () => {
  let controller: BridgeTransactionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BridgeTransactionController],
    }).compile();

    controller = module.get<BridgeTransactionController>(BridgeTransactionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

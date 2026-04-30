import { Test, TestingModule } from '@nestjs/testing';
import { BridgeService } from './bridge.service';
import { BridgeClient } from './bridge.client';
import { Currency } from '../common/enums/currency.enum';
import { PaymentRail } from '../common/enums/payment-rail.enum';

describe('BridgeService', () => {
  let service: BridgeService;
  let bridgeClient: { post: jest.Mock };

  beforeEach(async () => {
    bridgeClient = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BridgeService,
        {
          provide: BridgeClient,
          useValue: bridgeClient,
        },
      ],
    }).compile();

    service = module.get<BridgeService>(BridgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVirtualAccount', () => {
    const dto = {
      transactionId: 'txn-123',
      customerId: 'c2c72984-1785-426c-a259-578f4f530ca3',
      sourceCurrency: Currency.USD,
      destinationCurrency: Currency.USDC,
      destinationPaymentRail: PaymentRail.STELLAR,
    };

    it('should create a virtual account and map response data', async () => {
      process.env.STELLAR_PUBLIC_KEY = 'GTESTPLATFORMPUBLICKEY1234567890123456789012345678901234567';

      bridgeClient.post.mockResolvedValue({
        id: 'va-123',
        customer_id: 'cust-123',
        source_deposit_instructions: { bank_name: 'Bridge Bank' },
        created_at: '2026-01-01T00:00:00.000Z',
        destination: { payment_rail: 'stellar' },
        status: 'active',
      });

      const result = await service.createVirtualAccount(dto);
      console.log('createVirtualAccount response:', result);

      expect(bridgeClient.post).toHaveBeenCalledWith(
        '/customers/c2c72984-1785-426c-a259-578f4f530ca3/virtual_accounts',
        'txn-txn-1234',
        {
          source: {
            currency: Currency.USD,
          },
          destination: {
            currency: Currency.USDC,
            payment_rail: PaymentRail.STELLAR,
            address: 'GTESTPLATFORMPUBLICKEY1234567890123456789012345678901234567',
          },
        },
      );

      expect(result).toEqual({
        successCode: 201,
        message: 'Virtual account created successfully',
        data: {
          id: 'va-1234',
          customer_id: 'cust-123',
          instructons: { bank_name: 'Bridge Bank' },
          created: '2026-01-01T00:00:00.000Z',
          destination: { payment_rail: 'stellar' },
          status: 'active',
        },
      });
    });

    it('should return bridge response as-is when id is missing', async () => {
      const bridgeResponse = {
        status: 'pending',
      };

      bridgeClient.post.mockResolvedValue(bridgeResponse);

      const result = await service.createVirtualAccount(dto);

      expect(result).toEqual(bridgeResponse);
    });

    it('should return null when bridge returns null', async () => {
      bridgeClient.post.mockResolvedValue(null);

      const result = await service.createVirtualAccount(dto);

      expect(result).toBeNull();
    });
  });
});

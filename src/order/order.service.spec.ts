import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BridgeVirtualAccountService } from '../bridge-virtual-account/bridge-virtual-account.service';
import { WebhookQueue } from '../queue/queue.constants';
import { StellarService } from '../stellar/stellar.service';
import { StellarTransactionEntity } from '../stellar-transaction/stellar-transaction.entity';
import { WebhookEntity, WebhookStatus } from '../webhook/webhook.entity';
import { OrderEntity, OrderStatus, ServiceType } from './order.entity';
import { OrderService } from './order.service';

const PLATFORM = 'GPLATFORMADDRESS000000000000000000000000000000000000000';
const ISSUER = 'GISSUERADDRESS00000000000000000000000000000000000000000';

describe('OrderService createOrder', () => {
  let service: OrderService;
  let orderRepo: { findOne: jest.Mock; save: jest.Mock };
  let stellarTransactionRepo: { findOne: jest.Mock; save: jest.Mock };
  let webhookRepo: { findOne: jest.Mock };
  let webhookQueue: { add: jest.Mock };
  let stellarService: { findPaymentsMatchingMemo: jest.Mock };

  const dto = {
    reference: 'ord-live-1',
    fait_amount: 15000,
    asset_amount: 10.5,
    fait_currency: 'NGN',
  };

  const responseKeys = [
    'reference',
    'memo',
    'public_address',
    'asset_amount',
    'fait_amount',
    'currency',
    'network',
    'fait_currency',
    'asset_code',
    'asset_issuer',
    'memo_type',
    'sep7_uri',
  ];

  function pendingOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
    return {
      id: 'order-1',
      reference: dto.reference,
      memo: '87654321',
      publicAddress: PLATFORM,
      assetAmount: '10.500000',
      faitAmount: '15000.00',
      currency: 'usdc',
      network: 'stellar',
      faitCurrency: 'NGN',
      paidAmount: '0',
      status: OrderStatus.PENDING,
      serviceType: ServiceType.STELLAR,
      ...overrides,
    } as OrderEntity;
  }

  beforeEach(async () => {
    process.env.STELLAR_PUBLIC_KEY = PLATFORM;
    process.env.STELLAR_USDC_ISSUER = ISSUER;
    delete process.env.STELLAR_CREATE_RECONCILE_TIMEOUT_MS;

    orderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (order: OrderEntity) => ({ ...order, id: order.id ?? 'order-new' })),
    };
    stellarTransactionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (tx) => tx),
    };
    webhookRepo = { findOne: jest.fn().mockResolvedValue(null) };
    webhookQueue = { add: jest.fn().mockResolvedValue(undefined) };
    stellarService = { findPaymentsMatchingMemo: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(StellarTransactionEntity), useValue: stellarTransactionRepo },
        { provide: getRepositoryToken(WebhookEntity), useValue: webhookRepo },
        { provide: getQueueToken(WebhookQueue.name), useValue: webhookQueue },
        { provide: DataSource, useValue: {} },
        { provide: BridgeVirtualAccountService, useValue: {} },
        { provide: StellarService, useValue: stellarService },
      ],
    }).compile();

    service = module.get(OrderService);
  });

  it('creates a new order without scanning Horizon', async () => {
    const started = Date.now();
    const result = await service.createOrder(dto);

    expect(Date.now() - started).toBeLessThan(1000);
    expect(stellarService.findPaymentsMatchingMemo).not.toHaveBeenCalled();
    expect(orderRepo.save).toHaveBeenCalledTimes(1);
    expect(result.message).toBe('Order created successfully');
    expect(Object.keys(result.data).sort()).toEqual([...responseKeys].sort());
    expect(result.data.reference).toBe(dto.reference);
    expect(result.data.memo).toMatch(/^\d{8}$/);
    expect(result.data.public_address).toBe(PLATFORM);
    expect(result.data.asset_amount).toBe(String(dto.asset_amount));
    expect(result.data.fait_amount).toBe(String(dto.fait_amount));
    expect(result.data.currency).toBe('usdc');
    expect(result.data.network).toBe('stellar');
    expect(result.data.fait_currency).toBe('NGN');
    expect(result.data.memo_type).toBe('MEMO_TEXT');
    expect(result.data.asset_code).toBe('USDC');
    expect(result.data.asset_issuer).toBe(ISSUER);
    expect(result.data.sep7_uri).toContain(`memo=${result.data.memo}`);
  });

  it('returns the stored order for an existing reference and still reconciles a matching payment', async () => {
    const existing = pendingOrder();
    orderRepo.findOne.mockImplementation(async (query: { where?: { reference?: string; id?: string } }) => {
      if (query?.where?.reference) {
        return existing;
      }
      if (query?.where?.id) {
        return pendingOrder({ status: OrderStatus.PAID, paidAmount: '10.500000' });
      }
      return null;
    });
    stellarService.findPaymentsMatchingMemo.mockResolvedValue([
      {
        transactionHash: 'tx-paid',
        amount: '10.500000',
        memo: existing.memo,
        currency: 'USDC',
        from: 'GPAYER',
        to: PLATFORM,
        createdAt: '2026-10-22T00:00:00Z',
      },
    ]);
    const apply = jest.spyOn(service, 'applyIncomingPayment').mockResolvedValue('paid');

    const started = Date.now();
    const result = await service.createOrder(dto);

    expect(Date.now() - started).toBeLessThan(1000);
    expect(orderRepo.save).not.toHaveBeenCalled();
    expect(stellarService.findPaymentsMatchingMemo).toHaveBeenCalledWith(PLATFORM, existing.memo, {
      assetCode: 'USDC',
    });
    expect(apply).toHaveBeenCalledWith(
      existing,
      expect.objectContaining({
        memo: existing.memo,
        currency: 'USDC',
        amount: '10.500000',
        transactionHash: 'tx-paid',
      }),
    );
    expect(webhookQueue.add).toHaveBeenCalled();
    expect(result.data.reference).toBe(existing.reference);
    expect(result.data.memo).toBe(existing.memo);
    expect(result.data.public_address).toBe(PLATFORM);
    expect(result.data.asset_amount).toBe(existing.assetAmount);
    expect(Object.keys(result.data).sort()).toEqual([...responseKeys].sort());
  });

  it('does not scan Horizon again when the existing order is already paid', async () => {
    orderRepo.findOne.mockResolvedValue(
      pendingOrder({ status: OrderStatus.PAID, paidAmount: '10.500000' }),
    );
    webhookRepo.findOne.mockResolvedValue({ status: WebhookStatus.SENT });

    const result = await service.createOrder(dto);

    expect(stellarService.findPaymentsMatchingMemo).not.toHaveBeenCalled();
    expect(result.data.memo).toBe('87654321');
    expect(result.data.reference).toBe(dto.reference);
  });

  it('returns the stored order when idempotent reconcile is slower than the deadline, then still applies the payment', async () => {
    process.env.STELLAR_CREATE_RECONCILE_TIMEOUT_MS = '40';
    const existing = pendingOrder();
    orderRepo.findOne.mockImplementation(async (query: { where?: { reference?: string; id?: string } }) => {
      if (query?.where?.reference) {
        return existing;
      }
      if (query?.where?.id) {
        return pendingOrder({ status: OrderStatus.PAID, paidAmount: '10.500000' });
      }
      return null;
    });

    let resolveLookup: (payments: unknown[]) => void = () => undefined;
    stellarService.findPaymentsMatchingMemo.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    const apply = jest.spyOn(service, 'applyIncomingPayment').mockResolvedValue('paid');

    const started = Date.now();
    const result = await service.createOrder(dto);

    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.data.memo).toBe(existing.memo);
    expect(result.data.public_address).toBe(PLATFORM);
    expect(apply).not.toHaveBeenCalled();

    resolveLookup([
      {
        transactionHash: 'tx-late',
        amount: '10.500000',
        memo: existing.memo,
        currency: 'USDC',
        from: 'GPAYER',
        to: PLATFORM,
        createdAt: null,
      },
    ]);
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(apply).toHaveBeenCalledWith(
      existing,
      expect.objectContaining({ transactionHash: 'tx-late', memo: existing.memo }),
    );
  });

  it('still returns the stored order when Horizon reconcile fails', async () => {
    const existing = pendingOrder();
    orderRepo.findOne.mockResolvedValue(existing);
    stellarService.findPaymentsMatchingMemo.mockRejectedValue(new Error('horizon timeout'));

    const result = await service.createOrder(dto);

    expect(result.data.memo).toBe(existing.memo);
    expect(result.data.public_address).toBe(existing.publicAddress);
    expect(result.data.reference).toBe(existing.reference);
  });
});

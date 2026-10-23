import { Test, TestingModule } from '@nestjs/testing';
import { StellarService } from './stellar.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { IncomingTransactionQueue } from '../queue/queue.constants';
import { StellarListenerStateService } from '../stellar-listener-state/stellar-listener-state.service';
import { DataSource } from 'typeorm';

describe('StellarService', () => {
  let service: StellarService;
  let walletRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    walletRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const values: Record<string, string> = {
                STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
                STELLAR_NETWORK: 'TESTNET',
                STELLAR_PUBLIC_KEY: '',
                STELLAR_SECRET_KEY: 'STESTPLATFORMSECRETKEY1234567890123456789012345678901234567',
                STELLAR_USDC_ISSUER: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
              };

              return values[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: getQueueToken(IncomingTransactionQueue.name),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: StellarListenerStateService,
          useValue: {
            getResumeCursor: jest.fn().mockResolvedValue('now'),
            updateCursor: jest.fn().mockResolvedValue({}),
            getListenerState: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn(() => walletRepo),
          },
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate key pair and print to console', () => {
    const wallet = service.generateWallet();

    console.log('Generated Stellar key pair:', wallet);

    expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(wallet.secret).toMatch(/^S[A-Z2-7]{55}$/);
  });

  it('should fund test USDC to wallet with user_id user_12345', async () => {
    walletRepo.findOne.mockResolvedValue({
      publicKey: 'GUSER12345PUBLICKEY1234567890123456789012345678901234567',
    });

    const sendPaymentSpy = jest
      .spyOn(service, 'sendPayment')
      .mockResolvedValue('tx-usdc-test-123');
    jest
      .spyOn(service as any, 'ensureTestnetDestinationAccount')
      .mockResolvedValue(undefined);

    const result = await service.fundTestnetWalletByUserId('user_12345', {
      assetCode: 'USDC',
      amount: '25',
    });

    expect(walletRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user_12345' },
      select: ['publicKey'],
    });

    expect(sendPaymentSpy).toHaveBeenCalledWith(
      'STESTPLATFORMSECRETKEY1234567890123456789012345678901234567',
      'GUSER12345PUBLICKEY1234567890123456789012345678901234567',
      '25',
      {
        assetCode: 'USDC',
        assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        memo: 'fund-user_12345',
      },
    );

    expect(result).toEqual({
      userId: 'user_12345',
      publicKey: 'GUSER12345PUBLICKEY1234567890123456789012345678901234567',
      assetCode: 'USDC',
      amount: '25',
      txHash: 'tx-usdc-test-123',
    });
  });

  describe('findPaymentsMatchingMemo', () => {
    const account = 'GPLATFORMADDRESS000000000000000000000000000000000000000';
    const memo = '42424242';

    function payment(overrides: Record<string, unknown> = {}) {
      return {
        type: 'payment',
        transaction_hash: `hash-${Math.random().toString(16).slice(2)}`,
        from: 'GPAYER00000000000000000000000000000000000000000000000000',
        to: account,
        amount: '1.0000000',
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        created_at: '2026-10-22T12:00:00Z',
        transaction_attr: { memo: '00000000', created_at: '2026-10-22T12:00:00Z' },
        transaction: jest.fn(() => {
          throw new Error('joined transaction link must not be called');
        }),
        ...overrides,
      };
    }

    function mockHorizon(records: Array<Record<string, unknown>>, transactionRecords?: Array<Record<string, unknown>>) {
      const paymentsCall = jest.fn().mockResolvedValue({ records });
      const payments = {
        forAccount: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        call: paymentsCall,
      };
      const perTransaction = jest.fn(() => {
        throw new Error('sequential Horizon transaction fetch');
      });
      const transactionsCall = jest.fn().mockResolvedValue({ records: transactionRecords ?? [] });
      const transactions = {
        transaction: perTransaction,
        forAccount: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        call: transactionsCall,
      };
      const server = (service as any).server;
      jest.spyOn(server, 'payments').mockReturnValue(payments);
      jest.spyOn(server, 'transactions').mockReturnValue(transactions);
      return { payments, paymentsCall, transactions, transactionsCall, perTransaction };
    }

    it('reads memos from one joined payments page and does not fetch each transaction', async () => {
      const match = payment({
        transaction_hash: 'hash-match',
        amount: '12.5000000',
        transaction_attr: { memo, memo_type: 'text', created_at: '2026-10-22T12:01:00Z' },
      });
      const records = [
        payment({ type: 'create_account', transaction_hash: 'hash-create', transaction_attr: { memo } }),
        payment({ to: 'GSOMEONEELSE', transaction_hash: 'hash-out', transaction_attr: { memo } }),
        payment({ asset_code: 'XLM', asset_type: 'native', transaction_hash: 'hash-xlm', transaction_attr: { memo } }),
        ...Array.from({ length: 180 }, (_, index) =>
          payment({ transaction_hash: `hash-usdc-${index}`, transaction_attr: { memo: String(10000000 + index) } }),
        ),
        match,
        payment({
          type: 'path_payment_strict_receive',
          transaction_hash: 'hash-path',
          amount: '3.0000000',
          transaction_attr: { memo, created_at: '2026-10-22T12:02:00Z' },
        }),
      ];
      const horizon = mockHorizon(records);

      const matches = await service.findPaymentsMatchingMemo(account, memo);

      expect(horizon.payments.forAccount).toHaveBeenCalledWith(account);
      expect(horizon.payments.order).toHaveBeenCalledWith('desc');
      expect(horizon.payments.limit).toHaveBeenCalledWith(200);
      expect(horizon.payments.join).toHaveBeenCalledWith('transactions');
      expect(horizon.paymentsCall).toHaveBeenCalledTimes(1);
      expect(horizon.transactions.forAccount).not.toHaveBeenCalled();
      expect(horizon.perTransaction).not.toHaveBeenCalled();
      for (const record of records) {
        expect(record.transaction).not.toHaveBeenCalled();
      }
      expect(matches).toEqual([
        {
          transactionHash: 'hash-match',
          amount: '12.5000000',
          memo,
          currency: 'USDC',
          from: match.from,
          to: account,
          createdAt: '2026-10-22T12:00:00Z',
        },
        {
          transactionHash: 'hash-path',
          amount: '3.0000000',
          memo,
          currency: 'USDC',
          from: match.from,
          to: account,
          createdAt: '2026-10-22T12:00:00Z',
        },
      ]);
    });

    it('uses a plain embedded transaction object when the SDK has not rewritten it', async () => {
      const horizon = mockHorizon([
        payment({
          transaction_hash: 'hash-plain',
          amount: '4.0000000',
          transaction_attr: undefined,
          transaction: { memo: ` ${memo} `, created_at: '2026-10-22T13:00:00Z' },
          created_at: undefined,
        }),
      ]);

      const matches = await service.findPaymentsMatchingMemo(account, memo, { assetCode: 'usdc', limit: 50 });

      expect(horizon.payments.limit).toHaveBeenCalledWith(50);
      expect(horizon.transactions.forAccount).not.toHaveBeenCalled();
      expect(matches).toEqual([
        expect.objectContaining({
          transactionHash: 'hash-plain',
          memo,
          amount: '4.0000000',
          createdAt: '2026-10-22T13:00:00Z',
        }),
      ]);
    });

    it('falls back to one transactions page when memos were not joined, never per payment', async () => {
      const records = Array.from({ length: 183 }, (_, index) =>
        payment({
          transaction_hash: `hash-${index}`,
          amount: index === 90 ? '9.0000000' : '1.0000000',
          created_at: undefined,
          transaction_attr: undefined,
          transaction: jest.fn(async () => ({ memo })),
        }),
      );
      const horizon = mockHorizon(
        records,
        records.map((record, index) => ({
          hash: record.transaction_hash,
          memo: index === 90 ? memo : '11111111',
          created_at: '2026-10-21T00:00:00Z',
        })),
      );

      const matches = await service.findPaymentsMatchingMemo(account, memo);

      expect(horizon.paymentsCall).toHaveBeenCalledTimes(1);
      expect(horizon.transactions.forAccount).toHaveBeenCalledTimes(1);
      expect(horizon.transactionsCall).toHaveBeenCalledTimes(1);
      expect(horizon.perTransaction).not.toHaveBeenCalled();
      for (const record of records) {
        expect(record.transaction).not.toHaveBeenCalled();
      }
      expect(matches).toEqual([
        expect.objectContaining({
          transactionHash: 'hash-90',
          amount: '9.0000000',
          memo,
          createdAt: '2026-10-21T00:00:00Z',
        }),
      ]);
    });

    it('does not call Horizon when the memo or account is blank', async () => {
      const horizon = mockHorizon([]);

      await expect(service.findPaymentsMatchingMemo(account, '   ')).resolves.toEqual([]);
      await expect(service.findPaymentsMatchingMemo('', memo)).resolves.toEqual([]);
      expect(horizon.paymentsCall).not.toHaveBeenCalled();
    });
  });
});


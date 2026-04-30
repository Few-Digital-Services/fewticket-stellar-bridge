import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import { WalletEntity, WalletType } from './wallet.entity';
import { StellarService } from '../stellar/stellar.service';
import { WalletBalanceEntity } from './wallet-balance.entity';
import { OrderService } from '../order/order.service';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: jest.Mocked<Partial<Repository<WalletEntity>>>;
  let walletBalanceRepo: jest.Mocked<Partial<Repository<WalletBalanceEntity>>>;
  let dataSource: { transaction: jest.Mock };
  let configService: { get: jest.Mock };
  let stellarService: {
    generateWallet: jest.Mock;
    getWalletBalances: jest.Mock;
    sendPayment: jest.Mock;
  };
  let orderService: { createOrder: jest.Mock };

  beforeEach(async () => {
    walletRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    walletBalanceRepo = {
      find: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'WALLET_SECRET_ENCRYPTION_KEY') {
          return 'test-wallet-secret';
        }

        if (key === 'STELLAR_PUBLIC_KEY') {
          return 'GTESTPLATFORMPUBLICKEY1234567890123456789012345678901234';
        }

        if (key === 'STELLAR_USDC_ISSUER') {
          return 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
        }

        return undefined;
      }),
    };

    stellarService = {
      generateWallet: jest.fn().mockReturnValue({
        publicKey: 'GTESTPUBLICKEY1234567890123456789012345678901234567890123',
        secret: 'STESTSECRETKEY1234567890123456789012345678901234567890123',
      }),
      getWalletBalances: jest.fn().mockResolvedValue({
        xlm: '0',
        usdc: '0',
      }),
      sendPayment: jest.fn().mockResolvedValue('tx-test-hash-123'),
    };

    orderService = {
      createOrder: jest.fn().mockResolvedValue({
        message: 'Order created successfully',
        data: {
          reference: 'ORD-12345',
          memo: '12345678',
          public_address: 'GTESTPLATFORMPUBLICKEY1234567890123456789012345678901234',
          asset_amount: '10',
          fait_amount: '16000',
          currency: 'usdc',
          network: 'stellar',
          fait_currency: 'NGN',
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: StellarService,
          useValue: stellarService,
        },
        {
          provide: OrderService,
          useValue: orderService,
        },
        {
          provide: getRepositoryToken(WalletEntity),
          useValue: walletRepo,
        },
        {
          provide: getRepositoryToken(WalletBalanceEntity),
          useValue: walletBalanceRepo,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should create a stellar wallet and initialize wallet balances', async () => {
    const now = new Date();
    const savedWallet = {
      id: 'wallet-1',
      userId: 'user-1',
      publicKey: 'GTESTPUBLICKEY1234567890123456789012345678901234567890123',
      secretKey: 'iv:encrypted',
      network: 'stellar',
      type: WalletType.USER,
      lastBalanceSyncAt: now,
    } as WalletEntity;

    (walletRepo.findOne as jest.Mock).mockResolvedValue(null);
    stellarService.getWalletBalances.mockResolvedValue({
      XLM: '0.00000000',
      USDC: '0.00000000',
    });

    dataSource.transaction.mockImplementation(async (callback) => {
      const manager = {
        create: jest.fn((entity, payload) => payload),
        save: jest
          .fn()
          .mockResolvedValueOnce(savedWallet)
          .mockResolvedValueOnce(undefined),
      };

      return callback(manager);
    });

    const result = await service.createUserWallet({
      userId: 'user-1',
      network: 'stellar',
    });

    expect(walletRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', network: 'stellar' },
    });
    expect(stellarService.generateWallet).toHaveBeenCalled();
    expect(stellarService.getWalletBalances).toHaveBeenCalledWith(
      'GTESTPUBLICKEY1234567890123456789012345678901234567890123',
    );
    expect(dataSource.transaction).toHaveBeenCalled();

    expect(result).toEqual({
      message: 'Wallet created successfully',
      data: {
        id: 'wallet-1',
        user_id: 'user-1',
        public_key: 'GTESTPUBLICKEY1234567890123456789012345678901234567890123',
        network: 'stellar',
        type: WalletType.USER,
        balances: {
          XLM: '0.00000000',
          USDC: '0.00000000',
        },
        last_balance_sync_at: now,
      },
    });
  });

  it('should reject unsupported networks', async () => {
    await expect(
      service.createUserWallet({
        userId: 'user-1',
        network: 'tron',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(stellarService.generateWallet).not.toHaveBeenCalled();
    expect(stellarService.getWalletBalances).not.toHaveBeenCalled();
  });

  it('should fund user_12345 wallet payment with test USDC', async () => {
    const walletSecret = 'SBTESTUSERSECRET1234567890123456789012345678901234567890123';
    const encryptedSecret = (service as any).encryptSecretKey(walletSecret);

    (walletRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'wallet-user-12345',
      userId: 'user_12345',
      publicKey: 'GUSER12345PUBLICKEY12345678901234567890123456789012345',
      secretKey: encryptedSecret,
      network: 'stellar',
      type: WalletType.USER,
      balances: [{ currency: 'USDC', balance: '100.000000' }],
    } as unknown as WalletEntity);

    const result = await service.payWithWalletOrder({
      userId: 'user_12345',
      reference: 'ORD-12345',
      asset_amount: 10,
      fait_amount: 16000,
      fait_currency: 'NGN',
      currency: 'USDC',
    });

    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'ORD-12345',
        asset_amount: 10,
        currency: 'USDC',
      }),
    );

    expect(stellarService.sendPayment).toHaveBeenCalledWith(
      walletSecret,
      'GTESTPLATFORMPUBLICKEY1234567890123456789012345678901234',
      '10',
      {
        assetCode: 'USDC',
        assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        memo: '12345678',
      },
    );

    expect(result).toEqual({
      message:
        'Payment submitted successfully. Order will be confirmed on blockchain confirmation.',
      data: {
        reference: 'ORD-12345',
        memo: '12345678',
        public_address: 'GTESTPLATFORMPUBLICKEY1234567890123456789012345678901234',
        asset_amount: '10',
        fait_amount: '16000',
        currency: 'usdc',
        network: 'stellar',
        fait_currency: 'NGN',
        tx_hash: 'tx-test-hash-123',
      },
    });
  });
});
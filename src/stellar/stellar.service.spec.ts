import { Test, TestingModule } from '@nestjs/testing';
import { StellarService } from './stellar.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { IncomingTransactionQueue } from '../queue/queue.constants';
import { StellarListenerStateService } from '../stellar-listener-state/stellar-listener-state.service';

describe('StellarService', () => {
  let service: StellarService;

  beforeEach(async () => {
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
});


import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BridgeModule } from './bridge/bridge.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GlobalThrottleGuard } from './common/guard/global-throttle.guard';
import { ResponseInterceptor } from './common/interfaces/response.interceptor';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { QueueModule } from './queue/queue.module';
import { QueueDashboardModule } from './queue/queue-dashboard.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarModule } from './stellar/stellar.module';
import { OrderModule } from './order/order.module';
import { StellarTransactionModule } from './stellar-transaction/stellar-transaction.module';
import { WalletModule } from './wallet/wallet.module';
import { BridgeTransactionModule } from './bridge-transaction/bridge-transaction.module';
import { BridgeVirtualAccountModule } from './bridge-virtual-account/bridge-virtual-account.module';
import { BridgeWebhookModule } from './bridge-webhook/bridge-webhook.module';

type RuntimeEnvironment = 'sandbox' | 'live';

const resolveEnvFilePaths = (): string[] => {
  const rawEnv = String(process.env.APP_ENV ?? 'sandbox').toLowerCase();
  const runtimeEnv: RuntimeEnvironment = rawEnv === 'live' ? 'live' : 'sandbox';

  return [
    `.env.${runtimeEnv}`,
    'src/.env',
    '.env',
  ];
};

const buildDatabaseOptions = (configService: ConfigService) => {
  const dbPort = Number(configService.get<string>('DB_PORT', '3306'));

      const dbAutoSyncRaw = configService.get<string>('DB_SYNC') || '';
        const dbAutoSync = ['true', '1', 'yes', 'on'].includes(
          dbAutoSyncRaw.trim().toLowerCase(),
        );

  return {
    type: 'mysql' as const,
    host: configService.get<string>('DB_HOST', '127.0.0.1'),
    port: Number.isNaN(dbPort) ? 3306 : dbPort,
    username: configService.get<string>('DB_USERNAME', 'root'),
    password: configService.get<string>('DB_PASSWORD', ''),
    database: configService.get<string>('DB_DATABASE', 'fewticket_stellar'),
    synchronize: dbAutoSync,
    autoLoadEntities: true,
    migrationsRun: true,
  };
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePaths(),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          ...buildDatabaseOptions(configService),
          autoLoadEntities: true,
        };
      },
    }),
    AuthModule,
    BridgeModule,
    QueueModule,
    QueueDashboardModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 10,
        },
      ],
    }),
    StellarModule,
    OrderModule,
    StellarTransactionModule,
    WalletModule,
    BridgeTransactionModule,
    BridgeVirtualAccountModule,
    BridgeWebhookModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: GlobalThrottleGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}

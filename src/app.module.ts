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
import { StellarOrderModule } from './stellar-order/stellar-order.module';
import { StellarTransactionModule } from './stellar-transaction/stellar-transaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['src/.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbPort = Number(configService.get<string>('DB_PORT', '3306'));

        return {
          type: 'mysql' as const,
          host: configService.get<string>('DB_HOST', '127.0.0.1'),
          port: Number.isNaN(dbPort) ? 3306 : dbPort,
          username: configService.get<string>('DB_USERNAME', 'root'),
          password: configService.get<string>('DB_PASSWORD', ''),
          database: configService.get<string>('DB_DATABASE', 'fewticket_stellar'),
          autoLoadEntities: true,
          synchronize: configService.get<string>('DB_SYNC', 'false') === 'true',
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
    StellarOrderModule,
    StellarTransactionModule,
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

import { Body, Controller, Get, Param, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { SystemOauth2Guard } from 'src/common/guard/systemOauth2.guard';
import { SkipResponseInterceptor } from 'src/common/interfaces/skip-response-interceptor';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateCustomerDto } from './dto/create-customer-dto';
import { CreateVirtualAccountDto } from './dto/create-virtual-accountd.dto';
import { CreateBridgeWalletDto } from './dto/create-bridge-wallet.dto';
import { GetVirtualAccountActivityDto } from './dto/get-virtual-account-activity.dto';
import { GetBridgeWalletTransactionHistoryDto } from './dto/get-bridge-wallet-transaction-history.dto';

@UseGuards(SystemOauth2Guard)
@Controller('bridge')
@ApiTags('v1/bridge')
@ApiBearerAuth('access-token')
export class BridgeController {

constructor(private readonly bridgeService: BridgeService) {}

  @Post('customers/create')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({ summary: 'Create a new individual customer' })
  @ApiResponse({
    status: 200,
    description: 'Customer created successfully',
  })
  async createCustomer(@Body() payload:CreateCustomerDto) {
    return this.bridgeService.createIndividualCustomer(payload);
  }


 @Post('customers/create-virtual-account')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({ summary: 'Create a new virtual account' })
  @ApiResponse({
    status: 200,
    description: 'Virtual account created successfully',
  })
  async createVirtualAccount(@Body() payload:CreateVirtualAccountDto) {
    return this.bridgeService.createVirtualAccount(payload);
  }

  @Post('customers/create-bridge-wallet')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @ApiOperation({ summary: 'Create a new bridge wallet for a customer' })
  @ApiResponse({
    status: 200,
    description: 'Bridge wallet created successfully',
  })
  async createBridgeWallet(@Body() payload: CreateBridgeWalletDto) {
    return this.bridgeService.createBridgeWallet(payload);
  }

  @Get('customers/:customerId/wallets/:bridgeWalletId')
  @ApiOperation({ summary: 'Get a bridge wallet for a customer' })
  @ApiParam({ name: 'customerId', description: 'Bridge customer ID' })
  @ApiParam({ name: 'bridgeWalletId', description: 'Bridge wallet ID' })
  @ApiResponse({
    status: 200,
    description: 'Bridge wallet retrieved successfully',
  })
  async getBridgeWallet(
    @Param('customerId') customerId: string,
    @Param('bridgeWalletId') bridgeWalletId: string,
  ) {
    return this.bridgeService.getBridgeWallet({
      customerId,
      bridgeWalletId,
    });
  }

  @Get('wallets/:bridgeWalletId/history')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Get transaction history for a bridge wallet' })
  @ApiParam({ name: 'bridgeWalletId', description: 'Bridge wallet ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max records to return' })
  @ApiQuery({ name: 'updatedAfterMs', required: false, description: 'Lower bound unix ms filter' })
  @ApiQuery({ name: 'updatedBeforeMs', required: false, description: 'Upper bound unix ms filter' })
  @ApiResponse({
    status: 200,
    description: 'Bridge wallet transaction history retrieved successfully',
  })
  async getBridgeWalletTransactionHistory(
    @Param('bridgeWalletId') bridgeWalletId: string,
    @Query() query: GetBridgeWalletTransactionHistoryDto,
  ) {
    return this.bridgeService.getBridgeWalletTransactionHistory({
      bridgeWalletId,
      limit: query.limit,
      updatedAfterMs: query.updatedAfterMs,
      updatedBeforeMs: query.updatedBeforeMs,
    });
  }

  @Get('customers/:customerId/virtual-accounts/:virtualAccountId/activity')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Get activity for a customer virtual account' })
  @ApiParam({ name: 'customerId', description: 'Bridge customer ID' })
  @ApiParam({ name: 'virtualAccountId', description: 'Virtual account ID' })
  @ApiQuery({ name: 'depositId', required: false, description: 'Filter by a single deposit ID' })
  @ApiQuery({ name: 'depositIds', required: false, description: 'Comma-separated or repeated deposit IDs' })
  @ApiQuery({ name: 'txHash', required: false, description: 'Filter by blockchain transaction hash' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max records to return' })
  @ApiQuery({ name: 'startingAfter', required: false, description: 'Pagination cursor for forward paging' })
  @ApiQuery({ name: 'endingBefore', required: false, description: 'Pagination cursor for backward paging' })
  @ApiQuery({ name: 'eventType', required: false, description: 'Filter by event type' })
  @ApiResponse({
    status: 200,
    description: 'Virtual account activity retrieved successfully',
  })
  async getVirtualAccountActivity(
    @Param('customerId') customerId: string,
    @Param('virtualAccountId') virtualAccountId: string,
    @Query() query: GetVirtualAccountActivityDto,
  ) {
    const rawDepositIds = query.depositIds as unknown;
    const depositIds = Array.isArray(rawDepositIds)
      ? rawDepositIds
      : typeof rawDepositIds === 'string'
        ? rawDepositIds.split(',').map((value) => value.trim()).filter(Boolean)
        : undefined;

    return this.bridgeService.getVirtualAccountActivity({
      customerId,
      virtualAccountId,
      depositId: query.depositId,
      depositIds,
      txHash: query.txHash,
      limit: query.limit,
      startingAfter: query.startingAfter,
      endingBefore: query.endingBefore,
      eventType: query.eventType,
    });
  }
}

import { Body, Controller, Get, Post, UseGuards, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateStellarOrderDto } from './dto/create-stellar-order.dto';
import { VerifyOrderTransactionDto } from './dto/verify-order-transaction.dto';
import { SystemOauth2Guard } from '../common/guard/systemOauth2.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateBridgeVirtualAccountOrderDto } from './dto/create-bridge-virtual-account-order.dto';
import { MatchUnmatchedCreditDto } from './dto/match-unmatched-credit.dto';

@UseGuards(SystemOauth2Guard)
@Controller('order')
@ApiTags('Orders')
@ApiBearerAuth('access-token')
export class OrderController {
	
	constructor(private readonly orderService: OrderService) {}

	@Get('stellar/unmatched-credits')
	@ApiOperation({
		summary: 'List unmatched incoming credits',
		description:
			'Incoming payments to the platform account that are not linked to any order (missing or wrong memo). For admin recovery.',
	})
	listUnmatchedCredits(
		@Query('currency') currency?: string,
		@Query('limit') limit?: string,
	) {
		return this.orderService.listUnmatchedCredits({ currency, limit: limit ? Number(limit) : undefined });
	}

	@Post('stellar/:reference/match-credit')
	@ApiOperation({
		summary: 'Admin: link an unmatched credit to an order',
		description:
			'Links an unmatched on-chain credit to a Stellar order, recomputes paid_amount and dispatches the paid webhook when fully paid.',
	})
	@ApiBody({ type: MatchUnmatchedCreditDto })
	matchUnmatchedCredit(
		@Param('reference') reference: string,
		@Body() dto: MatchUnmatchedCreditDto,
	) {
		return this.orderService.matchUnmatchedCredit(reference, dto.transaction_hash, dto.matched_by);
	}

	@Post('stellar')
	@ApiOperation({
		summary: 'Create a Stellar payment order',
		description:
			'Creates a Stellar order with a generated memo and platform receiving address for payment reconciliation.',
	})
	@ApiBody({ type: CreateStellarOrderDto })
	@ApiResponse({
		status: 201,
		description: 'Stellar order created successfully.',
	})
	@ApiResponse({
		status: 401,
		description: 'Missing or invalid bearer token.',
	})
	createOrder(@Body() dto: CreateStellarOrderDto) {
		return this.orderService.createOrder(dto);
	}

	@Get('stellar/:reference/diagnostics')
	@ApiOperation({
		summary: 'Get Stellar order diagnostics',
		description:
			'Returns bridge order state, on-chain memo matches, and webhook metadata for payment troubleshooting.',
	})
	@ApiResponse({
		status: 200,
		description: 'Diagnostics retrieved successfully.',
	})
	async getStellarOrderDiagnostics(@Param('reference') reference: string) {
		return this.orderService.getStellarOrderDiagnostics(reference);
	}

	@Post('stellar/:reference/verify-transaction')
	@ApiOperation({
		summary: 'Verify transaction for an order',
		description:
			'Verifies that a transaction has been completed for the given order reference. Called by Laravel before processing tickets.',
	})
	@ApiResponse({
		status: 200,
		description: 'Transaction verified successfully.',
	})
	@ApiResponse({
		status: 400,
		description: 'Order not found or transaction not verified.',
	})
	async verifyTransaction(
		@Param('reference') reference: string,
		@Body() dto: VerifyOrderTransactionDto,
	) {
		return this.orderService.verifyTransaction(reference, dto);
	}

	
	@Post('bridge/virtual-account')
	@ApiOperation({
		summary: 'Create a Bridge virtual account payment order',
		description:
			'Creates a Bridge virtual account order with a generated memo and platform receiving address for payment reconciliation.',
	})
	@ApiBody({ type: CreateBridgeVirtualAccountOrderDto })
	@ApiResponse({
		status: 201,
		description: 'Bridge virtual account order created successfully.',
	})
	@ApiResponse({
		status: 401,
		description: 'Missing or invalid bearer token.',
	})
	createVirtualAccountOrder(@Body() dto: CreateBridgeVirtualAccountOrderDto) {
		return this.orderService.createBridgeVirtualAccountOrder(dto);
	}

	@Post('bridge/virtual-account/:reference/verify-transaction')
	@ApiOperation({
		summary: 'Verify transaction for a Bridge virtual account order',
		description:
			'Verifies that a transaction has been completed for the given Bridge virtual account order reference. Called by Laravel before processing tickets.',
	})
	@ApiResponse({
		status: 200,
		description: 'Transaction verified successfully.',
	})
	@ApiResponse({
		status: 400,
		description: 'Order not found or transaction not verified.',
	})
	async verifyVirtualAccountTransaction(
		@Param('reference') reference: string,
		@Body() dto: VerifyOrderTransactionDto,
	) {
		return this.orderService.verifyTransaction(reference, dto);
	}
}

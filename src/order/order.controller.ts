import { Body, Controller, Post, UseGuards, Param } from '@nestjs/common';
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

@UseGuards(SystemOauth2Guard)
@Controller('order')
@ApiTags('Orders')
@ApiBearerAuth('access-token')
export class OrderController {
	
	constructor(private readonly orderService: OrderService) {}

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

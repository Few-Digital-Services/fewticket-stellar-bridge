import { Body, Controller, Post, UseGuards, Param } from '@nestjs/common';
import { StellarOrderService } from './stellar-order.service';
import { CreateStellarOrderDto } from './dto/create-stellar-order.dto';
import { VerifyStellarTransactionDto } from './dto/verify-stellar-transaction.dto';
import { SystemOauth2Guard } from '../common/guard/systemOauth2.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@UseGuards(SystemOauth2Guard)
@Controller('stellar-order')
@ApiTags('Stellar Orders')
@ApiBearerAuth('access-token')
export class StellarOrderController {
	constructor(private readonly stellarOrderService: StellarOrderService) {}

	@Post()
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
		return this.stellarOrderService.createOrder(dto);
	}

	@Post(':reference/verify-transaction')
	@ApiOperation({
		summary: 'Verify transaction for a Stellar order',
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
		@Body() dto: VerifyStellarTransactionDto,
	) {
		return this.stellarOrderService.verifyTransaction(reference, dto);
	}
}

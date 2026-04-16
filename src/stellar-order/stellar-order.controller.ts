import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StellarOrderService } from './stellar-order.service';
import { CreateStellarOrderDto } from './dto/create-stellar-order.dto';
import { SystemOauth2Guard } from 'src/common/guard/systemOauth2.guard';

@UseGuards(SystemOauth2Guard)
@Controller('stellar-order')
export class StellarOrderController {
	constructor(private readonly stellarOrderService: StellarOrderService) {}

	@Post()
	createOrder(@Body() dto: CreateStellarOrderDto) {
		return this.stellarOrderService.createOrder(dto);
	}
}

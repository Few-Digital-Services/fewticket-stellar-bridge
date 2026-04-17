import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Repository } from 'typeorm';
import {
	StellarOrderEntity,
	StellarOrderStatus,
} from './stellar-order.entity';
import { CreateStellarOrderDto } from './dto/create-stellar-order.dto';

type ApplyIncomingPaymentInput = {
	memo: string;
	currency: string;
	amount: string | number;
};

type ApplyIncomingPaymentResult =
	| 'paid'
	| 'partial_paid'
	| 'mismatch'
	| 'overpaid';

@Injectable()
export class StellarOrderService {
	constructor(
		@InjectRepository(StellarOrderEntity)
		private readonly stellarOrderRepo: Repository<StellarOrderEntity>,
	) {}

	findByMemoOrReference(memo: string) {
		return this.stellarOrderRepo.findOne({
			where: [{ memo }, { reference: memo }],
		});
	}


    
	async createOrder(dto: CreateStellarOrderDto) {
		const faitAmount = dto.fait_amount ?? dto.order_amount;

		if (!faitAmount) {
			throw new BadRequestException('fait amount is required');
		}

		const memo = await this.generateUniqueMemo();

		const order = new StellarOrderEntity();
		order.reference = dto.reference;
		order.faitAmount = String(faitAmount);
		order.assetAmount = String(dto.asset_amount);
		order.faitCurrency = dto.fait_currency;
		order.currency = 'usdc';
		order.network = 'stellar';
		order.publicAddress = process.env.STELLAR_PUBLIC_KEY;
		order.memo = memo;
		order.paidAmount = '0';
		order.status = StellarOrderStatus.PENDING;

		const savedOrder = await this.stellarOrderRepo.save(order);
        return {
            message: 'Order created successfully',
             data:{
            reference: savedOrder.reference,
            memo: savedOrder.memo,
            public_address: savedOrder.publicAddress,
            asset_amount: savedOrder.assetAmount,
            fait_amount: savedOrder.faitAmount,
            currency: savedOrder.currency,
            network: savedOrder.network,
            fait_currency: savedOrder.faitCurrency,
             }

        };
    
        
	}

	async markAsPaid(order: StellarOrderEntity) {
		order.paidAmount = String(order.assetAmount ?? '0');
		order.status = StellarOrderStatus.PAID;
		return this.stellarOrderRepo.save(order);
	}

	async applyIncomingPayment(
		order: StellarOrderEntity,
		input: ApplyIncomingPaymentInput,
	): Promise<ApplyIncomingPaymentResult> {
		const memo = String(input.memo ?? '').trim();
		const currency = String(input.currency ?? '').trim().toUpperCase();
		const expectedCurrency = String(order.currency ?? '').trim().toUpperCase();

		const memoMatches = memo === order.reference || memo === order.memo;
		if (!memoMatches || currency !== expectedCurrency) {
			return 'mismatch';
		}

		const currentPaidAmount = new Decimal(String(order.paidAmount ?? '0'));
		const incomingPaidAmount = new Decimal(String(input.amount ?? '0'));
		const paidAmount = currentPaidAmount.plus(incomingPaidAmount);
		const expectedAmount = new Decimal(String(order.assetAmount ?? '0'));

		order.paidAmount = paidAmount.toFixed(6);

		if (paidAmount.eq(expectedAmount)) {
			order.status = StellarOrderStatus.PAID;
			await this.stellarOrderRepo.save(order);
			return 'paid';
		}

		if (paidAmount.lt(expectedAmount)) {
			order.status = StellarOrderStatus.PARTIAL_PAID;
			await this.stellarOrderRepo.save(order);
			return 'partial_paid';
		}

		order.status = StellarOrderStatus.PAID;
		await this.stellarOrderRepo.save(order);

		return 'overpaid';
	}

	private async generateUniqueMemo(): Promise<string> {
		for (let attempt = 0; attempt < 10; attempt++) {
			const memo = Math.floor(10000000 + Math.random() * 90000000).toString();

			const existing = await this.stellarOrderRepo.findOne({
				where: { memo },
				select: ['id'],
			});

			if (!existing) {
				return memo;
			}
		}

		throw new BadRequestException('Unable to generate unique memo');
	}
}

import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FundTestnetWalletByUserIdDto } from './dto/fund-testnet-wallet-by-user-id.dto';
import { StellarService } from './stellar.service';

@ApiTags('Stellar')
@Controller('stellar')
export class StellarController {
	constructor(private readonly stellarService: StellarService) {}

	@Post('fund/testnet/user')
	@ApiOperation({
		summary: 'Fund a testnet wallet by user id',
		description:
			'Funds the user wallet on Stellar testnet. Uses Friendbot for XLM, and platform-funded transfer for USDC.',
	})
	@ApiBody({ type: FundTestnetWalletByUserIdDto })
	@ApiResponse({ status: 201, description: 'Testnet funding submitted successfully.' })
	@ApiResponse({ status: 400, description: 'Invalid asset or missing funding configuration.' })
	@ApiResponse({ status: 404, description: 'Wallet not found for user.' })
	fundTestnetWalletByUserId(@Body() dto: FundTestnetWalletByUserIdDto) {
		return this.stellarService.fundTestnetWalletByUserId(dto.user_id, {
			assetCode: dto.asset_code,
			amount: dto.amount,
		});
	}
}

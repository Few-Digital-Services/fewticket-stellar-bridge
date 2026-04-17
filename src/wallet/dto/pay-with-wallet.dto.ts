import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PayWithWalletDto {
  @ApiProperty({ description: 'User ID making the payment' })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ description: 'Unique order reference' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({ description: 'Amount to pay in the specified currency (e.g. 10.00)' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsNotEmpty()
  asset_amount: number;

  @ApiPropertyOptional({ description: 'Currency to pay with: USDC or XLM', default: 'USDC' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value ?? 'USDC').toUpperCase())
  currency?: string;

  @ApiPropertyOptional({ description: 'Fiat equivalent amount' })
  @IsOptional()
  fait_amount?: number;

  @ApiPropertyOptional({ description: 'Fiat currency code (e.g. USD, NGN)' })
  @IsOptional()
  @IsString()
  fait_currency?: string;
}

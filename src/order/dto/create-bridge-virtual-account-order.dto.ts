import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';
import type { VirtualAccountCurrency } from 'src/bridge-virtual-account/bridge-virtual-account.entity';

export class CreateBridgeVirtualAccountOrderDto {
  @ApiProperty({ example: 'ORD-20260416-001' })
  @IsString()
  @MaxLength(120)
  reference: string;

  @ApiPropertyOptional({
    example: '150.00',
    description: 'Backward-compatible alias for fait_amount',
  })


  @ApiProperty({ example: '150.00' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  fait_amount?: number;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  @MaxLength(10)
  fait_currency:  VirtualAccountCurrency;



}

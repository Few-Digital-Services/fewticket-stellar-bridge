import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStellarOrderDto {
  @ApiProperty({ example: 'ORD-20260416-001' })
  @IsString()
  @MaxLength(120)
  reference: string;

  @ApiPropertyOptional({
    example: '150.00',
    description: 'Backward-compatible alias for fait_amount',
  })
  @IsOptional()
  @IsNumberString()
  order_amount?: string;

  @ApiProperty({ example: '150.00' })
  @IsOptional()
  @IsNumberString()
  fait_amount?: string;

  @ApiProperty({ example: '125.348912' })
  @IsNumberString()
  asset_amount: string;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  @MaxLength(10)
  fait_currency: string;

//   @ApiPropertyOptional({ example: 'USDC', default: 'usdc' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(10)
//   currency?: string;

//   @ApiPropertyOptional({ example: 'stellar', default: 'stellar' })
//   @IsOptional()
//   @IsString()
//   @MaxLength(80)
//   network?: string;


}

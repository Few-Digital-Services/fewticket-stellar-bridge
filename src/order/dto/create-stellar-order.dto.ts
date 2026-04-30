import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStellarOrderDto {
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

  @ApiProperty({ example: '125.348912' })
  @IsNumber({ maxDecimalPlaces: 6 })
  asset_amount: number;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  @MaxLength(10)
  fait_currency: string;



}

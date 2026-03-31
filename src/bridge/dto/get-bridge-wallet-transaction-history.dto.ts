import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetBridgeWalletTransactionHistoryDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Number of history records to return (max 100)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example: 1711886512000,
    description: 'Return transactions updated after this unix ms timestamp',
  })
  @IsOptional()
  @IsInt()
  updatedAfterMs?: number;

  @ApiPropertyOptional({
    example: 1711896512000,
    description: 'Return transactions updated before this unix ms timestamp',
  })
  @IsOptional()
  @IsInt()
  updatedBeforeMs?: number;

  @ApiPropertyOptional({
    example: 'bw_123',
    description: 'Bridge wallet ID',
  })
  @IsOptional()
  @IsString()
  bridgeWalletId?: string;
}

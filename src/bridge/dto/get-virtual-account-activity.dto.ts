import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetVirtualAccountActivityDto {
  @ApiPropertyOptional({
    example: 'deposit_123',
    description: 'Filter events by a single deposit ID',
  })
  @IsOptional()
  @IsString()
  depositId?: string;

  @ApiPropertyOptional({
    example: ['deposit_123', 'deposit_456'],
    description: 'Filter events by multiple deposit IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  depositIds?: string[];

  @ApiPropertyOptional({
    example: '0xabc123',
    description: 'Filter events by blockchain transaction hash',
  })
  @IsOptional()
  @IsString()
  txHash?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of activity records to return (max 100)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example: 'va_event_100',
    description: 'Pagination cursor to fetch items after this event',
  })
  @IsOptional()
  @IsString()
  startingAfter?: string;

  @ApiPropertyOptional({
    example: 'va_event_200',
    description: 'Pagination cursor to fetch items before this event',
  })
  @IsOptional()
  @IsString()
  endingBefore?: string;

  @ApiPropertyOptional({
    example: 'funds_received',
    description: 'Filter by virtual account activity event type',
  })
  @IsOptional()
  @IsString()
  eventType?: string;
}

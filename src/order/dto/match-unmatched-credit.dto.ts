import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MatchUnmatchedCreditDto {
  @ApiProperty({ example: '45e1d9624a1daf5363b2874a85cf1a45f38655adacad85adae598d22a461c67e' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  transaction_hash: string;

  @ApiProperty({ example: 'admin:12 (ops@fewticket.com)', description: 'Who approved the match (for the audit trail).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  matched_by: string;
}

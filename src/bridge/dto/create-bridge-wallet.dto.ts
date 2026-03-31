import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { BridgeChain } from 'src/common/enums/bridge-chain.enum';

export class CreateBridgeWalletDto {
  @ApiProperty({
    example: 'txn-202020-0202',
    description: 'Unique request ID used for idempotency',
  })
  @IsNotEmpty()
  @IsString()
  transactionId: string;

  @ApiProperty({
    example: 'cust_2020200202',
    description: 'Bridge customer ID',
  })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty({
    example: BridgeChain.BASE,
    description: 'Blockchain network for the wallet',
    enum: BridgeChain,
  })
  @IsNotEmpty()
  @IsString()
  chain: BridgeChain;
}

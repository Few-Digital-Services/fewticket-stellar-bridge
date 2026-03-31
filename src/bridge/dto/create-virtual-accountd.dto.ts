//create dto for create virtual account read format from create customer dto and modify as needed
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from 'src/common/enums/currency.enum';
import { PaymentRail } from 'src/common/enums/payment-rail.enum';

export class CreateVirtualAccountDto {
    @ApiProperty({ example: 'uuid-202020-0202', description: 'Transaction ID for idempotency key' })
    @IsNotEmpty()
    @IsString()
    transactionId: string;

    @ApiProperty({ example: 'customer-uuid-202020-0202', description: 'Customer ID' })
    @IsNotEmpty()
    @IsString()
    customerId: string;

    @ApiProperty({ example: 'USD', description: 'Source currency' })
    @IsNotEmpty()
    @IsString()
    sourceCurrency: Currency;


    @ApiProperty({ example: 'USD', description: 'Destination currency' })
    @IsNotEmpty()
    @IsString()
    destinationCurrency: Currency;

    @ApiProperty({ example: 'BANK', description: 'Destination payment rail' })
    @IsNotEmpty()
    @IsString()
    destinationPaymentRail: PaymentRail;

}


import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerType } from 'src/common/enums/customer-type.enum';


export class CreateCustomerDto {

 @ApiProperty({ example: 'uuid-202020-0202', description: 'Customer Reference ID for idempotency key' })
  @IsNotEmpty()
  @IsString()
  customerReferenceId: string;

  @ApiProperty({ example: CustomerType.INDIVIDUAL, description: 'Customer Type' })
  @IsNotEmpty()
  @IsString()
  customerType: CustomerType;

  @ApiProperty({ example: '+1234567890', description: 'Customer Phone Number' })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'John', description: 'Customer First Name' })
  @IsString()
  firstName: string;

  
  @ApiProperty({ example: 'Doe', description: 'Customer Last Name' })
  @IsString()
  lastName: string;


     @ApiProperty({ example: '123 Main St', description: 'Street address' })
    @IsNotEmpty()
    @IsString()
    streetAddress: string;

    @ApiProperty({ example: 'New York', description: 'City' })
    @IsNotEmpty()
    @IsString()
    city: string;

    @ApiProperty({ example: 'NY', description: 'State' })
    @IsNotEmpty()
    @IsString()
    state: string;

    @ApiProperty({ example: '10001', description: 'Postal code' })
    @IsOptional()
    @IsString()
    postalCode: string;

    @ApiProperty({ example: 'USA', description: 'Country' })
    @IsNotEmpty()
    @IsString()
    country: string;


}

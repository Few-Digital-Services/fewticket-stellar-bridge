import { Injectable } from '@nestjs/common';
import { BridgeVirtualAccountEntity } from './bridge-virtual-account.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BridgeService } from 'src/bridge/bridge.service';
import { PaymentRail } from 'src/common/enums/payment-rail.enum';
import { Currency } from 'src/common/enums/currency.enum';

@Injectable()
export class BridgeVirtualAccountService {

    constructor(
        @InjectRepository(BridgeVirtualAccountEntity)
        private readonly bridgeVirtualAccountRepository: Repository<BridgeVirtualAccountEntity>,
        private readonly bridgeService: BridgeService,
    ) {}


 async generateVirtualAccountNumberForNewOrder(dto: { customerId: string; reference: string; faitCurrency: Currency; destinationCurrency: Currency; destinationPaymentRail: PaymentRail; blockchainMemo?: string; destinationAddress?: string }) {

        //check if there are inactive virtual accounts that can be reused
        const inactiveVirtualAccount = await this.bridgeVirtualAccountRepository.findOne({
            where: { status: 'inactive' },
        });
        if (inactiveVirtualAccount) {
            //reactivate the virtual account and return it
            const activatVirtualAccount = await this.bridgeService.activateVirtualAccount({
                virtualAccountId: inactiveVirtualAccount.id,
                customerId: dto.customerId,
                referenceId: dto.reference,
            });

            if(activatVirtualAccount){
                //update virtual account with new destination details

                const updatedVirtualAccount = await this.bridgeService.updateVirtualAccount({
                virtualAccountId: inactiveVirtualAccount.id,
                customerId: dto.customerId,
                destinationCurrency: dto.destinationCurrency,
                destinationPaymentRail: dto.destinationPaymentRail,
                 blockchainMemo: dto.blockchainMemo,
                 destinationAddress: dto.destinationAddress
                   
                });
                if (updatedVirtualAccount) {
                    return updatedVirtualAccount;
                }
            }
        }

    const generateVirtualAccount = await this.bridgeService.createVirtualAccount({
			transactionId: dto.reference,
			customerId: dto.customerId,
			sourceCurrency: dto.faitCurrency as any,
			destinationCurrency: dto.destinationCurrency as any,
			destinationPaymentRail: dto.destinationPaymentRail as any,
			blockchainMemo: dto.blockchainMemo,
			destinationAddress: dto.destinationAddress,
		});


        return generateVirtualAccount;

    }
}

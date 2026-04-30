import { Injectable } from '@nestjs/common';
import { BridgeClient } from './bridge.client';
import { CustomerType } from 'src/common/enums/customer-type.enum';
import { PaymentRail } from 'src/common/enums/payment-rail.enum';
import { Currency } from 'src/common/enums/currency.enum';
import { BridgeChain } from 'src/common/enums/bridge-chain.enum';

@Injectable()
export class BridgeService {
    constructor(private readonly bridgeClient: BridgeClient) {}



    async createIndividualCustomer(dto: {
        customerType: CustomerType;
        customerReferenceId: string;
        phoneNumber: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        streetAddress?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        
    }) {
        const body = {
            phone_number: dto.phoneNumber,
            email: dto.email,
            type: dto.customerType,
            first_name: dto.firstName,
            last_name: dto.lastName,
            residential_address: {
                street_line_1: dto.streetAddress,
                city: dto.city,
                subdivision: dto.state,
                postal_code: dto.postalCode,
                country: dto.country,


            },
             signed_agreement_id:"bf793288-9d9d-40ff-888a-12a8db96087c",
               birth_date: "1990-01-01",
                endorsements:['sepa','base','faster_payments'],
                account_purpose:'purchase_goods_and_services',
                employment_status:'self_employed',
                expected_monthly_payments_usd:"5000_9999",
                most_recent_occupation:"172021",
                nationality:"NGA"
           
        };

        const res = await this.bridgeClient.post('/customers', `create-customer-${dto.customerReferenceId}`, body);

        if (!res || !res.id) {
            return res;
        }

        const resData = {
            id: res.id,
            firstName: res.first_name,
            lastName: res.last_name,
            email: res.email,
            phoneNumber: res.phone_number,
            capabilities: res.capabilities,
            status: res.status,
        };

        return resData;
    }


    async createVirtualAccount(dto: {
        transactionId: string;
        customerId: string;
        sourceCurrency: Currency;
        destinationCurrency: Currency;
        destinationPaymentRail: PaymentRail;
        blockchainMemo?: string;
        destinationAddress?: string;
    }) {
        const body = {
            source: {
                currency: dto.sourceCurrency,
            },
            destination: {
                currency: dto.destinationCurrency,
                payment_rail: dto.destinationPaymentRail,
                address: dto.destinationAddress, 
                blockchain_memo: dto.blockchainMemo
            },
        };

        const res = await this.bridgeClient.post(`/customers/${dto.customerId}/virtual_accounts`, `txn-${dto.transactionId}`, body);

        if (!res || !res.id) {
            return res;
        }


        const resData = {
            id: res.id,
            customer_id: res.customer_id,
            instructons: res.source_deposit_instructions,
            created: res.created_at,
            destination: res.destination,
            status: res.status,
        };

        return resData;
    }


    
    async updateVirtualAccount(dto: {
        virtualAccountId: string;
        customerId: string;
        destinationCurrency: Currency;
        destinationPaymentRail: PaymentRail;
        blockchainMemo?: string;
        destinationAddress?: string;
    }) {
        const body = {
            destination: {
                currency: dto.destinationCurrency,
                payment_rail: dto.destinationPaymentRail,
                address: dto.destinationAddress, 
                blockchain_memo: dto.blockchainMemo
            },
        };

        const res = await this.bridgeClient.put(`/customers/${dto.customerId}/virtual_accounts/${dto.virtualAccountId}`, body);

        if (!res || !res.id) {
            return res;
        }


        const resData = {
            id: res.id,
            customer_id: res.customer_id,
            instructons: res.source_deposit_instructions,
            created: res.created_at,
            destination: res.destination,
            status: res.status,
        };

        return resData;
    }


        
    async deactivateVirtualAccount(dto: {
        virtualAccountId: string;
        customerId: string;
        referenceId: string;
    }) {
        const body = {
        };

        const res = await this.bridgeClient.post(`/customers/${dto.customerId}/virtual_accounts/${dto.virtualAccountId}/deactivate`, `deactivate-virtual-account-${dto.referenceId}`, body);

        if (!res || !res.id) {
            return res;
        }
     

        const resData = {
            id: res.id,
            customer_id: res.customer_id,
            instructons: res.source_deposit_instructions,
            created: res.created_at,
            destination: res.destination,
            status: res.status,
        };

        return resData;
    }


      async activateVirtualAccount(dto: {
        virtualAccountId: string;
        customerId: string;
        referenceId: string;
    }) {
        const body = {
        };

        const res = await this.bridgeClient.post(`/customers/${dto.customerId}/virtual_accounts/${dto.virtualAccountId}/reactivate`, `reactivate-virtual-account-${dto.referenceId}`, body);

        if (!res || !res.id) {
            return res;
        }
     

        const resData = {
            id: res.id,
            customer_id: res.customer_id,
            instructons: res.source_deposit_instructions,
            created: res.created_at,
            destination: res.destination,
            status: res.status,
        };

        return resData;
    }





    async createBridgeWallet(dto: {
        transactionId: string;
        customerId: string;
        chain: BridgeChain;
    }) {
        const body = {
            chain: dto.chain,
        };

        const res = await this.bridgeClient.post(
            `/customers/${dto.customerId}/wallets`,
            `wallet-${dto.transactionId}`,
            body,
        );

        if (!res || !res.id) {
            return res;
        }

        const resData = {
            id: res.id,
            chain: res.chain,
            address: res.address,
            createdAt: res.created_at,
            updatedAt: res.updated_at,
        };

        return {
            successCode: 201,
            message: 'Bridge wallet created successfully',
            data: resData,
        };
    }

    async getBridgeWallet(dto: {
        customerId: string;
        bridgeWalletId: string;
    }) {
        const res = await this.bridgeClient.get(
            `/customers/${dto.customerId}/wallets/${dto.bridgeWalletId}`,
            `get-wallet-${dto.bridgeWalletId}`,
        );

        if (!res || !res.id) {
            return res;
        }

        const resData = {
            id: res.id,
            chain: res.chain,
            address: res.address,
            createdAt: res.created_at,
            updatedAt: res.updated_at,
            balances: res.balances,
        };

        return {
            successCode: 200,
            message: 'Bridge wallet retrieved successfully',
            data: resData,
        };
    }

    async getBridgeWalletTransactionHistory(dto: {
        bridgeWalletId: string;
        limit?: number;
        updatedAfterMs?: number;
        updatedBeforeMs?: number;
    }) {
        const params = {
            ...(dto.limit !== undefined ? { limit: dto.limit } : {}),
            ...(dto.updatedAfterMs !== undefined ? { updated_after_ms: dto.updatedAfterMs } : {}),
            ...(dto.updatedBeforeMs !== undefined ? { updated_before_ms: dto.updatedBeforeMs } : {}),
        };

        const res = await this.bridgeClient.get(
            `/wallets/${dto.bridgeWalletId}/history`,
            `wallet-history-${dto.bridgeWalletId}`,
            params,
        );

        return {
            successCode: 200,
            message: 'Bridge wallet transaction history retrieved successfully',
            data: {
                count: res?.count ?? 0,
                transactions: res?.data ?? [],
            },
        };
    }

    async getVirtualAccountActivity(dto: {
        customerId: string;
        virtualAccountId: string;
        depositId?: string;
        depositIds?: string[];
        txHash?: string;
        limit?: number;
        startingAfter?: string;
        endingBefore?: string;
        eventType?: string;
    }) {
        const params = {
            ...(dto.depositId ? { deposit_id: dto.depositId } : {}),
            ...(dto.depositIds && dto.depositIds.length ? { deposit_ids: dto.depositIds } : {}),
            ...(dto.txHash ? { tx_hash: dto.txHash } : {}),
            ...(dto.limit !== undefined ? { limit: dto.limit } : {}),
            ...(dto.startingAfter ? { starting_after: dto.startingAfter } : {}),
            ...(dto.endingBefore ? { ending_before: dto.endingBefore } : {}),
            ...(dto.eventType ? { event_type: dto.eventType } : {}),
        };

        const res = await this.bridgeClient.get(
            `/customers/${dto.customerId}/virtual_accounts/${dto.virtualAccountId}/history`,
            `virtual-account-history-${dto.virtualAccountId}`,
            params,
        );

        return {
            successCode: 200,
            message: 'Virtual account activity retrieved successfully',
            data: {
                count: res?.count ?? 0,
                activities: res?.data ?? [],
            },
        };
    }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderEntity } from 'src/order/order.entity';
import { BridgeTransactionEntity } from 'src/bridge-transaction/bridge-transaction.entity';


export type VirtualAccountCurrency = 'USD'  | 'EUR' | 'GBP';

@Entity({ name: 'bridge_virtual_accounts' })
export class BridgeVirtualAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bridgeVirtualAccount: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  accountNumber: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankName?: string;

  @Column({ name: 'fait_currency', type: 'varchar', length: 10, nullable: true })
  faitCurrency: VirtualAccountCurrency;
  
  @Column({ type: 'longtext', nullable: true })
  instructions: string;
  

  @Column({ type: 'json', nullable: true })
  destination: {
    type: 'stellar' | 'bridge_wallet';
    publicAddress?: string;
    memo?: string;
    network?: string;
    bridgeWalletId?: string;
  };

  
  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';


  @OneToMany(() => OrderEntity, (order) => order.virtualAccount)
  orders: OrderEntity[];

 @OneToMany(() => BridgeTransactionEntity, (transaction) => transaction.virtualAccount)
  transactions: BridgeTransactionEntity[];


  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

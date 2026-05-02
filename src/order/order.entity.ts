import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StellarTransactionEntity } from '../stellar-transaction/stellar-transaction.entity';
import { BridgeVirtualAccountEntity } from 'src/bridge-virtual-account/bridge-virtual-account.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PARTIAL_PAID = 'partial_paid',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum OrderSettlementStatus {
  PENDING = 'pending',
  SETTLED = 'settled',
  FAILED = 'failed',
}

@Entity({ name: 'stellar_orders' })
//unique index reference and fait curreny
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

 
  @Column({ type: 'varchar', length: 120 })
  reference: string;

  @Column({
    name: 'fait_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  faitAmount: string;

  @Column({
    name: 'asset_amount',
    type: 'decimal',
    precision: 18,
    scale: 6,
  })
  assetAmount: string;

  @Column({  type: 'varchar', length: 10 })
  faitCurrency: string;

  @Column({ type: 'varchar', length: 10, default: 'usdc' })
  currency: string;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  paidAmount: string;

  @Column({
    name: 'settlement_amount',
    type: 'decimal',
    precision: 18,
    scale: 6,
    default: 0,
  })
  settlementAmount: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

   @Column({
    type: 'enum',
    enum: OrderSettlementStatus,
    default: OrderSettlementStatus.PENDING,
  })
  settlementStatus: OrderSettlementStatus;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 8 })
  memo: string;

  @Column({ name: 'public_address', type: 'varchar', length: 255, nullable: true })
  publicAddress?: string;

  @Column({ type: 'varchar', length: 80, default: 'stellar' })
  network: string;



  @Index()
  @Column({ type: 'uuid', nullable: true })
  virtualAccountId?: string;
   @ManyToOne(() => BridgeVirtualAccountEntity, (account) => account.orders, {
      nullable: true,
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'virtualAccountId' })
    virtualAccount?: BridgeVirtualAccountEntity;




  @OneToMany(() => StellarTransactionEntity, (transaction) => transaction.order)
  transactions: StellarTransactionEntity[];


  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

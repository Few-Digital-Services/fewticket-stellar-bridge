import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StellarTransactionEntity } from '../stellar-transaction/stellar-transaction.entity';

export enum StellarOrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PARTIAL_PAID = 'partial_paid',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity({ name: 'stellar_orders' })
export class StellarOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
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

  @Column({ name: 'fait_currency', type: 'varchar', length: 10 })
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
    type: 'enum',
    enum: StellarOrderStatus,
    default: StellarOrderStatus.PENDING,
  })
  status: StellarOrderStatus;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 8 })
  memo: string;

  @Column({ name: 'public_address', type: 'varchar', length: 255, nullable: true })
  publicAddress?: string;

  @Column({ type: 'varchar', length: 80, default: 'stellar' })
  network: string;

  @OneToMany(() => StellarTransactionEntity, (transaction) => transaction.order)
  transactions: StellarTransactionEntity[];


  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

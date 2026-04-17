import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StellarOrderEntity } from '../stellar-order/stellar-order.entity';

export enum StellarTransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum StellarTransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

@Entity({ name: 'stellar_transactions' })
@Index(['transactionHash', 'publicAddress', 'type'], { unique: true })
export class StellarTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 100, nullable: true })
  userId?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @ManyToOne(() => StellarOrderEntity, (order) => order.transactions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order?: StellarOrderEntity;

  @Index()
  @Column({ type: 'varchar', length: 140 })
  transactionHash: string;

  @Column({
    type: 'enum',
    enum: StellarTransactionType,
    default: StellarTransactionType.CREDIT,
  })
  type: StellarTransactionType;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'USDC' })
  currency: string;

  @Column({
    type: 'enum',
    enum: StellarTransactionStatus,
    default: StellarTransactionStatus.PENDING,
  })
  status: StellarTransactionStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  network?: string;

  @Column({ name: 'public_address', type: 'varchar', length: 255, nullable: true })
  publicAddress?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  memo?: string;

  @Column({ name: 'counterparty_address', type: 'varchar', length: 255, nullable: true })
  counterpartyAddress?: string;

  @Column({ type: 'json', nullable: true })
  rawPayload?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

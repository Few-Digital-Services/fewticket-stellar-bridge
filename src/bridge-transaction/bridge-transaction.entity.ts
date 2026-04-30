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
import { OrderEntity } from '../order/order.entity';
import { BridgeVirtualAccountEntity } from 'src/bridge-virtual-account/bridge-virtual-account.entity';

export enum BridgeTransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum BridgeTransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

@Entity({ name: 'bridge_transactions' })
@Index(['transactionReference',  'type'], { unique: true })
export class BridgeTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 100, nullable: true })
  userId?: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId?: string;

  @ManyToOne(() => OrderEntity, (order) => order.transactions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity;


  @Index()
  @Column({ type: 'uuid', nullable: true })
  virtualAccountId?: string;
  @ManyToOne(() => BridgeVirtualAccountEntity, (account) => account.transactions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'virtualAccountId' })
  virtualAccount?: BridgeVirtualAccountEntity;


  @Index()
  @Column({ type: 'varchar', length: 140 })
  transactionReference: string;

  @Column({
    type: 'enum',
    enum: BridgeTransactionType,
    default: BridgeTransactionType.CREDIT,
  })
  type: BridgeTransactionType;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amount: string;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: BridgeTransactionStatus,
    default: BridgeTransactionStatus.PENDING,
  })
  status: BridgeTransactionStatus;


  @Column({ type: 'json', nullable: true })
  rawPayload?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}

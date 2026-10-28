import type {
  AuditLogRecord,
  BetStatus,
  MarketCategory,
  MarketStatus,
  PendingDeposit,
  PendingWithdrawal,
  Role,
  TransactionRecord,
  TransactionStatus,
  TransactionType,
  UserProfile,
} from '@/lib/types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function metadataRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export interface ProfileRow {
  id: string;
  username: string;
  email: string;
  binance_uid: string | null;
  balance: string | number;
  role: Role;
  is_banned: boolean;
  created_at: string;
}

export function mapUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    binanceUid: row.binance_uid,
    balance: String(row.balance),
    role: row.role,
    isBanned: row.is_banned,
    createdAt: row.created_at,
  };
}

export interface TransactionRow {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: string | number;
  status: TransactionStatus;
  reference_id: string | null;
  metadata: unknown;
  created_at: string;
}

export function mapTransaction(row: TransactionRow, username: string): TransactionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    username,
    type: row.type,
    amount: String(row.amount),
    status: row.status,
    referenceId: row.reference_id,
    metadata: metadataRecord(row.metadata),
    createdAt: row.created_at,
  };
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_user_id: string | null;
  metadata: unknown;
  created_at: string;
}

export function mapAuditLog(
  row: AuditLogRow,
  actorUsername: string | null
): AuditLogRecord {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorUsername,
    action: row.action,
    targetUserId: row.target_user_id,
    metadata: metadataRecord(row.metadata),
    createdAt: row.created_at,
  };
}

export interface PendingWithdrawalRow {
  id: string;
  user_id: string;
  amount: string | number;
  reference_id: string | null;
  created_at: string;
}

export function mapPendingWithdrawal(
  row: PendingWithdrawalRow,
  username: string,
  binanceUid: string | null
): PendingWithdrawal {
  return {
    id: row.id,
    referenceId: row.reference_id ?? '',
    userId: row.user_id,
    username,
    binanceUid,
    amount: String(row.amount),
    createdAt: row.created_at,
  };
}

export interface PendingDepositRow {
  id: string;
  user_id: string;
  amount: string | number;
  reference_id: string | null;
  created_at: string;
}

export function mapPendingDeposit(row: PendingDepositRow, username: string): PendingDeposit {
  return {
    id: row.id,
    referenceId: row.reference_id ?? '',
    userId: row.user_id,
    username,
    amount: String(row.amount),
    createdAt: row.created_at,
  };
}

export function asMarketStatus(value: string): MarketStatus {
  return value === 'CLOSED' || value === 'RESOLVED' || value === 'CANCELLED' ? value : 'OPEN';
}

export function asMarketCategory(value: string): MarketCategory {
  const clean = value?.trim().toUpperCase();
  return clean && clean.length >= 2 ? clean.slice(0, 30) : 'GENERAL';
}

export function asBetStatus(value: string): BetStatus {
  return value === 'WON' || value === 'LOST' || value === 'REFUNDED' ? value : 'ACTIVE';
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

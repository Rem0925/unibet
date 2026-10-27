import { NextResponse, type NextRequest } from 'next/server';
import type {
  AdminOverview,
  AdminStats,
  AuditLogRecord,
  PendingDeposit,
  PendingWithdrawal,
  TransactionRecord,
} from '@/lib/types';
import { requireRole } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import {
  mapAuditLog,
  mapPendingDeposit,
  mapPendingWithdrawal,
  mapTransaction,
  mapUserProfile,
  type AuditLogRow,
  type PendingDepositRow,
  type PendingWithdrawalRow,
  type ProfileRow,
  type TransactionRow,
} from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '0';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN']);
    enforceRateLimit(`admin-overview:${profile.id}`, 60, 60_000);

    const supabase = getServiceSupabase();
    const { data: statsData, error: statsError } = await supabase.rpc('fn_admin_overview', {
      p_caller_id: profile.id,
    });

    if (statsError) {
      throwRpcError(statsError, 'No se pudieron calcular las métricas financieras');
    }

    const rawStats = (statsData ?? {}) as Record<string, unknown>;
    const stats: AdminStats = {
      totalUsers: asNumber(rawStats.total_users),
      totalUserBalances: asString(rawStats.total_user_balances),
      activePools: asString(rawStats.active_pools),
      pendingWithdrawals: asString(rawStats.pending_withdrawals),
      houseFees: asString(rawStats.house_fees),
      houseWins: asString(rawStats.house_wins),
      creatorWins: asString(rawStats.creator_wins),
      totalDeposits: asString(rawStats.total_deposits),
      openMarkets: asNumber(rawStats.open_markets),
      totalMarkets: asNumber(rawStats.total_markets),
      activeBets: asNumber(rawStats.active_bets),
      expectedBinanceBalance: asString(rawStats.expected_binance_balance),
    };

    const [
      { data: userData, error: userError },
      { data: txData, error: txError },
      { data: pendingData, error: pendingError },
      { data: pendingDepositData, error: pendingDepositError },
      { data: auditData, error: auditError },
    ] = await Promise.all([
      supabase
        .from('users')
        .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('transactions')
        .select('id, user_id, type, amount, status, reference_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('transactions')
        .select('id, user_id, amount, reference_id, created_at')
        .eq('type', 'WITHDRAW')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('transactions')
        .select('id, user_id, amount, reference_id, created_at')
        .eq('type', 'DEPOSIT')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('audit_logs')
        .select('id, actor_id, action, target_user_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (userError || txError || pendingError || pendingDepositError || auditError) {
      console.error('[admin] Error cargando panel:', {
        userError,
        txError,
        pendingError,
        pendingDepositError,
        auditError,
      });
      throw new Error('No se pudo cargar el panel de administración');
    }

    const users = ((userData ?? []) as ProfileRow[]).map(mapUserProfile);
    const transactions = (txData ?? []) as TransactionRow[];
    const pendingRows = (pendingData ?? []) as PendingWithdrawalRow[];
    const pendingDepositRows = (pendingDepositData ?? []) as PendingDepositRow[];
    const auditRows = (auditData ?? []) as AuditLogRow[];

    const userIds = new Set<string>();
    for (const user of users) userIds.add(user.id);
    for (const tx of transactions) userIds.add(tx.user_id);
    for (const pending of pendingRows) userIds.add(pending.user_id);
    for (const pending of pendingDepositRows) userIds.add(pending.user_id);
    for (const audit of auditRows) {
      if (audit.actor_id) userIds.add(audit.actor_id);
      if (audit.target_user_id) userIds.add(audit.target_user_id);
    }

    const idList = [...userIds];
    const { data: lookupData } = idList.length
      ? await supabase.from('users').select('id, username, binance_uid').in('id', idList)
      : { data: [] };

    const lookups = new Map<string, { username: string; binanceUid: string | null }>();
    for (const row of (lookupData ?? []) as Array<{
      id: string;
      username: string;
      binance_uid: string | null;
    }>) {
      lookups.set(row.id, { username: row.username, binanceUid: row.binance_uid });
    }

    const mappedTransactions: TransactionRecord[] = transactions.map((row) =>
      mapTransaction(row, lookups.get(row.user_id)?.username ?? 'usuario')
    );

    const pendingWithdrawals: PendingWithdrawal[] = pendingRows.map((row) => {
      const lookup = lookups.get(row.user_id);
      return mapPendingWithdrawal(row, lookup?.username ?? 'usuario', lookup?.binanceUid ?? null);
    });

    const pendingDeposits: PendingDeposit[] = pendingDepositRows.map((row) =>
      mapPendingDeposit(row, lookups.get(row.user_id)?.username ?? 'usuario')
    );

    const auditLogs: AuditLogRecord[] = auditRows.map((row) =>
      mapAuditLog(
        row,
        row.actor_id ? lookups.get(row.actor_id)?.username ?? 'sistema' : 'sistema'
      )
    );

    const overview: AdminOverview = {
      stats,
      users,
      transactions: mappedTransactions,
      pendingWithdrawals,
      pendingDeposits,
      auditLogs,
    };

    return NextResponse.json(overview);
  } catch (error) {
    return jsonError(error);
  }
}

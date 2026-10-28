'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Landmark,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate, formatUsdt } from '@/lib/format';
import type {
  AdminOverview,
  AuditLogRecord,
  PendingDeposit,
  PendingWithdrawal,
  Role,
  TransactionRecord,
  UserProfile,
} from '@/lib/types';
import { EmptyState, ErrorBanner, Spinner } from './ui';

type AdminTab = 'WITHDRAWALS' | 'DEPOSITS' | 'USERS' | 'TRANSACTIONS' | 'AUDIT';

const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'WITHDRAWALS', label: 'RETIROS', icon: <Clock className="h-3.5 w-3.5" /> },
  { id: 'DEPOSITS', label: 'DEPÓSITOS', icon: <CircleDollarSign className="h-3.5 w-3.5" /> },
  { id: 'USERS', label: 'USUARIOS', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'TRANSACTIONS', label: 'MOVIMIENTOS', icon: <Receipt className="h-3.5 w-3.5" /> },
  { id: 'AUDIT', label: 'AUDITORÍA', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

const roleStyles: Record<Role, string> = {
  ADMIN: 'border-[#f59e0b]/40 bg-[#261f12] text-[#fbbf24]',
  MODERATOR: 'border-[#a855f7]/40 bg-[#221730] text-[#c084fc]',
  USER: 'border-[#00f090]/30 bg-[#121f18] text-[#00f090]',
};

const txLabels: Record<TransactionRecord['type'], string> = {
  DEPOSIT: 'Recarga',
  WITHDRAW: 'Retiro',
  BET_PLACED: 'Apuesta',
  BET_WON: 'Premio',
  FEE_DEPOSIT: 'Comisión recarga',
  HOUSE_WIN: 'Ganancia casa',
  CREATOR_WIN: 'Ganancia creador',
  REFUND: 'Reembolso',
};

function auditLabel(action: string): string {
  return action.replaceAll('_', ' ');
}

export function AdminDashboard({
  overview,
  currentUserId,
  loading,
  error,
  onRetry,
  onChanged,
  showToast,
}: {
  overview: AdminOverview | null;
  currentUserId: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChanged: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const [tab, setTab] = useState<AdminTab>('WITHDRAWALS');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    referenceId: string;
    action: 'refund' | 'complete';
  } | null>(null);
  const [depositConfirm, setDepositConfirm] = useState<string | null>(null);
  const [banConfirm, setBanConfirm] = useState<string | null>(null);

  const stats = overview?.stats;

  const pendingTotal = useMemo(() => {
    if (!overview) return 0;
    return overview.pendingWithdrawals.reduce(
      (sum, item) => sum + (Number.parseFloat(item.amount) || 0),
      0
    );
  }, [overview]);

  const updateUser = async (
    user: UserProfile,
    payload: { role?: Role; isBanned?: boolean }
  ) => {
    const key = `user:${user.id}`;
    setBusyKey(key);
    try {
      const response = await apiFetch<{ success: boolean; profile: UserProfile }>(
        '/api/admin/users',
        {
          method: 'PATCH',
          body: JSON.stringify({ userId: user.id, ...payload }),
        }
      );
      showToast(
        payload.role
          ? `Rol de @${response.profile.username} actualizado a ${ROLE_LABELS[response.profile.role]}`
          : `Estado de @${response.profile.username} actualizado`,
        'success'
      );
      setBanConfirm(null);
      await onChanged();
    } catch (updateError) {
      showToast(errorMessage(updateError), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const reconcile = async (
    withdrawal: PendingWithdrawal,
    action: 'refund' | 'complete'
  ) => {
    const key = `wd:${withdrawal.referenceId}:${action}`;
    setBusyKey(key);
    try {
      const response = await apiFetch<{ success: boolean; message: string }>(
        '/api/admin/withdrawals/reconcile',
        {
          method: 'POST',
          body: JSON.stringify({ referenceId: withdrawal.referenceId, action }),
        }
      );
      showToast(response.message || 'Retiro reconciliado', 'success');
      setPendingConfirm(null);
      await onChanged();
    } catch (reconcileError) {
      showToast(errorMessage(reconcileError), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const reconcileDeposit = async (deposit: PendingDeposit, action: 'verify' | 'fail') => {
    const key = `dp:${deposit.referenceId}:${action}`;
    setBusyKey(key);
    try {
      const response = await apiFetch<{ success: boolean; message: string }>(
        '/api/admin/deposits/reconcile',
        {
          method: 'POST',
          body: JSON.stringify({
            referenceId: deposit.referenceId,
            action,
            ...(action === 'fail' ? { note: 'Orden cerrada sin acreditar tras revisión admin' } : {}),
          }),
        }
      );
      showToast(response.message || 'Depósito verificado', 'success');
      setDepositConfirm(null);
      await onChanged();
    } catch (depositError) {
      showToast(errorMessage(depositError), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" />
          <div>
            <h2 className="text-sm font-bold text-white">Panel financiero</h2>
            <p className="text-[10px] text-slate-500">
              Solo administradores. Los moderadores no ven saldos ni métricas de la casa.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="flex items-center gap-1.5 self-start rounded border border-[#2d3447] bg-[#161a24] px-2.5 py-1.5 font-mono text-[10px] font-bold text-slate-200 transition hover:bg-[#1e2330] disabled:opacity-60"
        >
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualizar
        </button>
      </div>

      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricCard
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="Saldos de usuarios"
            value={`$${formatUsdt(stats.totalUserBalances)}`}
            hint={`${stats.totalUsers} cuentas registradas`}
          />
          <MetricCard
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            label="Pozos activos"
            value={`$${formatUsdt(stats.activePools)}`}
            hint={`${stats.openMarkets} mercados abiertos o en curso`}
          />
          <MetricCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Retiros pendientes"
            value={`$${formatUsdt(stats.pendingWithdrawals)}`}
            hint={`${overview?.pendingWithdrawals.length ?? 0} solicitudes por revisar`}
            tone="text-[#fbbf24]"
          />
          <MetricCard
            icon={<Landmark className="h-3.5 w-3.5" />}
            label="Saldo esperado en Binance"
            value={`$${formatUsdt(stats.expectedBinanceBalance)}`}
            hint="Saldos + pozos + retiros pendientes"
            tone="text-[#7dd3fc]"
          />
          <MetricCard
            icon={<Receipt className="h-3.5 w-3.5" />}
            label="Comisiones 1.5%"
            value={`$${formatUsdt(stats.houseFees)}`}
            hint="Acumulado por recargas"
            tone="text-[#00f090]"
          />
          <MetricCard
            icon={<Trophy className="h-3.5 w-3.5" />}
            label="Ganancias casa"
            value={`$${formatUsdt(stats.houseWins)}`}
            hint="Pozos huérfanos (70%)"
            tone="text-[#00f090]"
          />
          <MetricCard
            icon={<Users className="h-3.5 w-3.5" />}
            label="Ganancias creadores"
            value={`$${formatUsdt(stats.creatorWins)}`}
            hint="Pozos huérfanos (30%)"
            tone="text-[#c084fc]"
          />
          <MetricCard
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            label="Recargas netas"
            value={`$${formatUsdt(stats.totalDeposits)}`}
            hint={`${stats.activeBets} apuestas activas · ${stats.totalMarkets} mercados`}
          />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-lg border border-[#1e2330] bg-[#11141c]"
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[10px] font-bold transition ${
              tab === item.id
                ? 'border-[#2a3142] bg-[#181c26] text-white'
                : 'border-[#222736] bg-[#0e1118] text-slate-400 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
            {item.id === 'WITHDRAWALS' && (overview?.pendingWithdrawals.length ?? 0) > 0 ? (
              <span className="rounded bg-[#f59e0b] px-1 text-[9px] font-black text-black">
                {overview?.pendingWithdrawals.length}
              </span>
            ) : null}
            {item.id === 'DEPOSITS' && (overview?.pendingDeposits.length ?? 0) > 0 ? (
              <span className="rounded bg-[#38bdf8] px-1 text-[9px] font-black text-black">
                {overview?.pendingDeposits.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
        {tab === 'WITHDRAWALS' ? (
          <WithdrawalsTab
            overview={overview}
            loading={loading}
            total={pendingTotal}
            busyKey={busyKey}
            pendingConfirm={pendingConfirm}
            setPendingConfirm={setPendingConfirm}
            onReconcile={reconcile}
          />
        ) : null}

        {tab === 'DEPOSITS' ? (
          <DepositsTab
            overview={overview}
            loading={loading}
            busyKey={busyKey}
            depositConfirm={depositConfirm}
            setDepositConfirm={setDepositConfirm}
            onReconcile={reconcileDeposit}
          />
        ) : null}

        {tab === 'USERS' ? (
          <UsersTab
            users={overview?.users ?? []}
            currentUserId={currentUserId}
            busyKey={busyKey}
            banConfirm={banConfirm}
            setBanConfirm={setBanConfirm}
            onUpdate={updateUser}
          />
        ) : null}

        {tab === 'TRANSACTIONS' ? (
          <TransactionsTab transactions={overview?.transactions ?? []} />
        ) : null}

        {tab === 'AUDIT' ? <AuditTab logs={overview?.auditLogs ?? []} /> : null}
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = 'text-white',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400">
        <span className="text-slate-400">{icon}</span>
        <span className="truncate font-medium">{label}</span>
      </div>
      <div className={`font-mono text-lg font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 truncate text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function WithdrawalsTab({
  overview,
  loading,
  total,
  busyKey,
  pendingConfirm,
  setPendingConfirm,
  onReconcile,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  total: number;
  busyKey: string | null;
  pendingConfirm: { referenceId: string; action: 'refund' | 'complete' } | null;
  setPendingConfirm: (value: { referenceId: string; action: 'refund' | 'complete' } | null) => void;
  onReconcile: (withdrawal: PendingWithdrawal, action: 'refund' | 'complete') => void;
}) {
  if (!overview && loading) {
    return <div className="h-24 animate-pulse rounded border border-[#1e2330] bg-[#0e1118]" />;
  }

  if (!overview || overview.pendingWithdrawals.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="Sin retiros pendientes"
        description="Todos los retiros fueron confirmados o reembolsados. Los pagos inciertos de Binance aparecerán aquí para revisión."
      />
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-slate-400">
        <span>
          {overview.pendingWithdrawals.length} solicitudes en revisión
        </span>
        <span>
          Total: <strong className="text-[#fbbf24]">${formatUsdt(total)} USDT</strong>
        </span>
      </div>
      <div className="divide-y divide-[#1a1e28]">
        {overview.pendingWithdrawals.map((withdrawal) => {
          const confirming = pendingConfirm?.referenceId === withdrawal.referenceId;
          return (
            <div key={withdrawal.id} className="py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-white">
                    ${formatUsdt(withdrawal.amount)} USDT
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      @{withdrawal.username}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-slate-500">
                    UID {withdrawal.binanceUid ?? '—'} · {formatDate(withdrawal.createdAt)}
                  </div>
                  <div className="truncate font-mono text-[9px] text-slate-600">
                    Ref: {withdrawal.referenceId}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirm({
                        referenceId: withdrawal.referenceId,
                        action: 'complete',
                      })
                    }
                    className="rounded border border-[#00f090]/30 bg-[#121f18] px-2 py-1 font-mono text-[9px] font-bold text-[#00f090] transition hover:bg-[#16291f]"
                  >
                    Completar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirm({
                        referenceId: withdrawal.referenceId,
                        action: 'refund',
                      })
                    }
                    className="rounded border border-[#f43f5e]/30 bg-[#1f1113] px-2 py-1 font-mono text-[9px] font-bold text-[#f87171] transition hover:bg-[#2a1518]"
                  >
                    Reembolsar
                  </button>
                </div>
              </div>

              {confirming && pendingConfirm ? (
                <div className="mt-2 rounded border border-[#f59e0b]/30 bg-[#181511] p-2.5">
                  <div className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#fbbf24]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {pendingConfirm.action === 'complete'
                      ? 'Confirma solo si verificaste en Binance que el USDT llegó al UID del usuario. No se puede deshacer.'
                      : 'El saldo se devolverá al usuario sin cobrar comisión. Confirma solo si el pago no se envió o fue rechazado.'}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onReconcile(withdrawal, pendingConfirm.action)}
                      disabled={busyKey === `wd:${withdrawal.referenceId}:${pendingConfirm.action}`}
                      className={`flex items-center gap-1 rounded px-2 py-1 font-mono text-[9px] font-bold text-black transition disabled:opacity-60 ${
                        pendingConfirm.action === 'complete'
                          ? 'bg-[#00f090] hover:bg-[#00d681]'
                          : 'bg-[#f59e0b] hover:bg-[#d97706]'
                      }`}
                    >
                      {busyKey === `wd:${withdrawal.referenceId}:${pendingConfirm.action}` ? (
                        <Spinner className="h-3 w-3" />
                      ) : pendingConfirm.action === 'complete' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Confirmar {pendingConfirm.action === 'complete' ? 'pago' : 'reembolso'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingConfirm(null)}
                      className="rounded border border-[#2d3447] bg-[#161a24] px-2 py-1 font-mono text-[9px] font-bold text-slate-300 transition hover:bg-[#1e2330]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DepositsTab({
  overview,
  loading,
  busyKey,
  depositConfirm,
  setDepositConfirm,
  onReconcile,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  busyKey: string | null;
  depositConfirm: string | null;
  setDepositConfirm: (value: string | null) => void;
  onReconcile: (deposit: PendingDeposit, action: 'verify' | 'fail') => void;
}) {
  if (!overview && loading) {
    return <div className="h-24 animate-pulse rounded border border-[#1e2330] bg-[#0e1118]" />;
  }

  if (!overview || overview.pendingDeposits.length === 0) {
    return (
      <EmptyState
        icon={<CircleDollarSign className="h-6 w-6" />}
        title="Sin depósitos pendientes"
        description="Aquí aparecen las recargas cuya orden sigue PENDING: si el webhook de Binance no llegó, usa «Verificar» para consultar el estado real de la orden antes de acreditar."
      />
    );
  }

  return (
    <div>
      <div className="mb-2 font-mono text-[10px] text-slate-400">
        {overview.pendingDeposits.length} recargas sin acreditar
      </div>
      <div className="divide-y divide-[#1a1e28]">
        {overview.pendingDeposits.map((deposit) => {
          const confirming = depositConfirm === deposit.referenceId;
          return (
            <div key={deposit.id} className="py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-white">
                    ${formatUsdt(deposit.amount)} USDT
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      @{deposit.username}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-slate-500">
                    {formatDate(deposit.createdAt)}
                  </div>
                  <div className="truncate font-mono text-[9px] text-slate-600">
                    Ref: {deposit.referenceId}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => onReconcile(deposit, 'verify')}
                    disabled={busyKey === `dp:${deposit.referenceId}:verify`}
                    className="flex items-center gap-1 rounded border border-[#38bdf8]/30 bg-[#101d29] px-2 py-1 font-mono text-[9px] font-bold text-[#38bdf8] transition hover:bg-[#152635] disabled:opacity-60"
                  >
                    {busyKey === `dp:${deposit.referenceId}:verify` ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Verificar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositConfirm(deposit.referenceId)}
                    className="rounded border border-[#f43f5e]/30 bg-[#1f1113] px-2 py-1 font-mono text-[9px] font-bold text-[#f87171] transition hover:bg-[#2a1518]"
                  >
                    Marcar fallido
                  </button>
                </div>
              </div>

              {confirming ? (
                <div className="mt-2 rounded border border-[#f59e0b]/30 bg-[#181511] p-2.5">
                  <div className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#fbbf24]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Confirma solo si verificaste en Binance que la orden se cerró sin pago. El
                    depósito quedará FAILED sin acreditar saldo. Si el usuario pagó, usa «Verificar»
                    en su lugar.
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onReconcile(deposit, 'fail')}
                      disabled={busyKey === `dp:${deposit.referenceId}:fail`}
                      className="flex items-center gap-1 rounded bg-[#f59e0b] px-2 py-1 font-mono text-[9px] font-bold text-black transition hover:bg-[#d97706] disabled:opacity-60"
                    >
                      {busyKey === `dp:${deposit.referenceId}:fail` ? (
                        <Spinner className="h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Confirmar fallido
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositConfirm(null)}
                      className="rounded border border-[#2d3447] bg-[#161a24] px-2 py-1 font-mono text-[9px] font-bold text-slate-300 transition hover:bg-[#1e2330]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsersTab({
  users,
  currentUserId,
  busyKey,
  banConfirm,
  setBanConfirm,
  onUpdate,
}: {
  users: UserProfile[];
  currentUserId: string;
  busyKey: string | null;
  banConfirm: string | null;
  setBanConfirm: (value: string | null) => void;
  onUpdate: (user: UserProfile, payload: { role?: Role; isBanned?: boolean }) => void;
}) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Sin usuarios"
        description="Los perfiles aparecen aquí en cuanto inician sesión con Supabase Auth."
      />
    );
  }

  return (
    <div className="divide-y divide-[#1a1e28]">
      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        const busy = busyKey === `user:${user.id}`;
        const confirmingBan = banConfirm === user.id;

        return (
          <div key={user.id} className="py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#252b3b] bg-[#141822] font-mono text-[10px] font-bold text-slate-300">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-xs font-bold text-white">
                      @{user.username}
                    </span>
                    <span
                      className={`rounded border px-1 py-0.5 font-mono text-[8px] font-bold ${roleStyles[user.role]}`}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                    {user.isBanned ? (
                      <span className="rounded border border-[#f43f5e]/30 bg-[#1f1113] px-1 py-0.5 font-mono text-[8px] font-bold text-[#f87171]">
                        SUSPENDIDO
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate font-mono text-[9px] text-slate-500">
                    {user.email} · ${formatUsdt(user.balance)} USDT
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <select
                  value={user.role}
                  disabled={busy || isSelf}
                  onChange={(event) =>
                    onUpdate(user, { role: event.target.value as Role })
                  }
                  aria-label={`Rol de ${user.username}`}
                  className="rounded border border-[#222736] bg-[#090a0f] px-1.5 py-1 font-mono text-[9px] font-bold text-slate-200 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                >
                  <option value="USER">APOSTADOR</option>
                  <option value="MODERATOR">MODERADOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                {isSelf ? (
                  <span className="rounded border border-[#2a3142] bg-[#171b26] px-1.5 py-1 font-mono text-[9px] text-slate-500">
                    TÚ
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBanConfirm(confirmingBan ? null : user.id)}
                    disabled={busy}
                    className={`flex items-center gap-1 rounded border px-1.5 py-1 font-mono text-[9px] font-bold transition disabled:opacity-50 ${
                      user.isBanned
                        ? 'border-[#00f090]/30 bg-[#121f18] text-[#00f090] hover:bg-[#16291f]'
                        : 'border-[#f43f5e]/30 bg-[#1f1113] text-[#f87171] hover:bg-[#2a1518]'
                    }`}
                  >
                    {busy ? (
                      <Spinner className="h-3 w-3" />
                    ) : user.isBanned ? (
                      <UserCog className="h-3 w-3" />
                    ) : (
                      <Ban className="h-3 w-3" />
                    )}
                    {user.isBanned ? 'Reactivar' : 'Suspender'}
                  </button>
                )}
              </div>
            </div>

            {confirmingBan ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-[#f59e0b]/30 bg-[#181511] px-2.5 py-2 text-[10px] text-[#fbbf24]">
                <span>
                  {user.isBanned
                    ? `¿Reactivar la cuenta de @${user.username}?`
                    : `¿Suspender a @${user.username}? No podrá apostar, recargar ni retirar.`}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdate(user, { isBanned: !user.isBanned })}
                    className="rounded bg-[#f59e0b] px-2 py-1 font-mono text-[9px] font-bold text-black transition hover:bg-[#d97706]"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setBanConfirm(null)}
                    className="rounded border border-[#2d3447] bg-[#161a24] px-2 py-1 font-mono text-[9px] font-bold text-slate-300 transition hover:bg-[#1e2330]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TransactionsTab({ transactions }: { transactions: TransactionRecord[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-6 w-6" />}
        title="Sin movimientos"
        description="Las recargas, apuestas, premios y retiros aparecerán aquí en tiempo real."
      />
    );
  }

  return (
    <div className="divide-y divide-[#1a1e28]">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold text-white">
              {txLabels[tx.type]}
              <span className="ml-1.5 font-mono text-[9px] font-normal text-slate-400">
                @{tx.username}
              </span>
            </div>
            <div className="truncate font-mono text-[9px] text-slate-500">
              {formatDate(tx.createdAt)} · {tx.status}
              {tx.referenceId ? ` · ${tx.referenceId}` : ''}
            </div>
          </div>
          <div
            className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
              tx.type === 'WITHDRAW' || tx.type === 'BET_PLACED' ? 'text-slate-200' : 'text-[#00f090]'
            }`}
          >
            ${formatUsdt(tx.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ logs }: { logs: AuditLogRecord[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Sin eventos de auditoría"
        description="Las acciones de administración y moderación se registrarán aquí automáticamente."
      />
    );
  }

  return (
    <div className="divide-y divide-[#1a1e28]">
      {logs.map((log) => {
        const metadata = Object.keys(log.metadata).length > 0;
        return (
          <div key={log.id} className="py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-[#2a3142] bg-[#171b26] px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-200">
                {auditLabel(log.action)}
              </span>
              <span className="font-mono text-[9px] text-slate-500">
                {formatDate(log.createdAt)}
              </span>
              <span className="font-mono text-[9px] text-slate-400">
                por @{log.actorUsername ?? 'sistema'}
              </span>
            </div>
            {metadata ? (
              <details className="mt-1">
                <summary className="cursor-pointer font-mono text-[9px] text-slate-600 hover:text-slate-400">
                  Ver detalles
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto rounded border border-[#1e2330] bg-[#0c0e14] p-2 font-mono text-[9px] leading-relaxed text-slate-400">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

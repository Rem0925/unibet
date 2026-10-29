'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  Landmark,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  User,
  UserCog,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate, formatShortDate, formatUsdt } from '@/lib/format';
import type {
  AdminOverview,
  AuditLogRecord,
  BetRecord,
  PendingDeposit,
  PendingWithdrawal,
  Role,
  TransactionRecord,
  UserProfile,
} from '@/lib/types';
import { EmptyState, ErrorBanner, Modal, Spinner } from './ui';

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
  onBackToMarkets,
}: {
  overview: AdminOverview | null;
  currentUserId: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChanged: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
  onBackToMarkets?: () => void;
}) {
  const [tab, setTab] = useState<AdminTab>('WITHDRAWALS');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    referenceId: string;
    action: 'refund' | 'complete';
  } | null>(null);
  const [depositConfirm, setDepositConfirm] = useState<string | null>(null);
  const [banConfirm, setBanConfirm] = useState<string | null>(null);
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null);

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
      if (inspectingUser?.id === user.id) {
        setInspectingUser(response.profile);
      }
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
          body: JSON.stringify({ referenceId: deposit.referenceId, action }),
        }
      );
      showToast(response.message || 'Depósito reconciliado', 'success');
      setDepositConfirm(null);
      await onChanged();
    } catch (reconcileError) {
      showToast(errorMessage(reconcileError), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Botón Volver a Mercados */}
      {onBackToMarkets && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToMarkets}
            className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#00f090] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 text-[#00f090]" />
            <span>Volver a Mercados</span>
          </button>
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Panel Financiero & Administración</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gestión de usuarios, auditoría, verificación de retiros y conciliación de depósitos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="flex items-center gap-1.5 self-start rounded-xl border border-[#2d3447] bg-[#161a24] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-[#1e2330] disabled:opacity-60"
        >
          {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualizar
        </button>
      </div>

      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

      {/* Tarjetas de Métricas */}
      {stats ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <MetricCard
            icon={<Wallet className="h-4 w-4" />}
            label="Saldos de usuarios"
            mobileLabel="Saldos usuarios"
            value={`$${formatUsdt(stats.totalUserBalances)}`}
            hint={`${stats.totalUsers} cuentas registradas`}
          />
          <MetricCard
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Pozos activos"
            mobileLabel="Pozos activos"
            value={`$${formatUsdt(stats.activePools)}`}
            hint={`${stats.openMarkets} mercados abiertos`}
          />
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Retiros pendientes"
            mobileLabel="Retiros pend."
            value={`$${formatUsdt(stats.pendingWithdrawals)}`}
            hint={`${overview?.pendingWithdrawals.length ?? 0} solicitudes`}
            tone="text-[#fbbf24]"
          />
          <MetricCard
            icon={<Landmark className="h-4 w-4" />}
            label="Saldo esperado Binance"
            mobileLabel="Saldo Binance"
            value={`$${formatUsdt(stats.expectedBinanceBalance)}`}
            hint="Saldos + pozos + retiros"
            tone="text-[#7dd3fc]"
          />
          <MetricCard
            icon={<Receipt className="h-4 w-4" />}
            label="Comisiones de recarga"
            mobileLabel="Comisión 1.5%"
            value={`$${formatUsdt(stats.houseFees)}`}
            hint="1.5% acumulado"
            tone="text-[#00f090]"
          />
          <MetricCard
            icon={<Trophy className="h-4 w-4" />}
            label="Ganancias casa"
            mobileLabel="Ganancias casa"
            value={`$${formatUsdt(stats.houseWins)}`}
            hint="Pozos huérfanos / batacazos"
            tone="text-[#00f090]"
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Ganancias creadores"
            mobileLabel="Gan. creador"
            value={`$${formatUsdt(stats.creatorWins)}`}
            hint="30% acumulado por crear"
            tone="text-[#c084fc]"
          />
          <MetricCard
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Recargas netas"
            mobileLabel="Recargas"
            value={`$${formatUsdt(stats.totalDeposits)}`}
            hint={`${stats.activeBets} apuestas activas`}
          />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-20 sm:h-24 animate-pulse rounded-2xl border border-[#1e2330] bg-[#11141c]"
            />
          ))}
        </div>
      ) : null}

      {/* Tabs Selector */}
      <div className="flex overflow-x-auto scrollbar-none gap-1.5 rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
              tab === item.id
                ? 'bg-[#181c26] text-white shadow-sm ring-1 ring-[#283042]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* Panel de Contenido */}
      <section className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4 shadow-sm">
        {tab === 'WITHDRAWALS' ? (
          <WithdrawalsTab
            overview={overview}
            loading={loading}
            total={pendingTotal}
            busyKey={busyKey}
            pendingConfirm={pendingConfirm}
            setPendingConfirm={setPendingConfirm}
            onReconcile={reconcile}
            showToast={showToast}
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
            showToast={showToast}
          />
        ) : null}

        {tab === 'USERS' ? (
          <UsersTab
            users={overview?.users ?? []}
            loading={loading}
            currentUserId={currentUserId}
            busyKey={busyKey}
            banConfirm={banConfirm}
            setBanConfirm={setBanConfirm}
            onUpdate={updateUser}
            onInspectUser={(u) => setInspectingUser(u)}
          />
        ) : null}

        {tab === 'TRANSACTIONS' ? (
          <TransactionsTab
            transactions={overview?.transactions ?? []}
            loading={loading}
          />
        ) : null}

        {tab === 'AUDIT' ? (
          <AuditTab
            logs={overview?.auditLogs ?? []}
            loading={loading}
          />
        ) : null}
      </section>

      {/* Modal de Detalle e Inspección de Usuario con sus movimientos y tickets */}
      {inspectingUser ? (
        <UserInspectModal
          user={inspectingUser}
          currentUserId={currentUserId}
          onClose={() => setInspectingUser(null)}
          onUpdate={updateUser}
          busyKey={busyKey}
        />
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  mobileLabel,
  value,
  hint,
  tone = 'text-white',
}: {
  icon: React.ReactNode;
  label: string;
  mobileLabel?: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-3 sm:p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
        <span className="shrink-0 text-slate-400">{icon}</span>
        <span className="truncate font-medium">
          {mobileLabel ? (
            <>
              <span className="sm:hidden">{mobileLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
        </span>
      </div>
      <div className={`font-mono text-base sm:text-lg font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 truncate text-[11px] sm:text-xs text-slate-500">{hint}</div>
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
  showToast,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  total: number;
  busyKey: string | null;
  pendingConfirm: { referenceId: string; action: 'refund' | 'complete' } | null;
  setPendingConfirm: (value: { referenceId: string; action: 'refund' | 'complete' } | null) => void;
  onReconcile: (withdrawal: PendingWithdrawal, action: 'refund' | 'complete') => void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copiado al portapapeles`, 'success');
    } catch {
      showToast(`No se pudo copiar ${label}`, 'warn');
    }
  };

  if (!overview && loading) {
    return <div className="h-24 animate-pulse rounded-2xl border border-[#1e2330] bg-[#0e1118]" />;
  }

  if (!overview || overview.pendingWithdrawals.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6" />}
        title="Sin retiros pendientes"
        description="Todos los retiros fueron confirmados o reembolsados."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>{overview.pendingWithdrawals.length} solicitudes en revisión</span>
        <span>
          Total: <strong className="font-mono text-[#fbbf24]">${formatUsdt(total)} USDT</strong>
        </span>
      </div>
      <div className="divide-y divide-[#1e2330]">
        {overview.pendingWithdrawals.map((withdrawal) => {
          const isBep20 = withdrawal.method === 'BEP20';
          const destination = withdrawal.destination || withdrawal.binanceUid || '';
          const netAmount = withdrawal.netPayout || withdrawal.amount;
          const isBusyComplete = busyKey === `wd:${withdrawal.referenceId}:complete`;
          const isBusyRefund = busyKey === `wd:${withdrawal.referenceId}:refund`;
          const isConfirming = pendingConfirm?.referenceId === withdrawal.referenceId;

          return (
            <div key={withdrawal.id} className="py-3.5 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  {/* Fila 1: Monto, Usuario y Método */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-white">
                      ${formatUsdt(withdrawal.amount)} USDT
                    </span>
                    <span className="text-xs text-slate-400">
                      @{withdrawal.username}
                    </span>
                    {isBep20 ? (
                      <span className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        <Zap className="h-3 w-3" /> Express BEP-20 (BSC)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        Binance Pay (0% com.)
                      </span>
                    )}
                  </div>

                  {/* Fila 2: Destino (UID o Billetera) con botón de copiar */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="text-slate-400 font-medium">
                      {isBep20 ? 'Billetera BSC:' : 'Binance UID:'}
                    </span>
                    <span className="font-mono font-bold text-white bg-[#141822] px-2 py-0.5 rounded border border-[#212633] truncate max-w-[280px]">
                      {destination || '—'}
                    </span>
                    {destination && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(destination, isBep20 ? 'Dirección BSC' : 'UID de Binance')
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#00f090] hover:text-[#00d681] bg-[#00f090]/10 hover:bg-[#00f090]/20 px-2 py-0.5 rounded transition"
                      >
                        <Copy className="h-3 w-3" />
                        Copiar {isBep20 ? 'Dirección' : 'UID'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(netAmount, 'Monto a transferir')}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-[#1a202c] hover:bg-[#2d3748] px-2 py-0.5 rounded transition"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar ${netAmount}
                    </button>
                  </div>

                  {/* Fila 3: Detalle de red / comisión si es BEP20 */}
                  {isBep20 && withdrawal.networkFee && Number(withdrawal.networkFee) > 0 ? (
                    <div className="text-[11px] text-amber-300/90 font-mono">
                      Neto a enviar: ${formatUsdt(netAmount)} USDT (Gas BSC: ${formatUsdt(withdrawal.networkFee)} USDT)
                    </div>
                  ) : null}

                  {/* Fila 4: Fecha y Ref */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{formatDate(withdrawal.createdAt)}</span>
                    <span>·</span>
                    <span className="font-mono">Ref: {withdrawal.referenceId}</span>
                  </div>
                </div>

                {/* Botones de Acción para el Administrador */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Botón directo para abrir Binance */}
                  {isBep20 ? (
                    <a
                      href="https://www.binance.com/es/my/wallet/account/main/withdrawal/crypto/USDT"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="sm:hidden">Binance BSC</span>
                      <span className="hidden sm:inline">Abrir Retiros USDT Binance</span>
                    </a>
                  ) : (
                    <a
                      href="https://www.binance.com/es/pay"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl border border-[#F0B90B]/40 bg-[#F0B90B]/15 px-3 py-1.5 text-xs font-bold text-[#F0B90B] transition hover:bg-[#F0B90B]/25"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="sm:hidden">Binance Pay</span>
                      <span className="hidden sm:inline">Abrir Binance Pay</span>
                    </a>
                  )}

                  {/* Botón Aprobar y Completar */}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirm({
                        referenceId: withdrawal.referenceId,
                        action: 'complete',
                      })
                    }
                    disabled={isBusyComplete || isBusyRefund}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {isBusyComplete ? <Spinner className="h-3 w-3" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span className="sm:hidden">Aprobar</span>
                    <span className="hidden sm:inline">Aprobar y Completar</span>
                  </button>

                  {/* Botón Reembolsar */}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirm({
                        referenceId: withdrawal.referenceId,
                        action: 'refund',
                      })
                    }
                    disabled={isBusyComplete || isBusyRefund}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {isBusyRefund ? <Spinner className="h-3 w-3" /> : null}
                    Reembolsar
                  </button>
                </div>
              </div>

              {/* Banner de confirmación */}
              {isConfirming && pendingConfirm ? (
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
                    pendingConfirm.action === 'complete'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  <span>
                    {pendingConfirm.action === 'complete'
                      ? `¿Confirmas que ya transferiste $${netAmount} USDT a ${destination}? El retiro se marcará como completado.`
                      : `¿Deseas reembolsar $${withdrawal.amount} USDT al saldo de @${withdrawal.username}?`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onReconcile(withdrawal, pendingConfirm.action)}
                      className={`rounded-lg px-3 py-1 font-bold transition ${
                        pendingConfirm.action === 'complete'
                          ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                          : 'bg-rose-500 text-white hover:bg-rose-400'
                      }`}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingConfirm(null)}
                      className="rounded-lg border border-[#2d3447] bg-[#161a24] px-3 py-1 text-slate-300 transition hover:bg-[#1e2330]"
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
  showToast,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  busyKey: string | null;
  depositConfirm: string | null;
  setDepositConfirm: (value: string | null) => void;
  onReconcile: (deposit: PendingDeposit, action: 'verify' | 'fail') => void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copiado al portapapeles`, 'success');
    } catch {
      showToast(`No se pudo copiar ${label}`, 'warn');
    }
  };

  if (!overview && loading) {
    return <div className="h-24 animate-pulse rounded-2xl border border-[#1e2330] bg-[#0e1118]" />;
  }

  if (!overview || overview.pendingDeposits.length === 0) {
    return (
      <EmptyState
        icon={<CircleDollarSign className="h-6 w-6" />}
        title="Sin depósitos pendientes"
        description="Todas las órdenes de recarga activas fueron procesadas correctamente."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 text-xs text-slate-400">
        {overview.pendingDeposits.length} recargas recientes en verificación (últimos 30 min)
      </div>
      <div className="divide-y divide-[#1e2330]">
        {overview.pendingDeposits.map((deposit) => {
          const isBusyVerify = busyKey === `dp:${deposit.referenceId}:verify`;
          const isConfirming = depositConfirm === deposit.referenceId;

          return (
            <div key={deposit.id} className="py-3.5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold text-white">
                    ${formatUsdt(deposit.amount)} USDT
                    <span className="ml-2 font-sans text-xs font-normal text-slate-400">
                      @{deposit.username}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatDate(deposit.createdAt)}</span>
                    <span>·</span>
                    <span className="font-mono text-[11px] text-slate-400">Ref: {deposit.referenceId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(deposit.referenceId, 'Referencia')}
                      className="text-[#00f090] hover:text-[#00d681] text-[10px] font-semibold flex items-center gap-0.5 bg-[#00f090]/10 px-1.5 py-0.5 rounded"
                    >
                      <Copy className="h-2.5 w-2.5" /> Copiar
                    </button>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => onReconcile(deposit, 'verify')}
                    disabled={isBusyVerify}
                    className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 transition hover:bg-sky-500/20 disabled:opacity-50"
                  >
                    {isBusyVerify ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    <span className="sm:hidden">Verificar</span>
                    <span className="hidden sm:inline">Verificar en Binance</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositConfirm(deposit.referenceId)}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20"
                  >
                    <span className="sm:hidden">Descartar</span>
                    <span className="hidden sm:inline">Descartar intento</span>
                  </button>
                </div>
              </div>

              {isConfirming ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <span>¿Descartar este intento de depósito no pagado de @{deposit.username}?</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onReconcile(deposit, 'fail')}
                      className="rounded-lg bg-rose-500 px-3 py-1 font-bold text-white transition hover:bg-rose-400"
                    >
                      Confirmar descarte
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositConfirm(null)}
                      className="rounded-lg border border-[#2d3447] bg-[#161a24] px-3 py-1 text-slate-300 transition hover:bg-[#1e2330]"
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
  loading,
  currentUserId,
  busyKey,
  banConfirm,
  setBanConfirm,
  onUpdate,
  onInspectUser,
}: {
  users: UserProfile[];
  loading: boolean;
  currentUserId: string;
  busyKey: string | null;
  banConfirm: string | null;
  setBanConfirm: (value: string | null) => void;
  onUpdate: (user: UserProfile, payload: { role?: Role; isBanned?: boolean }) => void;
  onInspectUser: (user: UserProfile) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.username?.toLowerCase() || '').includes(q) ||
        (u.email?.toLowerCase() || '').includes(q) ||
        (u.binanceUid && u.binanceUid.includes(q))
    );
  }, [users, searchQuery]);

  if (loading && users.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-[#1e2330] bg-[#141822]/40" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Sin usuarios registrados"
        description="Aún no hay cuentas registradas en la plataforma."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Buscador de usuarios */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por usuario, email o Binance UID..."
            className="w-full rounded-xl border border-[#212633] bg-[#141822] py-2 pl-10 pr-3.5 text-xs text-white placeholder-slate-500 focus:border-[#00f090] focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500">
          Mostrando {filtered.length} de {users.length} usuarios
        </span>
      </div>

      <div className="divide-y divide-[#1e2330]">
        {filtered.map((user) => {
          const isSelf = user.id === currentUserId;
          const busy = busyKey === `user:${user.id}`;
          const confirmingBan = banConfirm === user.id;

          return (
            <div key={user.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Clic en usuario abre la inspección */}
                <button
                  type="button"
                  onClick={() => onInspectUser(user)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-80"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-xs font-bold text-[#00f090] ring-1 ring-[#00f090]/30">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-white">
                        @{user.username}
                      </span>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${roleStyles[user.role]}`}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                      {user.isBanned ? (
                        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">
                          SUSPENDIDO
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">
                      {user.email} · <span className="font-mono text-white font-semibold">${formatUsdt(user.balance)} USDT</span>
                      {user.binanceUid ? ` · UID: ${user.binanceUid}` : ''}
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Botón para ver movimientos */}
                  <button
                    type="button"
                    onClick={() => onInspectUser(user)}
                    className="flex items-center gap-1.5 rounded-xl border border-[#2d3447] bg-[#161a24] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-[#1e2330] hover:text-white"
                  >
                    <Eye className="h-3.5 w-3.5 text-[#00f090]" />
                    <span className="sm:hidden">Ver</span>
                    <span className="hidden sm:inline">Movimientos</span>
                  </button>

                  <select
                    value={user.role}
                    disabled={busy || isSelf}
                    onChange={(event) =>
                      onUpdate(user, { role: event.target.value as Role })
                    }
                    aria-label={`Rol de ${user.username}`}
                    className="rounded-xl border border-[#212633] bg-[#141822] px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:border-[#00f090] focus:outline-none disabled:opacity-50 cursor-pointer"
                  >
                    <option value="USER">Apostador</option>
                    <option value="MODERATOR">Moderador</option>
                    <option value="ADMIN">Admin</option>
                  </select>

                  {isSelf ? (
                    <span className="rounded-xl border border-[#2a3142] bg-[#181c26] px-2.5 py-1.5 text-xs font-semibold text-slate-400">
                      TÚ
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBanConfirm(confirmingBan ? null : user.id)}
                      disabled={busy}
                      className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        user.isBanned
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                      }`}
                    >
                      {busy ? (
                        <Spinner className="h-3 w-3" />
                      ) : user.isBanned ? (
                        <UserCog className="h-3.5 w-3.5" />
                      ) : (
                        <Ban className="h-3.5 w-3.5" />
                      )}
                      {user.isBanned ? 'Reactivar' : 'Suspender'}
                    </button>
                  )}
                </div>
              </div>

              {confirmingBan ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <span>
                    {user.isBanned
                      ? `¿Reactivar la cuenta de @${user.username}?`
                      : `¿Suspender a @${user.username}? No podrá apostar, recargar ni retirar.`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdate(user, { isBanned: !user.isBanned })}
                      className="rounded-lg bg-amber-500 px-3 py-1 font-bold text-slate-950 transition hover:bg-amber-400"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setBanConfirm(null)}
                      className="rounded-lg border border-[#2d3447] bg-[#161a24] px-3 py-1 text-slate-300 transition hover:bg-[#1e2330]"
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

function TransactionsTab({
  transactions,
  loading,
}: {
  transactions: TransactionRecord[];
  loading: boolean;
}) {
  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl border border-[#1e2330] bg-[#141822]/40" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-6 w-6" />}
        title="Sin movimientos"
        description="Las recargas, apuestas y retiros aparecerán aquí."
      />
    );
  }

  return (
    <div className="divide-y divide-[#1e2330]">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">
              {txLabels[tx.type]}
              <span className="ml-2 font-normal text-slate-400">
                @{tx.username}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              {formatDate(tx.createdAt)} · {tx.status}
              {tx.referenceId ? ` · ${tx.referenceId}` : ''}
            </div>
          </div>
          <div
            className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
              tx.type === 'WITHDRAW' || tx.type === 'BET_PLACED' ? 'text-slate-200' : 'text-[#00f090]'
            }`}
          >
            ${formatUsdt(tx.amount)} USDT
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTab({
  logs,
  loading,
}: {
  logs: AuditLogRecord[];
  loading: boolean;
}) {
  if (loading && logs.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl border border-[#1e2330] bg-[#141822]/40" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Sin eventos de auditoría"
        description="Las acciones de administración y moderación se registrarán aquí."
      />
    );
  }

  return (
    <div className="divide-y divide-[#1e2330]">
      {logs.map((log) => {
        const metadata = Object.keys(log.metadata).length > 0;
        return (
          <div key={log.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-[#212633] bg-[#141822] px-2 py-0.5 font-semibold text-slate-200">
                {auditLabel(log.action)}
              </span>
              <span className="text-slate-500">
                {formatDate(log.createdAt)}
              </span>
              <span className="text-slate-400 font-semibold">
                por @{log.actorUsername ?? 'sistema'}
              </span>
            </div>
            {metadata ? (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
                  Ver detalles JSON
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto rounded-xl border border-[#1e2330] bg-[#0c0d12] p-3 font-mono text-[11px] leading-relaxed text-slate-400">
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

// Modal de Inspección Completa de Usuario: Movimientos y Tickets
function UserInspectModal({
  user,
  currentUserId,
  onClose,
  onUpdate,
  busyKey,
}: {
  user: UserProfile;
  currentUserId: string;
  onClose: () => void;
  onUpdate: (user: UserProfile, payload: { role?: Role; isBanned?: boolean }) => void;
  busyKey: string | null;
}) {
  const [subTab, setSubTab] = useState<'MOVEMENTS' | 'BETS'>('MOVEMENTS');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    transactions: TransactionRecord[];
    bets: BetRecord[];
  }>({ transactions: [], bets: [] });
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === currentUserId;
  const busy = busyKey === `user:${user.id}`;

  useEffect(() => {
    let active = true;
    const loadUserHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          success: boolean;
          user: UserProfile;
          transactions: TransactionRecord[];
          bets: BetRecord[];
        }>(`/api/admin/users?userId=${user.id}`);
        if (active) {
          setData({ transactions: res.transactions, bets: res.bets });
        }
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUserHistory();
    return () => {
      active = false;
    };
  }, [user.id]);

  return (
    <Modal
      title={`Usuario: @${user.username}`}
      subtitle={`Historial financiero, tickets y configuración de cuenta.`}
      icon={<User className="h-5 w-5 text-[#00f090]" />}
      onClose={onClose}
      wide={true}
    >
      <div className="space-y-4">
        {/* Ficha Resumen del Usuario */}
        <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-[#1e2330] bg-[#141822]/70 p-4 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-base text-white">@{user.username}</span>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${roleStyles[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
              {user.isBanned && (
                <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                  SUSPENDIDO
                </span>
              )}
            </div>
            <p className="text-slate-400">{user.email}</p>
            <p className="text-slate-500 mt-1">Registrado el {formatShortDate(user.createdAt)}</p>
          </div>

          <div className="flex flex-col justify-between sm:items-end">
            <div>
              <span className="text-slate-400">Saldo actual:</span>{' '}
              <strong className="font-mono text-base font-bold text-[#00f090]">
                ${formatUsdt(user.balance)} USDT
              </strong>
            </div>
            <div className="text-slate-400 mt-1">
              Binance UID:{' '}
              <span className="font-mono text-white font-semibold">
                {user.binanceUid ? user.binanceUid : 'No configurado'}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas de Admin sobre este usuario */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1e2330] bg-[#141822]/40 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Cambiar Rol:</span>
            <select
              value={user.role}
              disabled={busy || isSelf}
              onChange={(e) => onUpdate(user, { role: e.target.value as Role })}
              className="rounded-lg border border-[#212633] bg-[#0c0d12] px-2.5 py-1 text-xs font-semibold text-white focus:border-[#00f090] focus:outline-none"
            >
              <option value="USER">Apostador</option>
              <option value="MODERATOR">Moderador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          {!isSelf && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate(user, { isBanned: !user.isBanned })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                user.isBanned
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {user.isBanned ? 'Reactivar Cuenta' : 'Suspender Cuenta'}
            </button>
          )}
        </div>

        {/* Selector de sub-pestañas: Movimientos vs Apuestas */}
        <div className="flex rounded-xl border border-[#1e2330] bg-[#141822] p-1">
          <button
            type="button"
            onClick={() => setSubTab('MOVEMENTS')}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              subTab === 'MOVEMENTS'
                ? 'bg-[#00f090] text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Movimientos ({data.transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('BETS')}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              subTab === 'BETS'
                ? 'bg-[#00f090] text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Apuestas ({data.bets.length})
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        {loading ? (
          <div className="py-8 text-center">
            <Spinner className="mx-auto h-6 w-6 text-[#00f090]" />
            <p className="mt-2 text-xs text-slate-400">Cargando historial...</p>
          </div>
        ) : subTab === 'MOVEMENTS' ? (
          data.transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Este usuario aún no tiene movimientos registrados.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {data.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-[#1e2330] bg-[#141822] p-3 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-white">{txLabels[tx.type]}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(tx.createdAt)}
                      {tx.referenceId ? ` · Ref: ${tx.referenceId}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono text-xs font-bold ${
                        tx.type === 'DEPOSIT' || tx.type === 'BET_WON' || tx.type === 'CREATOR_WIN'
                          ? 'text-[#00f090]'
                          : 'text-slate-200'
                      }`}
                    >
                      {tx.type === 'DEPOSIT' || tx.type === 'BET_WON' || tx.type === 'CREATOR_WIN'
                        ? '+'
                        : '-'}
                      ${formatUsdt(tx.amount)} USDT
                    </span>
                    <div className="text-[10px] text-slate-500 font-semibold">{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : data.bets.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Este usuario no ha colocado apuestas aún.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {data.bets.map((bet) => (
              <div
                key={bet.id}
                className="rounded-xl border border-[#1e2330] bg-[#141822] p-3 text-xs space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-white truncate">{bet.marketTitle}</span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      bet.status === 'WON'
                        ? 'bg-[#00f090]/15 text-[#00f090]'
                        : bet.status === 'ACTIVE'
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {bet.status === 'WON'
                      ? 'GANADA'
                      : bet.status === 'ACTIVE'
                        ? 'EN JUEGO'
                        : bet.status === 'REFUNDED'
                          ? 'REEMBOLSADA'
                          : 'NO ACERTADA'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>
                    Opción: <strong className="text-white">{bet.selectedOption}</strong>
                  </span>
                  <span>
                    Apostado:{' '}
                    <strong className="font-mono text-white">${formatUsdt(bet.amount)} USDT</strong>
                  </span>
                  {Number.parseFloat(bet.payoutAmount) > 0 && (
                    <span className="text-[#00f090] font-mono font-bold">
                      Premio: +${formatUsdt(bet.payoutAmount)} USDT
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

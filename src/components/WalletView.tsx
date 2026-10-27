'use client';

import { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  History,
  Info,
  Wallet,
} from 'lucide-react';
import { formatDate, formatUsdt } from '@/lib/format';
import type { TransactionRecord, TransactionType, UserProfile } from '@/lib/types';
import { EmptyState, ErrorBanner } from './ui';

const typeLabel: Record<TransactionType, string> = {
  DEPOSIT: 'Recarga',
  WITHDRAW: 'Retiro',
  BET_PLACED: 'Apuesta',
  BET_WON: 'Premio',
  FEE_DEPOSIT: 'Comisión de recarga',
  HOUSE_WIN: 'Casa',
  CREATOR_WIN: 'Premio por creador',
  REFUND: 'Reembolso',
};

const creditTypes: TransactionType[] = [
  'DEPOSIT',
  'BET_WON',
  'FEE_DEPOSIT',
  'HOUSE_WIN',
  'CREATOR_WIN',
  'REFUND',
];

function statusBadge(status: TransactionRecord['status']) {
  if (status === 'COMPLETED') {
    return 'border-[#00f090]/25 bg-[#121f18] text-[#00f090]';
  }
  if (status === 'PENDING') {
    return 'border-[#f59e0b]/30 bg-[#1a1610] text-[#fbbf24]';
  }
  return 'border-[#f43f5e]/30 bg-[#1f1113] text-[#f87171]';
}

const statusLabel: Record<TransactionRecord['status'], string> = {
  COMPLETED: 'COMPLETADO',
  PENDING: 'PENDIENTE',
  FAILED: 'FALLIDO',
};

export function WalletView({
  profile,
  transactions,
  loading,
  error,
  onRetry,
  onDeposit,
  onWithdraw,
}: {
  profile: UserProfile;
  transactions: TransactionRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const balance = Number.parseFloat(profile.balance) || 0;

  const totals = useMemo(() => {
    let deposited = 0;
    let withdrawn = 0;

    for (const tx of transactions) {
      if (tx.status !== 'COMPLETED') continue;
      if (tx.type === 'DEPOSIT') deposited += Number.parseFloat(tx.amount) || 0;
      if (tx.type === 'WITHDRAW') withdrawn += Number.parseFloat(tx.amount) || 0;
    }

    return { deposited, withdrawn };
  }, [transactions]);

  const pendingCount = transactions.filter((tx) => tx.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-[#1e2330] bg-[#11141c] p-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">
            <Wallet className="h-3.5 w-3.5 text-[#00f090]" /> Saldo disponible
          </div>
          <div className="mt-2 font-mono text-3xl font-black tabular-nums text-white">
            ${formatUsdt(balance)}
            <span className="ml-2 text-xs font-bold text-slate-400">USDT</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDeposit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[#00f090] px-3 py-2 text-xs font-bold text-black transition hover:bg-[#00d681] sm:flex-none"
            >
              <ArrowDownLeft className="h-4 w-4" /> Recargar USDT
            </button>
            <button
              type="button"
              onClick={onWithdraw}
              disabled={balance < 1}
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#2d3447] bg-[#161a24] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1e2330] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <ArrowUpRight className="h-4 w-4" /> Retirar a Binance
            </button>
          </div>
          <div className="mt-3 flex items-start gap-1.5 font-mono text-[9px] leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Recargas con Binance Pay: 1.5% de comisión de entrada, acreditada al instante. Los
            retiros a tu UID no tienen comisión.
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
            <div className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
              Recargado
            </div>
            <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#00f090]">
              +${formatUsdt(totals.deposited)}
            </div>
          </div>
          <div className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
            <div className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
              Retirado
            </div>
            <div className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-200">
              -${formatUsdt(totals.withdrawn)}
            </div>
          </div>
          <div className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
            <div className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
              Binance UID
            </div>
            <div className="mt-1 truncate font-mono text-[11px] font-bold text-slate-200">
              {profile.binanceUid ?? 'Sin registrar'}
            </div>
          </div>
          <div className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
            <div className="font-mono text-[9px] uppercase tracking-wide text-slate-500">
              Movimientos pendientes
            </div>
            <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#fbbf24]">
              {pendingCount}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[#1e2330] bg-[#11141c]">
        <div className="flex items-center gap-2 border-b border-[#1a1e28] px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-wide text-white">
          <History className="h-4 w-4 text-[#00f090]" /> Historial de movimientos
        </div>

        <div className="p-3">
          {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

          {loading && transactions.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded border border-[#1e2330] bg-[#0e1118]"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<CircleDollarSign className="h-6 w-6" />}
              title="Sin movimientos todavía"
              description="Cuando recargues, apuestes o ganes un mercado, el movimiento aparecerá aquí con su referencia."
            />
          ) : (
            <div className="divide-y divide-[#1a1e28]">
              {transactions.map((tx) => {
                const credit = creditTypes.includes(tx.type);
                const amount = Number.parseFloat(tx.amount) || 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border ${
                          credit
                            ? 'border-[#00f090]/25 bg-[#121f18] text-[#00f090]'
                            : 'border-[#f43f5e]/25 bg-[#1f1113] text-[#f87171]'
                        }`}
                      >
                        {credit ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-white">
                          {typeLabel[tx.type]}
                        </div>
                        <div className="truncate font-mono text-[9px] text-slate-500">
                          {formatDate(tx.createdAt)}
                          {tx.referenceId ? ` · ${tx.referenceId}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`font-mono text-xs font-bold tabular-nums ${
                          tx.status === 'FAILED'
                            ? 'text-slate-500 line-through'
                            : credit
                              ? 'text-[#00f090]'
                              : 'text-slate-200'
                        }`}
                      >
                        {credit && tx.status !== 'FAILED' ? '+' : '-'}${formatUsdt(amount)}
                      </div>
                      <span
                        className={`inline-block rounded border px-1 py-0.5 font-mono text-[8px] font-bold ${statusBadge(tx.status)}`}
                      >
                        {statusLabel[tx.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

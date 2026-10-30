'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CircleDollarSign,
  History,
  Info,
  Receipt,
  Wallet,
  X,
} from 'lucide-react';
import { formatDate, formatUsdt } from '@/lib/format';
import { apiFetch, errorMessage } from '@/lib/api-client';
import type { MeResponse, TransactionRecord, TransactionType, UserProfile } from '@/lib/types';
import { EmptyState, ErrorBanner, Spinner } from './ui';

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
  onRefreshProfile,
  onExplore,
}: {
  profile: UserProfile;
  transactions: TransactionRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onRefreshProfile?: () => Promise<UserProfile>;
  onExplore?: () => void;
}) {
  const [editingUid, setEditingUid] = useState(false);
  const [uidInput, setUidInput] = useState(profile.binanceUid ?? '');
  const [savingUid, setSavingUid] = useState(false);
  const [uidError, setUidError] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW' | 'WINS'>('ALL');

  const balance = Number.parseFloat(profile.balance) || 0;

  const handleSaveUid = async (e: React.FormEvent) => {
    e.preventDefault();
    setUidError(null);
    const clean = uidInput.trim();

    if (!clean) {
      setUidError('Ingresa tu Binance Pay UID.');
      return;
    }

    if (!/^[0-9]{8,10}$/.test(clean)) {
      setUidError('El UID debe ser numérico y contener entre 8 y 10 dígitos.');
      return;
    }

    setSavingUid(true);
    try {
      await apiFetch<MeResponse>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ binanceUid: clean }),
      });
      if (onRefreshProfile) {
        await onRefreshProfile();
      }
      setEditingUid(false);
    } catch (saveError) {
      setUidError(errorMessage(saveError));
    } finally {
      setSavingUid(false);
    }
  };

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

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'ALL') return transactions;
    if (txFilter === 'DEPOSIT') return transactions.filter((t) => t.type === 'DEPOSIT');
    if (txFilter === 'WITHDRAW') return transactions.filter((t) => t.type === 'WITHDRAW');
    if (txFilter === 'WINS')
      return transactions.filter((t) => t.type === 'BET_WON' || t.type === 'CREATOR_WIN');
    return transactions;
  }, [transactions, txFilter]);

  const pendingCount = transactions.filter((tx) => tx.status === 'PENDING').length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Cabecera con botón Volver a Mercados */}
      <div className="flex items-center justify-between">
        {onExplore && (
          <button
            type="button"
            onClick={onExplore}
            className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#00f090] hover:text-white active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-[#00f090]" />
            <span>Volver a Mercados</span>
          </button>
        )}
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Mi Billetera & Movimientos
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-slate-400">
            <Wallet className="h-4 w-4 text-[#00f090]" /> Saldo disponible
          </div>
          <div className="mt-2 font-mono text-3xl sm:text-4xl font-black tabular-nums text-white">
            ${formatUsdt(balance)}
            <span className="ml-2 text-xs font-bold text-emerald-400">USDT</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onDeposit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#00f090] px-4 py-2.5 text-xs font-bold text-black transition hover:bg-[#00d681] shadow-lg shadow-[#00f090]/15 active:scale-95 cursor-pointer"
            >
              <ArrowDownLeft className="h-4 w-4" /> Recargar USDT
            </button>
            <button
              type="button"
              onClick={onWithdraw}
              disabled={balance < 0.01}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#2d3447] bg-[#161a24] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1e2330] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4 text-emerald-400" /> Retirar a Binance
            </button>
          </div>
          <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            Recargas con Binance Pay automáticas. Retiros a tu UID sin comisión.
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Total Recargado
            </div>
            <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#00f090]">
              +${formatUsdt(totals.deposited)} USDT
            </div>
          </div>
          <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Total Retirado
            </div>
            <div className="mt-1 font-mono text-base font-bold tabular-nums text-slate-300">
              -${formatUsdt(totals.withdrawn)} USDT
            </div>
          </div>
          <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Binance UID
              </span>
              <button
                type="button"
                onClick={() => {
                  setUidInput(profile.binanceUid ?? '');
                  setEditingUid(true);
                }}
                className="text-[10px] font-bold text-[#00f090] hover:underline"
              >
                {profile.binanceUid ? 'Editar' : 'Afiliar'}
              </button>
            </div>
            <div className="mt-1 truncate font-mono text-xs font-bold text-slate-200">
              {profile.binanceUid ?? 'Sin registrar'}
            </div>
          </div>
          <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Pendientes
            </div>
            <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#fbbf24]">
              {pendingCount}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1a1e28] px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white">
            <Receipt className="h-4 w-4 text-[#00f090]" /> Historial de movimientos
          </div>

          <div className="flex gap-1 rounded-xl border border-[#212633] bg-[#141822] p-1">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'DEPOSIT', label: 'Recargas' },
                { id: 'WITHDRAW', label: 'Retiros' },
                { id: 'WINS', label: 'Premios' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTxFilter(t.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                  txFilter === t.id
                    ? 'bg-[#00f090] text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

          {loading && transactions.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-xl border border-[#1e2330] bg-[#0e1118]"
                />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState
              icon={<CircleDollarSign className="h-6 w-6" />}
              title="Sin movimientos en esta categoría"
              description="Cuando recargues, apuestes o ganes un mercado, el movimiento aparecerá aquí con su referencia."
            />
          ) : (
            <div className="divide-y divide-[#1a1e28]">
              {filteredTransactions.map((tx) => {
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

      {/* Modal para afiliar o editar Binance Pay UID */}
      {editingUid ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#1e2330] bg-[#11141c] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a1e28] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Afiliar Binance Pay UID
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingUid(false);
                  setUidError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUid} className="mt-4 space-y-3">
              {uidError ? (
                <div className="rounded border border-[#f43f5e]/30 bg-[#1f1113] px-3 py-2 text-[11px] text-[#fda4af]">
                  {uidError}
                </div>
              ) : null}

              <div>
                <label htmlFor="uid-input" className="block text-[11px] font-bold text-slate-300">
                  Tu Binance Pay ID / UID
                </label>
                <input
                  id="uid-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={uidInput}
                  onChange={(e) => setUidInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ej: 198274635"
                  className="mt-1 w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
                  autoFocus
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Número de 8 a 10 dígitos ubicado en tu perfil de la app de Binance.
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUid(false);
                    setUidError(null);
                  }}
                  className="flex-1 rounded border border-[#2d3447] bg-[#161a24] py-2 text-xs font-bold text-slate-300 hover:bg-[#1e2330]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUid}
                  className="flex-1 rounded bg-[#00f090] py-2 text-xs font-bold text-black hover:bg-[#00d681] disabled:opacity-50"
                >
                  {savingUid ? <Spinner className="mx-auto text-black" /> : 'Guardar UID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

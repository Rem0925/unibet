'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  RotateCcw,
  Trophy,
  TrendingUp,
  Wallet,
  XCircle,
  DollarSign,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { calculateCashoutQuote, type CashoutCalculation } from '@/lib/cashout';
import { formatShortDate, formatUsdt } from '@/lib/format';
import type { BetRecord, BetStatus, MarketSummary } from '@/lib/types';
import { EmptyState, ErrorBanner, Spinner } from './ui';

type Filter = 'ALL' | 'ACTIVE' | 'WON' | 'LOST' | 'REFUNDED';

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'ALL', label: 'TODOS' },
  { id: 'ACTIVE', label: 'ABIERTOS' },
  { id: 'WON', label: 'GANADOS' },
  { id: 'LOST', label: 'PERDIDOS' },
  { id: 'REFUNDED', label: 'REEMBOLSADOS' },
];

const statusStyle: Record<BetStatus, string> = {
  ACTIVE: 'border-[#38bdf8]/30 bg-[#0f1a24] text-[#7dd3fc]',
  WON: 'border-[#00f090]/30 bg-[#121f18] text-[#00f090]',
  LOST: 'border-[#f43f5e]/30 bg-[#1f1113] text-[#f87171]',
  REFUNDED: 'border-[#f59e0b]/30 bg-[#1a1610] text-[#fbbf24]',
};

const statusLabel: Record<BetStatus, string> = {
  ACTIVE: 'ACTIVO',
  WON: 'GANADO',
  LOST: 'PERDIDO',
  REFUNDED: 'REEMBOLSADO',
};

function numeric(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MyBets({
  bets,
  loading,
  error,
  markets = [],
  onRetry,
  onExplore,
  onSelectMarket,
  onUndoBet,
  onCashoutBet,
}: {
  bets: BetRecord[];
  loading: boolean;
  error: string | null;
  markets?: MarketSummary[];
  onRetry: () => void;
  onExplore: () => void;
  onSelectMarket?: (marketId: string) => void;
  onUndoBet?: (betId: string) => Promise<void>;
  onCashoutBet?: (betId: string, expectedPayout: number) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [undoingBetId, setUndoingBetId] = useState<string | null>(null);
  const [cashoutTarget, setCashoutTarget] = useState<{
    bet: BetRecord;
    quote: CashoutCalculation;
  } | null>(null);
  const [cashingOut, setCashingOut] = useState(false);
  const now = useNow();

  const marketsMap = useMemo(() => {
    const map = new Map<string, MarketSummary>();
    for (const m of markets) {
      map.set(m.id, m);
    }
    return map;
  }, [markets]);

  const visibleBets = useMemo(
    () => (filter === 'ALL' ? bets : bets.filter((bet) => bet.status === filter)),
    [bets, filter]
  );

  const summary = useMemo(() => {
    let staked = 0;
    let won = 0;
    let refunded = 0;
    let active = 0;

    for (const bet of bets) {
      staked += numeric(bet.amount);
      if (bet.status === 'WON') won += numeric(bet.payoutAmount);
      if (bet.status === 'REFUNDED') refunded += numeric(bet.payoutAmount || bet.amount);
      if (bet.status === 'ACTIVE') active += numeric(bet.amount);
    }

    return { staked, won, active, profit: won + refunded - (staked - active) };
  }, [bets]);

  const handleExecuteUndo = async (betId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUndoBet || undoingBetId) return;
    setUndoingBetId(betId);
    try {
      await onUndoBet(betId);
    } finally {
      setUndoingBetId(null);
    }
  };

  const handleOpenCashoutModal = (
    bet: BetRecord,
    quote: CashoutCalculation,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setCashoutTarget({ bet, quote });
  };

  const handleConfirmCashout = async () => {
    if (!cashoutTarget || !onCashoutBet || cashingOut) return;
    setCashingOut(true);
    try {
      await onCashoutBet(cashoutTarget.bet.id, cashoutTarget.quote.cashoutAmount);
      setCashoutTarget(null);
    } finally {
      setCashingOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Cabecera con botón Volver a Mercados */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExplore}
          className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#00f090] hover:text-white active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#00f090]" />
          <span>Volver a Mercados</span>
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Mis Apuestas & Historial
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SummaryCard
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Total apostado"
          value={`$${formatUsdt(summary.staked)}`}
          tone="text-white"
        />
        <SummaryCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="En juego"
          value={`$${formatUsdt(summary.active)}`}
          tone="text-[#7dd3fc]"
        />
        <SummaryCard
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="Cobrado"
          value={`$${formatUsdt(summary.won)}`}
          tone="text-[#00f090]"
        />
        <SummaryCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Resultado neto"
          value={`${summary.profit >= 0 ? '+' : '-'}$${formatUsdt(Math.abs(summary.profit))}`}
          tone={summary.profit >= 0 ? 'text-[#00f090]' : 'text-[#f87171]'}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded border px-2.5 py-1 font-mono text-[10px] font-bold transition ${
              filter === item.id
                ? 'border-[#00f090]/40 bg-[#121f18] text-[#00f090]'
                : 'border-[#222736] bg-[#11141c] text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

      {loading && bets.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-lg border border-[#1e2330] bg-[#11141c]"
            />
          ))}
        </div>
      ) : visibleBets.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title={bets.length === 0 ? 'Todavía no tienes tickets' : 'No hay tickets en este filtro'}
          description={
            bets.length === 0
              ? 'Explora los mercados abiertos y compra tu primer cupón. Los pagos se calculan con el pozo real.'
              : 'Prueba con otro estado o vuelve cuando el mercado se liquide.'
          }
          action={
            <button
              type="button"
              onClick={onExplore}
              className="rounded bg-[#00f090] px-3 py-1.5 text-xs font-bold text-black transition hover:bg-[#00d681]"
            >
              Ver mercados
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {visibleBets.map((bet) => {
            const potential =
              bet.status === 'WON' ? numeric(bet.payoutAmount) : numeric(bet.amount);
            const isRefundedWithCashout =
              bet.status === 'REFUNDED' &&
              numeric(bet.payoutAmount) > 0 &&
              numeric(bet.payoutAmount) < numeric(bet.amount);

            // Ventana de gracia (10 segundos)
            const createdAtMs = new Date(bet.createdAt).getTime();
            const closeTimeMs = new Date(bet.closeTime).getTime();
            const elapsedMs = now - createdAtMs;
            const isWithinGracePeriod =
              bet.status === 'ACTIVE' && elapsedMs <= 10000 && closeTimeMs > now;
            const graceSecondsLeft = isWithinGracePeriod
              ? Math.max(1, Math.ceil((10000 - elapsedMs) / 1000))
              : 0;

            // Retiro anticipado (Cash Out) después de la ventana de gracia
            const market = marketsMap.get(bet.marketId);
            const canCashout =
              bet.status === 'ACTIVE' &&
              !isWithinGracePeriod &&
              bet.marketStatus === 'OPEN' &&
              closeTimeMs > now;

            const cashoutQuote = canCashout
              ? calculateCashoutQuote({
                  betAmount: numeric(bet.amount),
                  optionPool: market ? Number.parseFloat(market.optionPools[bet.selectedOption] || '0') : 0,
                  totalPool: market ? Number.parseFloat(market.totalPool || '0') : numeric(bet.amount),
                })
              : null;

            return (
              <article
                key={bet.id}
                onClick={() => onSelectMarket?.(bet.marketId)}
                className="group rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4 transition hover:border-[#00f090]/40 hover:bg-[#11151f] shadow-sm cursor-pointer active:scale-[0.99]"
                title="Ver este evento en el mercado"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[9px] font-bold ${
                          isRefundedWithCashout
                            ? 'border-amber-500/40 bg-amber-950/30 text-amber-400'
                            : statusStyle[bet.status]
                        }`}
                      >
                        {isRefundedWithCashout
                          ? `CASH OUT ($${formatUsdt(bet.payoutAmount)})`
                          : statusLabel[bet.status]}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {formatShortDate(bet.createdAt)}
                      </span>
                      {isWithinGracePeriod && (
                        <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                          <RotateCcw className="h-2.5 w-2.5" />
                          <span>Cancelable ({graceSecondsLeft}s)</span>
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-bold text-white group-hover:text-emerald-300 transition">
                      {bet.marketTitle}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>Selección:</span>
                      <span className="rounded-lg border border-[#2a3142] bg-[#171b26] px-2 py-0.5 font-bold text-emerald-400">
                        {bet.selectedOption}
                      </span>
                      {bet.marketStatus === 'RESOLVED' && bet.winningOption ? (
                        <span className="text-slate-500 text-[11px]">
                          Ganador: <strong className="text-slate-300">{bet.winningOption}</strong>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center text-slate-500 group-hover:text-[#00f090] transition shrink-0 pt-1">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between border-t border-[#1a1e28] pt-2.5 font-mono text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">Monto apostado</div>
                    <div className="text-sm font-bold tabular-nums text-white">
                      ${formatUsdt(bet.amount)} USDT
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-slate-500">
                      {bet.status === 'WON'
                        ? 'Cobrado'
                        : isRefundedWithCashout
                          ? 'Recuperado (Cash Out)'
                          : bet.status === 'ACTIVE'
                            ? 'Potencial'
                            : 'Resultado'}
                    </div>
                    <div
                      className={`text-sm font-bold tabular-nums ${
                        bet.status === 'WON'
                          ? 'text-[#00f090]'
                          : isRefundedWithCashout
                            ? 'text-amber-300'
                            : bet.status === 'LOST'
                              ? 'text-[#f87171]'
                              : 'text-slate-200'
                      }`}
                    >
                      {bet.status === 'LOST'
                        ? '-$0.00'
                        : isRefundedWithCashout
                          ? `$${formatUsdt(bet.payoutAmount)} USDT`
                          : `$${formatUsdt(potential)} USDT`}
                    </div>
                  </div>
                </div>

                {/* ACCIONES: Botón Deshacer o Retiro Anticipado */}
                {isWithinGracePeriod && onUndoBet && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <div className="text-[11px] text-amber-200 font-medium">
                      ¿Te equivocaste de opción o monto?
                    </div>
                    <button
                      type="button"
                      disabled={undoingBetId === bet.id}
                      onClick={(e) => handleExecuteUndo(bet.id, e)}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 active:scale-95 transition cursor-pointer"
                    >
                      {undoingBetId === bet.id ? (
                        <Spinner className="h-3.5 w-3.5 text-amber-300" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      <span>Deshacer ({graceSecondsLeft}s) • Reembolso 100%</span>
                    </button>
                  </div>
                )}

                {canCashout && cashoutQuote && onCashoutBet && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[#222a3d] bg-[#121622] p-2.5">
                    <div className="text-[11px] text-slate-400">
                      Retiro anticipado: rescata{' '}
                      <strong className="text-emerald-400 font-mono">
                        ${formatUsdt(cashoutQuote.cashoutAmount)} USDT
                      </strong>{' '}
                      <span className="text-slate-500">
                        (pierdes ${formatUsdt(cashoutQuote.penaltyAmount)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleOpenCashoutModal(bet, cashoutQuote, e)}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 active:scale-95 transition cursor-pointer"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>Retirar ${formatUsdt(cashoutQuote.cashoutAmount)}</span>
                    </button>
                  </div>
                )}

                {bet.status === 'ACTIVE' && closeTimeMs <= now ? (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-[#fbbf24]">
                    <XCircle className="h-3 w-3" /> Esperando liquidación del moderador
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE RETIRO ANTICIPADO (CASH OUT) */}
      {cashoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-6 shadow-2xl shadow-black">
            <button
              type="button"
              onClick={() => setCashoutTarget(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-[#1a1f2c] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
              <DollarSign className="h-5 w-5" />
              <span>Confirmar Retiro Anticipado (Cash Out)</span>
            </div>

            <p className="mt-2 text-xs text-slate-300">
              ¿Deseas liquidar y retirar esta apuesta ahora mismo?
            </p>

            <div className="mt-4 space-y-2.5 rounded-xl border border-[#1e2330] bg-[#12151f] p-4 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Evento:</span>
                <span className="font-bold text-white text-right truncate max-w-[200px]">
                  {cashoutTarget.bet.marketTitle}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tu Selección:</span>
                <span className="font-bold text-emerald-400">
                  {cashoutTarget.bet.selectedOption}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-[#1e2330] pt-2">
                <span>Monto original apostado:</span>
                <span className="text-white font-bold">
                  ${formatUsdt(cashoutTarget.quote.originalAmount)} USDT
                </span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Recibirás en tu saldo:</span>
                <span className="text-sm">
                  +${formatUsdt(cashoutTarget.quote.cashoutAmount)} USDT
                </span>
              </div>
              <div className="flex justify-between text-[#f87171]">
                <span>Pérdida por retiro anticipado:</span>
                <span>
                  -${formatUsdt(cashoutTarget.quote.penaltyAmount)} USDT (-
                  {Math.round(cashoutTarget.quote.penaltyRate * 100)}%)
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Esta acción es definitiva. Al retirar, no participarás en la liquidación final del evento.
                El monto se acreditará de inmediato a tu billetera.
              </span>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCashoutTarget(null)}
                disabled={cashingOut}
                className="rounded-xl border border-[#2a3142] px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-[#1a1f2c] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCashout}
                disabled={cashingOut}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-emerald-400 active:scale-95 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {cashingOut && <Spinner className="h-4 w-4 text-black" />}
                <span>
                  Confirmar Retiro (${formatUsdt(cashoutTarget.quote.cashoutAmount)} USDT)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div className={`font-mono text-sm font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

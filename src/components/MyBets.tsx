'use client';

import { useMemo, useState } from 'react';
import { Clock, Trophy, TrendingUp, Wallet, XCircle } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { formatShortDate, formatUsdt } from '@/lib/format';
import type { BetRecord, BetStatus } from '@/lib/types';
import { EmptyState, ErrorBanner } from './ui';

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
  onRetry,
  onExplore,
}: {
  bets: BetRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onExplore: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const now = useNow();

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
      if (bet.status === 'REFUNDED') refunded += numeric(bet.amount);
      if (bet.status === 'ACTIVE') active += numeric(bet.amount);
    }

    return { staked, won, active, profit: won + refunded - (staked - active) };
  }, [bets]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        <div className="space-y-2">
          {visibleBets.map((bet) => {
            const potential =
              bet.status === 'WON' ? numeric(bet.payoutAmount) : numeric(bet.amount);
            return (
              <article
                key={bet.id}
                className="rounded-lg border border-[#1e2330] bg-[#11141c] p-3 transition hover:border-[#2d3447]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white">{bet.marketTitle}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-400">
                      <span className="rounded border border-[#2a3142] bg-[#171b26] px-1.5 py-0.5 font-bold text-slate-200">
                        {bet.selectedOption}
                      </span>
                      <span>{formatShortDate(bet.createdAt)}</span>
                      {bet.marketStatus === 'RESOLVED' && bet.winningOption ? (
                        <span className="text-slate-500">
                          Ganó: <strong className="text-slate-300">{bet.winningOption}</strong>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${statusStyle[bet.status]}`}
                  >
                    {statusLabel[bet.status]}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between border-t border-[#1a1e28] pt-2 font-mono text-[10px]">
                  <div>
                    <div className="text-slate-500">Apostado</div>
                    <div className="text-sm font-bold tabular-nums text-white">
                      ${formatUsdt(bet.amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500">
                      {bet.status === 'WON' ? 'Pago recibido' : bet.status === 'ACTIVE' ? 'En juego' : 'Resultado'}
                    </div>
                    <div
                      className={`text-sm font-bold tabular-nums ${
                        bet.status === 'WON'
                          ? 'text-[#00f090]'
                          : bet.status === 'LOST'
                            ? 'text-[#f87171]'
                            : 'text-slate-200'
                      }`}
                    >
                      {bet.status === 'LOST'
                        ? '-$0.00'
                        : `$${formatUsdt(potential)}`}
                    </div>
                  </div>
                </div>

                {bet.status === 'ACTIVE' && new Date(bet.closeTime).getTime() <= now ? (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-[#fbbf24]">
                    <XCircle className="h-3 w-3" /> Esperando liquidación del moderador
                  </div>
                ) : null}
              </article>
            );
          })}
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

'use client';

import { Clock, Trophy, Users } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { formatShortDate, formatUsdt, timeUntil } from '@/lib/format';
import type { MarketSummary } from '@/lib/types';

const barColors = ['bg-[#00f090]', 'bg-sky-400', 'bg-amber-400', 'bg-purple-400', 'bg-rose-400'];

const statusBadge: Record<MarketSummary['status'], { label: string; style: string }> = {
  OPEN: { label: 'ABIERTO', style: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  CLOSED: { label: 'EN CURSO', style: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  RESOLVED: { label: 'FINALIZADO', style: 'border-slate-700 bg-slate-800/40 text-slate-300' },
  CANCELLED: { label: 'CANCELADO', style: 'border-rose-500/30 bg-rose-500/10 text-rose-400' },
};

export function MarketCard({
  market,
  onSelectOption,
}: {
  market: MarketSummary;
  onSelectOption: (market: MarketSummary, option: string) => void;
}) {
  const now = useNow();
  const canBet = market.status === 'OPEN' && new Date(market.closeTime).getTime() > now;
  const badge = statusBadge[market.status] ?? statusBadge.OPEN;

  return (
    <article className="flex flex-col justify-between rounded-xl border border-[#212633] bg-[#12151c] p-4 shadow-sm transition hover:border-[#2f374a]">
      <div>
        {/* Cabecera: Categoría y Estado */}
        <div className="mb-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-[#262c3d] bg-[#161a24] px-2 py-0.5 text-[11px] font-semibold tracking-wider text-slate-300">
              {market.category}
            </span>
            {market.status === 'RESOLVED' && market.winningOption ? (
              <span className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                <Trophy className="h-3 w-3" />
                {market.winningOption}
              </span>
            ) : null}
          </div>
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.style}`}>
            {badge.label}
          </span>
        </div>

        {/* Pregunta / Título */}
        <h3 className="mb-2 text-base font-bold leading-snug text-white">
          {market.title}
        </h3>

        {market.description ? (
          <p className="mb-3 line-clamp-2 text-xs text-slate-400">
            {market.description}
          </p>
        ) : null}

        {/* Barra de progreso */}
        <div className="mb-3 flex h-1 w-full gap-0.5 overflow-hidden rounded-full bg-[#1b202c]">
          {market.options.map((option, index) => {
            const percentage = Number.parseFloat(
              market.odds.optionsOdds[option]?.percentage.replace('%', '') ?? '0'
            );
            return (
              <div
                key={option}
                style={{ width: `${Math.max(0, percentage)}%` }}
                className={`h-full ${barColors[index % barColors.length]}`}
                title={`${option}: ${percentage.toFixed(1)}%`}
              />
            );
          })}
        </div>

        {/* Opciones de Apuesta */}
        <div className="mb-3 space-y-2">
          {market.options.map((option) => {
            const optionOdds = market.odds.optionsOdds[option] ?? {
              pool: '0.00',
              percentage: '0%',
              multiplier: '1.00x',
            };
            const isWinning = market.status === 'RESOLVED' && market.winningOption === option;

            return (
              <button
                key={option}
                type="button"
                disabled={!canBet}
                onClick={() => onSelectOption(market, option)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                  isWinning
                    ? 'border-[#00f090] bg-[#00f090]/10 text-white'
                    : canBet
                      ? 'border-[#262c3d] bg-[#161a24] text-slate-200 hover:border-emerald-500/50 hover:bg-[#1a2130]'
                      : 'cursor-not-allowed border-[#1c202a] bg-[#0e1017] text-slate-500'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <span className="block truncate text-xs font-bold text-white">{option}</span>
                  <span className="text-[10px] text-slate-400">{optionOdds.percentage}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {optionOdds.multiplier}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer del Mercado */}
      <div className="flex items-center justify-between border-t border-[#1e2330] pt-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            Pozo: <strong className="font-mono font-bold text-white">${formatUsdt(market.totalPool)} USDT</strong>
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {market.betCount}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="h-3 w-3 text-slate-500" />
          <span>
            {market.status === 'OPEN' ? timeUntil(market.closeTime, now) : formatShortDate(market.closeTime)}
          </span>
        </div>
      </div>
    </article>
  );
}

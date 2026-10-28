'use client';

import { Clock, Info, Trophy, Users } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { MARKET_CATEGORY_LABELS } from '@/lib/constants';
import { formatShortDate, formatUsdt, timeUntil } from '@/lib/format';
import type { MarketSummary } from '@/lib/types';

const barColors = ['bg-[#00f090]', 'bg-[#38bdf8]', 'bg-[#f59e0b]', 'bg-[#a855f7]', 'bg-[#f43f5e]'];

const statusLabels: Record<MarketSummary['status'], string> = {
  OPEN: 'ABIERTO',
  CLOSED: 'EN CURSO',
  RESOLVED: 'FINALIZADO',
  CANCELLED: 'CANCELADO',
};

const statusStyles: Record<MarketSummary['status'], string> = {
  OPEN: 'text-[#00f090] border-[#00f090]/30 bg-[#121f18]',
  CLOSED: 'text-[#f59e0b] border-[#f59e0b]/30 bg-[#1a1610]',
  RESOLVED: 'text-slate-300 border-[#2a3142] bg-[#171b26]',
  CANCELLED: 'text-[#f43f5e] border-[#f43f5e]/30 bg-[#1f1113]',
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
  const totalPool = Number.parseFloat(market.totalPool) || 0;

  return (
    <article className="flex flex-col justify-between rounded-lg border border-[#1e2330] bg-[#11141c] p-4 transition hover:border-[#2d3447]">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] text-slate-400">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-[#252a3a] bg-[#171a24] px-1.5 py-0.5 font-bold uppercase text-slate-300">
              {MARKET_CATEGORY_LABELS[market.category]}
            </span>
            {market.isOfficial ? (
              <span className="rounded border border-[#00f090]/30 bg-[#121f24] px-1.5 py-0.5 font-bold uppercase text-[#00f090]">
                OFICIAL
              </span>
            ) : null}
            {market.status === 'RESOLVED' && market.winningOption ? (
              <span className="flex items-center gap-1 rounded border border-[#00f090]/30 bg-[#121f18] px-1.5 py-0.5 font-bold text-[#00f090]">
                <Trophy className="h-3 w-3" />
                {market.winningOption}
              </span>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 font-bold uppercase ${statusStyles[market.status]}`}
          >
            {statusLabels[market.status]}
          </span>
        </div>

        <h3 className="mb-1 text-sm font-bold leading-snug text-white">{market.title}</h3>
        {market.description ? (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {market.description}
          </p>
        ) : null}

        <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wide text-slate-500">
          <span>Distribución del pozo</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {market.status === 'OPEN' ? timeUntil(market.closeTime, now) : formatShortDate(market.closeTime)}
          </span>
        </div>
        <div className="mb-3 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-sm border border-[#252b3b] bg-[#181c26]">
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

        <div className="mb-3 space-y-1.5">
          {market.options.map((option) => {
            const optionOdds = market.odds.optionsOdds[option] ?? {
              pool: '0.00',
              percentage: '0.0%',
              multiplier: '1.00x',
            };
            const isWinning = market.status === 'RESOLVED' && market.winningOption === option;
            const noBets = Number.parseFloat(optionOdds.pool) === 0 && totalPool > 0;

            return (
              <button
                key={option}
                type="button"
                disabled={!canBet}
                onClick={() => onSelectOption(market, option)}
                className={`flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left font-mono text-xs transition ${
                  isWinning
                    ? 'border-[#00f090] bg-[#14261d] text-[#00f090]'
                    : canBet
                      ? 'border-[#222736] bg-[#141822] text-slate-300 hover:border-[#2e3548] hover:bg-[#1a202d]'
                      : 'cursor-not-allowed border-[#1e2330] bg-[#10131a] text-slate-500'
                }`}
                aria-label={
                  canBet ? `Apostar a ${option}` : `${option}, mercado no disponible para apostar`
                }
              >
                <span className="min-w-0">
                  <span className="mr-2 font-bold text-white">{option}</span>
                  <span className="text-[10px] text-slate-500">({optionOdds.percentage})</span>
                  {noBets ? (
                    <span className="ml-2 rounded border border-[#f59e0b]/30 bg-[#1a1610] px-1 py-0.5 text-[9px] font-bold text-[#f59e0b]">
                      SIN APUESTAS
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded border border-[#2a3245] bg-[#1a202d] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#00f090]">
                  {optionOdds.multiplier}
                </span>
              </button>
            );
          })}
        </div>

        {market.status === 'CANCELLED' && market.cancelledReason ? (
          <div className="mb-3 rounded border border-[#f43f5e]/25 bg-[#1f1113] px-2 py-1.5 text-[10px] text-[#fda4af]">
            Motivo de cancelación: {market.cancelledReason}
          </div>
        ) : null}

        {market.status === 'OPEN' && !canBet ? (
          <div className="mb-3 flex items-center gap-1 rounded border border-[#f59e0b]/25 bg-[#181511] px-2 py-1.5 text-[10px] text-[#fbbf24]">
            <Info className="h-3 w-3 shrink-0" />
            La hora de cierre ya pasó. Un moderador debe cerrar el mercado.
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#1a1e28] pt-2 font-mono text-[10px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            Pozo:{' '}
            <strong className="text-white">${formatUsdt(market.totalPool)} USDT</strong>
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {market.betCount}
          </span>
        </div>
        <div className="min-w-0 truncate text-right">
          Por <strong className="text-slate-300">@{market.creatorUsername}</strong>
        </div>
      </div>

      {market.resolutionSource ? (
        <div className="mt-1 truncate font-mono text-[9px] text-slate-600" title={market.resolutionSource}>
          Fuente: {market.resolutionSource}
        </div>
      ) : null}
    </article>
  );
}

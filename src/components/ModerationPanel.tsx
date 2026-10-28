'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Clock, ShieldCheck, Trophy } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatShortDate, formatUsdt } from '@/lib/format';
import type { MarketSummary } from '@/lib/types';
import { EmptyState, ErrorBanner, Spinner } from './ui';

const statusLabel: Record<MarketSummary['status'], string> = {
  OPEN: 'Abierto',
  CLOSED: 'Cerrado',
  RESOLVED: 'Liquidado',
  CANCELLED: 'Cancelado',
};

const statusStyle: Record<MarketSummary['status'], string> = {
  OPEN: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  CLOSED: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  RESOLVED: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  CANCELLED: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

function requiresAction(market: MarketSummary, now: number): boolean {
  if (market.status === 'CLOSED') return true;
  if (market.status === 'OPEN' && new Date(market.closeTime).getTime() <= now) return true;
  return false;
}

export function ModerationPanel({
  markets,
  loading,
  error,
  onRetry,
  onResolve,
  onCancel,
  onChanged,
  showToast,
}: {
  markets: MarketSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onResolve: (market: MarketSummary) => void;
  onCancel: (market: MarketSummary) => void;
  onChanged: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const [filter, setFilter] = useState<'ACTION' | 'ALL'>('ACTION');
  const [closingId, setClosingId] = useState<string | null>(null);
  const now = useNow();

  const visible = useMemo(() => {
    const actionable = markets.filter(
      (market) => market.status === 'OPEN' || market.status === 'CLOSED'
    );

    const base = filter === 'ACTION' ? actionable : markets;
    return [...base].sort((a, b) => {
      const actionDiff = Number(requiresAction(b, now)) - Number(requiresAction(a, now));
      if (actionDiff !== 0) return actionDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filter, markets, now]);

  const actionCount = markets.filter((market) => requiresAction(market, now)).length;

  const closeMarket = async (market: MarketSummary) => {
    setClosingId(market.id);
    try {
      const response = await apiFetch<{ success: boolean; message: string }>('/api/markets/close', {
        method: 'POST',
        body: JSON.stringify({ marketId: market.id }),
      });
      showToast(response.message || 'Mercado cerrado', 'success');
      await onChanged();
    } catch (closeError) {
      showToast(errorMessage(closeError), 'error');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Panel de Moderación</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cierra recepción de apuestas, certifica ganadores o cancela eventos en caso de fuerza mayor.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5 rounded-xl border border-[#1e2330] bg-[#141822] p-1">
          <button
            type="button"
            onClick={() => setFilter('ACTION')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === 'ACTION'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendientes ({actionCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === 'ALL'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({markets.length})
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

      {loading && markets.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl border border-[#1e2330] bg-[#11141c]"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-[#00f090]" />}
          title={filter === 'ACTION' ? 'Todo al día' : 'No hay mercados'}
          description={
            filter === 'ACTION'
              ? 'No hay mercados esperando cierre ni resolución en este momento.'
              : 'Aún no se ha creado ningún mercado.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((market) => {
            const overdue =
              market.status === 'OPEN' && new Date(market.closeTime).getTime() <= now;
            const pending = requiresAction(market, now);
            const canResolve = market.status === 'OPEN' || market.status === 'CLOSED';
            const canCancel = canResolve;

            return (
              <article
                key={market.id}
                className={`rounded-2xl border bg-[#0c0d12] p-4 transition ${
                  pending ? 'border-amber-500/30' : 'border-[#1e2330]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle[market.status]}`}
                      >
                        {statusLabel[market.status]}
                      </span>
                      {overdue ? (
                        <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Tiempo expirado
                        </span>
                      ) : null}
                      {market.isOfficial ? (
                        <span className="rounded-full border border-[#00f090]/30 bg-[#00f090]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#00f090]">
                          Oficial
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-base font-bold text-white">{market.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {formatShortDate(market.closeTime)}
                      </span>
                      <span>
                        Pozo: <strong className="font-mono text-white">${formatUsdt(market.totalPool)} USDT</strong>
                      </span>
                      <span>
                        Apuestas: <strong className="font-mono text-white">{market.betCount}</strong>
                      </span>
                      <span>@{market.creatorUsername}</span>
                      {market.winningOption ? (
                        <span className="flex items-center gap-1 font-semibold text-[#00f090]">
                          <Trophy className="h-3.5 w-3.5" /> {market.winningOption}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {canResolve || canCancel ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#1e2330] pt-3">
                    {market.status === 'OPEN' ? (
                      <button
                        type="button"
                        onClick={() => closeMarket(market)}
                        disabled={closingId === market.id}
                        className="flex items-center gap-1.5 rounded-xl border border-[#2d3447] bg-[#161a24] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-[#1e2330] disabled:opacity-50"
                      >
                        {closingId === market.id ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        Cerrar apuestas
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onResolve(market)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#00f090] px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-[#00d681]"
                    >
                      <Trophy className="h-3.5 w-3.5" /> Resolver
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancel(market)}
                      className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20"
                    >
                      <Ban className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>
                ) : market.cancelledReason ? (
                  <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                    Motivo de cancelación: {market.cancelledReason}
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

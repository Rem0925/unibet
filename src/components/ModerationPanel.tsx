'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Clock, ShieldCheck, Trophy } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatShortDate, formatUsdt } from '@/lib/format';
import type { MarketSummary } from '@/lib/types';
import { EmptyState, ErrorBanner, Spinner } from './ui';

const statusLabel: Record<MarketSummary['status'], string> = {
  OPEN: 'ABIERTO',
  CLOSED: 'CERRADO',
  RESOLVED: 'LIQUIDADO',
  CANCELLED: 'CANCELADO',
};

const statusStyle: Record<MarketSummary['status'], string> = {
  OPEN: 'border-[#00f090]/30 bg-[#121f18] text-[#00f090]',
  CLOSED: 'border-[#f59e0b]/30 bg-[#181511] text-[#fbbf24]',
  RESOLVED: 'border-[#38bdf8]/30 bg-[#0f1a24] text-[#7dd3fc]',
  CANCELLED: 'border-[#f43f5e]/30 bg-[#1f1113] text-[#f87171]',
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
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-2 rounded-lg border border-[#1e2330] bg-[#11141c] p-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#c084fc]" />
          <div>
            <h2 className="text-sm font-bold text-white">Sala de moderación</h2>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Cierra apuestas, certifica ganadores o cancela con reembolso total. Por integridad,
              no puedes moderar mercados donde tengas apuestas activas.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setFilter('ACTION')}
            className={`rounded border px-2.5 py-1 font-mono text-[10px] font-bold transition ${
              filter === 'ACTION'
                ? 'border-[#f59e0b]/40 bg-[#181511] text-[#fbbf24]'
                : 'border-[#222736] bg-[#0e1118] text-slate-400 hover:text-white'
            }`}
          >
            PENDIENTES ({actionCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`rounded border px-2.5 py-1 font-mono text-[10px] font-bold transition ${
              filter === 'ALL'
                ? 'border-[#2a3142] bg-[#181c26] text-white'
                : 'border-[#222736] bg-[#0e1118] text-slate-400 hover:text-white'
            }`}
          >
            TODOS ({markets.length})
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

      {loading && markets.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-lg border border-[#1e2330] bg-[#11141c]"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title={filter === 'ACTION' ? 'Nada pendiente por moderar' : 'Sin mercados'}
          description={
            filter === 'ACTION'
              ? 'No hay mercados abiertos ni cerrados esperando liquidación. Buen trabajo.'
              : 'Crea el primer mercado desde el botón Crear del encabezado.'
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((market) => {
            const overdue =
              market.status === 'OPEN' && new Date(market.closeTime).getTime() <= now;
            const pending = requiresAction(market, now);
            const canResolve = market.status === 'OPEN' || market.status === 'CLOSED';
            const canCancel = canResolve;

            return (
              <article
                key={market.id}
                className={`rounded-lg border bg-[#11141c] p-3 ${
                  pending ? 'border-[#f59e0b]/30' : 'border-[#1e2330]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 font-mono text-[9px]">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-bold ${statusStyle[market.status]}`}
                      >
                        {statusLabel[market.status]}
                      </span>
                      {overdue ? (
                        <span className="flex items-center gap-1 rounded border border-[#f59e0b]/30 bg-[#181511] px-1.5 py-0.5 font-bold text-[#fbbf24]">
                          <AlertTriangle className="h-2.5 w-2.5" /> HORA VENCIDA
                        </span>
                      ) : null}
                      {market.isOfficial ? (
                        <span className="rounded border border-[#00f090]/25 bg-[#121f18] px-1.5 py-0.5 font-bold text-[#00f090]">
                          OFICIAL
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-sm font-bold leading-snug text-white">{market.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatShortDate(market.closeTime)}
                      </span>
                      <span>
                        Pozo{' '}
                        <strong className="text-slate-300">
                          ${formatUsdt(market.totalPool)}
                        </strong>
                      </span>
                      <span>
                        Tickets <strong className="text-slate-300">{market.betCount}</strong>
                      </span>
                      <span className="truncate">@{market.creatorUsername}</span>
                      {market.winningOption ? (
                        <span className="flex items-center gap-1 text-[#00f090]">
                          <Trophy className="h-3 w-3" /> {market.winningOption}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {canResolve || canCancel ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#1a1e28] pt-2">
                    {market.status === 'OPEN' ? (
                      <button
                        type="button"
                        onClick={() => closeMarket(market)}
                        disabled={closingId === market.id}
                        className="flex items-center gap-1 rounded border border-[#2d3447] bg-[#161a24] px-2 py-1 font-mono text-[10px] font-bold text-slate-200 transition hover:bg-[#1e2330] disabled:opacity-50"
                      >
                        {closingId === market.id ? (
                          <Spinner className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        Cerrar apuestas
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onResolve(market)}
                      className="flex items-center gap-1 rounded bg-[#00f090] px-2 py-1 font-mono text-[10px] font-bold text-black transition hover:bg-[#00d681]"
                    >
                      <Trophy className="h-3 w-3" /> Resolver
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancel(market)}
                      className="flex items-center gap-1 rounded border border-[#f43f5e]/30 bg-[#1f1113] px-2 py-1 font-mono text-[10px] font-bold text-[#f87171] transition hover:bg-[#2a1518]"
                    >
                      <Ban className="h-3 w-3" /> Cancelar
                    </button>
                  </div>
                ) : market.cancelledReason ? (
                  <div className="mt-2 rounded border border-[#f43f5e]/20 bg-[#1f1113] px-2 py-1.5 text-[10px] text-[#fda4af]">
                    {market.cancelledReason}
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

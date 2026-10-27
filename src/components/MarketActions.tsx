'use client';

import { useState } from 'react';
import { AlertTriangle, Ban, Trophy, XCircle } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatUsdt } from '@/lib/format';
import type { MarketSummary } from '@/lib/types';
import { Modal, Spinner } from './ui';

interface ActionResponse {
  success: boolean;
  message: string;
}

export function ResolveMarketModal({
  market,
  onClose,
  onDone,
  showToast,
}: {
  market: MarketSummary;
  onClose: () => void;
  onDone: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const [winningOption, setWinningOption] = useState(market.winningOption ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = Number.parseFloat(market.totalPool) || 0;
  const winnerPool = Number.parseFloat(market.optionPools[winningOption] ?? '0') || 0;
  const hasWinners = winnerPool > 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!winningOption) {
      setError('Selecciona la opción ganadora.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<ActionResponse>('/api/markets/resolve', {
        method: 'POST',
        body: JSON.stringify({ marketId: market.id, winningOption }),
      });

      showToast(response.message || 'Mercado liquidado', 'success');
      await onDone();
      onClose();
    } catch (resolveError) {
      setError(errorMessage(resolveError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Liquidar mercado"
      subtitle="Esta acción reparte el pozo de forma irreversible. Verifica el resultado antes de confirmar."
      icon={<Trophy className="h-4 w-4 text-[#00f090]" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded border border-[#1d222e] bg-[#0c0e14] p-2.5">
          <div className="text-[11px] font-bold text-white">{market.title}</div>
          <div className="mt-1 font-mono text-[10px] text-slate-400">
            Pozo total: <strong className="text-white">${formatUsdt(pool)} USDT</strong>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[11px] font-bold text-slate-300">
            Opción ganadora
          </legend>
          <div className="space-y-1.5">
            {market.options.map((option) => {
              const optionPool = Number.parseFloat(market.optionPools[option] ?? '0') || 0;
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded border px-3 py-2 font-mono text-xs transition ${
                    winningOption === option
                      ? 'border-[#00f090] bg-[#14261d] text-[#00f090]'
                      : 'border-[#222736] bg-[#141822] text-slate-300 hover:border-[#2e3548]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <input
                      type="radio"
                      name="winning-option"
                      value={option}
                      checked={winningOption === option}
                      onChange={() => setWinningOption(option)}
                      className="accent-[#00f090]"
                    />
                    <span className="truncate font-bold text-white">{option}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">
                    ${formatUsdt(optionPool)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {winningOption ? (
          <div className="space-y-1 rounded border border-[#1d222e] bg-[#0c0e14] p-2.5 text-[10px]">
            {hasWinners ? (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>Reparto a ganadores:</span>
                  <span className="text-[#00f090]">${formatUsdt(pool)} USDT (100%)</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Apuestas en esa opción:</span>
                  <span>${formatUsdt(winnerPool)} USDT</span>
                </div>
              </>
            ) : (
              <>
                <div className="mb-1 flex items-center gap-1 font-bold text-[#fbbf24]">
                  <AlertTriangle className="h-3 w-3" /> Nadie apostó a esta opción
                </div>
                <div className="text-[10px] leading-relaxed text-slate-500">
                  No habrá pagos a ganadores; el pozo se liquida según la regla del pozo huérfano.
                </div>
              </>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-[#f43f5e]/35 bg-[#1f1113] px-3 py-2 text-[10px] leading-relaxed text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || !winningOption}
          className="flex w-full items-center justify-center gap-2 rounded bg-[#00f090] py-2.5 text-xs font-bold text-black transition hover:bg-[#00d681] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Spinner /> : <Trophy className="h-4 w-4" />}
          {loading ? 'Liquidando…' : 'Confirmar y repartir pozo'}
        </button>

        <p className="text-[9px] leading-relaxed text-slate-600">
          Si ningún ticket acertó, se aplica la regla del pozo huérfano. Por integridad, no puedes liquidar mercados donde tengas apuestas activas.
        </p>
      </form>
    </Modal>
  );
}

export function CancelMarketModal({
  market,
  onClose,
  onDone,
  showToast,
}: {
  market: MarketSummary;
  onClose: () => void;
  onDone: () => Promise<void> | void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = Number.parseFloat(market.totalPool) || 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (reason.trim().length < 5) {
      setError('Escribe un motivo de al menos 5 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<ActionResponse>('/api/markets/cancel', {
        method: 'POST',
        body: JSON.stringify({ marketId: market.id, reason: reason.trim() }),
      });

      showToast(response.message || 'Mercado cancelado', 'success');
      await onDone();
      onClose();
    } catch (cancelError) {
      setError(errorMessage(cancelError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Cancelar mercado"
      subtitle="Se devolverá el 100% de lo apostado a cada ticket activo."
      icon={<Ban className="h-4 w-4 text-[#f43f5e]" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded border border-[#1d222e] bg-[#0c0e14] p-2.5">
          <div className="text-[11px] font-bold text-white">{market.title}</div>
          <div className="mt-1 font-mono text-[10px] text-slate-400">
            A reembolsar: <strong className="text-[#fbbf24]">${formatUsdt(pool)} USDT</strong>
          </div>
        </div>

        <div className="flex items-start gap-1.5 rounded border border-[#f43f5e]/25 bg-[#1f1113] px-2.5 py-2 text-[10px] leading-relaxed text-[#fda4af]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Cancela solo si el evento no puede resolverse con claridad. Por integridad, no puedes
          cancelar mercados donde tengas apuestas activas.
        </div>

        <div>
          <label htmlFor="cancel-reason" className="mb-1 block text-[11px] font-bold text-slate-300">
            Motivo de cancelación
          </label>
          <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setReason('Empate técnico no contemplado en las opciones de apuesta')}
              className="rounded border border-[#2a3040] bg-[#141822] px-2 py-0.5 text-slate-300 hover:border-slate-400"
            >
              🤝 Empate no contemplado
            </button>
            <button
              type="button"
              onClick={() => setReason('Evento suspendido oficialmente por lluvia o corte eléctrico')}
              className="rounded border border-[#2a3040] bg-[#141822] px-2 py-0.5 text-slate-300 hover:border-slate-400"
            >
              🌧️ Suspendido / Lluvia
            </button>
            <button
              type="button"
              onClick={() => setReason('Baja de participante o enunciado ambiguo')}
              className="rounded border border-[#2a3040] bg-[#141822] px-2 py-0.5 text-slate-300 hover:border-slate-400"
            >
              ⚠️ Enunciado ambiguo
            </button>
          </div>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Ej: el evento fue suspendido sin resultado oficial."
            className="w-full resize-none rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded border border-[#f43f5e]/35 bg-[#1f1113] px-3 py-2 text-[10px] leading-relaxed text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded border border-[#2d3447] bg-[#161a24] py-2.5 text-xs font-bold text-white transition hover:bg-[#1e2330] disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" /> Volver
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded bg-[#f43f5e] py-2.5 text-xs font-bold text-white transition hover:bg-[#e11d48] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Spinner /> : <Ban className="h-4 w-4" />}
            {loading ? 'Cancelando…' : 'Cancelar y reembolsar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

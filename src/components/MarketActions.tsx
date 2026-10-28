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
      subtitle="Define el resultado definitivo del evento para distribuir los fondos."
      icon={<Trophy className="h-5 w-5 text-[#00f090]" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5">
          <div className="text-sm font-semibold text-white">{market.title}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>Pozo acumulado:</span>
            <strong className="font-mono text-white">${formatUsdt(pool)} USDT</strong>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-300">
            Selecciona la opción ganadora
          </label>
          <div className="space-y-2">
            {market.options.map((option) => {
              const optionPool = Number.parseFloat(market.optionPools[option] ?? '0') || 0;
              const isSelected = winningOption === option;
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                    isSelected
                      ? 'border-[#00f090] bg-[#00f090]/10 text-white'
                      : 'border-[#1e2330] bg-[#141822] text-slate-300 hover:border-[#2d3447]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="winning-option"
                      value={option}
                      checked={isSelected}
                      onChange={() => setWinningOption(option)}
                      className="accent-[#00f090]"
                    />
                    <span className="font-medium text-sm text-white">{option}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    ${formatUsdt(optionPool)} USDT
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {winningOption ? (
          <div className="rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5 text-xs">
            {hasWinners ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>A distribuir a ganadores:</span>
                  <span className="font-mono font-bold text-[#00f090]">${formatUsdt(pool)} USDT</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Total apostado en esta opción:</span>
                  <span className="font-mono">${formatUsdt(winnerPool)} USDT</span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-xs leading-relaxed">
                  Ningún participante apostó a esta opción ganadora.
                </span>
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || !winningOption}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Spinner className="text-black" /> : <Trophy className="h-4 w-4" />}
          {loading ? 'Liquidando…' : 'Confirmar y distribuir fondos'}
        </button>
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
      title="Cancelar evento"
      subtitle="Cancela el mercado y reembolsa el 100% de los fondos a los participantes."
      icon={<Ban className="h-5 w-5 text-[#f43f5e]" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5">
          <div className="text-sm font-semibold text-white">{market.title}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>Total a reembolsar:</span>
            <strong className="font-mono text-[#fbbf24]">${formatUsdt(pool)} USDT</strong>
          </div>
        </div>

        <div>
          <label htmlFor="cancel-reason" className="mb-1.5 block text-xs font-semibold text-slate-300">
            Motivo de cancelación
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setReason('Empate técnico no contemplado en las opciones')}
              className="rounded-lg border border-[#2a3040] bg-[#141822] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              Empate no contemplado
            </button>
            <button
              type="button"
              onClick={() => setReason('Evento suspendido oficialmente')}
              className="rounded-lg border border-[#2a3040] bg-[#141822] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              Suspendido oficialmente
            </button>
            <button
              type="button"
              onClick={() => setReason('Enunciado ambiguo o error en opciones')}
              className="rounded-lg border border-[#2a3040] bg-[#141822] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              Enunciado con error
            </button>
          </div>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Describe brevemente la causa de cancelación..."
            className="w-full resize-none rounded-xl border border-[#222736] bg-[#090a0f] p-3 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#2d3447] bg-[#161a24] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e2330] disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" /> Volver
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#f43f5e] py-2.5 text-sm font-bold text-white transition hover:bg-[#e11d48] disabled:opacity-60"
          >
            {loading ? <Spinner /> : <Ban className="h-4 w-4" />}
            {loading ? 'Cancelando…' : 'Cancelar y reembolsar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

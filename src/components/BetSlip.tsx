'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Wallet, X } from 'lucide-react';
import { BET_MAX, BET_MIN, BET_USER_MARKET_MAX } from '@/lib/constants';
import { formatUsdt } from '@/lib/format';
import { estimateBetPayout } from '@/lib/odds';
import type { MarketSummary } from '@/lib/types';
import { Spinner } from './ui';

export function BetSlip({
  market,
  option,
  balance,
  placing,
  userActiveInMarket = 0,
  inline = false,
  onClose,
  onConfirm,
}: {
  market: MarketSummary;
  option: string;
  balance: number;
  placing: boolean;
  userActiveInMarket?: number;
  inline?: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('5.00');

  const optionPool = Number.parseFloat(market.optionPools[option] ?? '0') || 0;
  const currentMultiplier = market.odds.optionsOdds[option]?.multiplier ?? '—';
  const amountNumber = Number.parseFloat(amount);
  const validAmount = Number.isFinite(amountNumber) && amountNumber > 0;
  const remainingMarketCap = Math.max(0, BET_USER_MARKET_MAX - userActiveInMarket);

  const estimate = useMemo(
    () =>
      estimateBetPayout({
        amount: validAmount ? amountNumber : 0,
        totalPool: market.totalPool,
        optionPool,
      }),
    [validAmount, amountNumber, market.totalPool, optionPool]
  );

  const validationError = useMemo(() => {
    if (!validAmount) return 'Introduce un monto válido.';
    if (amountNumber < BET_MIN) return `El mínimo por apuesta es $${formatUsdt(BET_MIN)} USDT.`;
    if (amountNumber > BET_MAX) return `El máximo por apuesta es $${formatUsdt(BET_MAX)} USDT.`;
    if (amountNumber > remainingMarketCap) {
      return `Superas el límite de $${BET_USER_MARKET_MAX} USDT por mercado (cupo: $${formatUsdt(remainingMarketCap)}).`;
    }
    if (amountNumber > balance) return 'Saldo insuficiente en tu cuenta.';
    return null;
  }, [amountNumber, balance, remainingMarketCap, validAmount]);

  const addAmount = (increment: number) => {
    const current = validAmount ? amountNumber : 0;
    const next = Math.min(BET_MAX, remainingMarketCap, current + increment);
    setAmount(Math.max(0, next).toFixed(2));
  };

  const handleMax = () => {
    const maxVal = Math.max(0, Math.min(balance, BET_MAX, remainingMarketCap));
    setAmount(maxVal.toFixed(2));
  };

  const containerClasses = inline
    ? 'rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-4 shadow-xl'
    : 'fixed bottom-0 right-0 z-50 w-full border-t border-[#1e2330] bg-[#0c0d12]/95 backdrop-blur-md p-4 shadow-2xl sm:bottom-4 sm:right-4 sm:w-80 sm:rounded-2xl sm:border';

  return (
    <div className={containerClasses}>
      <div className="mb-3 flex items-center justify-between border-b border-[#1e2330] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#00f090] animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Boleto de Apuesta
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-[#1a1f2c] hover:text-white"
          aria-label="Cerrar cupón"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 truncate text-xs text-slate-400 font-medium">{market.title}</div>
      <div className="mb-3.5 flex items-center justify-between rounded-xl border border-[#212633] bg-[#141822] p-3">
        <span className="truncate text-sm font-bold text-white">{option}</span>
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className="text-slate-400 line-through text-[11px]">{currentMultiplier}</span>
          <ArrowRight className="h-3 w-3 text-slate-500" />
          <span className="font-mono text-xs font-bold text-[#00f090] bg-[#00f090]/10 px-2 py-0.5 rounded-md">
            {estimate.multiplier}
          </span>
        </div>
      </div>

      <div className="mb-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <label htmlFor="bet-amount">Monto en USDT</label>
          <span className="text-[11px] text-slate-500 font-normal">
            Cupo: ${formatUsdt(remainingMarketCap)}
          </span>
        </div>

        <div className="relative">
          <input
            id="bet-amount"
            type="number"
            inputMode="decimal"
            min={BET_MIN}
            max={Math.min(BET_MAX, remainingMarketCap)}
            step="0.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-[#212633] bg-[#090a0f] px-3.5 py-2.5 pr-14 font-mono text-sm font-bold text-white focus:border-[#00f090] focus:outline-none"
          />
          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-500">USDT</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[1, 5, 10, 25].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => addAmount(chip)}
              className="rounded-lg border border-[#212633] bg-[#141822] py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              +${chip}
            </button>
          ))}
          <button
            type="button"
            onClick={handleMax}
            className="rounded-lg border border-[#00f090]/30 bg-[#00f090]/10 py-1 text-xs font-bold text-[#00f090] transition hover:bg-[#00f090]/20"
          >
            MAX
          </button>
        </div>
      </div>

      <div className="mb-3.5 space-y-1.5 rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Ganancia potencial:</span>
          <strong className="font-mono font-bold text-[#00f090]">${estimate.payout} USDT</strong>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Retorno neto:</span>
          <span className="font-mono text-slate-300">+${estimate.profit} USDT</span>
        </div>
      </div>

      {validationError ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onConfirm(amountNumber)}
        disabled={placing || Boolean(validationError)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] shadow-lg shadow-[#00f090]/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placing ? <Spinner className="h-4 w-4 text-black" /> : <Wallet className="h-4 w-4 text-black" />}
        {placing ? 'Colocando apuesta…' : `Apostar $${validAmount ? amountNumber.toFixed(2) : '0.00'} USDT`}
      </button>

      <div className="mt-2.5 text-center text-[11px] text-slate-500">
        Saldo disponible: ${formatUsdt(balance)} USDT
      </div>
    </div>
  );
}

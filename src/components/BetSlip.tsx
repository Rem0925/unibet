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
  onClose,
  onConfirm,
}: {
  market: MarketSummary;
  option: string;
  balance: number;
  placing: boolean;
  userActiveInMarket?: number;
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

  return (
    <aside className="fixed bottom-0 right-0 z-50 w-full border-t border-[#262c3d] bg-[#12151c] p-4 shadow-2xl md:bottom-4 md:right-4 md:w-80 md:rounded-xl md:border">
      <div className="mb-3 flex items-center justify-between border-b border-[#1e2330] pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Cupón de apuesta
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:text-white"
          aria-label="Cerrar cupón"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 truncate text-xs text-slate-400">{market.title}</div>
      <div className="mb-3 flex items-center justify-between rounded-lg border border-[#262c3d] bg-[#0c0d12] p-2.5">
        <span className="truncate text-sm font-bold text-white">{option}</span>
        <div className="flex items-center gap-1 text-xs font-bold">
          <span className="text-slate-400">{currentMultiplier}</span>
          <ArrowRight className="h-3 w-3 text-slate-600" />
          <span className="font-mono text-emerald-400">{estimate.multiplier}</span>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <label htmlFor="bet-amount">Monto de apuesta</label>
          <span className="text-[11px] text-slate-400">
            Cupo: ${formatUsdt(remainingMarketCap)} USDT
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
            className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2 pr-14 text-sm font-bold text-white focus:border-[#00f090] focus:outline-none"
          />
          <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">USDT</span>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {[1, 5, 10, 25].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => addAmount(chip)}
              className="rounded-lg border border-[#262c3d] bg-[#161a24] py-1 text-xs font-bold text-slate-300 transition hover:bg-[#1e2330]"
            >
              +${chip}
            </button>
          ))}
          <button
            type="button"
            onClick={handleMax}
            className="rounded-lg border border-[#262c3d] bg-[#161a24] py-1 text-xs font-bold text-emerald-400 transition hover:bg-[#1e2330]"
          >
            MAX
          </button>
        </div>
      </div>

      <div className="mb-3 space-y-1.5 rounded-lg border border-[#1e2330] bg-[#0c0d12] p-2.5 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Ganancia estimada:</span>
          <strong className="font-mono font-bold text-[#00f090]">${estimate.payout} USDT</strong>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Beneficio neto:</span>
          <span className="font-mono text-slate-300">+${estimate.profit} USDT</span>
        </div>
      </div>

      {validationError ? (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs font-medium text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onConfirm(amountNumber)}
        disabled={placing || Boolean(validationError)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00f090] py-2.5 text-sm font-bold text-black transition hover:bg-[#00d681] disabled:opacity-50"
      >
        {placing ? <Spinner className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
        {placing ? 'Confirmando…' : `Apostar $${validAmount ? amountNumber.toFixed(2) : '0.00'} USDT`}
      </button>

      <div className="mt-2 text-center text-[11px] text-slate-500">
        Saldo en billetera: ${formatUsdt(balance)} USDT
      </div>
    </aside>
  );
}

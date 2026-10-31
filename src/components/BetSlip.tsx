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
  onDeposit,
}: {
  market: MarketSummary;
  option: string;
  balance: number;
  placing: boolean;
  userActiveInMarket?: number;
  inline?: boolean;
  onClose: () => void;
  onConfirm: (amount: number, accessCode?: string) => void;
  onDeposit?: () => void;
}) {
  const [amount, setAmount] = useState('5.00');
  const [enteredCode, setEnteredCode] = useState(market.accessCode ?? '');

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
    if (market.visibility === 'PRIVATE_CODE' && !enteredCode.trim()) {
      return 'Debes introducir el código de acceso privado para apostar.';
    }
    return null;
  }, [amountNumber, balance, enteredCode, market.visibility, remainingMarketCap, validAmount]);

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
    : 'fixed bottom-0 left-0 right-0 z-50 w-full rounded-t-3xl border-t border-[#1e2330] bg-[#0c0d12]/98 backdrop-blur-xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black sm:bottom-4 sm:left-auto sm:right-4 sm:w-80 sm:rounded-2xl sm:border sm:p-4 animate-in slide-in-from-bottom-4 duration-200';

  return (
    <div className={containerClasses}>
      {/* Indicador táctil superior para móvil */}
      <div className="mx-auto -mt-1.5 mb-2.5 h-1 w-10 rounded-full bg-slate-700/80 sm:hidden" />

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
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-[#1a1f2c] hover:text-white active:scale-95"
          aria-label="Cerrar cupón"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 truncate text-xs text-slate-400 font-medium">{market.title}</div>
      <div className="mb-3.5 flex items-center justify-between rounded-xl border border-[#212633] bg-[#141822] p-3">
        <span className="truncate text-sm font-bold text-white">{option}</span>
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className="text-slate-400 line-through text-[11px] tabular-nums">{currentMultiplier}</span>
          <ArrowRight className="h-3 w-3 text-slate-500" />
          <span className="font-mono text-xs font-bold text-[#00f090] bg-[#00f090]/10 px-2 py-0.5 rounded-md tabular-nums">
            {estimate.multiplier}
          </span>
        </div>
      </div>

      <div className="mb-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <label htmlFor="bet-amount">Monto en USDT</label>
          <span className="text-[11px] text-slate-500 font-normal tabular-nums">
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
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-[#212633] bg-[#090a0f] px-3.5 py-2.5 pr-14 font-mono text-base sm:text-sm font-bold text-white tabular-nums focus:border-[#00f090] focus:outline-none transition-colors"
          />
          <span className="absolute right-3.5 top-3 sm:top-2.5 text-xs font-bold text-slate-500">USDT</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[1, 5, 10, 25].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => addAmount(chip)}
              className="rounded-lg border border-[#212633] bg-[#141822] py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white active:scale-95"
            >
              +${chip}
            </button>
          ))}
          <button
            type="button"
            onClick={handleMax}
            className="rounded-lg border border-[#00f090]/30 bg-[#00f090]/10 py-1.5 text-xs font-bold text-[#00f090] transition hover:bg-[#00f090]/20 active:scale-95"
          >
            MAX
          </button>
        </div>
      </div>

      {market.visibility === 'PRIVATE_CODE' ? (
        <div className="mb-3.5 space-y-1">
          <label htmlFor="bet-slip-code" className="block text-xs font-bold text-purple-300">
            Código de Acceso Privado *
          </label>
          <input
            id="bet-slip-code"
            type="text"
            value={enteredCode}
            onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
            placeholder="Introduce el código secreto"
            className="w-full rounded-xl border border-purple-500/30 bg-[#090a0f] px-3.5 py-2.5 font-mono text-base sm:text-xs font-bold text-white uppercase focus:border-purple-400 focus:outline-none transition-colors"
          />
        </div>
      ) : null}

      <div className="mb-3.5 space-y-1.5 rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Ganancia potencial:</span>
          <strong className="font-mono font-bold text-[#00f090] tabular-nums">${estimate.payout} USDT</strong>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Retorno neto:</span>
          <span className="font-mono text-slate-300 tabular-nums">+${estimate.profit} USDT</span>
        </div>
        <div className="flex justify-between text-[11px] border-t border-[#1e2330]/60 pt-1 text-slate-400">
          <span>Rendimiento / Ganancia:</span>
          <span className="font-mono font-bold text-[#00f090] tabular-nums">{estimate.profitPercentage}</span>
        </div>
      </div>

      {validationError ? (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
          {amountNumber > balance && onDeposit ? (
            <button
              type="button"
              onClick={onDeposit}
              className="mt-0.5 flex items-center justify-center gap-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/30 py-1.5 text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Wallet className="h-3.5 w-3.5 text-amber-300" />
              <span>Recargar saldo ahora</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() =>
          onConfirm(
            amountNumber,
            market.visibility === 'PRIVATE_CODE' ? enteredCode.trim() || undefined : undefined
          )
        }
        disabled={placing || Boolean(validationError)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-[0.98] shadow-lg shadow-[#00f090]/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placing ? <Spinner className="h-4 w-4 text-black" /> : <Wallet className="h-4 w-4 text-black" />}
        {placing ? 'Colocando apuesta…' : `Apostar $${validAmount ? amountNumber.toFixed(2) : '0.00'} USDT`}
      </button>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
        <span>Saldo disponible: ${formatUsdt(balance)} USDT</span>
        {onDeposit ? (
          <button
            type="button"
            onClick={onDeposit}
            className="font-semibold text-[#00f090] hover:underline cursor-pointer"
          >
            + Recargar
          </button>
        ) : null}
      </div>
    </div>
  );
}

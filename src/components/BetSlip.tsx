'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Info, Wallet, X } from 'lucide-react';
import { BET_MAX, BET_MIN, BET_USER_MARKET_MAX, PAYOUT_MULTIPLIER_CAP } from '@/lib/constants';
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

  const lowMultiplier = useMemo(() => {
    const parsed = Number.parseFloat(estimate.multiplier);
    return validAmount && estimate.multiplier !== '—' && Number.isFinite(parsed) && parsed < 1.1;
  }, [estimate.multiplier, validAmount]);

  const validationError = useMemo(() => {
    if (!validAmount) return 'Introduce un monto válido.';
    if (amountNumber < BET_MIN) return `El mínimo por apuesta es $${formatUsdt(BET_MIN)} USDT.`;
    if (amountNumber > BET_MAX) return `El máximo por apuesta es $${formatUsdt(BET_MAX)} USDT.`;
    if (amountNumber > remainingMarketCap) {
      return `Superas el límite de $${BET_USER_MARKET_MAX} USDT en este mercado (cupo restante: $${formatUsdt(remainingMarketCap)} USDT).`;
    }
    if (amountNumber > balance) return 'Saldo insuficiente en tu billetera.';
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
    <aside className="fixed bottom-0 right-0 z-50 w-full border border-[#232836] bg-[#11141c] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] font-mono text-xs shadow-2xl md:bottom-4 md:right-4 md:w-[22rem] md:rounded-lg">
      <div className="mb-3 flex items-center justify-between border-b border-[#1e2330] pb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white">
          Cupón de apuesta
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 transition hover:bg-[#1a1f2b] hover:text-white"
          aria-label="Cerrar cupón"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 truncate text-[11px] text-slate-400">{market.title}</div>
      <div className="mb-3 flex items-center justify-between rounded border border-[#222736] bg-[#161a24] p-2">
        <span className="min-w-0 truncate font-bold text-white">{option}</span>
        <div className="flex items-center gap-1.5 font-bold">
          <span className="text-[10px] text-slate-400" title="Cuota antes de tu apuesta">{currentMultiplier}</span>
          <span className="text-[10px] text-slate-600">→</span>
          <span className="text-[#00f090]" title="Cuota proyectada tras tu apuesta">{estimate.multiplier}</span>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
          <label htmlFor="bet-amount">Monto (USDT)</label>
          <span className="text-[9px] text-slate-500">
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
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 pr-14 text-white focus:border-[#00f090] focus:outline-none"
          />
          <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-500">USDT</span>
        </div>

        <div className="grid grid-cols-5 gap-1">
          {[1, 5, 10, 25].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => addAmount(chip)}
              className="rounded border border-[#252b3d] bg-[#171a24] py-1 text-[10px] font-bold text-slate-300 transition hover:bg-[#1e2330]"
            >
              +${chip}
            </button>
          ))}
          <button
            type="button"
            onClick={handleMax}
            className="rounded border border-[#252b3d] bg-[#171a24] py-1 text-[10px] font-bold text-slate-300 transition hover:bg-[#1e2330]"
          >
            MAX
          </button>
        </div>
      </div>

      <div className="mb-3 space-y-1 rounded border border-[#1b1f2b] bg-[#0c0e14] p-2.5 text-[11px]">
        <div className="flex justify-between text-slate-400">
          <span>Pago estimado:</span>
          <strong className="font-bold text-[#00f090]">${estimate.payout} USDT</strong>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Beneficio neto:</span>
          <span>+${estimate.profit} USDT</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Impacto en cuota:</span>
          <span className="text-slate-300">{currentMultiplier} → {estimate.multiplier}</span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>Pozo tras tu apuesta:</span>
          <span>${formatUsdt(estimate.totalPool)} USDT</span>
        </div>
      </div>

      {validationError ? (
        <div className="mb-2 flex items-center gap-1.5 rounded border border-[#f59e0b]/25 bg-[#181511] px-2 py-1.5 text-[10px] text-[#fbbf24]">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {validationError}
        </div>
      ) : (
        <>
          {lowMultiplier ? (
            <div className="mb-2 flex items-start gap-1.5 rounded border border-[#f59e0b]/25 bg-[#181511] px-2 py-1.5 text-[10px] leading-relaxed text-[#fbbf24]">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Esta cuota es casi 1.00x: si ganas recibirías casi exactamente lo que apostaste. Puede
              mejorar si entra más dinero a las otras opciones antes del cierre.
            </div>
          ) : null}
          <div className="mb-2 flex items-start gap-1.5 rounded border border-[#1d222e] bg-[#0c0e14] px-2 py-1.5 text-[10px] leading-relaxed text-slate-500">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-[#00f090]" />
            Cuota estimada: se recalcula con el pozo hasta el cierre (tope de {PAYOUT_MULTIPLIER_CAP}x).
            Máximo ${BET_USER_MARKET_MAX} USDT activos por persona en este mercado.
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => onConfirm(amountNumber)}
        disabled={placing || Boolean(validationError)}
        className="flex w-full items-center justify-center gap-2 rounded bg-[#00f090] py-2 text-xs font-bold text-black transition hover:bg-[#00d681] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placing ? <Spinner /> : <Wallet className="h-4 w-4" />}
        {placing ? 'Registrando…' : `Apostar $${validAmount ? amountNumber.toFixed(2) : '0.00'} USDT`}
      </button>

      <div className="mt-2 text-center text-[9px] text-slate-600">
        Saldo disponible: ${formatUsdt(balance)} USDT
      </div>
    </aside>
  );
}

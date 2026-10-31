import Decimal from 'decimal.js';
import { PAYOUT_MULTIPLIER_CAP } from './constants';
import type { MarketOdds, OptionOdds } from './types';

export interface BetTicket {
  selectedOption: string;
  amount: number | string;
}

const ZERO = new Decimal(0);
const MULTIPLIER_CAP = new Decimal(PAYOUT_MULTIPLIER_CAP);

function buildOdds(poolsByOption: Record<string, Decimal>, totalPool: Decimal, options: string[]): MarketOdds {
  const optionsOdds: Record<string, OptionOdds> = {};

  for (const option of options) {
    const optionPool = poolsByOption[option] ?? ZERO;

    if (totalPool.isZero() || optionPool.isZero()) {
      let profitPct = '+0%';
      if (!totalPool.isZero()) {
        const minBet = new Decimal(0.1);
        const projMult = totalPool.plus(minBet).dividedBy(minBet);
        const cappedMult = projMult.gt(MULTIPLIER_CAP) ? MULTIPLIER_CAP : projMult;
        const profit = cappedMult.minus(1).times(100);
        profitPct = `+${profit.toFixed(0)}%`;
      }

      optionsOdds[option] = {
        pool: '0.00',
        percentage: '0.0%',
        multiplier: totalPool.isZero() ? '1.00x' : '—',
        profitPercentage: totalPool.isZero() ? '+0%' : profitPct,
        hasBets: false,
      };
      continue;
    }

    const percentage = optionPool.dividedBy(totalPool).times(100);

    if (optionPool.equals(totalPool)) {
      optionsOdds[option] = {
        pool: optionPool.toFixed(2),
        percentage: '100.0%',
        multiplier: '1.00x',
        profitPercentage: '+0%',
        hasBets: true,
      };
      continue;
    }

    const rawMultiplier = totalPool.dividedBy(optionPool);
    const multiplier = rawMultiplier.gt(MULTIPLIER_CAP) ? MULTIPLIER_CAP : rawMultiplier;
    const profit = multiplier.minus(1).times(100);

    optionsOdds[option] = {
      pool: optionPool.toFixed(2),
      percentage: `${percentage.toFixed(1)}%`,
      multiplier: `${multiplier.toFixed(2)}x`,
      profitPercentage: `+${profit.toFixed(0)}%`,
      hasBets: true,
    };
  }

  return {
    totalPool: totalPool.toFixed(2),
    netPrizePool: totalPool.toFixed(2),
    optionsOdds,
  };
}

export function calculatePariMutuelOddsFromPools(
  options: string[],
  optionPools: Record<string, number | string>
): MarketOdds {
  const poolsByOption: Record<string, Decimal> = {};
  let totalPool = ZERO;

  for (const option of options) {
    const pool = new Decimal(optionPools[option] ?? 0);
    if (pool.isNegative() || !pool.isFinite()) {
      poolsByOption[option] = ZERO;
      continue;
    }
    poolsByOption[option] = pool;
    totalPool = totalPool.plus(pool);
  }

  return buildOdds(poolsByOption, totalPool, options);
}

export function calculatePariMutuelOdds(options: string[], bets: BetTicket[]): MarketOdds {
  const pools: Record<string, number> = {};

  for (const bet of bets) {
    const amount = new Decimal(bet.amount || 0);
    if (!amount.isFinite() || amount.isNegative()) continue;
    pools[bet.selectedOption] = (pools[bet.selectedOption] ?? 0) + amount.toNumber();
  }

  return calculatePariMutuelOddsFromPools(options, pools);
}

export interface BetEstimate {
  multiplier: string;
  payout: string;
  profit: string;
  profitPercentage: string;
  totalPool: string;
  optionPool: string;
}

export function estimateBetPayout(params: {
  amount: number | string;
  totalPool: number | string;
  optionPool: number | string;
}): BetEstimate {
  const amount = new Decimal(params.amount || 0);
  const totalPool = new Decimal(params.totalPool || 0);
  const optionPool = new Decimal(params.optionPool || 0);

  if (!amount.isFinite() || amount.isNegative() || !totalPool.isFinite() || !optionPool.isFinite()) {
    return {
      multiplier: '—',
      payout: '0.00',
      profit: '0.00',
      profitPercentage: '+0%',
      totalPool: '0.00',
      optionPool: '0.00',
    };
  }

  const projectedTotal = totalPool.plus(amount);
  const projectedOption = optionPool.plus(amount);
  let multiplier = projectedOption.isZero() ? new Decimal(1) : projectedTotal.dividedBy(projectedOption);
  if (multiplier.gt(MULTIPLIER_CAP)) {
    multiplier = MULTIPLIER_CAP;
  }
  const payout = amount.times(multiplier);
  const netProfit = Decimal.max(0, payout.minus(amount));
  const profitPercentage = amount.gt(0) && multiplier.gt(1)
    ? `+${multiplier.minus(1).times(100).toFixed(0)}%`
    : '+0%';

  return {
    multiplier: `${multiplier.toFixed(2)}x`,
    payout: payout.toFixed(2),
    profit: netProfit.toFixed(2),
    profitPercentage,
    totalPool: projectedTotal.toFixed(2),
    optionPool: projectedOption.toFixed(2),
  };
}

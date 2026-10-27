import Decimal from 'decimal.js';
import type { MarketOdds, OptionOdds } from './types';

export interface BetTicket {
  selectedOption: string;
  amount: number | string;
}

const ZERO = new Decimal(0);

function buildOdds(poolsByOption: Record<string, Decimal>, totalPool: Decimal, options: string[]): MarketOdds {
  const optionsOdds: Record<string, OptionOdds> = {};

  for (const option of options) {
    const optionPool = poolsByOption[option] ?? ZERO;

    if (totalPool.isZero() || optionPool.isZero()) {
      optionsOdds[option] = {
        pool: '0.00',
        percentage: '0.0%',
        multiplier: totalPool.isZero() ? '1.00x' : '—',
      };
      continue;
    }

    const percentage = optionPool.dividedBy(totalPool).times(100);

    if (optionPool.equals(totalPool)) {
      optionsOdds[option] = {
        pool: optionPool.toFixed(2),
        percentage: '100.0%',
        multiplier: '1.00x',
      };
      continue;
    }

    optionsOdds[option] = {
      pool: optionPool.toFixed(2),
      percentage: `${percentage.toFixed(1)}%`,
      multiplier: `${totalPool.dividedBy(optionPool).toFixed(2)}x`,
    };
  }

  return {
    totalPool: totalPool.toFixed(2),
    netPrizePool: totalPool.toFixed(2),
    optionsOdds,
  };
}

/**
 * Pari-mutuel odds from the aggregate amount held on every option.
 * Keeping this calculation in one place guarantees the UI and the API
 * present exactly the same numbers.
 */
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

/**
 * Convenience helper used by tests and by any caller that has raw tickets.
 * The database is still the source of truth for balances and settlement.
 */
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
  totalPool: string;
  optionPool: string;
}

/**
 * Projected pari-mutuel result if the ticket were added right now.
 * The real multiplier can move until the market closes because new money
 * keeps entering the pool.
 */
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
      totalPool: '0.00',
      optionPool: '0.00',
    };
  }

  const projectedTotal = totalPool.plus(amount);
  const projectedOption = optionPool.plus(amount);
  const multiplier = projectedOption.isZero() ? new Decimal(1) : projectedTotal.dividedBy(projectedOption);
  const payout = amount.times(multiplier);

  return {
    multiplier: `${multiplier.toFixed(2)}x`,
    payout: payout.toFixed(2),
    profit: Decimal.max(0, payout.minus(amount)).toFixed(2),
    totalPool: projectedTotal.toFixed(2),
    optionPool: projectedOption.toFixed(2),
  };
}

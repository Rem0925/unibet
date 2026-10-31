import Decimal from 'decimal.js';

export interface CashoutCalculation {
  eligible: boolean;
  reason?: string;
  originalAmount: number;
  cashoutAmount: number;
  penaltyAmount: number;
  recoveryRate: number; // e.g. 0.65 (65%)
  penaltyRate: number;  // e.g. 0.35 (35%)
}

/**
 * Calcula el monto a rescatar mediante Cash Out según la regla del usuario:
 * 1. NUNCA se recupera el 100% o más de la apuesta (tope estricto de 80%).
 * 2. Siempre hay una penalización/pérdida (mínimo 20% de pérdida).
 * 3. Si la opción tiene baja probabilidad / poco pozo, la pérdida es aún mayor (hasta 75% o más).
 *
 * Fórmula:
 * R = poolOpcion / poolTotal (acotado entre 0.05 y 1.0)
 * FactorRecuperacion = 0.20 + (0.80 - 0.20) * R = 0.20 + 0.60 * R
 * Cashout = Math.min(originalAmount * 0.80, originalAmount * FactorRecuperacion)
 */
export function calculateCashoutQuote({
  betAmount,
  optionPool,
  totalPool,
}: {
  betAmount: number;
  optionPool: number;
  totalPool: number;
}): CashoutCalculation {
  if (!betAmount || betAmount <= 0) {
    return {
      eligible: false,
      reason: 'Monto inválido',
      originalAmount: 0,
      cashoutAmount: 0,
      penaltyAmount: 0,
      recoveryRate: 0,
      penaltyRate: 1,
    };
  }

  const bet = new Decimal(betAmount);
  const optPool = new Decimal(Math.max(0, optionPool));
  const totPool = new Decimal(Math.max(0, totalPool));

  // Si no hay pozo total o pozo menor al monto, asumimos ratio 0.5
  let ratio = new Decimal(0.5);
  if (totPool.gt(0)) {
    ratio = optPool.dividedBy(totPool);
    if (ratio.gt(1)) ratio = new Decimal(1);
    if (ratio.lt(0.05)) ratio = new Decimal(0.05);
  }

  // Base mínima 20% (0.20), Techo máximo 80% (0.80)
  const minRate = new Decimal(0.20);
  const maxRate = new Decimal(0.80);
  const recoveryRate = minRate.plus(maxRate.minus(minRate).times(ratio));

  // Cashout = bet * recoveryRate, redondeado a 2 decimales hacia abajo
  let payout = bet.times(recoveryRate).toDecimalPlaces(2, Decimal.ROUND_DOWN);

  // Asegurar que nunca exceda el 80% y nunca supere bet - 0.01
  const hardCap = bet.times(maxRate).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  if (payout.gt(hardCap)) {
    payout = hardCap;
  }
  if (payout.gte(bet)) {
    payout = bet.minus(0.01);
  }

  const penalty = bet.minus(payout);
  const effectiveRecoveryRate = payout.dividedBy(bet).toNumber();

  return {
    eligible: true,
    originalAmount: bet.toNumber(),
    cashoutAmount: payout.toNumber(),
    penaltyAmount: penalty.toNumber(),
    recoveryRate: effectiveRecoveryRate,
    penaltyRate: 1 - effectiveRecoveryRate,
  };
}

import { describe, expect, it } from 'vitest';
import { calculateCashoutQuote } from './cashout';

describe('calculateCashoutQuote', () => {
  it('nunca devuelve el 100% de la apuesta, respetando el tope maximo de 80%', () => {
    // Apuesta de 10 USDT en un favorito con 95% del pozo
    const result = calculateCashoutQuote({
      betAmount: 10,
      optionPool: 95,
      totalPool: 100,
    });

    expect(result.eligible).toBe(true);
    expect(result.cashoutAmount).toBeLessThanOrEqual(8.0);
    expect(result.cashoutAmount).toBeLessThan(10.0);
    expect(result.penaltyAmount).toBeGreaterThanOrEqual(2.0);
  });

  it('aplica mayor penalizacion si la opcion es impopular o tiene poco pozo', () => {
    // Apuesta de 10 USDT en una opcion con solo 10% del pozo
    const result = calculateCashoutQuote({
      betAmount: 10,
      optionPool: 10,
      totalPool: 100,
    });

    expect(result.eligible).toBe(true);
    // Ratio = 0.1, recovery = 0.20 + 0.60 * 0.1 = 0.26 => 2.60 USDT
    expect(result.cashoutAmount).toBe(2.6);
    expect(result.penaltyAmount).toBe(7.4);
    expect(result.recoveryRate).toBe(0.26);
  });

  it('calcula correctamente para pozo 50/50', () => {
    const result = calculateCashoutQuote({
      betAmount: 20,
      optionPool: 50,
      totalPool: 100,
    });

    expect(result.eligible).toBe(true);
    // Ratio = 0.5, recovery = 0.20 + 0.60 * 0.5 = 0.50 => 10.00 USDT
    expect(result.cashoutAmount).toBe(10.0);
    expect(result.penaltyAmount).toBe(10.0);
  });

  it('rechaza montos invalidos o menores/iguales a 0', () => {
    const result = calculateCashoutQuote({
      betAmount: 0,
      optionPool: 10,
      totalPool: 100,
    });

    expect(result.eligible).toBe(false);
    expect(result.cashoutAmount).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  calculatePariMutuelOdds,
  calculatePariMutuelOddsFromPools,
  estimateBetPayout,
} from '../odds';

describe('calculatePariMutuelOddsFromPools', () => {
  it('reparte los porcentajes y multiplicadores con pozo repartido', () => {
    const odds = calculatePariMutuelOddsFromPools(['A', 'B'], { A: 25, B: 75 });

    expect(odds.totalPool).toBe('100.00');
    expect(odds.netPrizePool).toBe('100.00');
    expect(odds.optionsOdds.A).toEqual({
      pool: '25.00',
      percentage: '25.0%',
      multiplier: '4.00x',
    });
    expect(odds.optionsOdds.B).toEqual({
      pool: '75.00',
      percentage: '75.0%',
      multiplier: '1.33x',
    });
  });

  it('devuelve 1.00x para todas las opciones cuando el pozo está vacío', () => {
    const odds = calculatePariMutuelOddsFromPools(['A', 'B'], { A: 0, B: 0 });

    expect(odds.totalPool).toBe('0.00');
    expect(odds.optionsOdds.A.multiplier).toBe('1.00x');
    expect(odds.optionsOdds.B.multiplier).toBe('1.00x');
    expect(odds.optionsOdds.A.percentage).toBe('0.0%');
  });

  it('muestra 100% y 1.00x cuando todo el dinero está en una sola opción', () => {
    const odds = calculatePariMutuelOddsFromPools(['A', 'B'], { A: 100, B: 0 });

    expect(odds.optionsOdds.A).toEqual({
      pool: '100.00',
      percentage: '100.0%',
      multiplier: '1.00x',
    });
    expect(odds.optionsOdds.B).toEqual({
      pool: '0.00',
      percentage: '0.0%',
      multiplier: '—',
    });
  });

  it('trata pozos ausentes, negativos o no finitos como cero', () => {
    const odds = calculatePariMutuelOddsFromPools(['A', 'B', 'C'], {
      A: 60,
      B: Number.NaN,
      C: -5,
    });

    expect(odds.totalPool).toBe('60.00');
    expect(odds.optionsOdds.A.multiplier).toBe('1.00x');
    expect(odds.optionsOdds.A.percentage).toBe('100.0%');
    expect(odds.optionsOdds.B.pool).toBe('0.00');
    expect(odds.optionsOdds.C.pool).toBe('0.00');
  });

  it('empate 50/50 produce 2.00x para ambas opciones', () => {
    const odds = calculatePariMutuelOddsFromPools(['A', 'B'], { A: 40, B: 40 });

    expect(odds.optionsOdds.A.multiplier).toBe('2.00x');
    expect(odds.optionsOdds.B.multiplier).toBe('2.00x');
  });
});

describe('calculatePariMutuelOdds', () => {
  it('agrega los montos por opción', () => {
    const odds = calculatePariMutuelOdds(['A', 'B'], [
      { selectedOption: 'A', amount: 10 },
      { selectedOption: 'A', amount: 5 },
      { selectedOption: 'B', amount: 12.5 },
    ]);

    expect(odds.optionsOdds.A.pool).toBe('15.00');
    expect(odds.optionsOdds.B.pool).toBe('12.50');
    expect(odds.totalPool).toBe('27.50');
  });

  it('ignora apuestas inválidas sin alterar el pozo', () => {
    const odds = calculatePariMutuelOdds(['A'], [
      { selectedOption: 'A', amount: 20 },
      { selectedOption: 'A', amount: -5 },
      { selectedOption: 'A', amount: Number.NaN },
      { selectedOption: 'A', amount: '' },
    ]);

    expect(odds.totalPool).toBe('20.00');
  });
});

describe('estimateBetPayout', () => {
  it('proyecta el pago diluyendo el ticket en el pozo', () => {
    const estimate = estimateBetPayout({
      amount: 10,
      totalPool: 100,
      optionPool: 25,
    });

    expect(estimate.multiplier).toBe('3.14x');
    expect(estimate.payout).toBe('31.43');
    expect(estimate.profit).toBe('21.43');
    expect(estimate.totalPool).toBe('110.00');
    expect(estimate.optionPool).toBe('35.00');
  });

  it('primer ticket de un mercado: multiplica 1.00x y no promete ganancia', () => {
    const estimate = estimateBetPayout({
      amount: 10,
      totalPool: 0,
      optionPool: 0,
    });

    expect(estimate.multiplier).toBe('1.00x');
    expect(estimate.payout).toBe('10.00');
    expect(estimate.profit).toBe('0.00');
  });

  it('primer ticket en una opción sin dinero diluye el pozo existente', () => {
    const estimate = estimateBetPayout({
      amount: 10,
      totalPool: 90,
      optionPool: 0,
    });

    expect(estimate.multiplier).toBe('10.00x');
    expect(estimate.payout).toBe('100.00');
    expect(estimate.profit).toBe('90.00');
  });

  it('devuelve ceros para montos inválidos', () => {
    const estimate = estimateBetPayout({
      amount: -5,
      totalPool: 100,
      optionPool: 25,
    });

    expect(estimate.multiplier).toBe('—');
    expect(estimate.payout).toBe('0.00');
    expect(estimate.profit).toBe('0.00');
  });
});

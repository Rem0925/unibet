import { describe, expect, it } from 'vitest';
import { MAX_MARKET_DAYS } from '../constants';
import {
  AdminUpdateUserSchema,
  CancelMarketSchema,
  CloseMarketSchema,
  CreateMarketSchema,
  DepositSchema,
  PlaceBetSchema,
  ReconcileWithdrawalSchema,
  ResolveMarketSchema,
  WithdrawSchema,
} from '../security';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

function closeTimeIn(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

describe('PlaceBetSchema', () => {
  it('acepta una apuesta válida', () => {
    const result = PlaceBetSchema.safeParse({
      marketId: UUID,
      selectedOption: 'Equipo A',
      amount: 5,
    });

    expect(result.success).toBe(true);
  });

  it('rechaza montos fuera del rango 0.50 – 500.00', () => {
    for (const amount of [0.49, 0, -5, 500.01, 1000]) {
      const result = PlaceBetSchema.safeParse({
        marketId: UUID,
        selectedOption: 'Equipo A',
        amount,
      });
      expect(result.success).toBe(false);
    }
  });

  it('acepta los límites exactos del rango', () => {
    for (const amount of [0.5, 500]) {
      const result = PlaceBetSchema.safeParse({
        marketId: UUID,
        selectedOption: 'Equipo A',
        amount,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rechaza montos con más de 2 decimales', () => {
    const result = PlaceBetSchema.safeParse({
      marketId: UUID,
      selectedOption: 'Equipo A',
      amount: 10.555,
    });

    expect(result.success).toBe(false);
  });

  it('rechaza payload con claves desconocidas (strict)', () => {
    const result = PlaceBetSchema.safeParse({
      marketId: UUID,
      selectedOption: 'Equipo A',
      amount: 5,
      balance: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rechaza id de mercado inválido', () => {
    const result = PlaceBetSchema.safeParse({
      marketId: 'no-es-uuid',
      selectedOption: 'Equipo A',
      amount: 5,
    });

    expect(result.success).toBe(false);
  });
});

describe('WithdrawSchema', () => {
  it('acepta un UID de 8 dígitos y monto válido', () => {
    const result = WithdrawSchema.safeParse({ amount: 25, binanceUid: '12345678' });

    expect(result.success).toBe(true);
  });

  it('rechaza UIDs con formato incorrecto', () => {
    for (const binanceUid of ['1234567', '12345678901', '1234567a', '12 345678', '']) {
      const result = WithdrawSchema.safeParse({ amount: 25, binanceUid });
      expect(result.success).toBe(false);
    }
  });

  it('rechaza montos fuera del rango 1 – 200', () => {
    for (const amount of [0.99, 200.5]) {
      const result = WithdrawSchema.safeParse({ amount, binanceUid: '12345678' });
      expect(result.success).toBe(false);
    }
  });
});

describe('DepositSchema', () => {
  it('acepta montos dentro del rango 1 – 1000', () => {
    for (const amount of [1, 10.05, 1000]) {
      const result = DepositSchema.safeParse({ amount });
      expect(result.success).toBe(true);
    }
  });

  it('rechaza montos fuera de rango', () => {
    for (const amount of [0.99, -1, 1000.01]) {
      const result = DepositSchema.safeParse({ amount });
      expect(result.success).toBe(false);
    }
  });
});

describe('CreateMarketSchema', () => {
  const validMarket = {
    title: '¿Quién gana el clásico?',
    category: 'FUTBOL',
    options: ['Equipo A', 'Equipo B'],
    closeTime: closeTimeIn(5),
  };

  it('acepta un mercado mínimo válido', () => {
    const result = CreateMarketSchema.safeParse(validMarket);

    expect(result.success).toBe(true);
    if (result.success) {
      // La fecha se normaliza a ISO.
      expect(result.data.closeTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // El texto de opciones se recorta.
      expect(result.data.options[0]).toBe('Equipo A');
    }
  });

  it('rechaza duplicados ignorando mayúsculas y espacios', () => {
    const result = CreateMarketSchema.safeParse({
      ...validMarket,
      options: ['Equipo A', ' equipo a'],
    });

    expect(result.success).toBe(false);
  });

  it('rechaza títulos demasiado cortos', () => {
    const result = CreateMarketSchema.safeParse({ ...validMarket, title: 'Azar' });

    expect(result.success).toBe(false);
  });

  it('rechaza menos de 2 opciones o más de 10', () => {
    const one = CreateMarketSchema.safeParse({ ...validMarket, options: ['Solo A'] });
    const eleven = CreateMarketSchema.safeParse({
      ...validMarket,
      options: Array.from({ length: 11 }, (_, i) => `Opción ${i + 1}`),
    });

    expect(one.success).toBe(false);
    expect(eleven.success).toBe(false);
  });

  it('rechaza cierres en el pasado, dentro del minuto siguiente o demasiado lejanos', () => {
    expect(CreateMarketSchema.safeParse({ ...validMarket, closeTime: closeTimeIn(-5) }).success).toBe(false);
    expect(CreateMarketSchema.safeParse({ ...validMarket, closeTime: closeTimeIn(0.5) }).success).toBe(false);
    expect(CreateMarketSchema.safeParse({ ...validMarket, closeTime: closeTimeIn(3) }).success).toBe(true);
    expect(
      CreateMarketSchema.safeParse({
        ...validMarket,
        closeTime: new Date(Date.now() + (MAX_MARKET_DAYS + 1) * 86_400_000).toISOString(),
      }).success
    ).toBe(false);
  });

  it('rechaza claves desconocidas', () => {
    const result = CreateMarketSchema.safeParse({ ...validMarket, admin: true });

    expect(result.success).toBe(false);
  });
});

describe('ResolveMarketSchema y CloseMarketSchema', () => {
  it('valida la resolución', () => {
    expect(ResolveMarketSchema.safeParse({ marketId: UUID, winningOption: 'Equipo A' }).success).toBe(true);
    expect(ResolveMarketSchema.safeParse({ marketId: UUID, winningOption: '  ' }).success).toBe(false);
  });

  it('valida el cierre', () => {
    expect(CloseMarketSchema.safeParse({ marketId: UUID }).success).toBe(true);
    expect(CloseMarketSchema.safeParse({ marketId: UUID, extra: true }).success).toBe(false);
  });
});

describe('CancelMarketSchema', () => {
  it('exige un motivo de al menos 5 caracteres', () => {
    expect(CancelMarketSchema.safeParse({ marketId: UUID, reason: 'Evento suspendido' }).success).toBe(true);
    expect(CancelMarketSchema.safeParse({ marketId: UUID, reason: 'no' }).success).toBe(false);
  });
});

describe('AdminUpdateUserSchema', () => {
  it('exige al menos un campo a modificar', () => {
    expect(AdminUpdateUserSchema.safeParse({ userId: UUID }).success).toBe(false);
    expect(AdminUpdateUserSchema.safeParse({ userId: UUID, role: 'MODERATOR' }).success).toBe(true);
    expect(AdminUpdateUserSchema.safeParse({ userId: UUID, isBanned: false }).success).toBe(true);
  });

  it('rechaza roles desconocidos', () => {
    expect(AdminUpdateUserSchema.safeParse({ userId: UUID, role: 'MOD' }).success).toBe(false);
  });
});

describe('ReconcileWithdrawalSchema', () => {
  it('acepta las dos acciones válidas', () => {
    expect(ReconcileWithdrawalSchema.safeParse({ referenceId: 'wd-123456', action: 'refund' }).success).toBe(true);
    expect(ReconcileWithdrawalSchema.safeParse({ referenceId: 'wd-123456', action: 'complete' }).success).toBe(true);
  });

  it('rechaza referencias cortas o con caracteres prohibidos y acciones inválidas', () => {
    expect(ReconcileWithdrawalSchema.safeParse({ referenceId: 'ab', action: 'refund' }).success).toBe(false);
    expect(ReconcileWithdrawalSchema.safeParse({ referenceId: 'ref 123!', action: 'refund' }).success).toBe(false);
    expect(ReconcileWithdrawalSchema.safeParse({ referenceId: 'wd-123456', action: 'delete' }).success).toBe(false);
  });
});

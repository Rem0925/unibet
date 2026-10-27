import { z } from 'zod';
import {
  BET_MAX,
  BET_MIN,
  DEPOSIT_MAX,
  DEPOSIT_MIN,
  MAX_MARKET_DAYS,
  MAX_OPTIONS,
  MIN_OPTIONS,
  WITHDRAW_MAX,
  WITHDRAW_MIN,
} from './constants';

const UuidSchema = z.string().uuid({ message: 'ID inválido' });

const PositiveMoneySchema = z
  .number({ message: 'El monto debe ser un número' })
  .finite({ message: 'Monto inválido' })
  .multipleOf(0.01, { message: 'El monto solo puede tener 2 decimales' })
  .positive({ message: 'El monto debe ser positivo' });

const CloseTimeSchema = z
  .string()
  .trim()
  .min(1, { message: 'La fecha de cierre es obligatoria' })
  .refine(
    (value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime());
    },
    { message: 'Fecha de cierre inválida' }
  )
  .refine(
    (value) => {
      const date = new Date(value);
      return date.getTime() > Date.now() + 60_000;
    },
    { message: 'La fecha de cierre debe estar al menos 1 minuto en el futuro' }
  )
  .refine(
    (value) => {
      const date = new Date(value);
      return date.getTime() < Date.now() + MAX_MARKET_DAYS * 86_400_000;
    },
    { message: `La fecha de cierre no puede superar ${MAX_MARKET_DAYS} días` }
  )
  .transform((value) => new Date(value).toISOString());

const OptionalCleanText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional()
  );

const MarketOptionSchema = z
  .string()
  .trim()
  .min(1, { message: 'Las opciones no pueden estar vacías' })
  .max(50, { message: 'Cada opción puede tener máximo 50 caracteres' })
  .transform((value) => value.normalize('NFC'));

export const CreateMarketSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, { message: 'El título debe tener al menos 5 caracteres' })
      .max(200, { message: 'El título no puede exceder 200 caracteres' }),
    description: OptionalCleanText(1000),
    resolutionSource: OptionalCleanText(300),
    category: z.enum(['FUTBOL', 'BEISBOL', 'CAMPUS', 'GAMING', 'OTRO'], {
      message: 'Categoría inválida',
    }),
    options: z
      .array(MarketOptionSchema)
      .min(MIN_OPTIONS, { message: `Debe haber al menos ${MIN_OPTIONS} opciones de apuesta` })
      .max(MAX_OPTIONS, { message: `No se permiten más de ${MAX_OPTIONS} opciones` })
      .refine(
        (items) => new Set(items.map((item) => item.toLocaleLowerCase('es'))).size === items.length,
        { message: 'Las opciones no pueden estar duplicadas (ignorando mayúsculas)' }
      ),
    closeTime: CloseTimeSchema,
  })
  .strict();

export const PlaceBetSchema = z
  .object({
    marketId: UuidSchema,
    selectedOption: z
      .string()
      .trim()
      .min(1, { message: 'Selecciona una opción' })
      .max(50, { message: 'Opción inválida' })
      .transform((value) => value.normalize('NFC')),
    amount: PositiveMoneySchema.min(BET_MIN, {
      message: `Monto mínimo de apuesta: ${BET_MIN.toFixed(2)} USDT`,
    }).max(BET_MAX, {
      message: `Monto máximo de apuesta por seguridad: ${BET_MAX.toFixed(2)} USDT`,
    }),
  })
  .strict();

export const WithdrawSchema = z
  .object({
    amount: PositiveMoneySchema.min(WITHDRAW_MIN, {
      message: `Retiro mínimo: ${WITHDRAW_MIN.toFixed(2)} USDT`,
    }).max(WITHDRAW_MAX, {
      message: `Límite de seguridad por retiro: ${WITHDRAW_MAX.toFixed(2)} USDT`,
    }),
    binanceUid: z
      .string()
      .trim()
      .regex(/^[0-9]{8,10}$/, {
        message: 'El Binance UID debe contener entre 8 y 10 dígitos numéricos',
      }),
  })
  .strict();

export const DepositSchema = z
  .object({
    amount: PositiveMoneySchema.min(DEPOSIT_MIN, {
      message: `Depósito mínimo: ${DEPOSIT_MIN.toFixed(2)} USDT`,
    }).max(DEPOSIT_MAX, {
      message: `Depósito máximo por transacción: ${DEPOSIT_MAX.toFixed(2)} USDT`,
    }),
  })
  .strict();

export const ResolveMarketSchema = z
  .object({
    marketId: UuidSchema,
    winningOption: z
      .string()
      .trim()
      .min(1, { message: 'Debes seleccionar la opción ganadora' })
      .max(50, { message: 'Opción inválida' }),
  })
  .strict();

export const CloseMarketSchema = z
  .object({
    marketId: UuidSchema,
  })
  .strict();

export const CancelMarketSchema = z
  .object({
    marketId: UuidSchema,
    reason: z
      .string()
      .trim()
      .min(5, { message: 'El motivo debe tener al menos 5 caracteres' })
      .max(300, { message: 'El motivo no puede exceder 300 caracteres' }),
  })
  .strict();

export const AdminUpdateUserSchema = z
  .object({
    userId: UuidSchema,
    role: z.enum(['ADMIN', 'MODERATOR', 'USER']).optional(),
    isBanned: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.isBanned !== undefined, {
    message: 'No hay ningún cambio que aplicar',
  });

export const ReconcileWithdrawalSchema = z
  .object({
    referenceId: z
      .string()
      .trim()
      .min(6)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, { message: 'Referencia inválida' }),
    action: z.enum(['refund', 'complete'], { message: 'Acción inválida' }),
    note: OptionalCleanText(300),
  })
  .strict();

export const ReconcileDepositSchema = z
  .object({
    referenceId: z
      .string()
      .trim()
      .min(6)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, { message: 'Referencia inválida' }),
    action: z.enum(['verify', 'fail'], { message: 'Acción inválida' }),
    note: OptionalCleanText(300),
  })
  .strict();

export type CreateMarketInput = z.infer<typeof CreateMarketSchema>;
export type PlaceBetInput = z.infer<typeof PlaceBetSchema>;
export type WithdrawInput = z.infer<typeof WithdrawSchema>;
export type DepositInput = z.infer<typeof DepositSchema>;
export type ResolveMarketInput = z.infer<typeof ResolveMarketSchema>;
export type CancelMarketInput = z.infer<typeof CancelMarketSchema>;
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;
export type ReconcileWithdrawalInput = z.infer<typeof ReconcileWithdrawalSchema>;
export type ReconcileDepositInput = z.infer<typeof ReconcileDepositSchema>;

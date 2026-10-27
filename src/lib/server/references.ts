import crypto from 'crypto';

export type ReferencePrefix = 'DEP' | 'WDR' | 'REF';

/**
 * Binance merchant references must be short, unique and alphanumeric.
 * Time in base36 keeps them readable; the random suffix makes collisions
 * practically impossible even across instances.
 */
export function createReference(prefix: ReferencePrefix): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${prefix}${time}${random}`;
}

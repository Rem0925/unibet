import crypto from 'crypto';

export type ReferencePrefix = 'DEP' | 'WDR' | 'REF';

export function createReference(prefix: ReferencePrefix): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${prefix}${time}${random}`;
}

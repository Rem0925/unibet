import { ApiError } from './http';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function cleanup(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  cleanup(now);

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new ApiError(
      `Demasiadas solicitudes. Espera ${retryAfter} segundos antes de intentarlo de nuevo.`,
      429,
      'RATE_LIMITED',
      retryAfter
    );
  }

  current.count += 1;
}

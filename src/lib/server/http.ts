import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType } from 'zod';

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(message: string, status = 500, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isFrameworkControlFlow(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_')
  );
}

export function jsonError(error: unknown): NextResponse {
  // Next uses thrown errors with a NEXT_* digest to bail out of prerendering.
  // They are control flow, not application failures: let the framework catch them.
  if (isFrameworkControlFlow(error)) throw error;

  if (error instanceof ApiError) {
    const headers = new Headers();
    if (error.retryAfterSeconds) {
      headers.set('Retry-After', String(error.retryAfterSeconds));
    }
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
  }

  console.error('[api] unhandled error:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}

export async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('El cuerpo de la petición no es JSON válido', 400, 'INVALID_JSON');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ApiError(firstIssue?.message ?? 'Datos inválidos', 400, 'VALIDATION_ERROR');
  }

  return result.data;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function assertNoUnexpectedFields(value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError('Cuerpo inválido', 400);
  }
}

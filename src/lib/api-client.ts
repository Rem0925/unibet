import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new ApiError('No se pudo comprobar tu sesión. Vuelve a iniciar sesión.', 401);
  }

  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('La operación tardó demasiado. Inténtalo de nuevo.', 408);
    }
    throw new ApiError('No hay conexión con el servidor. Revisa tu red.', 0);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : `Error del servidor (${response.status})`;
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined;
    throw new ApiError(message, response.status, code);
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

import { ApiError } from './http';

export interface RpcErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * PostgreSQL raises inside our stored procedures arrive as PostgREST code
 * P0001. Those messages are written for end users. Any other failure is an
 * internal error and must not be exposed.
 */
export function throwRpcError(error: RpcErrorLike | null, fallback: string): never {
  console.error('[rpc]', error);
  if (error?.code === 'P0001' && error.message) {
    throw new ApiError(error.message, 400, 'RPC_REJECTED');
  }
  throw new ApiError(fallback, 500, 'RPC_FAILED');
}

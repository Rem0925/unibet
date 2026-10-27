import { ApiError } from './http';

export interface RpcErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

export function throwRpcError(error: RpcErrorLike | null, fallback: string): never {
  console.error('[rpc]', error);
  if (error?.code === 'P0001' && error.message) {
    throw new ApiError(error.message, 400, 'RPC_REJECTED');
  }
  throw new ApiError(fallback, 500, 'RPC_FAILED');
}

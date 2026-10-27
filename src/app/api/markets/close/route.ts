import { NextResponse, type NextRequest } from 'next/server';
import { CloseMarketSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN', 'MODERATOR']);
    enforceRateLimit(`market-close:${profile.id}`, 30, 60_000);

    const { marketId } = await parseBody(request, CloseMarketSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_close_market', {
      p_market_id: marketId,
      p_caller_id: profile.id,
    });

    if (error) {
      throwRpcError(error, 'No se pudo cerrar el mercado');
    }

    await logAudit({
      actorId: profile.id,
      action: 'MARKET_CLOSED',
      metadata: { marketId, result: data },
    });

    return NextResponse.json({
      success: true,
      message: 'Mercado cerrado con éxito',
      summary: data,
    });
  } catch (error) {
    return jsonError(error);
  }
}

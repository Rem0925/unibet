import { NextResponse, type NextRequest } from 'next/server';
import { ResolveMarketSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN', 'MODERATOR']);
    enforceRateLimit(`market-resolve:${profile.id}`, 20, 60_000);

    const { marketId, winningOption } = await parseBody(request, ResolveMarketSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_resolve_market', {
      p_market_id: marketId,
      p_winning_option: winningOption,
      p_caller_id: profile.id,
    });

    if (error) {
      throwRpcError(error, 'No se pudo liquidar el mercado');
    }

    await logAudit({
      actorId: profile.id,
      action: 'MARKET_RESOLVED',
      metadata: { marketId, winningOption, result: data },
    });

    return NextResponse.json({
      success: true,
      message: 'Mercado liquidado y fondos repartidos con éxito',
      summary: data,
    });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { CancelMarketSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';
import { notifyMarketCancelled } from '@/lib/server/telegram';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN', 'MODERATOR']);
    enforceRateLimit(`market-cancel:${profile.id}`, 20, 60_000);

    const { marketId, reason } = await parseBody(request, CancelMarketSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_cancel_market', {
      p_market_id: marketId,
      p_caller_id: profile.id,
      p_reason: reason,
    });

    if (error) {
      throwRpcError(error, 'No se pudo cancelar el mercado');
    }

    await logAudit({
      actorId: profile.id,
      action: 'MARKET_CANCELLED',
      metadata: { marketId, reason, result: data },
    });

    const { data: marketData } = await getServiceSupabase()
      .from('markets')
      .select('title')
      .eq('id', marketId)
      .single();

    if (marketData) {
      notifyMarketCancelled({
        title: marketData.title,
        reason,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: 'Mercado cancelado y fondos reembolsados',
      summary: data,
    });
  } catch (error) {
    return jsonError(error);
  }
}

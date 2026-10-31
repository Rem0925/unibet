import { NextResponse, type NextRequest } from 'next/server';
import { UndoBetSchema } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`bet-undo:${profile.id}`, 20, 60_000);

    const { betId } = await parseBody(request, UndoBetSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_undo_bet', {
      p_bet_id: betId,
      p_user_id: profile.id,
    });

    if (error) {
      throwRpcError(error, 'No se pudo deshacer la apuesta');
    }

    const result = (data ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      message: 'Apuesta deshecha con éxito. Fondos devueltos al 100%.',
      betId: result.bet_id,
      refundedAmount: result.refunded_amount,
      newBalance: String(result.new_balance ?? profile.balance),
    });
  } catch (error) {
    return jsonError(error);
  }
}

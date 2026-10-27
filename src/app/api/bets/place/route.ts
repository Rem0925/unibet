import { NextResponse, type NextRequest } from 'next/server';
import { PlaceBetSchema } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`bet:${profile.id}`, 12, 60_000);

    const { marketId, selectedOption, amount } = await parseBody(request, PlaceBetSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_place_bet', {
      p_user_id: profile.id,
      p_market_id: marketId,
      p_option: selectedOption,
      p_amount: amount,
    });

    if (error) {
      throwRpcError(error, 'No se pudo registrar la apuesta');
    }

    const result = (data ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      message: 'Apuesta registrada con éxito',
      betId: result.bet_id,
      newBalance: String(result.new_balance ?? profile.balance),
    });
  } catch (error) {
    return jsonError(error);
  }
}

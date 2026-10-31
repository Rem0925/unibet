import { NextResponse, type NextRequest } from 'next/server';
import { CashoutBetSchema } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`bet-cashout:${profile.id}`, 20, 60_000);

    const { betId, expectedPayout } = await parseBody(request, CashoutBetSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_cashout_bet', {
      p_bet_id: betId,
      p_user_id: profile.id,
      p_expected_payout: expectedPayout ?? null,
    });

    if (error) {
      throwRpcError(error, 'No se pudo procesar el retiro anticipado');
    }

    const result = (data ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      message: `Retiro anticipado liquidado. Se acreditaron $${Number(result.cashout_amount).toFixed(2)} USDT a tu saldo.`,
      betId: result.bet_id,
      cashoutAmount: result.cashout_amount,
      penaltyAmount: result.penalty_amount,
      newBalance: String(result.new_balance ?? profile.balance),
    });
  } catch (error) {
    return jsonError(error);
  }
}

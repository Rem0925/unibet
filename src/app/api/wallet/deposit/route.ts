import { NextResponse, type NextRequest } from 'next/server';
import { getAdminBinancePayId } from '@/lib/binance';
import { DepositSchema } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { createReference } from '@/lib/server/references';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`deposit:${profile.id}`, 10, 10 * 60_000);

    const { amount, binanceUid } = await parseBody(request, DepositSchema);
    const tradeNo = createReference('DEP');
    const adminPayId = getAdminBinancePayId();
    const effectiveUid = binanceUid || profile.binanceUid;

    const supabase = getServiceSupabase();

    // Si el usuario proporcionó un Binance UID nuevo, guardarlo en su perfil
    if (binanceUid && binanceUid !== profile.binanceUid) {
      await supabase
        .from('users')
        .update({ binance_uid: binanceUid, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
    }

    const pendingMetadata = {
      provider: 'binance_pay_c2c',
      requested_at: new Date().toISOString(),
      requested_amount: amount,
      admin_pay_id: adminPayId,
      payer_binance_uid: effectiveUid,
    };

    const { data: pendingTx, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: profile.id,
        type: 'DEPOSIT',
        amount,
        status: 'PENDING',
        reference_id: tradeNo,
        metadata: pendingMetadata,
      })
      .select('id')
      .single();

    if (insertError || !pendingTx) {
      console.error('[deposit] Error registrando depósito pendiente:', insertError);
      throw new Error('No se pudo registrar la orden de depósito');
    }

    return NextResponse.json({
      success: true,
      tradeNo,
      adminPayId: adminPayId || null,
      amount,
      userBinanceUid: effectiveUid || null,
      checkoutUrl: null,
      qrcodeLink: null,
      universalUrl: null,
      expireTime: Date.now() + 60 * 60 * 1000,
    });
  } catch (error) {
    return jsonError(error);
  }
}

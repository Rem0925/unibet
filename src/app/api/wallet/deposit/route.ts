import { NextResponse, type NextRequest } from 'next/server';
import { BinanceApiError, createBinanceDepositOrder } from '@/lib/binance';
import { DepositSchema } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { createReference } from '@/lib/server/references';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`deposit:${profile.id}`, 8, 10 * 60_000);

    const { amount } = await parseBody(request, DepositSchema);
    const tradeNo = createReference('DEP');

    const supabase = getServiceSupabase();
    const pendingMetadata = {
      provider: 'binance_pay',
      requested_at: new Date().toISOString(),
      requested_amount: amount,
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

    try {
      const order = await createBinanceDepositOrder({
        userId: profile.id,
        amount,
        tradeNo,
      });

      await supabase
        .from('transactions')
        .update({
          metadata: {
            ...pendingMetadata,
            prepay_id: order.prepayId,
            order_created_at: new Date().toISOString(),
          },
        })
        .eq('id', pendingTx.id)
        .eq('status', 'PENDING');

      return NextResponse.json({
        success: true,
        tradeNo,
        checkoutUrl: order.checkoutUrl,
        qrcodeLink: order.qrcodeLink,
        universalUrl: order.universalUrl,
        expireTime: order.expireTime,
      });
    } catch (binanceError) {
      const message =
        binanceError instanceof Error ? binanceError.message : 'Error desconocido de Binance Pay';

      await supabase
        .from('transactions')
        .update({
          status: 'FAILED',
          metadata: {
            ...pendingMetadata,
            failed_at: new Date().toISOString(),
            error: message.slice(0, 500),
          },
        })
        .eq('id', pendingTx.id)
        .eq('status', 'PENDING');

      console.error('[deposit] Binance Pay rechazó la orden:', binanceError);

      if (binanceError instanceof BinanceApiError && binanceError.code === 'BINANCE_NOT_CONFIGURED') {
        return NextResponse.json(
          { error: 'Las recargas no están disponibles en este momento. Contacta al administrador.' },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: 'No se pudo generar la orden de Binance Pay. Inténtalo de nuevo.' },
        { status: 502 }
      );
    }
  } catch (error) {
    return jsonError(error);
  }
}

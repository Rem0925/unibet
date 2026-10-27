import { NextResponse, type NextRequest } from 'next/server';
import { BinanceApiError, executeBinancePayout } from '@/lib/binance';
import { WithdrawSchema } from '@/lib/security';
import type { WithdrawResponse } from '@/lib/types';
import { logAudit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { metadataRecord } from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { createReference } from '@/lib/server/references';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

interface TransactionMetadataRow {
  metadata: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`withdraw:${profile.id}`, 5, 60 * 60_000);

    const { amount, binanceUid } = await parseBody(request, WithdrawSchema);
    const requestId = createReference('WDR');
    const supabase = getServiceSupabase();

    // 1. Descuento atómico antes de tocar Binance.
    const { data: withdrawalData, error: dbError } = await supabase.rpc('fn_start_withdrawal', {
      p_user_id: profile.id,
      p_amount: amount,
      p_binance_uid: binanceUid,
      p_request_id: requestId,
    });

    if (dbError) {
      throwRpcError(dbError, 'No se pudo iniciar el retiro');
    }

    const withdrawalResult = (withdrawalData ?? {}) as Record<string, unknown>;
    const remainingBalance = String(withdrawalResult.remaining_balance ?? profile.balance);

    // 2. Pago en Binance Pay.
    try {
      const payoutResult = await executeBinancePayout({
        requestId,
        binanceUid,
        amount,
      });

      const payoutStatus = payoutResult.status;
      const completed = !payoutStatus || payoutStatus === 'SUCCESS';

      const { data: txRow } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('reference_id', requestId)
        .maybeSingle();

      const metadata = metadataRecord((txRow as TransactionMetadataRow | null)?.metadata);

      await supabase
        .from('transactions')
        .update({
          status: completed ? 'COMPLETED' : 'PENDING',
          metadata: {
            ...metadata,
            payout_order_id: payoutResult.orderId,
            payout_status: payoutStatus,
            payout_accepted_at: new Date().toISOString(),
          },
        })
        .eq('reference_id', requestId);

      const response: WithdrawResponse = {
        success: completed,
        status: completed ? 'COMPLETED' : 'PENDING',
        message: completed
          ? 'Retiro procesado con éxito en Binance Pay'
          : 'Binance aceptó el retiro y lo está procesando. Aparecerá como pendiente hasta que se confirme.',
        remainingBalance,
      };

      return NextResponse.json(response);
    } catch (payoutError) {
      const definitive = payoutError instanceof BinanceApiError ? payoutError.definitive : false;
      const errorMessage =
        payoutError instanceof Error ? payoutError.message : 'Error desconocido al pagar en Binance';

      if (!definitive) {
        // No sabemos si Binance llegó a procesar la orden. Nunca reembolsamos
        // automáticamente un resultado incierto: quedaría dinero duplicado.
        const { data: txRow } = await supabase
          .from('transactions')
          .select('metadata')
          .eq('reference_id', requestId)
          .maybeSingle();

        const metadata = metadataRecord((txRow as TransactionMetadataRow | null)?.metadata);

        await supabase
          .from('transactions')
          .update({
            metadata: {
              ...metadata,
              payout_error: errorMessage.slice(0, 500),
              requires_review: true,
              review_reason: 'Resultado incierto de Binance Pay',
            },
          })
          .eq('reference_id', requestId)
          .eq('status', 'PENDING');

        console.error('[withdraw] Resultado incierto de Binance; queda pendiente de revisión:', {
          requestId,
          error: payoutError,
        });

        await logAudit({
          actorId: profile.id,
          action: 'WITHDRAW_UNCERTAIN',
          metadata: { requestId, amount, binanceUid, error: errorMessage },
        });

        const response: WithdrawResponse = {
          success: false,
          status: 'PENDING',
          message:
            'El retiro quedó en revisión porque Binance Pay no confirmó la operación. No se cobrará dos veces: un administrador verificará el estado.',
          remainingBalance,
        };

        return NextResponse.json(response, { status: 202 });
      }

      // Error definitivo: Binance rechazó el pago. Reembolsamos sin 3%.
      console.error('[withdraw] Binance rechazó el retiro; reembolsando:', {
        requestId,
        error: payoutError,
      });

      const { error: refundError } = await supabase.rpc('fn_refund_withdrawal', {
        p_user_id: profile.id,
        p_amount: amount,
        p_reference_id: requestId,
        p_reason: errorMessage.slice(0, 300),
      });

      if (refundError) {
        console.error('[withdraw] CRÍTICO: fallo al reembolsar el retiro:', {
          requestId,
          refundError,
        });

        await logAudit({
          actorId: profile.id,
          action: 'WITHDRAW_REFUND_FAILED',
          metadata: { requestId, amount, binanceUid, error: errorMessage, refundError },
        });

        return NextResponse.json(
          {
            error: `El retiro falló y no se pudo reembolsar automáticamente. Contacta al administrador con la referencia ${requestId}.`,
          },
          { status: 500 }
        );
      }

      await logAudit({
        actorId: profile.id,
        action: 'WITHDRAW_REFUNDED',
        metadata: { requestId, amount, binanceUid, error: errorMessage },
      });

      return NextResponse.json(
        {
          error:
            payoutError instanceof BinanceApiError && payoutError.code === 'BINANCE_NOT_CONFIGURED'
              ? 'Los retiros no están disponibles en este momento. El saldo fue reintegrado.'
              : `Binance Pay rechazó el retiro. El saldo fue reintegrado (${amount.toFixed(2)} USDT).`,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return jsonError(error);
  }
}

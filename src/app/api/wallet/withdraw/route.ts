import { NextResponse, type NextRequest } from 'next/server';
import {
  BinanceApiError,
  getBscWithdrawFee,
  submitBscWithdrawal,
} from '@/lib/binance';
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

    const input = await parseBody(request, WithdrawSchema);
    const { amount, method } = input;
    const destination = method === 'BEP20' ? input.address! : input.binanceUid!;
    const requestId = createReference('WDR');
    const supabase = getServiceSupabase();

    // Si es retiro Express BEP-20, consultar la comisión de red en tiempo real de Binance
    let liveFee = 0;
    let netPayout = amount;

    if (method === 'BEP20') {
      const feeInfo = await getBscWithdrawFee();
      liveFee = feeInfo.withdrawFee;
      const minRequired = Math.max(feeInfo.withdrawMin, 1.0) + liveFee;

      if (amount < minRequired) {
        return NextResponse.json(
          {
            error: `El retiro express mínimo es de $${minRequired.toFixed(2)} USDT ($${feeInfo.withdrawMin.toFixed(2)} monto mínimo de red + $${liveFee.toFixed(2)} comisión de gas BSC).`,
          },
          { status: 400 }
        );
      }

      netPayout = Math.round((amount - liveFee) * 10000) / 10000;
      if (netPayout <= 0) {
        return NextResponse.json(
          {
            error: `El monto a retirar debe ser mayor a la comisión de red ($${liveFee.toFixed(2)} USDT).`,
          },
          { status: 400 }
        );
      }
    }

    // Iniciar el retiro en la base de datos (descontando el saldo total de la plataforma)
    const { data: withdrawalData, error: dbError } = await supabase.rpc('fn_start_withdrawal', {
      p_user_id: profile.id,
      p_amount: amount,
      p_destination: destination,
      p_request_id: requestId,
      p_method: method,
    });

    if (dbError) {
      throwRpcError(dbError, 'No se pudo iniciar el retiro');
    }

    const withdrawalResult = (withdrawalData ?? {}) as Record<string, unknown>;
    const remainingBalance = String(withdrawalResult.remaining_balance ?? profile.balance);

    // ==========================================
    // MÉTODO 1: RETIRO EXPRESS BEP-20 (AUTOMÁTICO)
    // ==========================================
    if (method === 'BEP20') {
      try {
        const payoutResult = await submitBscWithdrawal({
          address: destination,
          amount: netPayout,
          requestId,
        });

        const { data: txRow } = await supabase
          .from('transactions')
          .select('metadata')
          .eq('reference_id', requestId)
          .maybeSingle();

        const metadata = metadataRecord((txRow as TransactionMetadataRow | null)?.metadata);

        await supabase
          .from('transactions')
          .update({
            status: 'COMPLETED',
            metadata: {
              ...metadata,
              method: 'BEP20',
              bep20_address: destination,
              binance_withdraw_id: payoutResult.id,
              network_fee: liveFee,
              net_payout: netPayout,
              completed_at: new Date().toISOString(),
            },
          })
          .eq('reference_id', requestId);

        await logAudit({
          actorId: profile.id,
          action: 'WITHDRAW_BEP20_COMPLETED',
          metadata: {
            requestId,
            amount,
            destination,
            liveFee,
            netPayout,
            withdrawId: payoutResult.id,
          },
        });

        const response: WithdrawResponse = {
          success: true,
          status: 'COMPLETED',
          message: `Retiro express procesado exitosamente. Se enviaron $${netPayout.toFixed(2)} USDT netos a tu billetera BSC (Comisión de red deducida: $${liveFee.toFixed(2)} USDT).`,
          remainingBalance,
          method: 'BEP20',
          payoutAmount: netPayout.toFixed(2),
          networkFee: liveFee.toFixed(2),
          binanceWithdrawId: payoutResult.id,
        };

        return NextResponse.json(response);
      } catch (payoutError) {
        const definitive = payoutError instanceof BinanceApiError ? payoutError.definitive : false;
        const errorMessage =
          payoutError instanceof Error ? payoutError.message : 'Error desconocido al retirar en Binance';

        if (!definitive) {
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
                review_reason: 'Resultado incierto de Binance SAPI (red o tiempo límite)',
              },
            })
            .eq('reference_id', requestId)
            .eq('status', 'PENDING');

          console.error('[withdraw] Retiro BEP20 incierto; pendiente de revisión manual:', {
            requestId,
            error: payoutError,
          });

          await logAudit({
            actorId: profile.id,
            action: 'WITHDRAW_UNCERTAIN',
            metadata: { requestId, amount, destination, method, error: errorMessage },
          });

          const response: WithdrawResponse = {
            success: false,
            status: 'PENDING',
            message:
              'El retiro quedó en revisión porque Binance no confirmó la operación a tiempo. Un administrador verificará el estado.',
            remainingBalance,
            method: 'BEP20',
          };

          return NextResponse.json(response, { status: 202 });
        }

        console.error('[withdraw] Binance rechazó el retiro BEP-20; ejecutando reembolso automático:', {
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
          console.error('[withdraw] CRÍTICO: fallo al reembolsar retiro BEP-20:', {
            requestId,
            refundError,
          });

          await logAudit({
            actorId: profile.id,
            action: 'WITHDRAW_REFUND_FAILED',
            metadata: { requestId, amount, destination, error: errorMessage, refundError },
          });

          return NextResponse.json(
            {
              error: `El retiro falló y no se pudo reembolsar automáticamente. Contacta al soporte con la referencia ${requestId}.`,
            },
            { status: 500 }
          );
        }

        await logAudit({
          actorId: profile.id,
          action: 'WITHDRAW_REFUNDED',
          metadata: { requestId, amount, destination, error: errorMessage },
        });

        return NextResponse.json(
          {
            error:
              payoutError instanceof BinanceApiError && payoutError.code === 'BINANCE_NOT_CONFIGURED'
                ? 'Los retiros automáticos no están configurados en este momento. Tu saldo fue reintegrado.'
                : `Binance rechazó el retiro (${errorMessage}). Tu saldo fue reintegrado por completo ($${amount.toFixed(2)} USDT).`,
          },
          { status: 502 }
        );
      }
    }

    // ==========================================
    // MÉTODO 2: RETIRO VÍA BINANCE PAY (0% COMISIÓN, 1-CLICK ADMIN)
    // ==========================================
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
          method: 'BINANCE_PAY',
          binance_uid: destination,
          fee: 0,
          net_payout: amount,
          requested_at: new Date().toISOString(),
        },
      })
      .eq('reference_id', requestId);

    await logAudit({
      actorId: profile.id,
      action: 'WITHDRAW_BINANCE_PAY_PENDING',
      metadata: { requestId, amount, binanceUid: destination },
    });

    const response: WithdrawResponse = {
      success: true,
      status: 'PENDING',
      message: `Solicitud de retiro registrada sin comisión ($0.00). El administrador enviará los $${amount.toFixed(2)} USDT directo a tu Binance Pay UID.`,
      remainingBalance,
      method: 'BINANCE_PAY',
      payoutAmount: amount.toFixed(2),
      networkFee: '0.00',
    };

    return NextResponse.json(response);
  } catch (error) {
    return jsonError(error);
  }
}

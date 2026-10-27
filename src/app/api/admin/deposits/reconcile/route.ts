import { NextResponse, type NextRequest } from 'next/server';
import { queryBinanceDepositOrder } from '@/lib/binance';
import { ReconcileDepositSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { ApiError, jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

interface DepositRow {
  id: string;
  user_id: string;
  amount: string | number;
  status: string;
  reference_id: string;
  metadata: unknown;
}

const FAILED_ORDER_STATES = new Set(['PAY_FAIL', 'PAY_CLOSED', 'PAY_OVER_TIME', 'PAY_TIMEOUT']);

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN']);
    enforceRateLimit(`admin-deposit-reconcile:${profile.id}`, 30, 60_000);

    const { referenceId, action, note } = await parseBody(request, ReconcileDepositSchema);
    const supabase = getServiceSupabase();

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status, reference_id, metadata')
      .eq('reference_id', referenceId)
      .eq('type', 'DEPOSIT')
      .maybeSingle();

    if (txError) {
      console.error('[admin] Error buscando depósito:', txError);
      throw new Error('No se pudo leer el depósito');
    }

    const tx = txData as DepositRow | null;
    if (!tx) {
      throw new ApiError('Depósito no encontrado', 404, 'DEPOSIT_NOT_FOUND');
    }

    if (tx.status === 'COMPLETED') {
      return NextResponse.json({ success: true, message: 'El depósito ya estaba acreditado.' });
    }

    if (action === 'fail') {
      const { error: failError } = await supabase.rpc('fn_fail_deposit', {
        p_reference_id: referenceId,
        p_reason: note ?? 'Marcado manualmente como fallido por administración',
      });

      if (failError) {
        throwRpcError(failError, 'No se pudo marcar el depósito como fallido');
      }

      await logAudit({
        actorId: profile.id,
        action: 'DEPOSIT_MARKED_FAILED',
        targetUserId: tx.user_id,
        metadata: { referenceId, amount: tx.amount, note },
      });

      return NextResponse.json({
        success: true,
        message: 'Depósito marcado como fallido. Ningún saldo fue acreditado.',
      });
    }

    let order;
    try {
      order = await queryBinanceDepositOrder(referenceId);
    } catch (binanceError) {
      const message =
        binanceError instanceof Error ? binanceError.message : 'Error consultando Binance';
      throw new ApiError(
        `Binance Pay no confirmó esta orden: ${message}`,
        502,
        'BINANCE_QUERY_FAILED'
      );
    }

    if (order.currency !== null && order.currency !== 'USDT') {
      throw new ApiError(
        `La orden está en ${order.currency}; solo se procesan depósitos en USDT.`,
        409,
        'DEPOSIT_CURRENCY_MISMATCH'
      );
    }

    if (order.status === 'PAY_SUCCESS' && order.totalFee !== null) {
      const { error: creditError } = await supabase.rpc('fn_credit_deposit', {
        p_user_id: tx.user_id,
        p_gross_amount: order.totalFee,
        p_reference_id: referenceId,
      });

      if (creditError) {
        throwRpcError(creditError, 'Binance confirma el pago pero la acreditación falló');
      }

      await logAudit({
        actorId: profile.id,
        action: 'DEPOSIT_CREDITED_MANUALLY',
        targetUserId: tx.user_id,
        metadata: { referenceId, totalFee: order.totalFee, binanceStatus: order.status },
      });

      return NextResponse.json({
        success: true,
        message: `Pago confirmado por Binance. Depósito acreditado (${order.totalFee} USDT brutos, menos la comisión del 1.5%).`,
      });
    }

    if (order.status && FAILED_ORDER_STATES.has(order.status)) {
      const { error: failError } = await supabase.rpc('fn_fail_deposit', {
        p_reference_id: referenceId,
        p_reason: `Binance reporta ${order.status}: la orden se cerró sin pago`,
      });

      if (failError) {
        throwRpcError(failError, 'No se pudo cerrar el depósito');
      }

      await logAudit({
        actorId: profile.id,
        action: 'DEPOSIT_MARKED_FAILED',
        targetUserId: tx.user_id,
        metadata: { referenceId, binanceStatus: order.status },
      });

      return NextResponse.json({
        success: true,
        message: `Binance reporta ${order.status}: depósito cerrado sin acreditar.`,
      });
    }

    await logAudit({
      actorId: profile.id,
      action: 'DEPOSIT_CHECKED_PENDING',
      targetUserId: tx.user_id,
      metadata: { referenceId, binanceStatus: order.status, checkedAt: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      message: `Binance reporta estado "${order.status ?? 'desconocido'}". La orden sigue en proceso; vuelve a verificar más tarde.`,
    });
  } catch (error) {
    return jsonError(error);
  }
}

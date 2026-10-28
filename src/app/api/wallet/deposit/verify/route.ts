import { NextResponse, type NextRequest } from 'next/server';
import { fetchBinancePayTransactions, isBinanceConfigured } from '@/lib/binance';
import { VerifyDepositSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireUser } from '@/lib/server/auth';
import { ApiError, jsonError, parseBody } from '@/lib/server/http';
import { metadataRecord } from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

interface DepositTxRow {
  id: string;
  user_id: string;
  type: string;
  amount: number | string;
  status: string;
  reference_id: string;
  metadata: unknown;
  created_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`deposit-verify:${profile.id}`, 20, 60_000);

    const { tradeNo, binanceUid } = await parseBody(request, VerifyDepositSchema);
    const supabase = getServiceSupabase();

    // Actualizar UID si fue provisto
    if (binanceUid && binanceUid !== profile.binanceUid) {
      await supabase
        .from('users')
        .update({ binance_uid: binanceUid, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
    }

    const effectiveUid = binanceUid || profile.binanceUid;

    // Buscar la orden pendiente
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, type, amount, status, reference_id, metadata, created_at')
      .eq('reference_id', tradeNo)
      .eq('type', 'DEPOSIT')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (txError) {
      console.error('[deposit-verify] Error leyendo transacción:', txError);
      throw new Error('No se pudo verificar la orden de depósito');
    }

    const tx = txData as DepositTxRow | null;
    if (!tx) {
      throw new ApiError('Orden de depósito no encontrada', 404, 'DEPOSIT_NOT_FOUND');
    }

    if (tx.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        credited: true,
        alreadyProcessed: true,
        message: 'El depósito ya fue verificado y acreditado.',
      });
    }

    if (tx.status !== 'PENDING') {
      throw new ApiError('La orden de depósito no está pendiente', 400, 'DEPOSIT_NOT_PENDING');
    }

    if (!isBinanceConfigured()) {
      return NextResponse.json({
        success: false,
        pending: true,
        message:
          'La API de Binance no está activa. Un administrador conciliará tu depósito manualmente desde el panel.',
      });
    }

    const orderAmount = Number(tx.amount);
    const orderCreatedAt = new Date(tx.created_at).getTime();
    // Consultar transferencias C2C en Binance Pay desde 10 minutos antes de la orden
    const transactions = await fetchBinancePayTransactions({
      startTime: Math.max(0, orderCreatedAt - 10 * 60 * 1000),
      limit: 100,
    });

    // Buscar coincidencia C2C en USDT
    const match = transactions.find((item) => {
      if (item.orderType !== 'C2C' || item.currency !== 'USDT') return false;
      const txAmount = Number.parseFloat(item.amount);
      if (!Number.isFinite(txAmount) || Math.abs(txAmount - orderAmount) > 0.05) return false;

      // Si tenemos el UID del usuario, validar que coincida
      if (effectiveUid) {
        return item.payerInfo?.binanceId === effectiveUid;
      }
      return true;
    });

    if (!match) {
      return NextResponse.json({
        success: false,
        pending: true,
        message:
          'Aún no detectamos la transferencia en Binance Pay. Si acabas de transferir, espera unos 15 a 30 segundos y vuelve a comprobar.',
      });
    }

    // Verificar que este transactionId no haya sido acreditado previamente en otra transacción
    const { data: duplicateTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('type', 'DEPOSIT')
      .eq('status', 'COMPLETED')
      .filter('metadata->>binance_pay_tx_id', 'eq', match.transactionId)
      .maybeSingle();

    if (duplicateTx) {
      console.warn('[deposit-verify] Intento de reusar comprobante de Binance Pay:', {
        transactionId: match.transactionId,
        existingTxId: duplicateTx.id,
      });
      throw new ApiError(
        'Esta transferencia de Binance ya fue utilizada para recargar saldo.',
        409,
        'BINANCE_TRANSFER_ALREADY_USED'
      );
    }

    const depositAmount = Number.parseFloat(match.amount);

    // Acreditar el saldo mediante la función de base de datos segura
    const { error: creditError } = await supabase.rpc('fn_credit_deposit', {
      p_user_id: profile.id,
      p_gross_amount: depositAmount,
      p_reference_id: tradeNo,
    });

    if (creditError) {
      throwRpcError(creditError, 'No se pudo acreditar el saldo del depósito');
    }

    const metadata = metadataRecord(tx.metadata);
    await supabase
      .from('transactions')
      .update({
        metadata: {
          ...metadata,
          binance_pay_tx_id: match.transactionId,
          payer_binance_id: match.payerInfo?.binanceId ?? effectiveUid,
          verified_at: new Date().toISOString(),
        },
      })
      .eq('id', tx.id);

    await logAudit({
      actorId: profile.id,
      action: 'DEPOSIT_C2C_VERIFIED',
      metadata: {
        tradeNo,
        amount: depositAmount,
        binanceTxId: match.transactionId,
        payerUid: match.payerInfo?.binanceId,
      },
    });

    return NextResponse.json({
      success: true,
      credited: true,
      message: `¡Depósito verificado! Se acreditaron exitosamente $${depositAmount.toFixed(2)} USDT a tu saldo.`,
    });
  } catch (error) {
    return jsonError(error);
  }
}

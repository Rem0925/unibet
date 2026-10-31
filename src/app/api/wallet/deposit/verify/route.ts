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

    const { tradeNo, binanceUid, binanceTxId } = await parseBody(request, VerifyDepositSchema);
    const supabase = getServiceSupabase();
    const cleanTxId = binanceTxId?.trim() || null;

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

    // Registrar que el usuario interactuó y solicitó la comprobación de su pago
    await supabase
      .from('transactions')
      .update({
        metadata: {
          ...metadataRecord(tx.metadata),
          user_confirmed_payment: true,
          submitted_tx_id: cleanTxId,
          user_checked_at: new Date().toISOString(),
        },
      })
      .eq('id', tx.id);

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

    // Consultar transferencias C2C en Binance Pay
    const transactions = await fetchBinancePayTransactions({
      startTime: Math.max(0, orderCreatedAt - (cleanTxId ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000)),
      limit: 100,
    });

    let match: (typeof transactions)[number] | undefined;

    if (cleanTxId) {
      // 1. Verificación directa por ID de transacción o ID de orden provisto por el usuario
      const searchNormalized = cleanTxId.toLowerCase().replace(/^p_/i, '');
      const candidate = transactions.find((item) => {
        const itemTxIdNorm = item.transactionId.toLowerCase().replace(/^p_/i, '');
        const itemOrderId = item.orderId ? String(item.orderId).trim() : '';
        return (
          itemTxIdNorm === searchNormalized ||
          item.transactionId.toLowerCase() === cleanTxId.toLowerCase() ||
          itemOrderId === cleanTxId
        );
      });

      if (!candidate) {
        return NextResponse.json({
          success: false,
          pending: true,
          message: `Aún no encontramos en Binance Pay la transacción "${cleanTxId}". Asegúrate de haber completado la transferencia o revisa si copiaste el ID correcto de tu comprobante.`,
        });
      }

      if (candidate.currency !== 'USDT') {
        throw new ApiError('La moneda de la transferencia debe ser USDT.', 400, 'INVALID_CURRENCY');
      }

      const txAmount = Number.parseFloat(candidate.amount);
      if (!Number.isFinite(txAmount) || txAmount <= 0) {
        throw new ApiError('La transacción no representa un pago entrante válido.', 400, 'INVALID_AMOUNT');
      }

      if (Math.abs(txAmount - orderAmount) > 0.05) {
        throw new ApiError(
          `El monto en Binance (${txAmount.toFixed(2)} USDT) no coincide con el monto de la orden (${orderAmount.toFixed(2)} USDT).`,
          400,
          'AMOUNT_MISMATCH'
        );
      }

      if (effectiveUid && candidate.payerInfo?.binanceId && candidate.payerInfo.binanceId !== effectiveUid) {
        throw new ApiError(
          'La cuenta de Binance que realizó la transferencia no coincide con tu UID registrado.',
          403,
          'UID_MISMATCH'
        );
      }

      match = candidate;
    } else {
      // 2. Coincidencia automática por monto y ventana de tiempo
      match = transactions.find((item) => {
        if (item.orderType !== 'C2C' || item.currency !== 'USDT') return false;
        const txAmount = Number.parseFloat(item.amount);
        if (!Number.isFinite(txAmount) || Math.abs(txAmount - orderAmount) > 0.05) return false;

        // Si Binance devuelve explícitamente el binanceId del pagador (sin enmascarar), verificar que no sea diferente
        if (effectiveUid && item.payerInfo?.binanceId && item.payerInfo.binanceId !== effectiveUid) {
          return false;
        }
        return true;
      });

      if (!match) {
        return NextResponse.json({
          success: false,
          pending: true,
          message:
            'Aún no detectamos la transferencia en Binance Pay. Pega el ID de transacción de tu comprobante de Binance para verificarla directamente.',
        });
      }
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
          payer_name: match.payerInfo?.name ?? null,
          payer_counterparty_id: match.counterpartyId ?? null,
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
        payerUid: match.payerInfo?.binanceId ?? effectiveUid,
        payerName: match.payerInfo?.name,
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

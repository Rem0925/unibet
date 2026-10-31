import { NextResponse, type NextRequest } from 'next/server';
import { fetchBinancePayTransactions, isBinanceConfigured } from '@/lib/binance';
import { ReconcileDepositSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { ApiError, jsonError, parseBody } from '@/lib/server/http';
import { metadataRecord } from '@/lib/server/mappers';
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
  created_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN']);
    enforceRateLimit(`admin-deposit-reconcile:${profile.id}`, 30, 60_000);

    const { referenceId, action, binanceTxId: paramTxId, note } = await parseBody(request, ReconcileDepositSchema);
    const supabase = getServiceSupabase();
    const cleanAdminTxId = paramTxId?.trim() || null;

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status, reference_id, metadata, created_at')
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

    // Acción: verify o manual
    const orderAmount = Number(tx.amount);
    let binanceTxId: string | null = null;
    let verifiedAmount = orderAmount;
    let payerName: string | null = null;
    let counterpartyId: string | number | null = null;

    if (action === 'verify') {
      if (!isBinanceConfigured()) {
        throw new ApiError(
          'La API de Binance no está activa. Si ya viste los fondos en tu app de Binance, utiliza la opción "Aprobar manualmente".',
          400,
          'BINANCE_NOT_CONFIGURED'
        );
      }

      let binanceErrorMsg: string | null = null;
      try {
        const orderCreatedAt = new Date(tx.created_at).getTime();
        const transactions = await fetchBinancePayTransactions({
          startTime: Math.max(0, orderCreatedAt - 24 * 60 * 60 * 1000),
          limit: 100,
        });

        const metadata = metadataRecord(tx.metadata);
        const userUid = typeof metadata.payer_binance_uid === 'string' ? metadata.payer_binance_uid : null;
        const submittedTxId = cleanAdminTxId || (typeof metadata.submitted_tx_id === 'string' ? metadata.submitted_tx_id.trim() : null);

        const match = transactions.find((item) => {
          if (item.currency !== 'USDT') return false;
          const txAmt = Number.parseFloat(item.amount);
          if (!Number.isFinite(txAmt) || Math.abs(txAmt - orderAmount) > 0.05) return false;

          if (submittedTxId) {
            const searchNorm = submittedTxId.toLowerCase().replace(/^p_/i, '');
            const itemTxNorm = item.transactionId.toLowerCase().replace(/^p_/i, '');
            const itemOrderId = item.orderId ? String(item.orderId).trim() : '';
            return (
              itemTxNorm === searchNorm ||
              item.transactionId.toLowerCase() === submittedTxId.toLowerCase() ||
              itemOrderId === submittedTxId
            );
          }

          if (item.orderType !== 'C2C') return false;
          if (userUid && item.payerInfo?.binanceId && item.payerInfo.binanceId !== userUid) return false;
          return true;
        });

        if (match) {
          binanceTxId = match.transactionId;
          verifiedAmount = Number.parseFloat(match.amount);
          payerName = match.payerInfo?.name ?? null;
          counterpartyId = match.counterpartyId ?? null;
        }
      } catch (err) {
        binanceErrorMsg = err instanceof Error ? err.message : 'Error desconocido al contactar a Binance';
        console.warn('[admin] Error al consultar Binance SAPI:', err);
      }

      if (!binanceTxId) {
        throw new ApiError(
          binanceErrorMsg
            ? `Binance API: ${binanceErrorMsg}. Si confirmas haber recibido los fondos en tu app de Binance, puedes usar "Aprobar manualmente".`
            : 'No se encontró en Binance Pay ninguna transferencia que coincida con esta orden. Si confirmas haber recibido los fondos en tu app de Binance, puedes usar "Aprobar manualmente".',
          400,
          'BINANCE_NOT_FOUND'
        );
      }
    }

    const { error: creditError } = await supabase.rpc('fn_credit_deposit', {
      p_user_id: tx.user_id,
      p_gross_amount: verifiedAmount,
      p_reference_id: referenceId,
    });

    if (creditError) {
      throwRpcError(creditError, 'Fallo al acreditar el depósito en la base de datos');
    }

    const metadata = metadataRecord(tx.metadata);
    await supabase
      .from('transactions')
      .update({
        metadata: {
          ...metadata,
          binance_pay_tx_id: binanceTxId,
          payer_name: payerName,
          payer_counterparty_id: counterpartyId,
          reconciled_by: profile.id,
          reconciled_at: new Date().toISOString(),
          reconciliation_note: note ?? (action === 'manual' ? 'Aprobado manualmente por el administrador sin confirmación de API' : 'Verificado automáticamente vía Binance Pay API'),
        },
      })
      .eq('id', tx.id);

    await logAudit({
      actorId: profile.id,
      action: 'DEPOSIT_CREDITED_MANUALLY',
      targetUserId: tx.user_id,
      metadata: { referenceId, amount: verifiedAmount, note, binanceTxId },
    });

    return NextResponse.json({
      success: true,
      message: `Depósito acreditado con éxito (${verifiedAmount.toFixed(2)} USDT acreditados al usuario sin comisiones).`,
    });
  } catch (error) {
    return jsonError(error);
  }
}

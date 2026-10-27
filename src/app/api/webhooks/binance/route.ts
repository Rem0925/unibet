import { NextResponse, type NextRequest } from 'next/server';
import { verifyBinanceWebhookSignature } from '@/lib/binance';
import { logAudit } from '@/lib/server/audit';
import { isRecord } from '@/lib/server/mappers';
import { getServiceSupabase } from '@/lib/server/supabase';

const MAX_BODY_BYTES = 100_000;

interface DepositTransactionRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  amount: string | number;
}

function ack() {
  return NextResponse.json({ returnCode: 'SUCCESS', returnMessage: null });
}

function fail(status: number, message: string) {
  return NextResponse.json({ returnCode: 'FAIL', returnMessage: message }, { status });
}

function parseAmount(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
  if (!/^\d{1,7}(\.\d{1,4})?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return fail(413, 'Payload too large');
    }

    // 1. Cuerpo RAW: la firma se calcula sobre los bytes exactos.
    const rawBody = await request.text();
    if (rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
      return fail(400, 'Invalid body');
    }

    const timestamp = request.headers.get('binancepay-timestamp') ?? '';
    const nonce = request.headers.get('binancepay-nonce') ?? '';
    const signature = request.headers.get('binancepay-signature') ?? '';
    const certSn = request.headers.get('binancepay-certificate-sn') ?? '';

    // 2. Firma RSA-SHA256 de Binance Pay.
    const isValid = await verifyBinanceWebhookSignature({
      rawBody,
      timestamp,
      nonce,
      signature,
      certSn,
    });

    if (!isValid) {
      console.error('[webhook] Firma inválida. Posible intento de falsificación.');
      return fail(401, 'Invalid signature');
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return fail(400, 'Invalid JSON');
    }

    if (!isRecord(event)) return fail(400, 'Invalid event');

    if (event.bizStatus !== 'PAY_SUCCESS') {
      return ack();
    }

    if (event.bizType !== undefined && event.bizType !== 'PAY') {
      return ack();
    }

    let orderData: unknown = event.data;
    if (typeof orderData === 'string') {
      try {
        orderData = JSON.parse(orderData);
      } catch {
        return fail(400, 'Invalid order data');
      }
    }

    if (!isRecord(orderData)) {
      console.error('[webhook] PAY_SUCCESS sin datos de orden válidos');
      return ack();
    }

    const merchantTradeNo =
      typeof orderData.merchantTradeNo === 'string' ? orderData.merchantTradeNo.trim() : '';
    const totalFee = parseAmount(orderData.totalFee);
    const currency =
      typeof orderData.currency === 'string' ? orderData.currency.toUpperCase() : 'USDT';

    if (
      !merchantTradeNo ||
      !/^[A-Za-z0-9_-]{6,64}$/.test(merchantTradeNo) ||
      totalFee === null ||
      currency !== 'USDT'
    ) {
      console.error('[webhook] Orden inválida:', { merchantTradeNo, totalFee, currency });
      await logAudit({
        action: 'WEBHOOK_INVALID_ORDER',
        metadata: { merchantTradeNo, totalFee, currency, orderData },
      });
      return ack();
    }

    const supabase = getServiceSupabase();
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('id, user_id, type, status, amount')
      .eq('reference_id', merchantTradeNo)
      .maybeSingle();

    if (txError) {
      console.error('[webhook] Error consultando la orden pendiente:', txError);
      return fail(500, 'Database error');
    }

    const tx = txData as DepositTransactionRow | null;

    if (!tx) {
      console.error('[webhook] Orden desconocida:', merchantTradeNo);
      await logAudit({
        action: 'WEBHOOK_UNKNOWN_ORDER',
        metadata: { merchantTradeNo, totalFee, orderData },
      });
      return ack();
    }

    if (tx.type !== 'DEPOSIT') {
      await logAudit({
        actorId: tx.user_id,
        action: 'WEBHOOK_WRONG_TYPE',
        metadata: { merchantTradeNo, type: tx.type },
      });
      return ack();
    }

    if (tx.status === 'COMPLETED') {
      return ack();
    }

    if (tx.status !== 'PENDING') {
      await logAudit({
        actorId: tx.user_id,
        action: 'WEBHOOK_NOT_PENDING',
        metadata: { merchantTradeNo, status: tx.status, totalFee },
      });
      return ack();
    }

    // 3. Acreditación atómica e idempotente. Verifica usuario y monto contra
    //    la orden que creó el backend, no contra datos del navegador.
    const { error: rpcError } = await supabase.rpc('fn_credit_deposit', {
      p_user_id: tx.user_id,
      p_gross_amount: totalFee,
      p_reference_id: merchantTradeNo,
    });

    if (rpcError) {
      if (rpcError.code === 'P0001') {
        console.error('[webhook] Depósito rechazado por validación:', rpcError);
        await logAudit({
          actorId: tx.user_id,
          action: 'WEBHOOK_CREDIT_REJECTED',
          metadata: {
            merchantTradeNo,
            totalFee,
            storedAmount: tx.amount,
            error: rpcError.message,
          },
        });
        // Se confirma a Binance para detener reintentos infinitos; el caso
        // queda en auditoría para revisión manual.
        return ack();
      }

      console.error('[webhook] Error de base de datos acreditando depósito:', rpcError);
      return fail(500, 'Database error');
    }

    await logAudit({
      actorId: tx.user_id,
      action: 'DEPOSIT_CREDITED',
      metadata: { merchantTradeNo, totalFee },
    });

    return ack();
  } catch (error) {
    console.error('[webhook] Error interno:', error);
    return fail(500, 'Internal Server Error');
  }
}

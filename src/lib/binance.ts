import crypto from 'crypto';

const DEFAULT_BASE_URL = 'https://bpay.binanceapi.com';
const REQUEST_TIMEOUT_MS = 20_000;
const CERT_CACHE_TTL_MS = 60 * 60 * 1000;

export class BinanceApiError extends Error {
  definitive: boolean;
  code?: string;

  constructor(message: string, definitive: boolean, code?: string) {
    super(message);
    this.name = 'BinanceApiError';
    this.definitive = definitive;
    this.code = code;
  }
}

interface BinanceEnvelope<T> {
  status?: string;
  code?: string;
  errorMessage?: string;
  data?: T;
}

interface BinanceConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

interface CertificateEntry {
  serial: string | null;
  pem: string;
}

let certificateCache: { fetchedAt: number; entries: CertificateEntry[] } | null = null;

function getConfig(): BinanceConfig {
  const apiKey = process.env.BINANCE_PAY_API_KEY;
  const apiSecret = process.env.BINANCE_PAY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new BinanceApiError(
      'Binance Pay no está configurado en el servidor (faltan BINANCE_PAY_API_KEY / BINANCE_PAY_API_SECRET).',
      true,
      'BINANCE_NOT_CONFIGURED'
    );
  }

  return {
    baseUrl: (process.env.BINANCE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ''),
    apiKey,
    apiSecret,
  };
}

export function isBinanceConfigured(): boolean {
  return Boolean(process.env.BINANCE_PAY_API_KEY && process.env.BINANCE_PAY_API_SECRET);
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex').toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function binancePost<T>(endpoint: string, body: unknown): Promise<BinanceEnvelope<T>> {
  const config = getConfig();
  const jsonBody = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex').toUpperCase();
  const signature = signPayload(`${timestamp}\n${nonce}\n${jsonBody}\n`, config.apiSecret);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Binancepay-Timestamp': timestamp,
        'Binancepay-Nonce': nonce,
        'Binancepay-Certificate-SN': config.apiKey,
        'Binancepay-Signature': signature,
      },
      body: jsonBody,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de red desconocido';
    throw new BinanceApiError(`No se pudo contactar a Binance Pay: ${message}`, false, 'BINANCE_NETWORK');
  }

  const raw = await response.text();
  let payload: BinanceEnvelope<T> | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as BinanceEnvelope<T>) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const definitive = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
    throw new BinanceApiError(
      payload?.errorMessage || `Binance Pay respondió HTTP ${response.status}`,
      definitive,
      payload?.code || `HTTP_${response.status}`
    );
  }

  if (!payload) {
    throw new BinanceApiError('Binance Pay devolvió una respuesta ilegible', false, 'BINANCE_BAD_RESPONSE');
  }

  if (payload.status !== 'SUCCESS') {
    throw new BinanceApiError(
      payload.errorMessage || 'Binance Pay rechazó la operación',
      true,
      payload.code || 'BINANCE_REJECTED'
    );
  }

  return payload;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function createBinanceDepositOrder(params: {
  userId: string;
  amount: number;
  tradeNo: string;
  description?: string;
}) {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new BinanceApiError('Monto de depósito inválido', true, 'INVALID_AMOUNT');
  }

  const requestBody = {
    env: {
      terminalType: 'WEB',
    },
    merchantTradeNo: params.tradeNo,
    orderAmount: params.amount.toFixed(2),
    currency: 'USDT',
    goods: {
      goodsType: '02',
      goodsCategory: 'Z000',
      referenceGoodsId: params.tradeNo,
      goodsName: 'Recarga de saldo UniBet',
      goodsDetail: params.description || `Recarga de ${params.amount.toFixed(2)} USDT`,
    },
    returnUrl: `${appUrl()}/?wallet=deposit-success`,
    cancelUrl: `${appUrl()}/?wallet=deposit-cancelled`,
  };

  const response = await binancePost<Record<string, unknown>>('/binancepay/openapi/v2/order', requestBody);
  const data = response.data;

  if (!isRecord(data)) {
    throw new BinanceApiError('Binance Pay no devolvió los datos de la orden', false, 'BINANCE_BAD_ORDER');
  }

  return {
    prepayId: typeof data.prepayId === 'string' ? data.prepayId : null,
    qrcodeLink: typeof data.qrcodeLink === 'string' ? data.qrcodeLink : null,
    universalUrl: typeof data.universalUrl === 'string' ? data.universalUrl : null,
    checkoutUrl: typeof data.checkoutUrl === 'string' ? data.checkoutUrl : null,
    expireTime: typeof data.expireTime === 'number' ? data.expireTime : null,
  };
}

export interface BinanceDepositQuery {
  status: string | null;
  totalFee: number | null;
  currency: string | null;
}

export async function queryBinanceDepositOrder(tradeNo: string): Promise<BinanceDepositQuery> {
  const response = await binancePost<Record<string, unknown>>(
    '/binancepay/openapi/v3/order/query',
    { merchantTradeNo: tradeNo }
  );

  const data = response.data;
  if (!isRecord(data)) {
    throw new BinanceApiError(
      'Binance Pay no devolvió los datos de la orden',
      false,
      'BINANCE_BAD_ORDER'
    );
  }

  const status = typeof data.status === 'string' ? data.status.toUpperCase() : null;
  const rawFee = typeof data.totalFee === 'number' ? data.totalFee : Number(data.totalFee);

  return {
    status,
    totalFee: Number.isFinite(rawFee) ? rawFee : null,
    currency: typeof data.currency === 'string' ? data.currency.toUpperCase() : null,
  };
}

export async function executeBinancePayout(params: {
  requestId: string;
  binanceUid: string;
  amount: number;
}) {
  if (!/^[0-9]{8,10}$/.test(params.binanceUid)) {
    throw new BinanceApiError('Binance UID inválido', true, 'INVALID_UID');
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new BinanceApiError('Monto de retiro inválido', true, 'INVALID_AMOUNT');
  }

  const requestBody = {
    requestId: params.requestId,
    batchName: `Retiro ${params.requestId.slice(-10)}`,
    currency: 'USDT',
    totalAmount: params.amount.toFixed(2),
    totalNumber: 1,
    transferDetailList: [
      {
        merchantSendId: params.requestId,
        receiveType: 'BINANCE_ID',
        receiver: params.binanceUid,
        transferAmount: params.amount.toFixed(2),
        transferMethod: 'FUNDING_WALLET',
        remark: 'Retiro de saldo UniBet',
      },
    ],
  };

  const response = await binancePost<Record<string, unknown>>(
    '/binancepay/openapi/payout/transfer',
    requestBody
  );
  const data = response.data;

  if (!isRecord(data)) {
    throw new BinanceApiError('Binance Pay no devolvió los datos del retiro', false, 'BINANCE_BAD_PAYOUT');
  }

  const payoutStatus = typeof data.status === 'string' ? data.status.toUpperCase() : null;
  if (payoutStatus && !['SUCCESS', 'PROCESSING', 'PENDING', 'INIT'].includes(payoutStatus)) {
    throw new BinanceApiError(
      `Binance Pay no aceptó el retiro (estado: ${payoutStatus})`,
      true,
      'BINANCE_PAYOUT_REJECTED'
    );
  }

  return {
    status: payoutStatus,
    orderId: typeof data.orderId === 'string' ? data.orderId : null,
    raw: data,
  };
}

function normalizePem(value: string): string {
  const unescaped = value.replace(/\\n/g, '\n').trim();
  if (unescaped.includes('BEGIN')) return unescaped;

  const chunks = unescaped.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? unescaped;
  return `-----BEGIN PUBLIC KEY-----\n${chunks}\n-----END PUBLIC KEY-----`;
}

function extractCertificates(data: unknown): CertificateEntry[] {
  const candidates: unknown[] = [];

  if (Array.isArray(data)) {
    candidates.push(...data);
  } else if (isRecord(data)) {
    for (const key of ['certificates', 'certList', 'list', 'items']) {
      if (Array.isArray(data[key])) candidates.push(...data[key]);
    }
  }

  const entries: CertificateEntry[] = [];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 40) {
      entries.push({ serial: null, pem: normalizePem(candidate) });
      continue;
    }

    if (!isRecord(candidate)) continue;

    const pemValue =
      candidate.certPublic ??
      candidate.certPublicKey ??
      candidate.publicKey ??
      candidate.certificate ??
      candidate.cert;

    if (typeof pemValue !== 'string' || pemValue.length < 40) continue;

    const serialValue =
      candidate.certSn ?? candidate.certSerial ?? candidate.serialNumber ?? candidate.sn;

    entries.push({
      serial: typeof serialValue === 'string' ? serialValue : null,
      pem: normalizePem(pemValue),
    });
  }

  return entries;
}

async function getCertificates(forceRefresh = false): Promise<CertificateEntry[]> {
  const now = Date.now();
  if (!forceRefresh && certificateCache && now - certificateCache.fetchedAt < CERT_CACHE_TTL_MS) {
    return certificateCache.entries;
  }

  const response = await binancePost<unknown>('/binancepay/openapi/certificates', {});
  const entries = extractCertificates(response.data);
  certificateCache = { fetchedAt: now, entries };
  return entries;
}

async function getVerificationKeys(certSn: string): Promise<string[]> {
  const cleanSn = certSn?.trim();
  if (!cleanSn) return [];

  const keys: string[] = [];
  const staticKey = process.env.BINANCE_PAY_PUBLIC_KEY?.trim();
  const staticSerial = process.env.BINANCE_PAY_CERT_SN?.trim();

  if (staticKey && staticSerial && staticSerial === cleanSn) {
    keys.push(normalizePem(staticKey));
  }

  try {
    let certificates = await getCertificates();
    let matching = certificates.filter((entry) => entry.serial === cleanSn);

    if (matching.length === 0) {
      certificates = await getCertificates(true);
      matching = certificates.filter((entry) => entry.serial === cleanSn);
    }

    for (const entry of matching) {
      if (!keys.includes(entry.pem)) keys.push(entry.pem);
    }
  } catch (error) {
    console.error('[binance] No se pudieron obtener los certificados de Binance:', error);
  }

  return keys;
}

export async function verifyBinanceWebhookSignature(params: {
  rawBody: string;
  timestamp: string;
  nonce: string;
  signature: string;
  certSn: string;
}): Promise<boolean> {
  try {
    const { rawBody, timestamp, nonce, signature, certSn } = params;

    if (!rawBody || !timestamp || !nonce || !signature || !certSn) return false;

    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || timestampNumber <= 0) return false;

    const ageMs = Math.abs(Date.now() - timestampNumber);
    if (ageMs > 5 * 60 * 1000) {
      console.error('[binance] Webhook descartado: timestamp fuera de la ventana de 5 minutos (replay attack).', ageMs);
      return false;
    }

    const payload = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const signatureBuffer = Buffer.from(signature, 'base64');
    if (signatureBuffer.length === 0) return false;

    const keys = await getVerificationKeys(certSn);
    if (keys.length === 0) {
      console.error('[binance] Webhook recibido sin clave pública configurada ni certificados disponibles para SN:', certSn);
      return false;
    }

    for (const pem of keys) {
      try {
        const valid = crypto.verify('RSA-SHA256', Buffer.from(payload), pem, signatureBuffer);
        if (valid) return true;
      } catch {}
    }

    return false;
  } catch (error) {
    console.error('[binance] Error verificando la firma del webhook:', error);
    return false;
  }
}

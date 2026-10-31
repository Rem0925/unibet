import crypto from 'crypto';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { BscFeeResponse } from './types';

const SAPI_DEFAULT_BASE_URL = 'https://api.binance.com';
const BPAY_DEFAULT_BASE_URL = 'https://bpay.binanceapi.com';
const REQUEST_TIMEOUT_MS = 20_000;
const CERT_CACHE_TTL_MS = 60 * 60 * 1000;
const BSC_FEE_CACHE_TTL_MS = 60 * 1000; // 1 minuto de caché para tarifas de red

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

interface SapiConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

interface CertificateEntry {
  serial: string | null;
  pem: string;
}

export interface BinancePayPayerInfo {
  name?: string;
  type?: string;
  binanceId?: string;
  accountId?: string;
}

export interface BinancePayTransactionItem {
  orderType: string;
  transactionId: string;
  orderId?: string | number;
  transactionTime: number;
  amount: string;
  currency: string;
  walletType?: number;
  counterpartyId?: number | string;
  payerInfo?: BinancePayPayerInfo;
  receiverInfo?: BinancePayPayerInfo;
}

export type BscFeeInfo = BscFeeResponse;

let certificateCache: { fetchedAt: number; entries: CertificateEntry[] } | null = null;
let lastForceRefreshAt = 0;
const FORCE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

let bscFeeCache: { data: BscFeeInfo; cachedAt: number } | null = null;

export function isBinanceConfigured(): boolean {
  const apiKey = process.env.BINANCE_API_KEY || process.env.BINANCE_PAY_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET || process.env.BINANCE_PAY_API_SECRET;
  return Boolean(apiKey && apiSecret);
}

export function getAdminBinancePayId(): string {
  return (
    process.env.NEXT_PUBLIC_ADMIN_BINANCE_PAY_ID ||
    process.env.ADMIN_BINANCE_PAY_ID ||
    process.env.BINANCE_PAY_ID ||
    ''
  ).trim();
}

export function getAdminBinancePayLink(): string {
  const directLink = (
    process.env.NEXT_PUBLIC_BINANCE_PAY_LINK ||
    process.env.BINANCE_PAY_LINK ||
    ''
  ).trim();
  if (directLink) return directLink;

  // Enlace universal nativo oficial de Binance Pay para Pay ID 1048652397
  return 'https://app.binance.com/uni-qr/SEBfeouK';
}

function getSapiConfig(): SapiConfig {
  const apiKey = process.env.BINANCE_API_KEY || process.env.BINANCE_PAY_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET || process.env.BINANCE_PAY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new BinanceApiError(
      'Binance API no está configurada en el servidor (faltan BINANCE_API_KEY / BINANCE_API_SECRET).',
      true,
      'BINANCE_NOT_CONFIGURED'
    );
  }

  const rawBase = process.env.BINANCE_BASE_URL || SAPI_DEFAULT_BASE_URL;
  // Si la variable configurada es bpay.binanceapi.com, redirigir a api.binance.com para llamadas SAPI
  const baseUrl = rawBase.includes('bpay.binanceapi.com')
    ? SAPI_DEFAULT_BASE_URL
    : rawBase.replace(/\/$/, '');

  return { baseUrl, apiKey, apiSecret };
}

function getMerchantConfig(): SapiConfig {
  const apiKey = process.env.BINANCE_PAY_API_KEY || process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_PAY_API_SECRET || process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new BinanceApiError(
      'Binance Pay no está configurado en el servidor.',
      true,
      'BINANCE_NOT_CONFIGURED'
    );
  }

  return {
    baseUrl: (process.env.BINANCE_BASE_URL || BPAY_DEFAULT_BASE_URL).replace(/\/$/, ''),
    apiKey,
    apiSecret,
  };
}

function signSapiQuery(params: Record<string, string | number | boolean | undefined>, secret: string): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  if (!searchParams.has('recvWindow')) {
    searchParams.append('recvWindow', '60000');
  }
  if (!searchParams.has('timestamp')) {
    searchParams.append('timestamp', String(Date.now()));
  }
  const queryString = searchParams.toString();
  const signature = crypto.createHmac('sha256', secret).update(queryString).digest('hex');
  return `${queryString}&signature=${signature}`;
}

let proxyAgentInstance: ProxyAgent | null = null;

function getProxyAgent(): ProxyAgent | undefined {
  const proxyUrl = process.env.FIXIE_URL || process.env.STATIC_PROXY_URL || process.env.HTTP_PROXY;
  if (!proxyUrl) return undefined;
  if (!proxyAgentInstance) {
    try {
      proxyAgentInstance = new ProxyAgent(proxyUrl);
    } catch {
      proxyAgentInstance = null;
    }
  }
  return proxyAgentInstance ?? undefined;
}

async function callBinanceSapi<T>(options: {
  method: 'GET' | 'POST';
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
}): Promise<T> {
  const config = getSapiConfig();
  const signedQuery = signSapiQuery(options.params ?? {}, config.apiSecret);

  const url =
    options.method === 'GET'
      ? `${config.baseUrl}${options.endpoint}?${signedQuery}`
      : `${config.baseUrl}${options.endpoint}`;

  // Si Fixie o un proxy estático está configurado, todas las llamadas autenticadas hacia Binance
  // deben salir por Fixie para coincidir con la lista de IPs autorizadas en Binance (52.87.82.133, 52.5.155.132).
  const agent = getProxyAgent();
  const fetchHeaders: Record<string, string> = {
    'X-MBX-APIKEY': config.apiKey,
    ...(options.method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
  };

  let response: Response;
  try {
    if (agent) {
      // Usar undiciFetch nativo para garantizar que el dispatcher del proxy estático de Fixie no sea ignorado por Next.js
      response = (await undiciFetch(url, {
        method: options.method,
        headers: fetchHeaders,
        body: options.method === 'POST' ? signedQuery : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        dispatcher: agent,
      })) as unknown as Response;
    } else {
      response = await fetch(url, {
        method: options.method,
        headers: fetchHeaders,
        body: options.method === 'POST' ? signedQuery : undefined,
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de red desconocido';
    throw new BinanceApiError(`No se pudo contactar a Binance SAPI: ${message}`, false, 'BINANCE_NETWORK');
  }

  const raw = await response.text();
  let payload: Record<string, unknown> | Array<unknown> | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown> | Array<unknown>) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const isDefinitive = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
    const rec = isRecord(payload) ? payload : null;
    const errMsg = (typeof rec?.msg === 'string' && rec.msg) ||
      (typeof rec?.errorMessage === 'string' && rec.errorMessage) ||
      `Binance respondió HTTP ${response.status}`;
    const errCode = rec?.code ? String(rec.code) : `HTTP_${response.status}`;
    throw new BinanceApiError(errMsg, isDefinitive, errCode);
  }

  if (payload === null) {
    throw new BinanceApiError('Binance devolvió una respuesta vacía o ilegible', false, 'BINANCE_BAD_RESPONSE');
  }

  return payload as T;
}

/**
 * Consulta en tiempo real las comisiones y límites de retiro para USDT en la red BSC (BEP-20).
 * Utiliza caché en memoria de 60s para no agotar los rate-limits de Binance.
 */
export async function getBscWithdrawFee(): Promise<BscFeeInfo> {
  const now = Date.now();
  if (bscFeeCache && now - bscFeeCache.cachedAt < BSC_FEE_CACHE_TTL_MS) {
    return bscFeeCache.data;
  }

  if (!isBinanceConfigured()) {
    return {
      coin: 'USDT',
      network: 'BSC',
      withdrawFee: 0.19,
      withdrawMin: 1.0,
      withdrawMax: 1000000.0,
      withdrawEnable: true,
      isLive: false,
      cachedAt: now,
    };
  }

  try {
    const data = await callBinanceSapi<
      Array<{
        coin: string;
        networkList?: Array<{
          network: string;
          withdrawFee: string;
          withdrawMin: string;
          withdrawMax: string;
          withdrawEnable: boolean;
        }>;
      }>
    >({
      method: 'GET',
      endpoint: '/sapi/v1/capital/config/getall',
    });

    if (Array.isArray(data)) {
      const usdt = data.find((c) => c.coin === 'USDT');
      const bsc = usdt?.networkList?.find((n) => n.network === 'BSC');

      if (bsc) {
        const feeInfo: BscFeeInfo = {
          coin: 'USDT',
          network: 'BSC',
          withdrawFee: Number.parseFloat(bsc.withdrawFee) || 0.19,
          withdrawMin: Number.parseFloat(bsc.withdrawMin) || 5.0,
          withdrawMax: Number.parseFloat(bsc.withdrawMax) || 1000000.0,
          withdrawEnable: bsc.withdrawEnable ?? true,
          isLive: true,
          cachedAt: now,
        };
        bscFeeCache = { data: feeInfo, cachedAt: now };
        return feeInfo;
      }
    }
  } catch (err) {
    console.error('[binance] Error consultando comisiones BSC en vivo:', err);
    if (bscFeeCache) {
      return bscFeeCache.data;
    }
  }

  return {
    coin: 'USDT',
    network: 'BSC',
    withdrawFee: 0.19,
    withdrawMin: 1.0,
    withdrawMax: 1000000.0,
    withdrawEnable: true,
    isLive: false,
    cachedAt: now,
  };
}

/**
 * Ejecuta un retiro automático on-chain en BSC hacia la dirección BEP-20 indicada.
 */
export async function submitBscWithdrawal(params: {
  address: string;
  amount: number;
  requestId: string;
}): Promise<{ id: string; raw: unknown }> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(params.address)) {
    throw new BinanceApiError('Dirección BEP-20 (BSC) inválida', true, 'INVALID_ADDRESS');
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new BinanceApiError('Monto de retiro inválido', true, 'INVALID_AMOUNT');
  }

  const response = await callBinanceSapi<{ id?: string }>({
    method: 'POST',
    endpoint: '/sapi/v1/capital/withdraw/apply',
    params: {
      coin: 'USDT',
      network: 'BSC',
      address: params.address,
      amount: params.amount.toFixed(4),
      withdrawOrderId: params.requestId,
    },
  });

  if (!response?.id) {
    throw new BinanceApiError('Binance no devolvió el identificador del retiro', false, 'BINANCE_NO_WITHDRAW_ID');
  }

  return { id: response.id, raw: response };
}

/**
 * Consulta el historial de transferencias C2C en Binance Pay de la cuenta personal del administrador.
 */
export async function fetchBinancePayTransactions(params?: {
  startTime?: number;
  limit?: number;
}): Promise<BinancePayTransactionItem[]> {
  if (!isBinanceConfigured()) {
    return [];
  }

  const queryParams: Record<string, string | number> = {
    limit: params?.limit ?? 100,
  };
  if (params?.startTime) {
    queryParams.startTime = params.startTime;
  }

  try {
    const response = await callBinanceSapi<{
      code?: string;
      message?: string;
      data?: BinancePayTransactionItem[];
      success?: boolean;
    }>({
      method: 'GET',
      endpoint: '/sapi/v1/pay/transactions',
      params: queryParams,
    });

    if (Array.isArray(response.data)) {
      return response.data;
    }
  } catch (error) {
    console.error('[binance] Error al obtener transacciones de Binance Pay:', error);
  }

  return [];
}

function signMerchantPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex').toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function binanceMerchantPost<T>(endpoint: string, body: unknown): Promise<BinanceEnvelope<T>> {
  const config = getMerchantConfig();
  const jsonBody = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex').toUpperCase();
  const signature = signMerchantPayload(`${timestamp}\n${nonce}\n${jsonBody}\n`, config.apiSecret);

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
    const isSystemError = payload.code?.startsWith('5') || payload.code === 'SYSTEM_ERROR' || payload.code === 'TIMEOUT';
    throw new BinanceApiError(
      payload.errorMessage || 'Binance Pay rechazó la operación',
      !isSystemError,
      payload.code || 'BINANCE_REJECTED'
    );
  }

  return payload;
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

  const adminPayId = getAdminBinancePayId();
  const payLink = getAdminBinancePayLink();
  return {
    prepayId: null,
    qrcodeLink: payLink,
    universalUrl: payLink,
    checkoutUrl: payLink,
    expireTime: Date.now() + 60 * 60 * 1000,
    adminPayId: adminPayId || null,
  };
}

export interface BinanceDepositQuery {
  status: string | null;
  totalFee: number | null;
  currency: string | null;
}

export async function queryBinanceDepositOrder(tradeNo: string): Promise<BinanceDepositQuery> {
  try {
    const transactions = await fetchBinancePayTransactions({ limit: 50 });
    const match = transactions.find((t) => t.orderType === 'C2C');
    if (match) {
      return {
        status: 'PAY_SUCCESS',
        totalFee: Number.parseFloat(match.amount),
        currency: match.currency,
      };
    }
  } catch {}

  return {
    status: null,
    totalFee: null,
    currency: 'USDT',
  };
}

export async function executeBinancePayout(params: {
  requestId: string;
  binanceUid: string;
  amount: number;
}) {
  return {
    status: 'PENDING',
    orderId: params.requestId,
    raw: { message: 'Pendiente de aprobación en Binance Pay' },
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

  const response = await binanceMerchantPost<unknown>('/binancepay/openapi/certificates', {});
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

    const now = Date.now();
    if (matching.length === 0 && now - lastForceRefreshAt > FORCE_REFRESH_COOLDOWN_MS) {
      lastForceRefreshAt = now;
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

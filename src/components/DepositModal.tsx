'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { DEPOSIT_FEE_RATE, DEPOSIT_MAX, DEPOSIT_MIN } from '@/lib/constants';
import { formatUsdt } from '@/lib/format';
import type { DepositOrderResponse, UserProfile } from '@/lib/types';
import { Modal, Spinner } from './ui';

const PRESET_AMOUNTS = [1, 5, 10, 20, 50];

export function DepositModal({
  profile,
  onClose,
  onRefreshProfile,
  showToast,
}: {
  profile: UserProfile;
  onClose: () => void;
  onRefreshProfile: () => Promise<UserProfile>;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
}) {
  const [amount, setAmount] = useState('20.00');
  const [uid, setUid] = useState(profile.binanceUid ?? '');
  const [order, setOrder] = useState<DepositOrderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const startBalance = useRef(Number.parseFloat(profile.balance) || 0);

  const gross = Math.round((Number.parseFloat(amount) || 0) * 100) / 100;
  const fee = useMemo(() => Math.round(gross * DEPOSIT_FEE_RATE * 100) / 100, [gross]);
  const net = Math.max(0, gross - fee);

  useEffect(() => {
    if (!order || paid) return;

    let active = true;
    const check = async () => {
      try {
        const verifyRes = await apiFetch<{ success: boolean; credited?: boolean; message?: string }>(
          '/api/wallet/deposit/verify',
          {
            method: 'POST',
            body: JSON.stringify({ tradeNo: order.tradeNo, binanceUid: uid.trim() || undefined }),
          }
        );

        if (!active) return;
        if (verifyRes.success && verifyRes.credited) {
          setPaid(true);
          await onRefreshProfile();
          showToast('¡Depósito verificado y acreditado con éxito!', 'success');
        }
      } catch {}
    };

    // Polling automático cada 6 segundos mientras la orden esté abierta
    const interval = setInterval(() => {
      void check();
    }, 6000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [order, paid, uid, onRefreshProfile, showToast]);

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(gross) || gross < DEPOSIT_MIN || gross > DEPOSIT_MAX) {
      setError(`El monto debe estar entre $${formatUsdt(DEPOSIT_MIN)} y $${formatUsdt(DEPOSIT_MAX)} USDT.`);
      return;
    }

    if (uid.trim() && !/^[0-9]{8,10}$/.test(uid.trim())) {
      setError('El Binance UID debe tener entre 8 y 10 dígitos numéricos.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<DepositOrderResponse>('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({
          amount: gross,
          binanceUid: uid.trim() || undefined,
        }),
      });
      startBalance.current = Number.parseFloat(profile.balance) || 0;
      setOrder(response);
    } catch (depositError) {
      setError(errorMessage(depositError));
    } finally {
      setLoading(false);
    }
  };

  const checkManually = async () => {
    if (!order) return;
    setChecking(true);
    setError(null);
    try {
      const verifyRes = await apiFetch<{ success: boolean; credited?: boolean; message?: string }>(
        '/api/wallet/deposit/verify',
        {
          method: 'POST',
          body: JSON.stringify({ tradeNo: order.tradeNo, binanceUid: uid.trim() || undefined }),
        }
      );

      if (verifyRes.success && verifyRes.credited) {
        setPaid(true);
        await onRefreshProfile();
        showToast(verifyRes.message || 'Depósito acreditado con éxito', 'success');
      } else {
        showToast(
          verifyRes.message || 'Pago aún no detectado. Si acabas de transferir, espera unos segundos.',
          'warn'
        );
      }
    } catch (checkError) {
      setError(errorMessage(checkError));
    } finally {
      setChecking(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copiado al portapapeles`, 'success');
    } catch {
      showToast(`No se pudo copiar ${label}`, 'warn');
    }
  };

  return (
    <Modal
      title="Recargar saldo"
      subtitle="Deposita USDT directo a través de Binance Pay sin comisiones."
      icon={<QrCode className="h-5 w-5 text-[#00f090]" />}
      onClose={onClose}
    >
      {paid ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00f090]/15 text-[#00f090]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white">¡Recarga completada con éxito!</h3>
          <p className="mt-1.5 text-sm text-slate-400">
            Tu saldo disponible ahora es{' '}
            <strong className="font-mono text-white">
              ${formatUsdt((Number.parseFloat(profile.balance) || 0).toString())} USDT
            </strong>.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681]"
          >
            Continuar apostando
          </button>
        </div>
      ) : order ? (
        <div className="space-y-4">
          {/* Tarjeta de Resumen */}
          <div className="rounded-xl border border-[#00f090]/30 bg-[#00f090]/10 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Monto exacto a transferir:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-[#00f090]">
                  ${formatUsdt(gross)} USDT
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(gross.toFixed(2), 'Monto exacto')}
                  className="flex items-center gap-1 rounded bg-[#00f090]/20 hover:bg-[#00f090]/30 px-2 py-0.5 text-[11px] font-bold text-[#00f090] transition"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              Comisión de depósito: <strong className="text-white">0% ($0.00 USDT)</strong>. Se te
              acreditarán exactamente <strong className="font-mono text-white">${formatUsdt(gross)} USDT</strong>.
            </p>
          </div>

          {/* Botón directo a Binance Pay */}
          <div className="space-y-1.5">
            <a
              href="https://www.binance.com/es/pay"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F0B90B] hover:bg-[#FCD535] py-3 text-sm font-bold text-slate-950 transition shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4 text-black" />
              Abrir Binance Pay para transferir
            </a>
            <div className="text-center">
              <a
                href="bnc://app.binance.com/payment/pay"
                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline"
              >
                <Smartphone className="h-3 w-3" />
                ¿En celular? Toca aquí para abrir la App de Binance
              </a>
            </div>
          </div>

          {/* Pay ID de la Casa */}
          {order.adminPayId ? (
            <div className="rounded-xl border border-[#1e2330] bg-[#141822] p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[11px] font-medium text-slate-400">
                    Binance Pay ID de destino (Receptor):
                  </span>
                  <span className="font-mono text-base font-extrabold tracking-wider text-white">
                    {order.adminPayId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(order.adminPayId ?? '', 'Binance Pay ID')}
                  className="flex items-center gap-1.5 rounded-lg border border-[#2d3447] bg-[#1c2230] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#252c3e]"
                >
                  <Copy className="h-3.5 w-3.5 text-[#00f090]" />
                  Copiar ID
                </button>
              </div>
            </div>
          ) : null}

          {/* Pasos en Binance */}
          <div className="space-y-2 rounded-xl border border-[#1e2330] bg-[#0d1017] p-3.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Smartphone className="h-4 w-4 text-[#00f090]" />
              <span>Instrucciones de pago desde Binance:</span>
            </div>
            <ol className="list-inside list-decimal space-y-1.5 pl-1 text-[11px] text-slate-400">
              <li>Abre tu app de Binance y entra a la sección <strong>Pay</strong>.</li>
              <li>Toca en <strong>Enviar / Transferir</strong>.</li>
              <li>Selecciona <strong>Binance ID / Pay ID</strong> e ingresa el ID de arriba.</li>
              <li>Transfiere exactamente <strong className="text-white">${formatUsdt(gross)} USDT</strong>.</li>
            </ol>
          </div>

          {/* Referencia de la Orden */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-2.5 text-xs">
            <div className="min-w-0">
              <span className="block text-[11px] text-slate-500">Referencia de orden</span>
              <span className="font-mono text-xs font-semibold text-slate-300 truncate block">
                {order.tradeNo}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(order.tradeNo, 'Referencia')}
              className="flex items-center gap-1.5 rounded-lg border border-[#2d3447] bg-[#1c2230] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-[#252c3e] hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar Ref
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
              {error}
            </div>
          ) : null}

          {/* Botones de acción */}
          <div className="grid gap-2.5">
            <button
              type="button"
              onClick={checkManually}
              disabled={checking}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] disabled:opacity-60"
            >
              {checking ? <Spinner className="text-black" /> : <RefreshCw className="h-4 w-4 text-black" />}
              {checking ? 'Verificando con Binance…' : 'Ya transferí / Comprobar Acreditación'}
            </button>
            <p className="text-center text-[11px] text-slate-500">
              El sistema comprueba automáticamente cada pocos segundos.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={createOrder} className="space-y-4">
          <div>
            <label htmlFor="deposit-amount" className="mb-1.5 block text-xs font-semibold text-slate-300">
              Monto a recargar (USDT)
            </label>
            <div className="relative">
              <input
                id="deposit-amount"
                type="number"
                inputMode="decimal"
                min={DEPOSIT_MIN}
                max={DEPOSIT_MAX}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-xl border border-[#222736] bg-[#090a0f] px-3.5 py-2.5 font-mono text-sm text-white focus:border-[#00f090] focus:outline-none"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-500">USDT</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset.toFixed(2))}
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                  Number.parseFloat(amount) === preset
                    ? 'border-[#00f090] bg-[#00f090]/15 text-[#00f090]'
                    : 'border-[#222736] bg-[#141822] text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                ${preset} USDT
              </button>
            ))}
          </div>

          {profile.binanceUid ? (
            <div className="rounded-xl border border-[#1e2330] bg-[#141822] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Cuenta Binance que envía:</span>
                <span className="text-[10px] font-semibold text-[#00f090] bg-[#00f090]/10 px-2 py-0.5 rounded-full border border-[#00f090]/20">
                  Vinculada a tu perfil
                </span>
              </div>
              <div className="mt-1.5 font-mono text-sm font-bold text-white tracking-wide">
                UID: {profile.binanceUid}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="deposit-uid" className="block text-xs font-semibold text-slate-300">
                  Tu Binance UID (ID de usuario)
                </label>
                <a
                  href="https://www.binance.com/es/my/settings/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[#00f090] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Ver mi UID
                </a>
              </div>
              <input
                id="deposit-uid"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={uid}
                onChange={(event) => setUid(event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Ej: 123456789"
                className="w-full rounded-xl border border-[#222736] bg-[#090a0f] px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Permite conciliar tu pago al instante cuando transfieras desde tu app.
              </p>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Monto a transferir:</span>
              <span className="font-mono text-white">${formatUsdt(gross)} USDT</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Comisión de recarga (0%):</span>
              <span className="font-mono text-[#00f090]">0.00 USDT</span>
            </div>
            <div className="flex justify-between border-t border-[#1e2330] pt-2 font-bold text-white">
              <span>Saldo que recibirás:</span>
              <span className="font-mono text-[#00f090]">${formatUsdt(gross)} USDT</span>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] disabled:opacity-60"
          >
            {loading ? <Spinner className="text-black" /> : <ArrowRight className="h-4 w-4 text-black" />}
            {loading ? 'Generando orden…' : 'Continuar al pago'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Mínimo ${formatUsdt(DEPOSIT_MIN)} y máximo ${formatUsdt(DEPOSIT_MAX)} USDT. Sin comisiones.
          </p>
        </form>
      )}
    </Modal>
  );
}

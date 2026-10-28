'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { DEPOSIT_FEE_RATE, DEPOSIT_MAX, DEPOSIT_MIN } from '@/lib/constants';
import { formatUsdt } from '@/lib/format';
import type { DepositOrderResponse, UserProfile } from '@/lib/types';
import { Modal, Spinner } from './ui';

const PRESET_AMOUNTS = [5, 10, 20, 50, 100];

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
  const [order, setOrder] = useState<DepositOrderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [qrError, setQrError] = useState(false);
  const startBalance = useRef(Number.parseFloat(profile.balance) || 0);

  const gross = Number.parseFloat(amount) || 0;
  const fee = useMemo(() => Math.round(gross * DEPOSIT_FEE_RATE * 100) / 100, [gross]);
  const net = Math.max(0, gross - fee);
  const feePercent = (DEPOSIT_FEE_RATE * 100).toFixed(1).replace(/\.0$/, '');

  useEffect(() => {
    if (!order || paid) return;

    let active = true;
    const check = async () => {
      try {
        const updated = await onRefreshProfile();
        if (!active) return;
        if (Number.parseFloat(updated.balance) > startBalance.current + 0.001) {
          setPaid(true);
          showToast('Depósito acreditado con éxito', 'success');
        }
      } catch {}
    };

    const interval = setInterval(() => {
      void check();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [order, paid, onRefreshProfile, showToast]);

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(gross) || gross < DEPOSIT_MIN || gross > DEPOSIT_MAX) {
      setError(`El monto debe estar entre $${formatUsdt(DEPOSIT_MIN)} y $${formatUsdt(DEPOSIT_MAX)} USDT.`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<DepositOrderResponse>('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount: gross }),
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
    setChecking(true);
    setError(null);
    try {
      const updated = await onRefreshProfile();
      if (Number.parseFloat(updated.balance) > startBalance.current + 0.001) {
        setPaid(true);
        showToast('Depósito acreditado con éxito', 'success');
      } else {
        showToast('Aún no se detecta el pago. Espera unos segundos y vuelve a consultar.', 'warn');
      }
    } catch (checkError) {
      setError(errorMessage(checkError));
    } finally {
      setChecking(false);
    }
  };

  const copyReference = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.tradeNo);
      showToast('Referencia copiada', 'success');
    } catch {
      showToast('No se pudo copiar la referencia', 'warn');
    }
  };

  return (
    <Modal
      title="Recargar saldo"
      subtitle="Acredita USDT al instante en tu cuenta mediante Binance Pay."
      icon={<QrCode className="h-5 w-5 text-[#00f090]" />}
      onClose={onClose}
    >
      {paid ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00f090]/15 text-[#00f090]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-white">¡Recarga completada!</h3>
          <p className="mt-1.5 text-sm text-slate-400">
            Tu saldo disponible ahora es{' '}
            <strong className="font-mono text-white">${formatUsdt((Number.parseFloat(profile.balance) || 0).toString())} USDT</strong>.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681]"
          >
            Continuar
          </button>
        </div>
      ) : order ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#00f090]/30 bg-[#00f090]/10 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Orden generada</span>
              <span className="font-mono font-bold text-[#00f090]">${formatUsdt(gross)} USDT</span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Recibirás <strong className="font-mono text-white">${formatUsdt(net)} USDT</strong> netos en tu saldo una vez confirmado el pago.
            </p>
          </div>

          {order.qrcodeLink && !qrError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1e2330] bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={order.qrcodeLink}
                alt="Código QR de Binance Pay"
                className="h-48 w-48 object-contain"
                onError={() => setQrError(true)}
              />
              <span className="mt-2 text-xs font-medium text-slate-700">
                Escanea con tu aplicación de Binance
              </span>
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Monto enviado:</span>
              <span className="font-mono text-white">${formatUsdt(gross)} USDT</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Comisión de servicio ({feePercent}%):</span>
              <span className="font-mono text-slate-400">-${formatUsdt(fee)} USDT</span>
            </div>
            <div className="flex justify-between border-t border-[#1e2330] pt-2 font-bold text-white">
              <span>Acreditas en cuenta:</span>
              <span className="font-mono text-[#00f090]">${formatUsdt(net)} USDT</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-2.5 text-xs">
            <div className="min-w-0">
              <span className="block text-[11px] text-slate-500">Referencia de orden</span>
              <span className="font-mono text-xs font-semibold text-slate-300 truncate block">{order.tradeNo}</span>
            </div>
            <button
              type="button"
              onClick={copyReference}
              className="flex items-center gap-1.5 rounded-lg border border-[#2d3447] bg-[#1c2230] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-[#252c3e] hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {order.universalUrl || order.checkoutUrl ? (
              <a
                href={order.universalUrl ?? order.checkoutUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00f090] py-2.5 text-xs font-bold text-slate-950 transition hover:bg-[#00d681]"
              >
                <ExternalLink className="h-4 w-4" />
                Pagar en Binance Pay
              </a>
            ) : null}
            <button
              type="button"
              onClick={checkManually}
              disabled={checking}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#2d3447] bg-[#161a24] py-2.5 text-xs font-bold text-white transition hover:bg-[#1e2330] disabled:opacity-60"
            >
              {checking ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
              Ya pagué / Comprobar
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
              {error}
            </div>
          ) : null}
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
                step="0.5"
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

          <div className="space-y-2 rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Monto bruto:</span>
              <span className="font-mono text-white">${formatUsdt(gross)} USDT</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Comisión de servicio ({feePercent}%):</span>
              <span className="font-mono text-slate-400">-${formatUsdt(fee)} USDT</span>
            </div>
            <div className="flex justify-between border-t border-[#1e2330] pt-2 font-bold text-white">
              <span>Acreditas en tu saldo:</span>
              <span className="font-mono text-[#00f090]">${formatUsdt(net)} USDT</span>
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
            {loading ? <Spinner className="text-black" /> : <QrCode className="h-4 w-4 text-black" />}
            {loading ? 'Generando orden…' : 'Continuar con Binance Pay'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Mínimo ${formatUsdt(DEPOSIT_MIN)} y máximo ${formatUsdt(DEPOSIT_MAX)} USDT. Acreditación automática.
          </p>
        </form>
      )}
    </Modal>
  );
}

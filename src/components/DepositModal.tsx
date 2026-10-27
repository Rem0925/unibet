'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { DEPOSIT_FEE_RATE, DEPOSIT_MAX, DEPOSIT_MIN } from '@/lib/constants';
import { formatUsdt } from '@/lib/format';
import type { DepositOrderResponse, UserProfile } from '@/lib/types';
import { Modal, Spinner } from './ui';

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
          showToast('Depósito acreditado en tu billetera', 'success');
        }
      } catch {}
    };

    const interval = setInterval(() => {
      void check();
    }, 6000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [order, paid, onRefreshProfile, showToast]);

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!Number.isFinite(gross) || gross < DEPOSIT_MIN || gross > DEPOSIT_MAX) {
      setError(`El depósito debe estar entre $${formatUsdt(DEPOSIT_MIN)} y $${formatUsdt(DEPOSIT_MAX)} USDT.`);
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
        showToast('Depósito acreditado en tu billetera', 'success');
      } else {
        showToast('Todavía no aparece el pago. Espera unos segundos y vuelve a comprobar.', 'warn');
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
      title="Recargar con Binance Pay"
      subtitle={`Comisión única del ${feePercent}% al recargar. El 100% del pozo se reparte dentro de los mercados.`}
      icon={<QrCode className="h-4 w-4 text-[#00f090]" />}
      onClose={onClose}
    >
      {paid ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[#00f090]" />
          <h3 className="text-sm font-bold text-white">Saldo acreditado</h3>
          <p className="mt-1 text-xs text-slate-400">
            Tu nuevo saldo es ${formatUsdt((Number.parseFloat(profile.balance) || 0).toString())} USDT.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded bg-[#00f090] py-2 text-xs font-bold text-black transition hover:bg-[#00d681]"
          >
            Continuar
          </button>
        </div>
      ) : order ? (
        <div className="space-y-3">
          <div className="rounded border border-[#00f090]/25 bg-[#121f18] p-3">
            <div className="text-[11px] font-bold text-white">
              Orden creada por ${formatUsdt(gross)} USDT
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-slate-400">
              Se acreditarán <strong className="text-[#00f090]">${formatUsdt(net)} USDT</strong> en
              tu saldo después de la comisión de ${formatUsdt(fee)} USDT. La acreditación es
              automática cuando Binance confirma el pago.
            </div>
          </div>

          {order.qrcodeLink && !qrError ? (
            <div className="flex justify-center rounded border border-[#222736] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={order.qrcodeLink}
                alt="Código QR de Binance Pay"
                className="h-48 w-48 object-contain"
                onError={() => setQrError(true)}
              />
            </div>
          ) : null}

          <div className="space-y-1 rounded border border-[#1d222e] bg-[#0c0e14] p-2.5 text-[10px]">
            <div className="flex justify-between text-slate-400">
              <span>Monto bruto:</span>
              <span className="text-white">${formatUsdt(gross)} USDT</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Comisión de recarga ({feePercent}%):</span>
              <span>-${formatUsdt(fee)} USDT</span>
            </div>
            <div className="flex justify-between border-t border-[#1e2330] pt-1 font-bold text-white">
              <span>Acreditas:</span>
              <span className="text-[#00f090]">${formatUsdt(net)} USDT</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded border border-[#222736] bg-[#141822] px-2.5 py-2 text-[10px]">
            <span className="truncate text-slate-500">Ref: {order.tradeNo}</span>
            <button
              type="button"
              onClick={copyReference}
              className="shrink-0 rounded p-1 text-slate-400 transition hover:text-white"
              aria-label="Copiar referencia"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {order.universalUrl || order.checkoutUrl ? (
              <a
                href={order.universalUrl ?? order.checkoutUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded bg-[#00f090] py-2 text-xs font-bold text-black transition hover:bg-[#00d681]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir Binance Pay
              </a>
            ) : null}
            <button
              type="button"
              onClick={checkManually}
              disabled={checking}
              className="flex items-center justify-center gap-1.5 rounded border border-[#2d3447] bg-[#161a24] py-2 text-xs font-bold text-white transition hover:bg-[#1e2330] disabled:opacity-60"
            >
              {checking ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
              Ya pagué / comprobar
            </button>
          </div>

          {error ? (
            <div className="rounded border border-[#f43f5e]/35 bg-[#1f1113] px-2.5 py-2 text-[10px] text-[#fda4af]">
              {error}
            </div>
          ) : null}

          <p className="text-[9px] leading-relaxed text-slate-600">
            Si cierras esta ventana, el pago igualmente se acreditará cuando Binance envíe el
            webhook. No compartas el enlace de pago.
          </p>
        </div>
      ) : (
        <form onSubmit={createOrder} className="space-y-3">
          <div>
            <label htmlFor="deposit-amount" className="mb-1 block text-[11px] font-bold text-slate-300">
              Monto a enviar (USDT)
            </label>
            <input
              id="deposit-amount"
              type="number"
              inputMode="decimal"
              min={DEPOSIT_MIN}
              max={DEPOSIT_MAX}
              step="0.5"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 text-white focus:border-[#00f090] focus:outline-none"
            />
          </div>

          <div className="space-y-1 rounded border border-[#1d222e] bg-[#0c0e14] p-2.5 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Monto bruto:</span>
              <span className="text-white">${formatUsdt(gross)} USDT</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Comisión de recarga ({feePercent}%):</span>
              <span>-${formatUsdt(fee)} USDT</span>
            </div>
            <div className="flex justify-between border-t border-[#1e2330] pt-1 font-bold text-white">
              <span>Acreditas en saldo:</span>
              <span className="text-[#00f090]">${formatUsdt(net)} USDT</span>
            </div>
          </div>

          {error ? (
            <div className="rounded border border-[#f43f5e]/35 bg-[#1f1113] px-2.5 py-2 text-[10px] text-[#fda4af]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#00f090] py-2 text-xs font-bold text-black transition hover:bg-[#00d681] disabled:opacity-60"
          >
            {loading ? <Spinner /> : <QrCode className="h-4 w-4" />}
            {loading ? 'Generando orden…' : 'Generar orden Binance Pay'}
          </button>

          <p className="text-[9px] leading-relaxed text-slate-600">
            Depósito mínimo ${formatUsdt(DEPOSIT_MIN)} y máximo ${formatUsdt(DEPOSIT_MAX)} USDT por
            transacción. El saldo se acredita automáticamente tras la confirmación de Binance.
          </p>
        </form>
      )}
    </Modal>
  );
}

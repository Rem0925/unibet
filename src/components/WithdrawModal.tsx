'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { WITHDRAW_MAX, WITHDRAW_MIN } from '@/lib/constants';
import { formatUsdt } from '@/lib/format';
import type { UserProfile, WithdrawResponse } from '@/lib/types';
import { Modal, Spinner } from './ui';

export function WithdrawModal({
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
  const balance = Number.parseFloat(profile.balance) || 0;
  const [amount, setAmount] = useState('10.00');
  const [uid, setUid] = useState(profile.binanceUid ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const amountNumber = Number.parseFloat(amount);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(null);

    if (!Number.isFinite(amountNumber) || amountNumber < WITHDRAW_MIN) {
      setError(`El retiro mínimo es $${formatUsdt(WITHDRAW_MIN)} USDT.`);
      return;
    }
    if (amountNumber > WITHDRAW_MAX) {
      setError(`El límite por retiro es $${formatUsdt(WITHDRAW_MAX)} USDT.`);
      return;
    }
    if (amountNumber > balance) {
      setError('Saldo insuficiente para este retiro.');
      return;
    }
    if (!/^[0-9]{8,10}$/.test(uid.trim())) {
      setError('El Binance UID debe tener entre 8 y 10 dígitos.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<WithdrawResponse>('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: amountNumber, binanceUid: uid.trim() }),
      });

      await onRefreshProfile();

      if (response.status === 'COMPLETED') {
        showToast(`Retiro de $${formatUsdt(amountNumber)} USDT enviado a Binance`, 'success');
        onClose();
      } else {
        setPending(response.message);
      }
    } catch (withdrawError) {
      setError(errorMessage(withdrawError));
      try {
        await onRefreshProfile();
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <Modal
        title="Retiro en revisión"
        icon={<Clock className="h-4 w-4 text-[#f59e0b]" />}
        onClose={onClose}
      >
        <div className="py-4 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-[#f59e0b]" />
          <p className="text-sm font-bold text-white">Binance Pay no confirmó el retiro</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{pending}</p>
          <div className="mt-4 rounded border border-[#f59e0b]/25 bg-[#181511] px-3 py-2 text-[10px] leading-relaxed text-[#fbbf24]">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            No vuelvas a solicitar el mismo retiro. Un administrador revisará el estado en
            Binance y reembolsará o completará la orden desde el panel financiero.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded border border-[#2d3447] bg-[#161a24] py-2 text-xs font-bold text-white transition hover:bg-[#1e2330]"
          >
            Entendido
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Retirar saldo a Binance"
      subtitle="Sin comisión de retiro. El USDT llega a tu UID de Binance."
      icon={<ArrowUpRight className="h-4 w-4 text-[#00f090]" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded border border-[#1d222e] bg-[#0c0e14] p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Saldo disponible</div>
          <div className="text-lg font-bold tabular-nums text-[#00f090]">
            ${formatUsdt(balance)} <span className="text-xs text-slate-400">USDT</span>
          </div>
        </div>

        <div>
          <label htmlFor="withdraw-uid" className="mb-1 block text-[11px] font-bold text-slate-300">
            Binance UID (8-10 dígitos)
          </label>
          <input
            id="withdraw-uid"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={uid}
            onChange={(event) => setUid(event.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="123456789"
            className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 font-mono text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
          />
          <p className="mt-1 text-[9px] text-slate-600">
            Verifica el UID en Binance: <strong className="text-slate-400">Perfil → ID de usuario</strong>.
            Un UID incorrecto puede perder los fondos.
          </p>
        </div>

        <div>
          <label
            htmlFor="withdraw-amount"
            className="mb-1 block text-[11px] font-bold text-slate-300"
          >
            Monto a retirar (USDT)
          </label>
          <div className="relative">
            <input
              id="withdraw-amount"
              type="number"
              inputMode="decimal"
              min={WITHDRAW_MIN}
              max={Math.min(WITHDRAW_MAX, balance)}
              step="0.5"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded border border-[#222736] bg-[#090a0f] px-3 py-2 pr-14 font-mono text-white focus:border-[#00f090] focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-500">
              USDT
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAmount(Math.min(balance, WITHDRAW_MAX).toFixed(2))}
            className="mt-1 text-[10px] font-bold text-[#00f090] underline underline-offset-2"
          >
            Retirar máximo permitido
          </button>
        </div>

        {error ? (
          <div className="rounded border border-[#f43f5e]/35 bg-[#1f1113] px-2.5 py-2 text-[10px] leading-relaxed text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || balance <= 0}
          className="flex w-full items-center justify-center gap-2 rounded bg-[#00f090] py-2 text-xs font-bold text-black transition hover:bg-[#00d681] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />}
          {loading ? 'Procesando retiro…' : `Confirmar retiro de $${Number.isFinite(amountNumber) ? formatUsdt(amountNumber) : '0.00'} USDT`}
        </button>

        <p className="text-[9px] leading-relaxed text-slate-600">
          Retiro mínimo ${formatUsdt(WITHDRAW_MIN)} y máximo ${formatUsdt(WITHDRAW_MAX)} por
          operación. Binance Pay puede tardar unos minutos en reflejar el saldo.
        </p>
      </form>
    </Modal>
  );
}

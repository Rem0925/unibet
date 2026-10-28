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
      setError('El Binance UID debe contener entre 8 y 10 dígitos numéricos.');
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
        showToast(`Retiro de $${formatUsdt(amountNumber)} USDT enviado con éxito`, 'success');
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
        icon={<Clock className="h-5 w-5 text-[#f59e0b]" />}
        onClose={onClose}
      >
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f59e0b]/15 text-[#fbbf24]">
            <Clock className="h-8 w-8" />
          </div>
          <p className="text-base font-bold text-white">Solicitud enviada a revisión</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{pending}</p>
          <div className="mt-4 rounded-xl border border-[#f59e0b]/30 bg-[#181511] p-3 text-xs leading-relaxed text-[#fbbf24] text-left">
            <AlertTriangle className="mr-1.5 inline h-4 w-4 shrink-0" />
            No es necesario reenviar la solicitud. El administrador conciliará la transacción en Binance Pay.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl border border-[#2d3447] bg-[#161a24] py-3 text-sm font-semibold text-white transition hover:bg-[#1e2330]"
          >
            Entendido
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Retirar a Binance"
      subtitle="Retira tu saldo disponible directo a tu Binance Pay UID sin comisiones."
      icon={<ArrowUpRight className="h-5 w-5 text-[#00f090]" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5">
          <span className="text-xs text-slate-400">Saldo disponible</span>
          <div className="text-right">
            <span className="font-mono text-base font-bold text-[#00f090]">${formatUsdt(balance)}</span>
            <span className="ml-1 text-xs text-slate-500">USDT</span>
          </div>
        </div>

        <div>
          <label htmlFor="withdraw-uid" className="mb-1.5 block text-xs font-semibold text-slate-300">
            Binance Pay UID
          </label>
          <input
            id="withdraw-uid"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={uid}
            onChange={(event) => setUid(event.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Ej: 123456789"
            className="w-full rounded-xl border border-[#222736] bg-[#090a0f] px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Encuéntralo en tu app de Binance: Perfil → ID de usuario.
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="withdraw-amount" className="text-xs font-semibold text-slate-300">
              Monto a retirar
            </label>
            <button
              type="button"
              onClick={() => setAmount(Math.min(balance, WITHDRAW_MAX).toFixed(2))}
              className="text-xs font-bold text-[#00f090] hover:underline"
            >
              MAX
            </button>
          </div>
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
              className="w-full rounded-xl border border-[#222736] bg-[#090a0f] px-3.5 py-2.5 pr-14 font-mono text-sm text-white focus:border-[#00f090] focus:outline-none"
            />
            <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-500">USDT</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || balance <= 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Spinner className="text-black" /> : <CheckCircle2 className="h-4 w-4" />}
          {loading ? 'Procesando retiro…' : `Confirmar retiro de $${Number.isFinite(amountNumber) ? formatUsdt(amountNumber) : '0.00'} USDT`}
        </button>

        <p className="text-center text-[11px] text-slate-500">
          Retiro mínimo ${formatUsdt(WITHDRAW_MIN)} y máximo ${formatUsdt(WITHDRAW_MAX)} USDT. Directo a tu cuenta.
        </p>
      </form>
    </Modal>
  );
}

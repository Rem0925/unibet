'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Info,
  ShieldAlert,
  Wallet,
  Zap,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { WITHDRAW_BEP20_MIN, WITHDRAW_MAX, WITHDRAW_MIN } from '@/lib/constants';
import { formatUsdt } from '@/lib/format';
import type { BscFeeResponse, UserProfile, WithdrawResponse } from '@/lib/types';
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
  const [method, setMethod] = useState<'BINANCE_PAY' | 'BEP20'>('BINANCE_PAY');
  const [amount, setAmount] = useState('10.00');
  const [uid, setUid] = useState(profile.binanceUid ?? '');
  const [bep20Address, setBep20Address] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [feeInfo, setFeeInfo] = useState<BscFeeResponse | null>(null);
  const [loadingFee, setLoadingFee] = useState(false);

  const amountNumber = Number.parseFloat(amount) || 0;

  // Cargar comisión dinámica de Binance SAPI al montar o al cambiar a BEP20
  useEffect(() => {
    let active = true;
    const fetchFee = async () => {
      setLoadingFee(true);
      try {
        const res = await apiFetch<BscFeeResponse>('/api/wallet/withdraw/fee');
        if (active) {
          setFeeInfo(res);
        }
      } catch {
        if (active) {
          // Fallback a tarifa habitual de BSC
          setFeeInfo({
            coin: 'USDT',
            network: 'BSC',
            withdrawFee: 0.19,
            withdrawMin: 5.0,
            withdrawMax: 1000000.0,
            withdrawEnable: true,
            isLive: false,
            cachedAt: Date.now(),
          });
        }
      } finally {
        if (active) {
          setLoadingFee(false);
        }
      }
    };

    void fetchFee();
    return () => {
      active = false;
    };
  }, []);

  const liveFee = useMemo(() => {
    if (method === 'BINANCE_PAY') return 0;
    return feeInfo?.withdrawFee ?? 0.19;
  }, [method, feeInfo]);

  const netPayout = useMemo(() => {
    if (method === 'BINANCE_PAY') return amountNumber;
    return Math.max(0, Math.round((amountNumber - liveFee) * 10000) / 10000);
  }, [method, amountNumber, liveFee]);

  const currentMin = useMemo(() => {
    if (method === 'BINANCE_PAY') return WITHDRAW_MIN;
    const bscMin = feeInfo?.withdrawMin ?? WITHDRAW_BEP20_MIN;
    return Math.max(bscMin, 1.0) + liveFee;
  }, [method, feeInfo, liveFee]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(null);

    if (!Number.isFinite(amountNumber) || amountNumber < currentMin) {
      setError(`El retiro mínimo para este método es de $${formatUsdt(currentMin)} USDT.`);
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

    if (method === 'BINANCE_PAY') {
      if (!/^[0-9]{8,10}$/.test(uid.trim())) {
        setError('El Binance Pay UID debe contener entre 8 y 10 dígitos numéricos.');
        return;
      }
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(bep20Address.trim())) {
        setError('Dirección BEP-20 (BSC) inválida. Debe ser un formato 0x de 42 caracteres.');
        return;
      }
      if (netPayout <= 0) {
        setError(`El monto debe superar la comisión de red ($${liveFee.toFixed(2)} USDT).`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload =
        method === 'BINANCE_PAY'
          ? { method: 'BINANCE_PAY', amount: amountNumber, binanceUid: uid.trim() }
          : { method: 'BEP20', amount: amountNumber, address: bep20Address.trim() };

      const response = await apiFetch<WithdrawResponse>('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await onRefreshProfile();

      if (response.status === 'COMPLETED') {
        showToast(
          `Retiro de $${formatUsdt(netPayout)} USDT procesado con éxito`,
          'success'
        );
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
            No es necesario reenviar la solicitud. La operación será procesada por la administración.
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
      title="Retirar fondos"
      subtitle="Elige tu método de retiro preferido."
      icon={<ArrowUpRight className="h-5 w-5 text-[#00f090]" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Pestañas de método */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#090a0f] p-1 border border-[#1e2330]">
          <button
            type="button"
            onClick={() => {
              setMethod('BINANCE_PAY');
              setError(null);
            }}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-bold transition ${
              method === 'BINANCE_PAY'
                ? 'bg-[#1e2330] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>Binance Pay</span>
            </div>
            <span className="text-[10px] text-[#00f090] font-mono mt-0.5">0% Comisión</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMethod('BEP20');
              setError(null);
            }}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-bold transition ${
              method === 'BEP20'
                ? 'bg-[#1e2330] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-400" />
              <span>Express BEP-20</span>
            </div>
            <span className="text-[10px] text-amber-400 font-mono mt-0.5">Automático</span>
          </button>
        </div>

        {/* Saldo disponible */}
        <div className="flex items-center justify-between rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3">
          <span className="text-xs text-slate-400">Saldo disponible</span>
          <div className="text-right">
            <span className="font-mono text-base font-bold text-[#00f090]">
              ${formatUsdt(balance)}
            </span>
            <span className="ml-1 text-xs text-slate-500">USDT</span>
          </div>
        </div>

        {/* Indicador de comisión en vivo para BEP-20 */}
        {method === 'BEP20' ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="font-medium">Comisión de red Binance BSC:</span>
            </div>
            <span className="font-mono font-bold text-amber-300">
              {loadingFee ? '...' : `${liveFee.toFixed(2)} USDT`}
            </span>
          </div>
        ) : null}

        {/* Campos según método */}
        {method === 'BINANCE_PAY' ? (
          <div>
            <label htmlFor="withdraw-uid" className="mb-1.5 block text-xs font-semibold text-slate-300">
              Tu Binance Pay UID
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
        ) : (
          <div>
            <label htmlFor="withdraw-address" className="mb-1.5 block text-xs font-semibold text-slate-300">
              Dirección de billetera BEP-20 (BNB Smart Chain)
            </label>
            <input
              id="withdraw-address"
              type="text"
              value={bep20Address}
              onChange={(event) => setBep20Address(event.target.value.trim())}
              placeholder="0x..."
              className="w-full rounded-xl border border-[#222736] bg-[#090a0f] px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              MetaMask, TrustWallet, Binance Web3 o cualquier billetera compatible con la red BSC.
            </p>
          </div>
        )}

        {/* Campo de Monto */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="withdraw-amount" className="text-xs font-semibold text-slate-300">
              Monto a retirar de tu saldo
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
              min={currentMin}
              max={Math.min(WITHDRAW_MAX, balance)}
              step="0.5"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl border border-[#222736] bg-[#090a0f] px-3.5 py-2.5 pr-14 font-mono text-sm text-white focus:border-[#00f090] focus:outline-none"
            />
            <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-500">USDT</span>
          </div>
        </div>

        {/* Desglose matemático exacto en tiempo real */}
        <div className="space-y-2 rounded-xl border border-[#1e2330] bg-[#141822]/60 p-3.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Monto debitado de tu saldo:</span>
            <span className="font-mono text-white">${formatUsdt(amountNumber)} USDT</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>
              {method === 'BEP20' ? 'Comisión de red Binance BSC (en vivo):' : 'Comisión de servicio (0%):'}
            </span>
            <span className={`font-mono ${method === 'BEP20' ? 'text-amber-400' : 'text-[#00f090]'}`}>
              {method === 'BEP20' ? `-${liveFee.toFixed(2)} USDT` : '$0.00 USDT'}
            </span>
          </div>
          <div className="flex justify-between border-t border-[#1e2330] pt-2 font-bold text-white">
            <span>Recibirás en tu {method === 'BEP20' ? 'billetera Web3' : 'Binance Pay'}:</span>
            <span className="font-mono text-sm text-[#00f090]">${formatUsdt(netPayout)} USDT</span>
          </div>
        </div>

        {method === 'BEP20' ? (
          <p className="text-[11px] leading-relaxed text-slate-400 bg-[#0d1017] p-2.5 rounded-lg border border-[#1e2330]">
            <Info className="inline h-3.5 w-3.5 mr-1 text-amber-400" />
            La tarifa de red ($<strong>{liveFee.toFixed(2)} USDT</strong>) se resta directamente del monto enviado para cubrir el gas de la red BNB Smart Chain. La casa no cobra recargos adicionales.
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-slate-400 bg-[#0d1017] p-2.5 rounded-lg border border-[#1e2330]">
            <Info className="inline h-3.5 w-3.5 mr-1 text-[#00f090]" />
            Los retiros por Binance Pay no tienen comisión de red ($0.00). Son aprobados y transferidos directamente a tu UID por el administrador.
          </p>
        )}

        {error ? (
          <div className="rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || balance <= 0 || (method === 'BEP20' && netPayout <= 0)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50 ${
            method === 'BEP20'
              ? 'bg-amber-400 hover:bg-amber-300'
              : 'bg-[#00f090] hover:bg-[#00d681]'
          }`}
        >
          {loading ? (
            <Spinner className="text-black" />
          ) : method === 'BEP20' ? (
            <Zap className="h-4 w-4 text-black" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-black" />
          )}
          {loading
            ? 'Procesando retiro…'
            : method === 'BEP20'
            ? `Retirar Express $${formatUsdt(netPayout)} USDT`
            : `Solicitar Retiro $${formatUsdt(amountNumber)} USDT`}
        </button>

        <p className="text-center text-[11px] text-slate-500">
          Mínimo ${formatUsdt(currentMin)} y máximo ${formatUsdt(WITHDRAW_MAX)} USDT.
        </p>
      </form>
    </Modal>
  );
}

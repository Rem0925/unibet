'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  LogOut,
  Pencil,
  Receipt,
  Shield,
  Ticket,
  Trophy,
  User,
  XCircle,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatDate, formatShortDate, formatUsdt } from '@/lib/format';
import type { BetRecord, BetStatus, TransactionRecord, UserProfile } from '@/lib/types';
import { Spinner } from './ui';

interface AccountViewProps {
  profile: UserProfile;
  bets: BetRecord[];
  transactions: TransactionRecord[];
  loadingBets: boolean;
  loadingWallet: boolean;
  initialSubTab?: AccountSubTab;
  onSubTabChange?: (subTab: AccountSubTab) => void;
  onRefreshProfile: () => Promise<UserProfile>;
  onDeposit: () => void;
  onWithdraw: () => void;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
  onExplore: () => void;
  onSelectMarket?: (marketId: string) => void;
}

export type AccountSubTab = 'BETS' | 'TRANSACTIONS' | 'SETTINGS';

const betStatusBadge: Record<BetStatus, { label: string; style: string }> = {
  ACTIVE: { label: 'EN JUEGO', style: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  WON: { label: 'GANADA', style: 'border-[#00f090]/40 bg-[#00f090]/15 text-[#00f090]' },
  LOST: { label: 'NO ACERTADA', style: 'border-slate-700 bg-slate-800/40 text-slate-400' },
  REFUNDED: { label: 'REEMBOLSADA', style: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
};

const txTypeLabels: Record<string, { label: string; positive: boolean }> = {
  DEPOSIT: { label: 'Depósito Binance Pay', positive: true },
  WITHDRAW: { label: 'Retiro a Binance Pay', positive: false },
  BET: { label: 'Apuesta colocada', positive: false },
  BET_PLACED: { label: 'Apuesta colocada', positive: false },
  BET_WON: { label: 'Premio de apuesta ganadora', positive: true },
  CREATOR_WIN: { label: 'Premio por crear mercado', positive: true },
  HOUSE_WIN: { label: 'Ingreso Casa', positive: true },
  FEE_DEPOSIT: { label: 'Comisión de depósito', positive: true },
  REFUND: { label: 'Reembolso de apuesta', positive: true },
};

export function AccountView({
  profile,
  bets,
  transactions,
  loadingBets,
  loadingWallet,
  initialSubTab = 'BETS',
  onSubTabChange,
  onRefreshProfile,
  onDeposit,
  onWithdraw,
  onLogout,
  showToast,
  onExplore,
  onSelectMarket,
}: AccountViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<AccountSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSelectSubTab = (tab: AccountSubTab) => {
    setActiveSubTab(tab);
    onSubTabChange?.(tab);
  };
  const [betFilter, setBetFilter] = useState<'ALL' | BetStatus>('ALL');
  const [txFilter, setTxFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW' | 'WINS'>('ALL');

  // Edit fields
  const [newUsername, setNewUsername] = useState(profile.username);
  const [savingUsername, setSavingUsername] = useState(false);
  const [newBinanceUid, setNewBinanceUid] = useState(profile.binanceUid ?? '');
  const [savingBinance, setSavingBinance] = useState(false);

  const filteredBets = useMemo(() => {
    if (betFilter === 'ALL') return bets;
    return bets.filter((b) => b.status === betFilter);
  }, [bets, betFilter]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'ALL') return transactions;
    if (txFilter === 'DEPOSIT') return transactions.filter((t) => t.type === 'DEPOSIT');
    if (txFilter === 'WITHDRAW') return transactions.filter((t) => t.type === 'WITHDRAW');
    if (txFilter === 'WINS')
      return transactions.filter((t) => t.type === 'BET_WON' || t.type === 'CREATOR_WIN');
    return transactions;
  }, [transactions, txFilter]);

  const stats = useMemo(() => {
    const totalWon = bets
      .filter((b) => b.status === 'WON')
      .reduce((sum, b) => sum + (Number.parseFloat(b.payoutAmount) || 0), 0);
    const activeCount = bets.filter((b) => b.status === 'ACTIVE').length;
    const wonCount = bets.filter((b) => b.status === 'WON').length;
    return { totalWon, activeCount, wonCount };
  }, [bets]);

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newUsername.trim().toLowerCase();
    if (clean === profile.username) return;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(clean)) {
      showToast('El usuario debe tener entre 3 y 24 caracteres (letras, números o _)', 'error');
      return;
    }

    setSavingUsername(true);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ username: clean }),
      });
      showToast('Nombre de usuario actualizado con éxito', 'success');
      await onRefreshProfile();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSaveBinanceUid = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBinanceUid.trim();
    if (clean === (profile.binanceUid ?? '')) return;
    if (!/^[0-9]{8,10}$/.test(clean)) {
      showToast('El Binance Pay UID debe contener entre 8 y 10 dígitos numéricos', 'error');
      return;
    }

    setSavingBinance(true);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ binanceUid: clean }),
      });
      showToast('Binance Pay UID vinculado correctamente', 'success');
      await onRefreshProfile();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setSavingBinance(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Botón Volver a Mercados */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExplore}
          className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#00f090] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 text-[#00f090]" />
          <span>Volver a Mercados</span>
        </button>
      </div>

      {/* Tarjeta Superior: Perfil & Balance */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Perfil del Usuario */}
        <div className="rounded-xl border border-[#212633] bg-[#12151c] p-5 shadow-sm md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#00f090]/20 to-sky-500/20 text-lg font-bold text-[#00f090] ring-1 ring-[#00f090]/30">
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-base font-bold text-white">@{profile.username}</h2>
                <span className="shrink-0 rounded bg-[#1a202d] px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                  {profile.role === 'ADMIN' ? 'Admin' : profile.role === 'MODERATOR' ? 'Moderador' : 'Apostador'}
                </span>
              </div>
              <p className="truncate text-xs text-slate-400">{profile.email}</p>
            </div>
          </div>

          <div className="mt-4 border-t border-[#1e2330] pt-3 text-xs text-slate-400">
            <div className="flex justify-between py-1">
              <span>Binance UID:</span>
              <span className="font-mono text-slate-200">
                {profile.binanceUid ? profile.binanceUid : 'No vinculado'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Miembro desde:</span>
              <span className="text-slate-200">{formatShortDate(profile.createdAt)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>

        {/* Tarjeta de Saldo y Fondos */}
        <div className="flex flex-col justify-between rounded-xl border border-[#212633] bg-[#12151c] p-5 shadow-sm md:col-span-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Saldo Disponible
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-white">
                ${formatUsdt(profile.balance)}
              </span>
              <span className="font-semibold text-emerald-400">USDT</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#1e2330] py-3 text-center">
            <div>
              <div className="font-mono text-sm font-bold text-white">{stats.activeCount}</div>
              <div className="text-[11px] text-slate-400">Apuestas en juego</div>
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-[#00f090]">{stats.wonCount}</div>
              <div className="text-[11px] text-slate-400">Ganadas</div>
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-[#00f090]">
                ${formatUsdt(stats.totalWon)}
              </div>
              <div className="text-[11px] text-slate-400">Premios cobrados</div>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onDeposit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#00f090] py-2.5 text-xs font-bold text-black transition hover:bg-[#00d681]"
            >
              <ArrowDownLeft className="h-4 w-4" /> Recargar USDT
            </button>
            <button
              type="button"
              onClick={onWithdraw}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#2d3447] bg-[#161a24] py-2.5 text-xs font-bold text-white transition hover:bg-[#1e2330]"
            >
              <ArrowUpRight className="h-4 w-4 text-emerald-400" /> Retirar USDT
            </button>
          </div>
        </div>
      </div>

      {/* Navegación de Sub-Pestañas */}
      <div className="flex border-b border-[#1e2330] overflow-x-auto scrollbar-none gap-2">
        <button
          type="button"
          onClick={() => handleSelectSubTab('BETS')}
          className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition shrink-0 ${
            activeSubTab === 'BETS'
              ? 'border-[#00f090] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ticket className="h-4 w-4 text-[#00f090]" /> Apuestas ({bets.length})
        </button>
        <button
          type="button"
          onClick={() => handleSelectSubTab('TRANSACTIONS')}
          className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition shrink-0 ${
            activeSubTab === 'TRANSACTIONS'
              ? 'border-[#00f090] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="h-4 w-4 text-emerald-400" /> Movimientos ({transactions.length})
        </button>
        <button
          type="button"
          onClick={() => handleSelectSubTab('SETTINGS')}
          className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition shrink-0 ${
            activeSubTab === 'SETTINGS'
              ? 'border-[#00f090] text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Pencil className="h-4 w-4 text-slate-400" /> Ajustes
        </button>
      </div>

      {/* CONTENIDO 1: MIS APUESTAS */}
      {activeSubTab === 'BETS' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg border border-[#212633] bg-[#0c0d12] p-1">
              {(
                [
                  { id: 'ALL', label: 'Todas' },
                  { id: 'ACTIVE', label: 'En juego' },
                  { id: 'WON', label: 'Ganadas' },
                  { id: 'LOST', label: 'No acertadas' },
                  { id: 'REFUNDED', label: 'Reembolsadas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBetFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    betFilter === tab.id
                      ? 'bg-[#1a202d] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onExplore}
              className="text-xs font-semibold text-[#00f090] hover:underline"
            >
              + Explorar más apuestas
            </button>
          </div>

          {loadingBets ? (
            <div className="flex h-36 items-center justify-center">
              <Spinner className="h-6 w-6 text-[#00f090]" />
            </div>
          ) : filteredBets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#212633] p-8 text-center">
              <Ticket className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-2 text-sm font-semibold text-slate-300">
                {betFilter === 'ALL'
                  ? 'Aún no has realizado ninguna apuesta'
                  : 'No tienes apuestas con este filtro'}
              </p>
              <button
                type="button"
                onClick={onExplore}
                className="mt-3 inline-block rounded-lg bg-[#00f090] px-4 py-2 text-xs font-bold text-black"
              >
                Ver eventos en juego
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredBets.map((bet) => {
                const badge = betStatusBadge[bet.status] ?? betStatusBadge.ACTIVE;
                return (
                  <div
                    key={bet.id}
                    onClick={() => onSelectMarket?.(bet.marketId)}
                    className="group flex flex-col justify-between gap-3 rounded-xl border border-[#212633] bg-[#12151c] p-4 sm:flex-row sm:items-center hover:border-[#00f090]/50 hover:bg-[#151a24] transition duration-150 cursor-pointer shadow-sm active:scale-[0.99]"
                    title="Clic para ver este mercado en vivo"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${badge.style}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatShortDate(bet.createdAt)}
                        </span>
                      </div>
                      <h4 className="mt-1 truncate text-sm font-bold text-white group-hover:text-emerald-300 transition">
                        {bet.marketTitle}
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-300">
                        Elegiste:{' '}
                        <strong className="font-semibold text-emerald-400">
                          {bet.selectedOption}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#1e2330] pt-2 sm:border-0 sm:pt-0 sm:text-right gap-3">
                      <span className="text-xs text-slate-400 sm:hidden">Monto apostado</span>
                      <div>
                        <div className="font-mono text-sm font-bold text-white">
                          ${formatUsdt(bet.amount)} USDT
                        </div>
                        {bet.status === 'WON' ? (
                          <div className="font-mono text-xs font-bold text-[#00f090]">
                            Cobrado: +${formatUsdt(bet.payoutAmount)} USDT
                          </div>
                        ) : null}
                      </div>
                      <div className="hidden sm:flex items-center text-slate-500 group-hover:text-[#00f090] transition">
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* CONTENIDO 2: MOVIMIENTOS FINANCIEROS */}
      {activeSubTab === 'TRANSACTIONS' ? (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg border border-[#212633] bg-[#0c0d12] p-1">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'DEPOSIT', label: 'Depósitos' },
                { id: 'WITHDRAW', label: 'Retiros' },
                { id: 'WINS', label: 'Premios' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTxFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  txFilter === tab.id
                    ? 'bg-[#1a202d] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingWallet ? (
            <div className="flex h-36 items-center justify-center">
              <Spinner className="h-6 w-6 text-[#00f090]" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#212633] p-8 text-center text-sm text-slate-400">
              No hay movimientos registrados con este filtro.
            </div>
          ) : (
            <div className="divide-y divide-[#1e2330] rounded-xl border border-[#212633] bg-[#12151c]">
              {filteredTransactions.map((tx) => {
                const conf = txTypeLabels[tx.type] ?? { label: tx.type, positive: true };
                const isPositive = conf.positive;

                return (
                  <div key={tx.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {isPositive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{conf.label}</div>
                        <div className="text-xs text-slate-500">{formatDate(tx.createdAt)}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-mono text-sm font-bold ${
                          isPositive ? 'text-[#00f090]' : 'text-slate-200'
                        }`}
                      >
                        {isPositive ? '+' : '-'}${formatUsdt(tx.amount)} USDT
                      </div>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : tx.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {tx.status === 'COMPLETED' ? 'Completado' : tx.status === 'PENDING' ? 'Pendiente' : 'Fallido'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* CONTENIDO 3: AJUSTES DE CUENTA */}
      {activeSubTab === 'SETTINGS' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Cambiar Username */}
          <form
            onSubmit={handleSaveUsername}
            className="rounded-xl border border-[#212633] bg-[#12151c] p-5 shadow-sm"
          >
            <h3 className="text-sm font-bold text-white">Nombre de usuario</h3>
            <p className="mt-1 text-xs text-slate-400">
              Es el nombre público con el que aparecerás al crear mercados y en los rankings.
            </p>

            <div className="mt-4">
              <label htmlFor="username-input" className="block text-xs font-semibold text-slate-300">
                Tu @usuario
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-500">
                  @
                </span>
                <input
                  id="username-input"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  maxLength={24}
                  className="w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] py-2 pl-7 pr-3 text-base sm:text-sm text-white focus:border-[#00f090] focus:outline-none transition-colors"
                  placeholder="ejemplo123"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingUsername || newUsername.trim() === profile.username}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-[#00f090] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#00d681] active:scale-[0.98] disabled:opacity-40"
            >
              {savingUsername ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              Guardar usuario
            </button>
          </form>

          {/* Vincular Binance Pay UID */}
          <form
            onSubmit={handleSaveBinanceUid}
            className="rounded-xl border border-[#212633] bg-[#12151c] p-5 shadow-sm"
          >
            <h3 className="text-sm font-bold text-white">Binance Pay UID</h3>
            <p className="mt-1 text-xs text-slate-400">
              Vincula tu ID de 8 a 10 dígitos de Binance para recibir tus retiros directamente sin tener que escribirlo cada vez.
            </p>

            <div className="mt-4">
              <label htmlFor="binance-uid-input" className="block text-xs font-semibold text-slate-300">
                Binance ID (Pay)
              </label>
              <input
                id="binance-uid-input"
                type="text"
                inputMode="numeric"
                value={newBinanceUid}
                onChange={(e) => setNewBinanceUid(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={10}
                className="mt-1 w-full rounded-lg border border-[#2d3447] bg-[#0c0d12] px-3 py-2 text-base sm:text-sm font-mono text-white tabular-nums focus:border-[#00f090] focus:outline-none transition-colors"
                placeholder="Ej. 182948291"
              />
            </div>

            <button
              type="submit"
              disabled={savingBinance || newBinanceUid.trim() === (profile.binanceUid ?? '')}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-[#2d3447] bg-[#161a24] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1e2330] active:scale-[0.98] disabled:opacity-40"
            >
              {savingBinance ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 text-[#00f090]" />}
              Guardar Binance UID
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

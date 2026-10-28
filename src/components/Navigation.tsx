'use client';

import {
  ArrowDownLeft,
  Flame,
  Layers,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { formatUsdt } from '@/lib/format';
import type { AppTab, Role, UserProfile } from '@/lib/types';
import { Spinner } from './ui';

interface NavigationProps {
  profile: UserProfile;
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onCreate: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function Header({
  profile,
  activeTab,
  onNavigate,
  onDeposit,
  onCreate,
  onLogout,
  onRefresh,
  refreshing,
}: NavigationProps) {
  const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR';

  return (
    <header className="sticky top-0 z-40 border-b border-[#1e2330] bg-[#0c0d12]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        {/* Logo */}
        <button
          type="button"
          onClick={() => onNavigate('EXPLORE')}
          className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90"
          aria-label="Ir a mercados"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-[#00f090] ring-1 ring-[#00f090]/25">
            <Flame className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black tracking-tight text-white">
              Uni<span className="text-[#00f090]">Bet</span>
            </span>
          </div>
        </button>

        {/* Desktop Main Nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => onNavigate('EXPLORE')}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === 'EXPLORE'
                ? 'bg-[#161a24] text-white shadow-sm ring-1 ring-[#283042]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mercados
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ACCOUNT')}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === 'ACCOUNT'
                ? 'bg-[#161a24] text-white shadow-sm ring-1 ring-[#283042]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mi Cuenta
          </button>
          {isStaff ? (
            <button
              type="button"
              onClick={() => onNavigate('MODERATION')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeTab === 'MODERATION'
                  ? 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30'
                  : 'text-purple-400/80 hover:text-purple-300'
              }`}
            >
              Moderación
            </button>
          ) : null}
          {profile.role === 'ADMIN' ? (
            <button
              type="button"
              onClick={() => onNavigate('ADMIN')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeTab === 'ADMIN'
                  ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              Finanzas
            </button>
          ) : null}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Balance Pill */}
          <button
            type="button"
            onClick={() => onNavigate('ACCOUNT')}
            className="flex items-center gap-2 rounded-lg border border-[#212633] bg-[#12151c] px-3 py-1.5 transition hover:border-[#2f374a]"
            title="Ver saldo y movimientos"
          >
            <Wallet className="h-3.5 w-3.5 text-[#00f090]" />
            <div className="text-right">
              <span className="font-mono text-xs font-bold text-white">
                ${formatUsdt(profile.balance)}
                <span className="ml-1 text-[10px] font-normal text-slate-400">USDT</span>
              </span>
            </div>
          </button>

          {/* Quick Deposit button */}
          <button
            type="button"
            onClick={onDeposit}
            className="hidden items-center gap-1 rounded-lg border border-[#2d3447] bg-[#161a24] px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-[#1e2330] md:flex"
            title="Recargar USDT con Binance Pay"
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-[#00f090]" />
            <span>Recargar</span>
          </button>

          {/* Create Button */}
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[#00f090] px-3 py-1.5 text-xs font-bold text-black transition hover:bg-[#00d681]"
          >
            <Plus className="h-4 w-4" />
            <span>Crear evento</span>
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg border border-[#212633] bg-[#12151c] p-2 text-slate-400 transition hover:text-white disabled:opacity-50"
            title="Actualizar datos"
            aria-label="Actualizar datos"
          >
            {refreshing ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>

          {/* User Avatar with link to account */}
          <button
            type="button"
            onClick={() => onNavigate('ACCOUNT')}
            className="hidden h-8 w-8 items-center justify-center rounded-lg border border-[#283042] bg-[#161a24] text-xs font-bold text-[#00f090] transition hover:border-slate-500 sm:flex"
            title={`@${profile.username}`}
          >
            {profile.username.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileNav({
  activeTab,
  onNavigate,
  onCreate,
  role,
}: {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onCreate: () => void;
  role: Role;
}) {
  const isStaff = role === 'ADMIN' || role === 'MODERATOR';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[#1e2330] bg-[#0c0d12]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <button
        type="button"
        onClick={() => onNavigate('EXPLORE')}
        className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition ${
          activeTab === 'EXPLORE' ? 'text-[#00f090]' : 'text-slate-400'
        }`}
      >
        <Flame className="h-5 w-5" />
        <span>Mercados</span>
      </button>

      {/* Botón Central Crear */}
      <button
        type="button"
        onClick={onCreate}
        className="flex -translate-y-2 flex-col items-center gap-1 rounded-full bg-[#00f090] p-3 text-black shadow-lg shadow-[#00f090]/20 transition active:scale-95"
        aria-label="Crear evento"
      >
        <Plus className="h-5 w-5 stroke-[2.5]" />
      </button>

      <button
        type="button"
        onClick={() => onNavigate('ACCOUNT')}
        className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition ${
          activeTab === 'ACCOUNT' ? 'text-[#00f090]' : 'text-slate-400'
        }`}
      >
        <User className="h-5 w-5" />
        <span>Mi Cuenta</span>
      </button>

      {isStaff ? (
        <button
          type="button"
          onClick={() => onNavigate(role === 'ADMIN' ? 'ADMIN' : 'MODERATION')}
          className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition ${
            activeTab === 'MODERATION' || activeTab === 'ADMIN'
              ? 'text-purple-400'
              : 'text-slate-400'
          }`}
        >
          <ShieldCheck className="h-5 w-5" />
          <span>Staff</span>
        </button>
      ) : null}
    </nav>
  );
}

'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Flame,
  Layers,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Wallet,
} from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';
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

const roleStyles: Record<Role, string> = {
  ADMIN: 'border-[#f59e0b]/40 bg-[#261f12] text-[#fbbf24]',
  MODERATOR: 'border-[#a855f7]/40 bg-[#221730] text-[#c084fc]',
  USER: 'border-[#00f090]/30 bg-[#121f18] text-[#00f090]',
};

export function Header({
  profile,
  activeTab,
  onNavigate,
  onDeposit,
  onWithdraw,
  onCreate,
  onLogout,
  onRefresh,
  refreshing,
}: NavigationProps) {
  const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR';

  return (
    <header className="sticky top-0 z-40 border-b border-[#1a1e28] bg-[#0c0d12]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <button
          type="button"
          onClick={() => onNavigate('EXPLORE')}
          className="flex shrink-0 items-center gap-2.5"
          aria-label="Ir a mercados"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded border border-[#262c3d] bg-[#141822]">
            <Flame className="h-4 w-4 text-[#00f090]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-base font-black uppercase tracking-tight text-white">
              Uni<span className="text-[#00f090]">Bet</span>
            </span>
            <span className="hidden rounded border border-[#00f090]/30 bg-[#141822] px-1 py-0.5 font-mono text-[9px] uppercase text-[#00f090] sm:inline">
              P2P
            </span>
          </div>
        </button>

        <nav className="hidden items-center gap-1 font-mono text-xs md:flex">
          <NavButton
            active={activeTab === 'EXPLORE'}
            onClick={() => onNavigate('EXPLORE')}
            label="MERCADOS"
          />
          <NavButton
            active={activeTab === 'MY_BETS'}
            onClick={() => onNavigate('MY_BETS')}
            label="MIS TICKETS"
          />
          <NavButton
            active={activeTab === 'WALLET'}
            onClick={() => onNavigate('WALLET')}
            label="BILLETERA"
          />
          {isStaff ? (
            <button
              type="button"
              onClick={() => onNavigate('MODERATION')}
              className={`rounded px-3 py-1.5 transition ${
                activeTab === 'MODERATION'
                  ? 'border border-[#6b21a8] bg-[#221730] font-bold text-[#c084fc]'
                  : 'text-[#c084fc]/70 hover:text-[#c084fc]'
              }`}
            >
              MODERACIÓN
            </button>
          ) : null}
          {profile.role === 'ADMIN' ? (
            <button
              type="button"
              onClick={() => onNavigate('ADMIN')}
              className={`rounded px-3 py-1.5 transition ${
                activeTab === 'ADMIN'
                  ? 'border border-[#b45309] bg-[#261f12] font-bold text-[#fbbf24]'
                  : 'text-[#fbbf24]/70 hover:text-[#fbbf24]'
              }`}
            >
              FINANZAS
            </button>
          ) : null}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onNavigate('WALLET')}
            className="flex items-center gap-2 rounded border border-[#212633] bg-[#12151c] px-2 py-1 transition hover:border-[#2e3548] sm:px-3"
            title="Ver billetera"
          >
            <Wallet className="h-3.5 w-3.5 text-[#00f090]" />
            <div className="text-right font-mono">
              <span className="block text-[9px] leading-none text-slate-500">Saldo</span>
              <span className="text-[11px] font-bold tabular-nums text-[#00f090]">
                ${formatUsdt(profile.balance)}
                <span className="ml-1 hidden text-[9px] text-slate-400 sm:inline">USDT</span>
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="hidden rounded border border-[#2c3345] bg-[#161a24] p-1.5 text-slate-300 transition hover:bg-[#1e2330] disabled:opacity-60 sm:block"
            title="Actualizar datos"
            aria-label="Actualizar datos"
          >
            {refreshing ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={onDeposit}
            className="flex items-center gap-1 rounded border border-[#2c3345] bg-[#161a24] px-2 py-1.5 font-mono text-xs font-bold text-slate-200 transition hover:bg-[#1e2330] sm:px-2.5"
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-[#00f090]" />
            <span className="hidden lg:inline">Recargar</span>
          </button>

          <button
            type="button"
            onClick={onWithdraw}
            className="rounded border border-[#2c3345] bg-[#161a24] p-1.5 text-slate-300 transition hover:bg-[#1e2330]"
            title="Retirar a Binance UID"
            aria-label="Retirar a Binance UID"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-1 rounded bg-[#00f090] px-2 py-1.5 font-mono text-xs font-bold text-black transition hover:bg-[#00d681] sm:px-3"
          >
            <Plus className="h-3.5 w-3.5 stroke-2" />
            <span className="hidden lg:inline">Crear</span>
          </button>

          <div className="hidden items-center gap-2 border-l border-[#222736] pl-2 xl:flex">
            <div className="text-right">
              <div className="max-w-[120px] truncate font-mono text-[11px] font-bold text-white">
                {profile.username}
              </div>
              <span
                className={`inline-block rounded border px-1 py-0.5 font-mono text-[9px] font-bold ${roleStyles[profile.role]}`}
              >
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded p-1.5 text-slate-500 transition hover:bg-[#1a1f2b] hover:text-[#f43f5e]"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="rounded p-1.5 text-slate-500 transition hover:text-[#f43f5e] xl:hidden"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 transition ${
        active
          ? 'border border-[#2a3142] bg-[#181c26] font-bold text-white'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

export function MobileNav({
  profile,
  activeTab,
  onNavigate,
  onCreate,
}: Pick<NavigationProps, 'profile' | 'activeTab' | 'onNavigate' | 'onCreate'>) {
  const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#1a1e28] bg-[#0d0e14] px-3 py-2 font-mono text-[10px] text-slate-400 md:hidden">
      <MobileButton
        icon={<Layers className="h-4 w-4" />}
        label="MERCADOS"
        active={activeTab === 'EXPLORE'}
        onClick={() => onNavigate('EXPLORE')}
      />
      <MobileButton
        icon={<Trophy className="h-4 w-4" />}
        label="TICKETS"
        active={activeTab === 'MY_BETS'}
        onClick={() => onNavigate('MY_BETS')}
      />
      <button
        type="button"
        onClick={onCreate}
        className="flex flex-col items-center gap-0.5 font-bold text-[#00f090]"
      >
        <Plus className="h-4 w-4 stroke-2" />
        <span>CREAR</span>
      </button>
      <MobileButton
        icon={<Wallet className="h-4 w-4" />}
        label="BILLETERA"
        active={activeTab === 'WALLET'}
        onClick={() => onNavigate('WALLET')}
      />
      {isStaff ? (
        <MobileButton
          icon={<ShieldCheck className="h-4 w-4" />}
          label="STAFF"
          active={activeTab === 'MODERATION' || activeTab === 'ADMIN'}
          onClick={() => onNavigate(profile.role === 'ADMIN' ? 'ADMIN' : 'MODERATION')}
        />
      ) : null}
    </div>
  );
}

function MobileButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 ${active ? 'font-bold text-[#00f090]' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

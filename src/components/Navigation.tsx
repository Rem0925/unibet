'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Flame,
  Layers,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Ticket,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { formatUsdt } from '@/lib/format';
import type { AppTab, Role, UserProfile } from '@/lib/types';

export type AccountSubTab = 'BETS' | 'TRANSACTIONS' | 'SETTINGS';

interface NavigationProps {
  profile: UserProfile;
  activeTab: AppTab;
  onNavigate: (tab: AppTab, subTab?: AccountSubTab) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onCreate: () => void;
  onOpenGroups?: () => void;
  onLogout: () => void;
}

export function Header({
  profile,
  activeTab,
  onNavigate,
  onDeposit,
  onCreate,
  onOpenGroups,
  onLogout,
}: NavigationProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR';

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMenuSelect = (action: () => void) => {
    setDropdownOpen(false);
    action();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#1e2330] bg-[#0c0d12]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        {/* Logo UniBet: al hacer clic siempre vuelve al mercado principal */}
        <button
          type="button"
          onClick={() => onNavigate('EXPLORE')}
          className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90"
          aria-label="Ir a mercados UniBet"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00f090]/20 to-emerald-600/30 text-[#00f090] ring-1 ring-[#00f090]/30 shadow-lg shadow-[#00f090]/10">
            <Flame className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tight text-white">
              Uni<span className="text-[#00f090]">Bet</span>
            </span>
            <span className="hidden sm:inline-block rounded-full bg-[#00f090]/10 px-2 py-0.5 text-[10px] font-bold text-[#00f090]">
              PRO
            </span>
          </div>
        </button>

        {/* Zona Derecha: Saldo, Crear evento y Avatar con menú desplegable */}
        <div className="flex items-center gap-2.5">
          {/* Tarjeta de Saldo con clic directo a Cartera & Movimientos */}
          <button
            type="button"
            onClick={() => onNavigate('ACCOUNT', 'TRANSACTIONS')}
            className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#141822]/80 px-3 py-1.5 transition hover:border-[#2a3244] hover:bg-[#181d29]"
            title="Ver cartera y movimientos"
          >
            <Wallet className="h-4 w-4 text-[#00f090]" />
            <div className="flex flex-col text-left">
              <span className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums">
                ${formatUsdt(profile.balance)}{' '}
                <span className="text-[10px] font-normal text-slate-400">USDT</span>
              </span>
            </div>
          </button>

          {/* Botón Crear Evento (sólo desktop/tablet, en móvil está en la barra inferior) */}
          <button
            type="button"
            onClick={onCreate}
            className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[#00f090] px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] shadow-lg shadow-[#00f090]/15"
          >
            <Plus className="h-4 w-4" />
            <span>Crear evento</span>
          </button>

          {/* Avatar con nombre de la cuenta y menú desplegable (sólo desktop/tablet, en móvil está en la barra inferior) */}
          <div className="relative hidden sm:block" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#141822] p-1.5 pr-2.5 transition hover:border-slate-500 hover:bg-[#1a202c]"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-xs font-black text-slate-950 shadow">
                {profile.username.slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden max-w-[100px] truncate text-xs font-semibold text-white sm:inline">
                @{profile.username}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-2 shadow-2xl shadow-black/90 backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header del dropdown */}
                <div className="border-b border-[#1e2330] p-2.5 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-sm font-black text-slate-950 shadow">
                      {profile.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-white">@{profile.username}</span>
                        {profile.role !== 'USER' && (
                          <span className="rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-400">
                            {profile.role}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-slate-500">{profile.email}</p>
                    </div>
                  </div>
                </div>

                {/* Opciones del menú */}
                <div className="space-y-0.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => handleMenuSelect(() => onNavigate('ACCOUNT', 'BETS'))}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-[#161a24] hover:text-white"
                  >
                    <User className="h-4 w-4 text-[#00f090]" />
                    <span>Mi perfil</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMenuSelect(() => onNavigate('ACCOUNT', 'TRANSACTIONS'))}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-[#161a24] hover:text-white"
                  >
                    <Wallet className="h-4 w-4 text-emerald-400" />
                    <div className="flex flex-1 items-center justify-between">
                      <span>Cartera & Movimientos</span>
                      <span className="font-mono text-[10px] text-slate-500">${formatUsdt(profile.balance)}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMenuSelect(() => onNavigate('ACCOUNT', 'SETTINGS'))}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-[#161a24] hover:text-white"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    <span>Configuraciones</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMenuSelect(() => onOpenGroups?.())}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-white"
                  >
                    <Users className="h-4 w-4 text-sky-400" />
                    <span>Mis Grupos & Privadas</span>
                  </button>

                  {isStaff && (
                    <>
                      <div className="my-1 border-t border-[#1e2330]" />
                      <button
                        type="button"
                        onClick={() => handleMenuSelect(() => onNavigate('MODERATION'))}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-purple-300 transition hover:bg-purple-500/10"
                      >
                        <ShieldCheck className="h-4 w-4 text-purple-400" />
                        <span>Sala de Moderación</span>
                      </button>
                    </>
                  )}

                  {profile.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => handleMenuSelect(() => onNavigate('ADMIN'))}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/10"
                    >
                      <Layers className="h-4 w-4 text-amber-400" />
                      <span>Panel Financiero (Admin)</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-[#1e2330]" />

                  <button
                    type="button"
                    onClick={() => handleMenuSelect(onLogout)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function MobileNav({
  activeTab,
  accountSubTab,
  onNavigate,
  onCreate,
  role,
  username,
}: {
  activeTab: AppTab;
  accountSubTab?: AccountSubTab;
  onNavigate: (tab: AppTab, subTab?: AccountSubTab) => void;
  onCreate: () => void;
  role: Role;
  username?: string;
}) {
  const isStaff = role === 'ADMIN' || role === 'MODERATOR';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 h-16 items-center border-t border-[#1e2330] bg-[#0c0d12]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      {/* 1. Mercados */}
      <button
        type="button"
        onClick={() => onNavigate('EXPLORE')}
        className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition ${
          activeTab === 'EXPLORE' ? 'text-[#00f090]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <TrendingUp className="h-4 w-4" />
        <span>Mercados</span>
      </button>

      {/* 2. Apuestas */}
      <button
        type="button"
        onClick={() => onNavigate('ACCOUNT', 'BETS')}
        className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition ${
          activeTab === 'ACCOUNT' && accountSubTab === 'BETS'
            ? 'text-[#00f090]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Ticket className="h-4 w-4" />
        <span>Apuestas</span>
      </button>

      {/* 3. Botón Central [+] Crear (Centrado exacto en columna 3) */}
      <div className="flex w-full items-center justify-center">
        <button
          type="button"
          onClick={onCreate}
          aria-label="Crear mercado"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00f090] text-slate-950 shadow-lg shadow-[#00f090]/25 active:scale-95 transition-transform"
        >
          <Plus className="h-5 w-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 4. Tab 4 según Rol: Admin / Mod / Billetera */}
      {role === 'ADMIN' ? (
        <button
          type="button"
          onClick={() => onNavigate('ADMIN')}
          className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition ${
            activeTab === 'ADMIN' ? 'text-[#fbbf24]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Admin</span>
        </button>
      ) : role === 'MODERATOR' ? (
        <button
          type="button"
          onClick={() => onNavigate('MODERATION')}
          className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition ${
            activeTab === 'MODERATION' ? 'text-purple-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Mod</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onNavigate('ACCOUNT', 'TRANSACTIONS')}
          className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition ${
            activeTab === 'ACCOUNT' && accountSubTab === 'TRANSACTIONS'
              ? 'text-[#00f090]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Billetera</span>
        </button>
      )}

      {/* 5. Perfil / Cuenta con Avatar del usuario */}
      <button
        type="button"
        onClick={() => onNavigate('ACCOUNT', 'SETTINGS')}
        className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition ${
          activeTab === 'ACCOUNT' && accountSubTab === 'SETTINGS'
            ? 'text-[#00f090]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {username ? (
          <div
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black transition ${
              activeTab === 'ACCOUNT' && accountSubTab === 'SETTINGS'
                ? 'bg-[#00f090] text-slate-950 ring-2 ring-[#00f090]/40 shadow-sm shadow-[#00f090]/30'
                : 'bg-gradient-to-tr from-emerald-500/40 to-teal-400/40 text-emerald-300 ring-1 ring-emerald-500/30'
            }`}
          >
            {username.slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <User className="h-4 w-4" />
        )}
        <span>Perfil</span>
      </button>
    </nav>
  );
}

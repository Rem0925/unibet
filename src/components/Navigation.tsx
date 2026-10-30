'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ChevronDown,
  ChevronRight,
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
  X,
} from 'lucide-react';
import { formatUsdt } from '@/lib/format';
import type { AppTab, UserProfile } from '@/lib/types';

interface NavigationProps {
  profile: UserProfile;
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onCreate: () => void;
  onOpenGroups: () => void;
  onLogout: () => void;
  onOpenDrawer?: () => void;
}

export function Header({
  profile,
  activeTab,
  onNavigate,
  onDeposit,
  onCreate,
  onOpenGroups,
  onLogout,
  onOpenDrawer,
}: NavigationProps) {
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR';

  // Cerrar menú desplegable de PC al hacer clic afuera o pulsar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        desktopMenuRef.current &&
        !desktopMenuRef.current.contains(event.target as Node)
      ) {
        setDesktopMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDesktopMenuOpen(false);
      }
    }

    if (desktopMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [desktopMenuOpen]);

  const handleItemClick = (tab: AppTab) => {
    setDesktopMenuOpen(false);
    onNavigate(tab);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#1e2330] bg-[#0c0d12]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        {/* Logo UniBet */}
        <button
          type="button"
          onClick={() => onNavigate('EXPLORE')}
          className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90 cursor-pointer"
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

        {/* Zona Derecha:
            - En móvil: SOLO el saldo visible.
            - En escritorio: Saldo + Botón Crear evento + Menú de Usuario integrado.
        */}
        <div className="flex items-center gap-2.5">
          {/* Tarjeta de Saldo */}
          <button
            type="button"
            onClick={() => onNavigate('WALLET')}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition cursor-pointer active:scale-95 ${
              activeTab === 'WALLET'
                ? 'border-[#00f090] bg-[#00f090]/10'
                : 'border-[#1e2330] bg-[#141822]/80 hover:border-[#2a3244] hover:bg-[#181d29]'
            }`}
            title="Ver mi saldo y billetera"
          >
            <Wallet className="h-4 w-4 text-[#00f090]" />
            <div className="flex flex-col text-left">
              <span className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums">
                ${formatUsdt(profile.balance)}{' '}
                <span className="text-[10px] font-normal text-slate-400">USDT</span>
              </span>
            </div>
          </button>

          {/* Botón Crear Evento (Solo visible en Desktop) */}
          <button
            type="button"
            onClick={onCreate}
            className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[#00f090] px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] shadow-lg shadow-[#00f090]/15 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Crear evento</span>
          </button>

          {/* MENÚ DE USUARIO INTEGRADO EN MODO ESCRITORIO (Oculto en móvil) */}
          <div ref={desktopMenuRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-slate-300 transition active:scale-95 cursor-pointer ${
                desktopMenuOpen
                  ? 'border-[#00f090]/50 bg-[#1a202c] text-white ring-1 ring-[#00f090]/25'
                  : 'border-[#1e2330] bg-[#141822] hover:border-slate-600 hover:bg-[#181d28] hover:text-white'
              }`}
              aria-label="Abrir menú de usuario"
              aria-expanded={desktopMenuOpen}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-[11px] font-black text-slate-950 shadow">
                {profile.username.slice(0, 1).toUpperCase()}
              </div>
              <span className="font-semibold text-xs text-white max-w-[100px] truncate">
                @{profile.username}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
                  desktopMenuOpen ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>

            {/* Menú Desplegable / Popover Flotante (Desktop) */}
            {desktopMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[#222838] bg-[#0c0d12] p-2.5 shadow-2xl shadow-black ring-1 ring-white/10 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Cabecera del usuario con saldo y rol */}
                <div className="rounded-xl border border-[#1e2330] bg-[#12151c] p-3 mb-2 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-xs font-black text-slate-950 shadow">
                      {profile.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-white">
                          @{profile.username}
                        </span>
                        {profile.role !== 'USER' && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-bold text-amber-400">
                            {profile.role}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-slate-400">{profile.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#1e2330] pt-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-500">Saldo</span>
                      <div className="font-mono text-xs font-bold text-white tabular-nums">
                        ${formatUsdt(profile.balance)} USDT
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopMenuOpen(false);
                        onDeposit();
                      }}
                      className="flex items-center gap-1 rounded-lg bg-[#00f090] px-2 py-1 text-[11px] font-bold text-slate-950 hover:bg-[#00d681] transition cursor-pointer"
                    >
                      <ArrowDownLeft className="h-3 w-3" />
                      <span>Recargar</span>
                    </button>
                  </div>
                </div>

                {/* Enlaces de navegación */}
                <div className="space-y-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => handleItemClick('EXPLORE')}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition cursor-pointer ${
                      activeTab === 'EXPLORE'
                        ? 'bg-[#00f090]/15 text-[#00f090]'
                        : 'text-slate-300 hover:bg-[#151922] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="h-4 w-4" />
                      <span>Explorar Mercados</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleItemClick('BETS')}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition cursor-pointer ${
                      activeTab === 'BETS'
                        ? 'bg-[#00f090]/15 text-[#00f090]'
                        : 'text-slate-300 hover:bg-[#151922] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Ticket className="h-4 w-4" />
                      <span>Mis Apuestas</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleItemClick('WALLET')}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition cursor-pointer ${
                      activeTab === 'WALLET'
                        ? 'bg-[#00f090]/15 text-[#00f090]'
                        : 'text-slate-300 hover:bg-[#151922] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Wallet className="h-4 w-4" />
                      <span>Mi Billetera & Movimientos</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleItemClick('GROUPS')}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition cursor-pointer ${
                      activeTab === 'GROUPS'
                        ? 'bg-[#00f090]/15 text-[#00f090]'
                        : 'text-slate-300 hover:bg-[#151922] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="h-4 w-4" />
                      <span>Comunidad</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleItemClick('PROFILE')}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition cursor-pointer ${
                      activeTab === 'PROFILE'
                        ? 'bg-[#00f090]/15 text-[#00f090]'
                        : 'text-slate-300 hover:bg-[#151922] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="h-4 w-4" />
                      <span>Mi Perfil & Ajustes</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  </button>

                  {/* Panel de administración / moderación */}
                  {isStaff && (
                    <div className="pt-2 border-t border-[#1e2330] mt-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => handleItemClick('MODERATION')}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition cursor-pointer ${
                          activeTab === 'MODERATION'
                            ? 'bg-purple-500/15 text-purple-300'
                            : 'text-purple-300 hover:bg-purple-500/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <ShieldCheck className="h-4 w-4 text-purple-400" />
                          <span>Sala de Moderación</span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                      </button>

                      {profile.role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => handleItemClick('ADMIN')}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition cursor-pointer ${
                            activeTab === 'ADMIN'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'text-amber-300 hover:bg-amber-500/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Layers className="h-4 w-4 text-amber-400" />
                            <span>Panel Financiero</span>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Botón Cerrar Sesión */}
                  <div className="pt-2 border-t border-[#1e2330] mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
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
  profile,
  activeTab,
  onNavigate,
  onCreate,
  onOpenMenu,
}: {
  profile: UserProfile;
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onCreate: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 h-16 items-center border-t border-[#1e2330] bg-[#0c0d12]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      {/* 1. Mercados */}
      <button
        type="button"
        onClick={() => onNavigate('EXPLORE')}
        className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold active:scale-95 transition cursor-pointer ${
          activeTab === 'EXPLORE' ? 'text-[#00f090]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <TrendingUp className="h-4 w-4" />
        <span>Mercados</span>
      </button>

      {/* 2. Apuestas */}
      <button
        type="button"
        onClick={() => onNavigate('BETS')}
        className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold active:scale-95 transition cursor-pointer ${
          activeTab === 'BETS' ? 'text-[#00f090]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Ticket className="h-4 w-4" />
        <span>Apuestas</span>
      </button>

      {/* 3. Botón Central [+] Crear */}
      <div className="flex w-full items-center justify-center">
        <button
          type="button"
          onClick={onCreate}
          aria-label="Crear mercado"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00f090] text-slate-950 shadow-lg shadow-[#00f090]/25 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="h-5 w-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 4. Billetera */}
      <button
        type="button"
        onClick={() => onNavigate('WALLET')}
        className={`flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold active:scale-95 transition cursor-pointer ${
          activeTab === 'WALLET' ? 'text-[#00f090]' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Wallet className="h-4 w-4" />
        <span>Billetera</span>
      </button>

      {/* 5. Avatar del Usuario + Menú Hamburguesa */}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex w-full flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200 active:scale-95 transition cursor-pointer"
        aria-label="Abrir menú de usuario"
      >
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-[10px] font-black text-slate-950 shadow-sm ring-1 ring-emerald-500/50">
          {profile.username.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-slate-300 truncate max-w-[50px]">Menú</span>
      </button>
    </nav>
  );
}

export function MenuDrawer({
  open,
  onClose,
  profile,
  activeTab,
  onNavigate,
  onDeposit,
  onOpenGroups,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onDeposit: () => void;
  onOpenGroups: () => void;
  onLogout: () => void;
}) {
  const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR';

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Fondo oscuro desenfocado con animación fade-in */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Bottom Sheet deslizable con animación suave hacia arriba en móvil */}
      <aside className="relative flex w-full max-w-lg max-h-[88vh] flex-col rounded-t-3xl border-t border-[#1e2330] bg-[#0c0d12] p-5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300 ease-out overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:border sm:max-h-[90vh]">
        {/* Barra superior de arrastre (Handle Bar para móvil) */}
        <div className="mx-auto -mt-1 mb-3 h-1.5 w-12 rounded-full bg-slate-700/60 sm:hidden" />

        {/* Encabezado del menú con botón de cerrar */}
        <div className="flex items-center justify-between border-b border-[#1e2330] pb-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00f090]/15 text-[#00f090]">
              <Flame className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm text-white">Menú Principal</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#141822] hover:text-white transition active:scale-95 cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tarjeta de Usuario y Saldo */}
        <div className="my-3.5 rounded-2xl border border-[#1e2330] bg-[#12151c] p-3.5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-sm font-black text-slate-950 shadow">
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
              <p className="truncate text-[11px] text-slate-400">{profile.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#1e2330] pt-2.5">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Saldo</span>
              <div className="font-mono text-sm font-bold text-white tabular-nums">
                ${formatUsdt(profile.balance)} USDT
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeposit();
              }}
              className="flex items-center gap-1 rounded-lg bg-[#00f090] px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-[#00d681] active:scale-95 transition cursor-pointer"
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>Recargar</span>
            </button>
          </div>
        </div>

        {/* Lista de Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('EXPLORE');
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'EXPLORE'
                ? 'bg-[#00f090]/15 text-[#00f090] ring-1 ring-[#00f090]/30'
                : 'text-slate-300 hover:bg-[#141822] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4" />
              <span>Explorar Mercados</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('BETS');
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'BETS'
                ? 'bg-[#00f090]/15 text-[#00f090] ring-1 ring-[#00f090]/30'
                : 'text-slate-300 hover:bg-[#141822] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Ticket className="h-4 w-4" />
              <span>Mis Apuestas</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('WALLET');
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'WALLET'
                ? 'bg-[#00f090]/15 text-[#00f090] ring-1 ring-[#00f090]/30'
                : 'text-slate-300 hover:bg-[#141822] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Wallet className="h-4 w-4" />
              <span>Mi Billetera & Movimientos</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {/* COMUNIDAD */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('GROUPS');
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'GROUPS'
                ? 'bg-[#00f090]/15 text-[#00f090] ring-1 ring-[#00f090]/30'
                : 'text-slate-300 hover:bg-[#141822] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4" />
              <span>Comunidad</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('PROFILE');
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'PROFILE'
                ? 'bg-[#00f090]/15 text-[#00f090] ring-1 ring-[#00f090]/30'
                : 'text-slate-300 hover:bg-[#141822] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              <span>Mi Perfil & Ajustes</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {/* Opciones Administrativas */}
          {isStaff && (
            <div className="pt-3 border-t border-[#1e2330] mt-3 space-y-1">
              <span className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                Gestión
              </span>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate('MODERATION');
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
                  activeTab === 'MODERATION'
                    ? 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30'
                    : 'text-purple-300 hover:bg-purple-500/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  <span>Sala de Moderación</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              </button>

              {profile.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('ADMIN');
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
                    activeTab === 'ADMIN'
                      ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                      : 'text-amber-300 hover:bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-amber-400" />
                    <span>Panel Financiero (Admin)</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                </button>
              )}
            </div>
          )}
        </nav>

        {/* Pie con Cerrar Sesión */}
        <div className="border-t border-[#1e2330] pt-4 mt-auto">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

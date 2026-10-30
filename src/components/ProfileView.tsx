'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  LogOut,
  Pencil,
  User,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatShortDate } from '@/lib/format';
import type { UserProfile } from '@/lib/types';
import { Spinner } from './ui';

interface ProfileViewProps {
  profile: UserProfile;
  onRefreshProfile: () => Promise<UserProfile>;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'warn' | 'error') => void;
  onExplore: () => void;
}

export function ProfileView({
  profile,
  onRefreshProfile,
  onLogout,
  showToast,
  onExplore,
}: ProfileViewProps) {
  const [newUsername, setNewUsername] = useState(profile.username);
  const [savingUsername, setSavingUsername] = useState(false);
  const [newBinanceUid, setNewBinanceUid] = useState(profile.binanceUid ?? '');
  const [savingBinance, setSavingBinance] = useState(false);

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
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Cabecera con botón Volver a Mercados */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExplore}
          className="flex items-center gap-2 rounded-xl border border-[#1e2330] bg-[#141822] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#00f090] hover:text-white active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#00f090]" />
          <span>Volver a Mercados</span>
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Mi Perfil & Ajustes
        </span>
      </div>

      {/* Tarjeta Principal de Identidad */}
      <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#00f090]/20 to-teal-500/20 text-xl font-black text-[#00f090] ring-1 ring-[#00f090]/40 shadow-lg shadow-[#00f090]/10">
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-bold text-white">@{profile.username}</h2>
                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  {profile.role === 'ADMIN' ? 'ADMINISTRADOR' : profile.role === 'MODERATOR' ? 'MODERADOR' : 'APOSTADOR'}
                </span>
              </div>
              <p className="truncate text-xs text-slate-400 mt-0.5">{profile.email}</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                <Clock className="h-3 w-3" />
                <span>Miembro desde {formatShortDate(profile.createdAt)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 active:scale-95 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Formularios de Configuración */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Cambiar Nombre de Usuario */}
        <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <User className="h-4 w-4 text-[#00f090]" />
            <span>Nombre de usuario</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Tu identificador público visible en las apuestas y en los grupos creados.
          </p>

          <form onSubmit={handleSaveUsername} className="space-y-3">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Ej: satoshi_99"
              className="w-full rounded-xl border border-[#212633] bg-[#141822] px-3.5 py-2.5 text-base sm:text-xs font-semibold text-white focus:border-[#00f090] focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={savingUsername || newUsername.trim() === profile.username}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#00f090] py-2.5 text-xs font-bold text-slate-950 transition hover:bg-[#00d681] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {savingUsername ? <Spinner className="text-black" /> : <Pencil className="h-3.5 w-3.5" />}
              <span>Guardar usuario</span>
            </button>
          </form>
        </div>

        {/* Binance Pay UID */}
        <div className="rounded-2xl border border-[#1e2330] bg-[#0c0d12] p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <CreditCard className="h-4 w-4 text-amber-400" />
            <span>Binance Pay UID</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Identificador numérico de tu app de Binance para recibir pagos y retiros automáticos.
          </p>

          <form onSubmit={handleSaveBinanceUid} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              value={newBinanceUid}
              onChange={(e) => setNewBinanceUid(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Ej: 104865239"
              className="w-full rounded-xl border border-[#212633] bg-[#141822] px-3.5 py-2.5 font-mono text-base sm:text-xs font-bold text-white tabular-nums focus:border-amber-400 focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={savingBinance || newBinanceUid.trim() === (profile.binanceUid ?? '')}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 py-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {savingBinance ? <Spinner className="text-amber-400" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>Vincular Binance UID</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

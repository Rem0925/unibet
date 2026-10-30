'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Flame,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { signInWithGoogle, signInWithMagicLink } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/api-client';
import { Spinner } from './ui';

export function AuthScreen({ configured }: { configured: boolean }) {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  const [loginEmail, setLoginEmail] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regBinanceUid, setRegBinanceUid] = useState('');
  const [regRulesAccepted, setRegRulesAccepted] = useState(true);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);

    try {
      if (tab === 'REGISTER') {
        const cleanUid = regBinanceUid.trim();
        const cleanUser = regUsername.trim();

        if (cleanUid && !/^[0-9]{8,10}$/.test(cleanUid)) {
          throw new Error('El Binance Pay UID debe contener entre 8 y 10 dígitos numéricos.');
        }

        if (cleanUser && !/^[a-zA-Z0-9_]{3,24}$/.test(cleanUser)) {
          throw new Error('El nombre de usuario debe tener entre 3 y 24 caracteres alfanuméricos.');
        }

        if (cleanUid || cleanUser) {
          localStorage.setItem(
            'unibet_pending_registration',
            JSON.stringify({
              binanceUid: cleanUid || undefined,
              username: cleanUser || undefined,
            })
          );
        }
      }

      await signInWithGoogle();
    } catch (googleError) {
      setError(errorMessage(googleError));
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const email = loginEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    try {
      await signInWithMagicLink(email);
      setSentEmail(email);
      setMagicSent(true);
    } catch (loginError) {
      setError(errorMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const email = regEmail.trim();
    const username = regUsername.trim();
    const binanceUid = regBinanceUid.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      setError('El usuario debe tener entre 3 y 24 caracteres (solo letras, números y guiones bajos).');
      return;
    }

    if (!binanceUid) {
      setError('Por favor indica tu Binance Pay UID (8 a 10 dígitos) para recibir tus retiros.');
      return;
    }

    if (!/^[0-9]{8,10}$/.test(binanceUid)) {
      setError('El Binance Pay UID debe ser numérico y contener entre 8 y 10 dígitos.');
      return;
    }

    if (!regRulesAccepted) {
      setError('Debes confirmar los términos para registrarte.');
      return;
    }

    setLoading(true);
    try {
      localStorage.setItem(
        'unibet_pending_registration',
        JSON.stringify({
          binanceUid,
          username: username || undefined,
        })
      );

      await signInWithMagicLink(email, {
        username: username || undefined,
        binance_uid: binanceUid,
      });

      setSentEmail(email);
      setMagicSent(true);
    } catch (regError) {
      setError(errorMessage(regError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#07080c] px-4 py-8 font-sans selection:bg-[#00f090] selection:text-slate-950">
      {/* Luces y ambientación de fondo (Sportsbook atmosphere) */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#00f090]/15 via-emerald-500/5 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-teal-500/10 blur-3xl" />

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Marca UniBet */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00f090] to-emerald-600 text-slate-950 shadow-xl shadow-[#00f090]/25 ring-2 ring-[#00f090]/40">
            <Flame className="h-8 w-8 fill-current" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black tracking-tight text-white">
              Uni<span className="text-[#00f090]">Bet</span>
            </span>
            <span className="rounded-md border border-[#00f090]/30 bg-[#00f090]/10 px-2 py-0.5 text-[11px] font-bold text-[#00f090]">
              USDT
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Plataforma Profesional de Pronósticos & Apuestas Deportivas
          </p>
        </div>

        {/* Tarjeta Principal de Autenticación estilo 1win / Stake */}
        <div className="rounded-3xl border border-[#1e2330] bg-[#0c0d12]/95 p-6 sm:p-8 shadow-2xl shadow-black/90 backdrop-blur-xl">
          {/* Banner de beneficios 1-click */}
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[#00f090]/25 bg-gradient-to-r from-[#00f090]/10 via-[#00f090]/5 to-transparent px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Zap className="h-4 w-4 text-[#00f090]" />
              <span>Cuotas vivas & retiros instantáneos</span>
            </div>
            <span className="rounded-full bg-[#00f090]/20 px-2 py-0.5 text-[10px] font-bold text-[#00f090]">
              0% Fee Retiro
            </span>
          </div>

          {/* Selector de Pestañas: INICIAR SESIÓN / REGISTRO RÁPIDO */}
          <div className="mb-6 flex rounded-2xl border border-[#1e2330] bg-[#141822]/80 p-1">
            <button
              type="button"
              onClick={() => {
                setTab('LOGIN');
                setError(null);
                setMagicSent(false);
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                tab === 'LOGIN'
                  ? 'bg-[#00f090] text-slate-950 shadow-md shadow-[#00f090]/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('REGISTER');
                setError(null);
                setMagicSent(false);
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                tab === 'REGISTER'
                  ? 'bg-[#00f090] text-slate-950 shadow-md shadow-[#00f090]/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Registro Rápido
            </button>
          </div>

          {/* Errores o Avisos */}
          {!configured && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4" />
                Configuración pendiente
              </div>
              Supabase no está configurado en las variables de entorno.
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {magicSent ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00f090]/15 text-[#00f090]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-white">Revisa tu bandeja de entrada</h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Enviamos un enlace de acceso seguro a <strong className="text-white">{sentEmail}</strong>.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Haz clic en el correo para ingresar directamente sin contraseña.
              </p>
              <button
                type="button"
                onClick={() => setMagicSent(false)}
                className="mt-5 text-xs font-bold text-[#00f090] hover:underline"
              >
                Volver o usar otro correo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Botón de Google OAuth */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={!configured || googleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white px-4 py-3 text-xs font-bold text-slate-900 transition hover:bg-slate-100 hover:shadow-lg disabled:opacity-50"
              >
                {googleLoading ? (
                  <Spinner className="text-slate-900" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                {tab === 'LOGIN' ? 'Entrar con Google' : 'Registrarse con Google'}
              </button>

              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <div className="h-px flex-1 bg-[#1e2330]" />
                <span>o con correo</span>
                <div className="h-px flex-1 bg-[#1e2330]" />
              </div>

              {/* Formulario Login */}
              {tab === 'LOGIN' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        placeholder="tu-correo@gmail.com"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-3 pl-10 pr-3.5 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none focus:ring-1 focus:ring-[#00f090]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!configured || loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] shadow-lg shadow-[#00f090]/20 disabled:opacity-50"
                  >
                    {loading ? <Spinner className="text-black" /> : <ArrowRight className="h-4 w-4" />}
                    Entrar a la plataforma
                  </button>
                </form>
              ) : (
                /* Formulario Registro Rápido */
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label htmlFor="reg-email" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Correo electrónico <span className="text-[#00f090]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        value={regEmail}
                        onChange={(event) => setRegEmail(event.target.value)}
                        placeholder="tu-correo@gmail.com"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-user" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Nombre de usuario / Alias <span className="text-slate-500 font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-user"
                        type="text"
                        autoComplete="username"
                        value={regUsername}
                        onChange={(event) => setRegUsername(event.target.value)}
                        placeholder="mi_usuario"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="reg-uid" className="text-xs font-semibold text-slate-300">
                        Binance Pay UID <span className="text-[#00f090]">*</span>
                      </label>
                      <span className="text-[11px] font-mono text-[#00f090]">8 a 10 dígitos</span>
                    </div>
                    <div className="relative">
                      <CreditCard className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-uid"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={regBinanceUid}
                        onChange={(event) => setRegBinanceUid(event.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Ej: 198274635"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-2.5 pl-10 pr-3.5 font-mono text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Tu ID de usuario Binance para recibir ganancias y retiros.
                    </p>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={regRulesAccepted}
                        onChange={(e) => setRegRulesAccepted(e.target.checked)}
                        className="mt-0.5 rounded border-[#222736] bg-[#090a0f] text-[#00f090] focus:ring-0"
                      />
                      <span className="text-xs leading-relaxed text-slate-400">
                        Acepto los términos y confirmo que mi Binance UID es válido.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!configured || loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] shadow-lg shadow-[#00f090]/20 disabled:opacity-50"
                  >
                    {loading ? <Spinner className="text-black" /> : <ArrowRight className="h-4 w-4" />}
                    Completar Registro
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Sellos de confianza estilo Sportsbook abajo */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-[#1e2330] bg-[#0c0d12]/60 p-2.5">
            <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-[#00f090]" />
            <div className="text-[11px] font-bold text-white">Saldos 1:1 USDT</div>
            <div className="text-[10px] text-slate-500">Sin spreads</div>
          </div>
          <div className="rounded-xl border border-[#1e2330] bg-[#0c0d12]/60 p-2.5">
            <Zap className="mx-auto mb-1 h-4 w-4 text-[#00f090]" />
            <div className="text-[11px] font-bold text-white">Binance Pay</div>
            <div className="text-[10px] text-slate-500">Acreditación instantánea</div>
          </div>
          <div className="rounded-xl border border-[#1e2330] bg-[#0c0d12]/60 p-2.5">
            <TrendingUp className="mx-auto mb-1 h-4 w-4 text-[#00f090]" />
            <div className="text-[11px] font-bold text-white">Cuotas Vivas</div>
            <div className="text-[10px] text-slate-500">100% pozo repartido</div>
          </div>
        </div>
      </div>
    </main>
  );
}

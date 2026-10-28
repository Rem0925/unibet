'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Flame,
  Info,
  Mail,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { signInWithGoogle, signInWithMagicLink } from '@/lib/auth';
import { errorMessage } from '@/lib/api-client';
import { Spinner } from './ui';

export function AuthScreen({ configured }: { configured: boolean }) {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  const [loginEmail, setLoginEmail] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regBinanceUid, setRegBinanceUid] = useState('');
  const [regRulesAccepted, setRegRulesAccepted] = useState(false);

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
      setError('Escribe un correo electrónico válido.');
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
      setError('Escribe un correo electrónico válido.');
      return;
    }

    if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      setError('El nombre de usuario debe tener entre 3 y 24 caracteres (solo letras, números y guiones bajos).');
      return;
    }

    if (!binanceUid) {
      setError('Indica tu Binance Pay UID (8 a 10 dígitos) para vincular tus retiros.');
      return;
    }

    if (!/^[0-9]{8,10}$/.test(binanceUid)) {
      setError('El Binance Pay UID debe tener entre 8 y 10 dígitos numéricos.');
      return;
    }

    if (!regRulesAccepted) {
      setError('Debes confirmar que los datos ingresados son correctos para continuar.');
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
    <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4 py-12 font-sans">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Lado izquierdo: Presentación */}
        <section className="flex flex-col justify-between rounded-3xl border border-[#1e2330] bg-[#0c0d12]/90 p-8 sm:p-10 shadow-2xl">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00f090]/15 text-[#00f090]">
                <Flame className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-white">
                  Uni<span className="text-[#00f090]">Bet</span>
                </span>
                <span className="rounded-full border border-[#00f090]/30 bg-[#00f090]/10 px-2 py-0.5 text-[10px] font-bold text-[#00f090]">
                  USDT
                </span>
              </div>
            </div>

            <span className="inline-block rounded-full border border-[#00f090]/20 bg-[#00f090]/10 px-3 py-1 text-xs font-semibold text-[#00f090]">
              Predicciones entre amigos
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight text-white">
              Crea pronósticos.
              <br />
              <span className="text-slate-400">Gana en cuotas dinámicas.</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Plataforma comunitaria de predicciones deportivas y eventos. Recargas y retiras
              directo en USDT con Binance Pay, sin intermediarios bancarios ni cuotas fijas abusivas.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#1e2330] bg-[#141822]/60 p-4">
                <div className="mb-2 inline-flex rounded-xl bg-[#00f090]/10 p-2 text-[#00f090]">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-white">Cuotas dinámicas</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Las cuotas se recalculan en vivo según el total aportado por los participantes.
                </p>
              </div>

              <div className="rounded-2xl border border-[#1e2330] bg-[#141822]/60 p-4">
                <div className="mb-2 inline-flex rounded-xl bg-[#00f090]/10 p-2 text-[#00f090]">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-white">Binance Pay</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Acreditación de saldo instantánea y retiros directos a tu ID de usuario.
                </p>
              </div>

              <div className="rounded-2xl border border-[#1e2330] bg-[#141822]/60 p-4">
                <div className="mb-2 inline-flex rounded-xl bg-[#00f090]/10 p-2 text-[#00f090]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-white">Transparencia</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  El pozo se reparte de forma verificable entre los boletos ganadores.
                </p>
              </div>

              <div className="rounded-2xl border border-[#1e2330] bg-[#141822]/60 p-4">
                <div className="mb-2 inline-flex rounded-xl bg-[#00f090]/10 p-2 text-[#00f090]">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-white">Círculo privado</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Espacio exclusivo para amigos y miembros autorizados de la comunidad.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-xs text-slate-500">
            UniBet opera exclusivamente con saldos en USDT y pagos verificados por Binance.
          </div>
        </section>

        {/* Lado derecho: Formulario */}
        <section className="flex flex-col justify-center rounded-3xl border border-[#1e2330] bg-[#0c0d12]/90 p-8 sm:p-10 shadow-2xl">
          {/* Selector de Pestañas */}
          <div className="mb-6 flex rounded-xl border border-[#1e2330] bg-[#141822]/60 p-1">
            <button
              type="button"
              onClick={() => {
                setTab('LOGIN');
                setError(null);
                setMagicSent(false);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                tab === 'LOGIN'
                  ? 'bg-[#00f090] text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('REGISTER');
                setError(null);
                setMagicSent(false);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                tab === 'REGISTER'
                  ? 'bg-[#00f090] text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <h2 className="text-xl font-bold text-white">
            {tab === 'LOGIN' ? 'Bienvenido a UniBet' : 'Crea tu cuenta'}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {tab === 'LOGIN'
              ? 'Accede con tu cuenta autorizada para ver mercados y pronósticos.'
              : 'Regístrate y vincula tu Binance UID para recibir tus retiros.'}
          </p>

          {!configured ? (
            <div className="mt-4 rounded-xl border border-[#f59e0b]/30 bg-[#181511] p-3 text-xs text-[#fbbf24]">
              <div className="mb-1 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4" />
                Falta configurar Supabase
              </div>
              Añade las variables de entorno de Supabase en tu despliegue.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 p-3 text-xs text-[#fda4af]">
              {error}
            </div>
          ) : null}

          {magicSent ? (
            <div className="mt-6 rounded-2xl border border-[#00f090]/30 bg-[#00f090]/10 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[#00f090]" />
              <p className="text-base font-bold text-white">
                {tab === 'REGISTER' ? '¡Registro iniciado!' : 'Revisa tu correo'}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Enviamos un enlace de acceso seguro a <strong className="text-white">{sentEmail}</strong>.
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Haz clic en el enlace para entrar de inmediato sin necesidad de contraseña.
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
            <>
              {/* Botón de Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={!configured || googleLoading}
                className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
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
                {tab === 'LOGIN' ? 'Continuar con Google' : 'Registrarse con Google'}
              </button>

              <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
                <div className="h-px flex-1 bg-[#1e2330]" />
                <span>o con correo</span>
                <div className="h-px flex-1 bg-[#1e2330]" />
              </div>

              {/* Formulario de INICIAR SESIÓN */}
              {tab === 'LOGIN' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        placeholder="tu-correo@gmail.com"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!configured || loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] disabled:opacity-50"
                  >
                    {loading ? <Spinner className="text-black" /> : <ArrowRight className="h-4 w-4" />}
                    Acceder a UniBet
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label htmlFor="reg-email" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Correo electrónico <span className="text-[#00f090]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        value={regEmail}
                        onChange={(event) => setRegEmail(event.target.value)}
                        placeholder="tu-correo@gmail.com"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-user" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Nombre de usuario <span className="text-slate-500 font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-user"
                        type="text"
                        autoComplete="username"
                        value={regUsername}
                        onChange={(event) => setRegUsername(event.target.value)}
                        placeholder="mi_usuario"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="reg-uid" className="text-xs font-semibold text-slate-300">
                        Binance Pay UID <span className="text-[#00f090]">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500">8 a 10 dígitos</span>
                    </div>
                    <div className="relative">
                      <CreditCard className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-uid"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={regBinanceUid}
                        onChange={(event) => setRegBinanceUid(event.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Ej: 198274635"
                        disabled={!configured || loading}
                        className="w-full rounded-xl border border-[#222736] bg-[#090a0f] py-2.5 pl-10 pr-3.5 font-mono text-sm text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Tu identificador de Binance para transferir tus retiros en USDT.
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
                        Confirmo que mi Binance UID es correcto y acepto operar con saldos en USDT.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!configured || loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00f090] py-3 text-sm font-bold text-slate-950 transition hover:bg-[#00d681] disabled:opacity-50"
                  >
                    {loading ? <Spinner className="text-black" /> : <ArrowRight className="h-4 w-4" />}
                    Crear cuenta
                  </button>
                </form>
              )}
            </>
          )}

          <p className="mt-6 border-t border-[#1e2330] pt-4 text-center text-[11px] text-slate-500">
            Acceso seguro sin contraseñas mediante Google o enlace criptográfico al correo.
          </p>
        </section>
      </div>
    </main>
  );
}

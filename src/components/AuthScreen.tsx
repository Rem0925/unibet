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

  // Estado para Iniciar Sesión
  const [loginEmail, setLoginEmail] = useState('');

  // Estado para Crear Cuenta
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regBinanceUid, setRegBinanceUid] = useState('');
  const [regRulesAccepted, setRegRulesAccepted] = useState(false);

  // Estados de carga y feedback
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
      setError('Por favor indica tu Binance Pay UID (8 a 10 dígitos) para configurar tus retiros en USDT.');
      return;
    }

    if (!/^[0-9]{8,10}$/.test(binanceUid)) {
      setError('El Binance Pay UID debe ser numérico y tener entre 8 y 10 dígitos (búscalo en tu app de Binance).');
      return;
    }

    if (!regRulesAccepted) {
      setError('Debes confirmar que aceptas las reglas del grupo para crear tu cuenta.');
      return;
    }

    setLoading(true);
    try {
      // Guardar localmente para sincronización en caso de redirección en pestaña limpia
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
    <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Banner descriptivo / Terminal Info */}
        <section className="flex flex-col justify-between rounded-lg border border-[#1e2330] bg-[#0e1118] p-6 sm:p-8">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-[#262c3d] bg-[#141822]">
                <Flame className="h-5 w-5 text-[#00f090]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-black uppercase tracking-tight text-white">
                  Uni<span className="text-[#00f090]">Bet</span>
                </span>
                <span className="rounded border border-[#00f090]/30 bg-[#00f090]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-[#00f090]">
                  USDT
                </span>
              </div>
            </div>

            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#00f090]">
              Mercados de predicción entre amigos
            </p>
            <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Apuestas pari-mutuel.
              <br />
              <span className="text-slate-400">Cero casa contra ti.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
              Todo el pozo se reparte entre los ganadores. Recargas con Binance Pay y retiras directo
              a tu UID en USDT. Sin cuotas infladas ni intermediarios bancarios.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Saldos atómicos',
                  text: 'Cada apuesta y retiro se valida en PostgreSQL con bloqueo de filas.',
                },
                {
                  icon: Wallet,
                  title: 'Binance Pay',
                  text: 'Recargas instantáneas y retiros acreditados a tu UID oficial.',
                },
                {
                  icon: TrendingUp,
                  title: 'Cuotas vivas',
                  text: 'El multiplicador se calcula con el dinero real aportado a cada opción.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Círculo cerrado',
                  text: 'Acceso privado para amigos. Sin spreads ocultos de casas tradicionales.',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-md border border-[#1e2330] bg-[#11141c] p-3"
                >
                  <feature.icon className="mb-2 h-4 w-4 text-[#00f090]" />
                  <div className="font-mono text-[11px] font-bold text-white">{feature.title}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded border border-[#f59e0b]/25 bg-[#181511] p-3 font-mono text-[10px] leading-relaxed text-[#fbbf24]">
            Regla del batacazo: si gana una opción que nadie apostó, el 70% va a la Casa y el 30% al
            creador. Multiplicador con tope de 20x.
          </div>
        </section>

        {/* Formulario de Acceso y Registro */}
        <section className="flex flex-col justify-center rounded-lg border border-[#1e2330] bg-[#11141c] p-6 sm:p-8">
          {/* Selector de Pestañas: Iniciar Sesión vs Crear Cuenta */}
          <div className="mb-6 flex border-b border-[#1e2330]">
            <button
              type="button"
              onClick={() => {
                setTab('LOGIN');
                setError(null);
                setMagicSent(false);
              }}
              className={`flex-1 pb-3 text-center font-mono text-xs font-bold uppercase tracking-wider transition ${
                tab === 'LOGIN'
                  ? 'border-b-2 border-[#00f090] text-white'
                  : 'text-slate-500 hover:text-slate-300'
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
              className={`flex-1 pb-3 text-center font-mono text-xs font-bold uppercase tracking-wider transition ${
                tab === 'REGISTER'
                  ? 'border-b-2 border-[#00f090] text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <h2 className="text-lg font-bold text-white">
            {tab === 'LOGIN' ? 'Entrar a la terminal' : 'Registrar nueva cuenta'}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {tab === 'LOGIN'
              ? 'Accede a tu billetera y mercados con tu cuenta activa.'
              : 'Únete a la plataforma y afilia tu Binance Pay para depósitos y retiros.'}
          </p>

          {!configured ? (
            <div className="mt-5 rounded border border-[#f59e0b]/30 bg-[#181511] p-3 text-[11px] leading-relaxed text-[#fbbf24]">
              <div className="mb-1 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Falta configurar Supabase
              </div>
              Añade las variables de entorno de Supabase en tu despliegue.
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded border border-[#f43f5e]/35 bg-[#1f1113] px-3 py-2 text-[11px] text-[#fda4af]">
              {error}
            </div>
          ) : null}

          {magicSent ? (
            <div className="mt-6 rounded border border-[#00f090]/30 bg-[#121f18] p-5 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-[#00f090]" />
              <p className="text-sm font-bold text-white">
                {tab === 'REGISTER' ? '¡Registro casi listo!' : 'Revisa tu correo'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Enviamos un enlace de acceso seguro a <strong className="text-white">{sentEmail}</strong>.
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Haz clic en el enlace del correo para{' '}
                {tab === 'REGISTER' ? 'activar tu cuenta y vincular tu Binance UID' : 'acceder a tu terminal'}.
              </p>
              <button
                type="button"
                onClick={() => setMagicSent(false)}
                className="mt-4 text-[11px] font-bold text-[#00f090] underline underline-offset-4"
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
                className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-white px-4 py-2.5 text-xs font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {googleLoading ? <Spinner /> : null}
                {tab === 'LOGIN' ? 'Continuar con Google' : 'Registrarse con Google'}
              </button>

              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-600">
                <div className="h-px flex-1 bg-[#222736]" />
                {tab === 'LOGIN' ? 'o con enlace por correo' : 'o registro manual'}
                <div className="h-px flex-1 bg-[#222736]" />
              </div>

              {/* Formulario de INICIAR SESIÓN */}
              {tab === 'LOGIN' ? (
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <label htmlFor="login-email" className="block text-[11px] font-bold text-slate-300">
                      Correo electrónico
                    </label>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        placeholder="tu-correo@gmail.com"
                        disabled={!configured || loading}
                        className="w-full rounded border border-[#222736] bg-[#090a0f] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!configured || loading}
                    className="flex w-full items-center justify-center gap-2 rounded border border-[#2d3447] bg-[#161a24] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1e2330] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
                    Entrar a mi terminal
                  </button>
                </form>
              ) : (
                /* Formulario de CREAR CUENTA */
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label htmlFor="reg-email" className="block text-[11px] font-bold text-slate-300">
                      Correo electrónico <span className="text-[#00f090]">*</span>
                    </label>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        value={regEmail}
                        onChange={(event) => setRegEmail(event.target.value)}
                        placeholder="tu-correo@gmail.com"
                        disabled={!configured || loading}
                        className="w-full rounded border border-[#222736] bg-[#090a0f] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-user" className="block text-[11px] font-bold text-slate-300">
                      Nombre de usuario / Alias <span className="text-slate-500 font-normal">(opcional)</span>
                    </label>
                    <div className="relative mt-1">
                      <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-user"
                        type="text"
                        autoComplete="username"
                        value={regUsername}
                        onChange={(event) => setRegUsername(event.target.value)}
                        placeholder="cripto_apuestas"
                        disabled={!configured || loading}
                        className="w-full rounded border border-[#222736] bg-[#090a0f] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="reg-uid" className="block text-[11px] font-bold text-slate-300">
                        Binance Pay UID <span className="text-[#00f090]">*</span>
                      </label>
                      <span className="font-mono text-[9px] text-[#00f090]">
                        8 a 10 dígitos numéricos
                      </span>
                    </div>
                    <div className="relative mt-1">
                      <CreditCard className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input
                        id="reg-uid"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        value={regBinanceUid}
                        onChange={(event) => setRegBinanceUid(event.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Ej: 198274635"
                        disabled={!configured || loading}
                        className="w-full rounded border border-[#222736] bg-[#090a0f] py-2 pl-9 pr-3 font-mono text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                      <Info className="h-3 w-3 shrink-0 text-slate-400" />
                      Tu Binance ID para procesar retiros directos a tu saldo en Binance Pay.
                    </p>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={regRulesAccepted}
                        onChange={(e) => setRegRulesAccepted(e.target.checked)}
                        className="mt-0.5 rounded border-[#222736] bg-[#090a0f] text-[#00f090] focus:ring-0"
                      />
                      <span className="text-[10px] leading-relaxed text-slate-400">
                        Confirmo que mi Binance UID es correcto y acepto operar en USDT bajo las reglas
                        pari-mutuel del grupo.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!configured || loading}
                    className="flex w-full items-center justify-center gap-2 rounded bg-[#00f090] px-4 py-2.5 text-xs font-bold text-black transition hover:bg-[#00d681] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Spinner className="text-black" /> : <ArrowRight className="h-4 w-4" />}
                    Crear cuenta y afiliar Binance
                  </button>
                </form>
              )}
            </>
          )}

          <p className="mt-6 border-t border-[#1e2330] pt-4 text-[10px] leading-relaxed text-slate-600">
            Círculo privado universitario. No usamos contraseñas recuperables: el acceso es validado
            por enlaces criptográficos directos o cuenta autenticada de Google.
          </p>
        </section>
      </div>
    </main>
  );
}

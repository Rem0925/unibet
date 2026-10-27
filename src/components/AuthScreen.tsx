'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flame,
  Mail,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { signInWithGoogle, signInWithMagicLink } from '@/lib/auth';
import { errorMessage } from '@/lib/api-client';
import { Spinner } from './ui';

export function AuthScreen({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (googleError) {
      setError(errorMessage(googleError));
      setGoogleLoading(false);
    }
  };

  const handleMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Escribe un correo electrónico válido.');
      return;
    }

    setMagicLoading(true);
    try {
      await signInWithMagicLink(email);
      setMagicSent(true);
    } catch (magicError) {
      setError(errorMessage(magicError));
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
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
              Todo el pozo se reparte entre los ganadores. Recargas con Binance Pay y retiras a
              tu UID en USDT. Sin cuotas artificiales ni comisiones dentro de los mercados.
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
                  text: 'Recargas al instante y retiros directos a tu UID de Binance.',
                },
                {
                  icon: TrendingUp,
                  title: 'Cuotas vivas',
                  text: 'El multiplicador se calcula con el dinero real de cada opción.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Círculo cerrado',
                  text: 'Solo amigos invitados. La casa nunca arriesga su propio dinero.',
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
            Regla del batacazo: si gana una opción sin apuestas, el pozo se reparte 70% para la
            casa y 30% para el creador del mercado. Apuesta con responsabilidad: el saldo es
            dinero real.
          </div>
        </section>

        <section className="flex flex-col justify-center rounded-lg border border-[#1e2330] bg-[#11141c] p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white">Entrar a la terminal</h2>
          <p className="mt-1 text-xs text-slate-400">
            Usa tu cuenta de Google o recibe un enlace mágico por correo.
          </p>

          {!configured ? (
            <div className="mt-5 rounded border border-[#f59e0b]/30 bg-[#181511] p-3 text-[11px] leading-relaxed text-[#fbbf24]">
              <div className="mb-1 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Falta configurar Supabase
              </div>
              Añade <code className="text-white">NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
              <code className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en{' '}
              <code className="text-white">.env.local</code> y reinicia el servidor.
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded border border-[#f43f5e]/35 bg-[#1f1113] px-3 py-2 text-[11px] text-[#fda4af]">
              {error}
            </div>
          ) : null}

          {magicSent ? (
            <div className="mt-6 rounded border border-[#00f090]/30 bg-[#121f18] p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-[#00f090]" />
              <p className="text-sm font-bold text-white">Revisa tu correo</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Enviamos un enlace de acceso a <strong className="text-white">{email}</strong>.
                Ábrelo en este mismo navegador.
              </p>
              <button
                type="button"
                onClick={() => setMagicSent(false)}
                className="mt-3 text-[11px] font-bold text-[#00f090] underline underline-offset-4"
              >
                Usar otro correo
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={!configured || googleLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-white px-4 py-2.5 text-xs font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {googleLoading ? <Spinner /> : null}
                Continuar con Google
              </button>

              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-600">
                <div className="h-px flex-1 bg-[#222736]" />
                o con enlace mágico
                <div className="h-px flex-1 bg-[#222736]" />
              </div>

              <form onSubmit={handleMagicLink} className="space-y-2">
                <label htmlFor="email" className="block text-[11px] font-bold text-slate-300">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu-correo@gmail.com"
                    disabled={!configured || magicLoading}
                    className="w-full rounded border border-[#222736] bg-[#090a0f] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:border-[#00f090] focus:outline-none disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!configured || magicLoading}
                  className="flex w-full items-center justify-center gap-2 rounded border border-[#2d3447] bg-[#161a24] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1e2330] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {magicLoading ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
                  Enviarme el enlace
                </button>
              </form>
            </>
          )}

          <p className="mt-6 border-t border-[#1e2330] pt-4 text-[10px] leading-relaxed text-slate-600">
            Al entrar aceptas las reglas del grupo: los depósitos se hacen en USDT y las
            decisiones de moderación son registradas en auditoría. No hay recuperación de
            contraseñas porque no usamos contraseñas.
          </p>
        </section>
      </div>
    </main>
  );
}

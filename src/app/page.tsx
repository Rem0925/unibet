'use client';

import { AlertTriangle, Flame, RefreshCw } from 'lucide-react';
import { AuthScreen } from '@/components/AuthScreen';
import { Terminal } from '@/components/Terminal';
import { Spinner } from '@/components/ui';
import { useSession } from '@/hooks/useSession';

export default function HomePage() {
  const {
    session,
    profile,
    initializing,
    profileLoading,
    error,
    refreshProfile,
    logout,
    configured,
  } = useSession();

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded border border-[#262c3d] bg-[#141822]">
            <Flame className="h-5 w-5 animate-pulse text-[#00f090]" />
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <Spinner className="h-3.5 w-3.5" /> Iniciando terminal…
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return <AuthScreen configured={configured} />;
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4">
        <div className="w-full max-w-md rounded-lg border border-[#1e2330] bg-[#11141c] p-5 text-center">
          {profileLoading ? (
            <>
              <Spinner className="mx-auto h-6 w-6 text-[#00f090]" />
              <h1 className="mt-3 text-sm font-bold text-white">Preparando tu cuenta</h1>
              <p className="mt-1 text-[11px] text-slate-400">
                Sincronizando tu perfil y tu billetera…
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="mx-auto h-6 w-6 text-[#f59e0b]" />
              <h1 className="mt-3 text-sm font-bold text-white">No se pudo cargar tu cuenta</h1>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                {error ?? 'Revisa tu conexión e inténtalo de nuevo.'}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center gap-1.5 rounded bg-[#00f090] py-2 text-xs font-bold text-black transition hover:bg-[#00d681]"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded border border-[#2d3447] bg-[#161a24] py-2 text-xs font-bold text-white transition hover:bg-[#1e2330]"
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <Terminal
      key={profile.id}
      profile={profile}
      refreshProfile={refreshProfile}
      onLogout={() => void logout()}
    />
  );
}

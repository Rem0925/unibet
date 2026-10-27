import { isSupabaseConfigured, supabase } from './supabase';

function requireConfiguration() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase no está configurado. Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.'
    );
  }
}

function redirectUrl() {
  return typeof window === 'undefined' ? undefined : window.location.origin;
}

export async function signInWithGoogle() {
  requireConfiguration();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl(),
    },
  });

  if (error) throw new Error(`No se pudo iniciar sesión con Google: ${error.message}`);
  return data;
}

export async function signInWithMagicLink(
  email: string,
  metadata?: { username?: string; binance_uid?: string }
) {
  requireConfiguration();
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: redirectUrl(),
      shouldCreateUser: true,
      data: metadata,
    },
  });

  if (error) throw new Error(`No se pudo enviar el enlace: ${error.message}`);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`No se pudo cerrar sesión: ${error.message}`);
}

export { isSupabaseConfigured };

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;
let authClient: SupabaseClient | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa .env.example y la configuración del despliegue.`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
}

export function getServiceSupabase(): SupabaseClient {
  if (serviceClient) return serviceClient;

  serviceClient = createClient(getSupabaseUrl(), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'unibet-server',
      },
    },
  });

  return serviceClient;
}

export function getAuthSupabase(): SupabaseClient {
  if (authClient) return authClient;

  authClient = createClient(getSupabaseUrl(), requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return authClient;
}

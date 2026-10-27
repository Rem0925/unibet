import type { User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { Role, UserProfile } from '@/lib/types';
import { ApiError } from './http';
import { getAuthSupabase, getServiceSupabase } from './supabase';

interface UserRow {
  id: string;
  username: string;
  email: string;
  binance_uid: string | null;
  balance: string | number;
  role: Role;
  is_banned: boolean;
  created_at: string;
}

export function mapProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    binanceUid: row.binance_uid,
    balance: String(row.balance),
    role: row.role,
    isBanned: row.is_banned,
    createdAt: row.created_at,
  };
}

function normalizeUsernameBase(email: string | undefined, fullName: string | undefined, id: string): string {
  const source = (email?.split('@')[0] || fullName || `user_${id.slice(0, 6)}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 24);

  if (source.length >= 3) return source;
  return `user_${id.replace(/-/g, '').slice(0, 8)}`;
}

async function findProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await getServiceSupabase()
    .from('users')
    .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer el perfil: ${error.message}`);
  }

  return data ? mapProfile(data as UserRow) : null;
}

export interface ProfileOptions {
  username?: string;
  binanceUid?: string;
}

export async function ensureProfile(user: User, options?: ProfileOptions): Promise<UserProfile> {
  const existing = await findProfile(user.id);
  const email = user.email ?? `${user.id}@users.local`;
  const isAdmin = email.toLowerCase().includes('remdev2509');

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (isAdmin && existing.role !== 'ADMIN') {
      updates.role = 'ADMIN';
    }
    const desiredBinance =
      options?.binanceUid ??
      (typeof user.user_metadata?.binance_uid === 'string' ? user.user_metadata.binance_uid : undefined);
    if (desiredBinance && /^[0-9]{8,10}$/.test(desiredBinance) && !existing.binanceUid) {
      updates.binance_uid = desiredBinance;
    }

    if (Object.keys(updates).length > 0) {
      const { data } = await getServiceSupabase()
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
        .single();
      if (data) return mapProfile(data as UserRow);
    }

    return existing;
  }

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : undefined;
  const rawRequestedUsername =
    options?.username ??
    (typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : undefined);
  const base =
    rawRequestedUsername && /^[a-zA-Z0-9_]{3,24}$/.test(rawRequestedUsername)
      ? rawRequestedUsername
      : normalizeUsernameBase(user.email, fullName, user.id);

  const desiredBinance =
    options?.binanceUid ??
    (typeof user.user_metadata?.binance_uid === 'string' ? user.user_metadata.binance_uid : undefined);
  const binanceUid =
    desiredBinance && /^[0-9]{8,10}$/.test(desiredBinance) ? desiredBinance : null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const username = attempt === 0 ? base : `${base}_${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;

    const { data, error } = await getServiceSupabase()
      .from('users')
      .insert({
        id: user.id,
        username,
        email,
        role: isAdmin ? 'ADMIN' : 'USER',
        balance: 0,
        binance_uid: binanceUid,
      })
      .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
      .single();

    if (!error && data) return mapProfile(data as UserRow);

    if (error?.code === '23505') {
      const byId = await findProfile(user.id);
      if (byId) return byId;

      const { data: byEmail } = await getServiceSupabase()
        .from('users')
        .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
        .eq('email', email)
        .maybeSingle();
      if (byEmail) return mapProfile(byEmail as UserRow);
      continue;
    }

    throw new Error(`No se pudo crear el perfil: ${error?.message ?? 'error desconocido'}`);
  }

  throw new Error('No se pudo generar un nombre de usuario único para la cuenta.');
}

async function getTokenUser(request: NextRequest): Promise<User | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice('Bearer '.length).trim();
  if (!token || token.length > 4096) return null;

  const { data, error } = await getAuthSupabase().auth.getUser(token);
  if (error) return null;
  return data.user;
}

export interface AuthenticatedUser {
  user: User;
  profile: UserProfile;
}

export async function requireUser(
  request: NextRequest,
  options?: ProfileOptions
): Promise<AuthenticatedUser> {
  const user = await getTokenUser(request);
  if (!user) {
    throw new ApiError('Debes iniciar sesión para continuar', 401, 'UNAUTHENTICATED');
  }

  const profile = await ensureProfile(user, options);

  if (profile.isBanned) {
    throw new ApiError(
      'Tu cuenta está suspendida. Contacta al administrador para más información.',
      403,
      'ACCOUNT_BANNED'
    );
  }

  return { user, profile };
}

export async function requireRole(
  request: NextRequest,
  roles: readonly Role[]
): Promise<AuthenticatedUser> {
  const authenticated = await requireUser(request);
  if (!roles.includes(authenticated.profile.role)) {
    throw new ApiError('No tienes permisos para realizar esta acción', 403, 'FORBIDDEN');
  }
  return authenticated;
}

import { NextResponse, type NextRequest } from 'next/server';
import { mapProfile, requireUser } from '@/lib/server/auth';
import { logAudit } from '@/lib/server/audit';
import { ApiError, jsonError } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, profile } = await requireUser(request);
    enforceRateLimit(`me-patch:${profile.id}`, 10, 60_000);

    const body = (await request.json()) as { binanceUid?: string; username?: string };
    const updates: Record<string, unknown> = {};

    if (typeof body.binanceUid === 'string') {
      const cleanUid = body.binanceUid.trim();
      if (!/^[0-9]{8,10}$/.test(cleanUid)) {
        throw new ApiError(
          'El Binance Pay UID debe contener entre 8 y 10 dígitos numéricos.',
          400,
          'INVALID_BINANCE_UID'
        );
      }
      updates.binance_uid = cleanUid;
    }

    if (typeof body.username === 'string') {
      const cleanUsername = body.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanUsername)) {
        throw new ApiError(
          'El nombre de usuario debe tener entre 3 y 24 caracteres alfanuméricos.',
          400,
          'INVALID_USERNAME'
        );
      }

      const { data: existingUser } = await getServiceSupabase()
        .from('users')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (existingUser) {
        throw new ApiError('Este nombre de usuario ya está registrado.', 400, 'USERNAME_TAKEN');
      }
      updates.username = cleanUsername;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ profile });
    }

    const { data, error } = await getServiceSupabase()
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
      .single();

    if (error || !data) {
      throw new ApiError('No se pudo actualizar el perfil', 500, 'PROFILE_UPDATE_FAILED');
    }

    await logAudit({
      actorId: user.id,
      action: 'USER_PROFILE_UPDATED',
      metadata: { previous: { username: profile.username }, updates },
    });

    return NextResponse.json({ profile: mapProfile(data) });
  } catch (error) {
    return jsonError(error);
  }
}

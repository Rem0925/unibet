import { NextResponse, type NextRequest } from 'next/server';
import { AdminUpdateUserSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { mapUserProfile, type ProfileRow } from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function PATCH(request: NextRequest) {
  try {
    const { profile } = await requireRole(request, ['ADMIN']);
    enforceRateLimit(`admin-users:${profile.id}`, 60, 60_000);

    const { userId, role, isBanned } = await parseBody(request, AdminUpdateUserSchema);
    const supabase = getServiceSupabase();

    const { data: before } = await supabase
      .from('users')
      .select('id, username, role, is_banned')
      .eq('id', userId)
      .maybeSingle();

    const { data, error } = await supabase.rpc('fn_admin_update_user', {
      p_admin_id: profile.id,
      p_user_id: userId,
      p_role: role ?? null,
      p_is_banned: isBanned ?? null,
    });

    if (error) {
      throwRpcError(error, 'No se pudo actualizar el usuario');
    }

    const { data: updatedData, error: updatedError } = await supabase
      .from('users')
      .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
      .eq('id', userId)
      .single();

    if (updatedError || !updatedData) {
      throw new Error('El usuario se actualizó, pero no se pudo recargar su perfil');
    }

    await logAudit({
      actorId: profile.id,
      action: 'ADMIN_USER_UPDATED',
      targetUserId: userId,
      metadata: {
        before,
        after: { role: role ?? null, isBanned: isBanned ?? null },
        rpcResult: data,
      },
    });

    return NextResponse.json({
      success: true,
      profile: mapUserProfile(updatedData as ProfileRow),
    });
  } catch (error) {
    return jsonError(error);
  }
}

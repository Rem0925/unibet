import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';
import { z } from 'zod';

const ManageMemberSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT', 'REMOVE']),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireUser(request);
    const { id: groupId } = await context.params;

    enforceRateLimit(`group-members:${profile.id}`, 60, 60_000);
    const supabase = getServiceSupabase();

    // Verificar si el usuario es miembro aprobado o creador del grupo
    const { data: userMembership } = await supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', profile.id)
      .single();

    if (!userMembership && profile.role !== 'ADMIN') {
      throw new Error('No tienes acceso para ver los miembros de este grupo');
    }

    const isCreatorOrAdmin =
      userMembership?.role === 'CREATOR' ||
      userMembership?.role === 'ADMIN' ||
      profile.role === 'ADMIN';

    // Si es creador/admin, ve todos (incluso PENDING). Si es miembro regular, solo APPROVED.
    let query = supabase
      .from('group_members')
      .select('id, group_id, user_id, role, status, requested_at, approved_at')
      .eq('group_id', groupId);

    if (!isCreatorOrAdmin) {
      query = query.eq('status', 'APPROVED');
    }

    const { data: memberRows, error: membersError } = await query.order('requested_at', {
      ascending: true,
    });

    if (membersError) {
      console.error('[groups] Error cargando miembros:', membersError);
      throw new Error('No se pudieron obtener los miembros');
    }

    const members = memberRows ?? [];
    const userIds = members.map((m) => m.user_id);

    const { data: usersData } = await supabase
      .from('users')
      .select('id, username')
      .in('id', userIds);

    const userMap = new Map<string, string>();
    for (const u of usersData ?? []) {
      userMap.set(u.id, u.username);
    }

    const result = members.map((m) => ({
      id: m.id,
      groupId: m.group_id,
      userId: m.user_id,
      username: userMap.get(m.user_id) ?? 'usuario',
      role: m.role,
      status: m.status,
      requestedAt: m.requested_at,
      approvedAt: m.approved_at,
    }));

    return NextResponse.json({
      members: result,
      isCreator: isCreatorOrAdmin,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireUser(request);
    const { id: groupId } = await context.params;

    enforceRateLimit(`group-manage:${profile.id}`, 30, 60_000);

    const { targetUserId, action } = await parseBody(request, ManageMemberSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_manage_group_member', {
      p_admin_user_id: profile.id,
      p_group_id: groupId,
      p_target_user_id: targetUserId,
      p_action: action,
    });

    if (error) {
      console.error('[groups] Error en fn_manage_group_member:', error);
      throw new Error(error.message || 'No se pudo actualizar el estado del miembro');
    }

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

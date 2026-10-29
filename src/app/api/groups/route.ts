import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';
import { z } from 'zod';

const CreateGroupSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(60, 'El nombre no puede exceder 60 caracteres'),
  description: z.string().trim().max(300, 'La descripción no puede superar 300 caracteres').optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`groups-list:${profile.id}`, 60, 60_000);

    const supabase = getServiceSupabase();

    // 1. Obtener los IDs de grupos a los que pertenece el usuario
    const { data: userMemberships, error: memError } = await supabase
      .from('group_members')
      .select('group_id, role, status')
      .eq('user_id', profile.id);

    if (memError) {
      console.error('[groups] Error leyendo membresías:', memError);
      throw new Error('No se pudieron cargar tus grupos');
    }

    const memberships = userMemberships ?? [];
    if (memberships.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const groupIds = memberships.map((m) => m.group_id);

    // 2. Cargar datos de los grupos
    const [{ data: groupsData, error: grpError }, { data: allMembers, error: countError }] = await Promise.all([
      supabase
        .from('groups')
        .select('id, name, description, creator_id, invite_code, is_active, created_at')
        .in('id', groupIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('group_members')
        .select('group_id, status')
        .in('group_id', groupIds)
        .eq('status', 'APPROVED'),
    ]);

    if (grpError) {
      console.error('[groups] Error leyendo grupos:', grpError);
      throw new Error('No se pudieron obtener los datos de grupos');
    }

    // Contar miembros aprobados por grupo
    const counts = new Map<string, number>();
    for (const m of allMembers ?? []) {
      counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
    }

    const memMap = new Map<string, { role: string; status: string }>();
    for (const m of memberships) {
      memMap.set(m.group_id, { role: m.role, status: m.status });
    }

    const groups = (groupsData ?? []).map((g) => {
      const userMem = memMap.get(g.id);
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        creatorId: g.creator_id,
        inviteCode: g.invite_code,
        memberCount: counts.get(g.id) ?? 1,
        userRole: userMem?.role ?? 'MEMBER',
        userStatus: userMem?.status ?? 'APPROVED',
        createdAt: g.created_at,
      };
    });

    return NextResponse.json({ groups });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`group-create:${profile.id}`, 5, 60 * 60_000);

    const { name, description } = await parseBody(request, CreateGroupSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_create_group', {
      p_creator_id: profile.id,
      p_name: name,
      p_description: description ?? null,
    });

    if (error) {
      console.error('[groups] Error en fn_create_group:', error);
      throw new Error(error.message || 'No se pudo crear el grupo');
    }

    const result = data as { success: boolean; group: unknown };
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';
import { z } from 'zod';

const JoinGroupSchema = z.object({
  inviteCode: z.string().trim().min(3, 'Código de invitación inválido').max(16, 'Código demasiado largo'),
});

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`group-join:${profile.id}`, 10, 60_000);

    const { inviteCode } = await parseBody(request, JoinGroupSchema);

    const { data, error } = await getServiceSupabase().rpc('fn_request_join_group', {
      p_user_id: profile.id,
      p_invite_code: inviteCode,
    });

    if (error) {
      console.error('[groups] Error en fn_request_join_group:', error);
      throw new Error(error.message || 'No se pudo procesar la solicitud de unión');
    }

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

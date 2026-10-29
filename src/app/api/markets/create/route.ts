import { NextResponse, type NextRequest } from 'next/server';
import { CreateMarketSchema } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';
import { notifyNewMarket } from '@/lib/server/telegram';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`market-create:${profile.id}`, 10, 60 * 60_000);

    const {
      title,
      description,
      resolutionSource,
      category,
      options,
      closeTime,
      visibility,
      groupId,
      accessCode,
    } = await parseBody(request, CreateMarketSchema);

    const supabase = getServiceSupabase();
    let finalGroupId: string | null = null;
    let finalAccessCode: string | null = null;

    if (visibility === 'GROUP') {
      if (!groupId) {
        throw new Error('Debes seleccionar un grupo para publicar esta apuesta');
      }
      const { data: member } = await supabase
        .from('group_members')
        .select('id, status')
        .eq('group_id', groupId)
        .eq('user_id', profile.id)
        .eq('status', 'APPROVED')
        .single();

      if (!member) {
        throw new Error('No eres miembro aprobado de este grupo para publicar apuestas');
      }
      finalGroupId = groupId;
    } else if (visibility === 'PRIVATE_CODE') {
      finalAccessCode =
        accessCode && accessCode.trim().length >= 4
          ? accessCode.trim().toUpperCase()
          : 'UB-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const { data, error } = await supabase
      .from('markets')
      .insert({
        creator_id: profile.id,
        title,
        description: description ?? null,
        resolution_source: resolutionSource ?? null,
        category,
        visibility: visibility ?? 'PUBLIC',
        group_id: finalGroupId,
        access_code: finalAccessCode,
        options,
        close_time: closeTime,
        status: 'OPEN',
        total_pool: 0,
        is_official: profile.role === 'ADMIN' || profile.role === 'MODERATOR',
      })
      .select('id, title, close_time, status, visibility, group_id, access_code')
      .single();

    if (error) {
      console.error('[markets] Error creando mercado:', error);
      throw new Error('No se pudo crear el mercado');
    }

    // Solo notificar en Telegram mercados públicos
    if ((visibility ?? 'PUBLIC') === 'PUBLIC') {
      notifyNewMarket({
        title,
        creator: profile.username,
        category,
        options,
        closeTime,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: 'Mercado creado exitosamente',
      market: data,
    });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { CreateMarketSchema } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`market-create:${profile.id}`, 10, 60 * 60_000);

    const { title, description, resolutionSource, category, options, closeTime } = await parseBody(
      request,
      CreateMarketSchema
    );

    const { data, error } = await getServiceSupabase()
      .from('markets')
      .insert({
        creator_id: profile.id,
        title,
        description: description ?? null,
        resolution_source: resolutionSource ?? null,
        category,
        options,
        close_time: closeTime,
        status: 'OPEN',
        total_pool: 0,
        is_official: profile.role === 'ADMIN' || profile.role === 'MODERATOR',
      })
      .select('id, title, close_time, status')
      .single();

    if (error) {
      console.error('[markets] Error creando mercado:', error);
      throw new Error('No se pudo crear el mercado');
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

import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import { mapTransaction, type TransactionRow } from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`transactions-mine:${profile.id}`, 60, 60_000);

    const { data, error } = await getServiceSupabase()
      .from('transactions')
      .select('id, user_id, type, amount, status, reference_id, metadata, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[transactions] Error leyendo movimientos:', error);
      throw new Error('No se pudieron cargar tus movimientos');
    }

    const transactions = ((data ?? []) as TransactionRow[]).map((row) =>
      mapTransaction(row, profile.username)
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    return jsonError(error);
  }
}

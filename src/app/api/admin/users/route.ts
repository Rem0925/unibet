import { NextResponse, type NextRequest } from 'next/server';
import { AdminUpdateUserSchema } from '@/lib/security';
import { logAudit } from '@/lib/server/audit';
import { requireRole } from '@/lib/server/auth';
import { jsonError, parseBody } from '@/lib/server/http';
import {
  asBetStatus,
  asMarketStatus,
  mapTransaction,
  mapUserProfile,
  type ProfileRow,
  type TransactionRow,
} from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { throwRpcError } from '@/lib/server/rpc';
import { getServiceSupabase } from '@/lib/server/supabase';
import type { BetRecord } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { profile: adminProfile } = await requireRole(request, ['ADMIN']);
    enforceRateLimit(`admin-users-get:${adminProfile.id}`, 60, 60_000);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const supabase = getServiceSupabase();

    if (userId) {
      // Fetch single user details + transactions + bets
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        throw new Error('Usuario no encontrado');
      }

      const user = mapUserProfile(userData as ProfileRow);

      const [txResult, betResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, user_id, type, amount, status, reference_id, metadata, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('bets')
          .select('id, market_id, selected_option, amount, payout_amount, status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const transactions = (txResult.data ?? []).map((row) =>
        mapTransaction(row as TransactionRow, user.username)
      );

      const rawBets = (betResult.data ?? []) as Array<{
        id: string;
        market_id: string;
        selected_option: string;
        amount: string | number;
        payout_amount: string | number;
        status: string;
        created_at: string;
      }>;

      const marketIds = [...new Set(rawBets.map((b) => b.market_id))];
      const { data: marketData } = marketIds.length
        ? await supabase
            .from('markets')
            .select('id, title, status, winning_option, close_time')
            .in('id', marketIds)
        : { data: [] };

      const marketMap = new Map<string, { title: string; status: string; winning_option: string | null; close_time: string }>();
      for (const m of (marketData ?? []) as Array<{ id: string; title: string; status: string; winning_option: string | null; close_time: string }>) {
        marketMap.set(m.id, m);
      }

      const bets: BetRecord[] = rawBets.map((b) => {
        const m = marketMap.get(b.market_id);
        return {
          id: b.id,
          marketId: b.market_id,
          marketTitle: m?.title ?? 'Mercado desconocido',
          marketStatus: asMarketStatus(m?.status ?? 'CLOSED'),
          winningOption: m?.winning_option ?? null,
          closeTime: m?.close_time ?? b.created_at,
          selectedOption: b.selected_option,
          amount: String(b.amount),
          payoutAmount: String(b.payout_amount ?? 0),
          status: asBetStatus(b.status),
          createdAt: b.created_at,
        };
      });

      return NextResponse.json({
        success: true,
        user,
        transactions,
        bets,
      });
    }

    // Default: fetch all users
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, username, email, binance_uid, balance, role, is_banned, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (usersError) {
      throw new Error('No se pudieron obtener los usuarios');
    }

    const users = (usersData ?? []).map((u) => mapUserProfile(u as ProfileRow));
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return jsonError(error);
  }
}

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

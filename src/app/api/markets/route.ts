import { NextResponse, type NextRequest } from 'next/server';
import { calculatePariMutuelOddsFromPools } from '@/lib/odds';
import type { MarketSummary, MarketVisibility } from '@/lib/types';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import { asMarketCategory, asMarketStatus, asStringArray } from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';

interface MarketRow {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  resolution_source: string | null;
  category: string;
  visibility?: string | null;
  group_id?: string | null;
  access_code?: string | null;
  options: unknown;
  close_time: string;
  status: string;
  winning_option: string | null;
  cancelled_reason: string | null;
  is_official: boolean;
  total_pool: string | number;
  created_at: string;
}

interface PoolRow {
  market_id: string;
  selected_option: string;
  pool: string | number;
  active_pool: string | number;
  active_bet_count: number;
  bet_count: number;
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`markets:${profile.id}`, 120, 60_000);

    const supabase = getServiceSupabase();
    const searchParams = request.nextUrl.searchParams;
    const requestedCode = searchParams.get('code')?.trim().toUpperCase();

    // 1. Obtener membresías aprobadas del usuario y apuestas activas para filtrar visibilidad
    const [{ data: userMemberships }, { data: userBets }] = await Promise.all([
      supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', profile.id)
        .eq('status', 'APPROVED'),
      supabase.from('bets').select('market_id').eq('user_id', profile.id),
    ]);

    const approvedGroupIds = new Set(
      (userMemberships ?? []).map((m: { group_id: string }) => m.group_id)
    );
    const userBetMarketIds = new Set(
      (userBets ?? []).map((b: { market_id: string }) => b.market_id)
    );

    // 2. Cargar mercados
    const { data: marketData, error: marketError } = await supabase
      .from('markets')
      .select(
        'id, creator_id, title, description, resolution_source, category, visibility, group_id, access_code, options, close_time, status, winning_option, cancelled_reason, is_official, total_pool, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(250);

    if (marketError) {
      console.error('[markets] Error leyendo mercados:', marketError);
      throw new Error('No se pudieron cargar los mercados');
    }

    const allMarkets = (marketData ?? []) as MarketRow[];

    // 3. Filtrar según visibilidad
    const markets = allMarkets.filter((market) => {
      const vis = (market.visibility ?? 'PUBLIC') as MarketVisibility;

      // Admin global ve todo
      if (profile.role === 'ADMIN') return true;

      // Creador del mercado siempre ve su mercado
      if (market.creator_id === profile.id) return true;

      // Mercados públicos los ve todo el mundo
      if (vis === 'PUBLIC') return true;

      // Mercados de grupo: solo miembros aprobados
      if (vis === 'GROUP' && market.group_id) {
        return approvedGroupIds.has(market.group_id);
      }

      // Mercados privados con código:
      if (vis === 'PRIVATE_CODE') {
        // Si el usuario ya apostó en él, lo ve
        if (userBetMarketIds.has(market.id)) return true;
        // Si proporcionó el código correcto en la URL, lo ve
        if (requestedCode && market.access_code && requestedCode === market.access_code.toUpperCase()) {
          return true;
        }
        // Si es moderador y el mercado está cerrado o pendiente de resolución
        if (profile.role === 'MODERATOR' && market.status !== 'OPEN') return true;
        return false;
      }

      return false;
    });

    if (markets.length === 0) {
      return NextResponse.json({ markets: [], serverTime: new Date().toISOString() });
    }

    const marketIds = markets.map((market) => market.id);
    const creatorIds = [...new Set(markets.map((market) => market.creator_id))];
    const groupIds = [
      ...new Set(
        markets.map((m) => m.group_id).filter((g): g is string => Boolean(g))
      ),
    ];

    const [{ data: creatorData }, { data: poolData }, { data: groupsData }] =
      await Promise.all([
        supabase.from('users').select('id, username').in('id', creatorIds),
        supabase
          .from('market_option_pools')
          .select('market_id, selected_option, pool, active_pool, active_bet_count, bet_count')
          .in('market_id', marketIds),
        groupIds.length > 0
          ? supabase.from('groups').select('id, name').in('id', groupIds)
          : Promise.resolve({ data: [] }),
      ]);

    const creatorNames = new Map<string, string>();
    for (const creator of (creatorData ?? []) as Array<{ id: string; username: string }>) {
      creatorNames.set(creator.id, creator.username);
    }

    const groupNames = new Map<string, string>();
    for (const grp of (groupsData ?? []) as Array<{ id: string; name: string }>) {
      groupNames.set(grp.id, grp.name);
    }

    const poolsByMarket = new Map<string, PoolRow[]>();
    for (const row of (poolData ?? []) as PoolRow[]) {
      const list = poolsByMarket.get(row.market_id) ?? [];
      list.push(row);
      poolsByMarket.set(row.market_id, list);
    }

    const result: MarketSummary[] = markets.map((market) => {
      const options = asStringArray(market.options);
      const poolRows = poolsByMarket.get(market.id) ?? [];
      const optionPools: Record<string, string> = {};
      const optionBetCounts: Record<string, number> = {};
      let betCount = 0;

      for (const option of options) {
        const row = poolRows.find((item) => item.selected_option === option);
        optionPools[option] = row ? String(row.pool) : '0';
        optionBetCounts[option] = row ? row.bet_count : 0;
        betCount += row ? row.bet_count : 0;
      }

      const status = asMarketStatus(market.status);
      const visibility = (market.visibility ?? 'PUBLIC') as MarketVisibility;

      // El access_code solo se revela al creador, a admins, o si fue solicitado con el código correcto
      const canSeeAccessCode =
        market.creator_id === profile.id ||
        profile.role === 'ADMIN' ||
        (requestedCode && market.access_code && requestedCode === market.access_code.toUpperCase());

      return {
        id: market.id,
        creatorId: market.creator_id,
        creatorUsername: creatorNames.get(market.creator_id) ?? 'usuario',
        title: market.title,
        description: market.description,
        resolutionSource: market.resolution_source,
        category: asMarketCategory(market.category),
        visibility,
        groupId: market.group_id ?? null,
        groupName: market.group_id ? groupNames.get(market.group_id) ?? null : null,
        accessCode: canSeeAccessCode ? market.access_code ?? null : null,
        options,
        closeTime: market.close_time,
        status,
        winningOption: market.winning_option,
        cancelledReason: market.cancelled_reason,
        isOfficial: market.is_official,
        totalPool: String(market.total_pool),
        optionPools,
        optionBetCounts,
        betCount,
        createdAt: market.created_at,
        odds: calculatePariMutuelOddsFromPools(options, optionPools),
      };
    });

    return NextResponse.json({ markets: result, serverTime: new Date().toISOString() });
  } catch (error) {
    return jsonError(error);
  }
}

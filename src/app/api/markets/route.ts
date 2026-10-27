import { NextResponse, type NextRequest } from 'next/server';
import { calculatePariMutuelOddsFromPools } from '@/lib/odds';
import type { MarketSummary } from '@/lib/types';
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
    const { data: marketData, error: marketError } = await supabase
      .from('markets')
      .select(
        'id, creator_id, title, description, resolution_source, category, options, close_time, status, winning_option, cancelled_reason, is_official, total_pool, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(250);

    if (marketError) {
      console.error('[markets] Error leyendo mercados:', marketError);
      throw new Error('No se pudieron cargar los mercados');
    }

    const markets = (marketData ?? []) as MarketRow[];
    if (markets.length === 0) {
      return NextResponse.json({ markets: [], serverTime: new Date().toISOString() });
    }

    const marketIds = markets.map((market) => market.id);
    const creatorIds = [...new Set(markets.map((market) => market.creator_id))];

    const [{ data: creatorData }, { data: poolData }] = await Promise.all([
      supabase.from('users').select('id, username').in('id', creatorIds),
      supabase
        .from('market_option_pools')
        .select('market_id, selected_option, pool, active_pool, active_bet_count, bet_count')
        .in('market_id', marketIds),
    ]);

    const creatorNames = new Map<string, string>();
    for (const creator of (creatorData ?? []) as Array<{ id: string; username: string }>) {
      creatorNames.set(creator.id, creator.username);
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

      return {
        id: market.id,
        creatorId: market.creator_id,
        creatorUsername: creatorNames.get(market.creator_id) ?? 'usuario',
        title: market.title,
        description: market.description,
        resolutionSource: market.resolution_source,
        category: asMarketCategory(market.category),
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

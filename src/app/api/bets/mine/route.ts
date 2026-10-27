import { NextResponse, type NextRequest } from 'next/server';
import type { BetRecord } from '@/lib/types';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import { asBetStatus, asMarketStatus } from '@/lib/server/mappers';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { getServiceSupabase } from '@/lib/server/supabase';

interface BetRow {
  id: string;
  market_id: string;
  selected_option: string;
  amount: string | number;
  payout_amount: string | number;
  status: string;
  created_at: string;
}

interface MarketRow {
  id: string;
  title: string;
  status: string;
  winning_option: string | null;
  close_time: string;
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`bets-mine:${profile.id}`, 60, 60_000);

    const supabase = getServiceSupabase();
    const { data: betData, error: betError } = await supabase
      .from('bets')
      .select('id, market_id, selected_option, amount, payout_amount, status, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (betError) {
      console.error('[bets] Error leyendo tickets:', betError);
      throw new Error('No se pudieron cargar tus tickets');
    }

    const bets = (betData ?? []) as BetRow[];
    if (bets.length === 0) {
      return NextResponse.json({ bets: [] });
    }

    const marketIds = [...new Set(bets.map((bet) => bet.market_id))];
    const { data: marketData, error: marketError } = await supabase
      .from('markets')
      .select('id, title, status, winning_option, close_time')
      .in('id', marketIds);

    if (marketError) {
      console.error('[bets] Error leyendo mercados:', marketError);
      throw new Error('No se pudieron cargar tus tickets');
    }

    const marketMap = new Map<string, MarketRow>();
    for (const market of (marketData ?? []) as MarketRow[]) {
      marketMap.set(market.id, market);
    }

    const result: BetRecord[] = bets.map((bet) => {
      const market = marketMap.get(bet.market_id);
      return {
        id: bet.id,
        marketId: bet.market_id,
        marketTitle: market?.title ?? 'Mercado no disponible',
        marketStatus: asMarketStatus(market?.status ?? 'RESOLVED'),
        winningOption: market?.winning_option ?? null,
        closeTime: market?.close_time ?? bet.created_at,
        selectedOption: bet.selected_option,
        amount: String(bet.amount),
        payoutAmount: String(bet.payout_amount),
        status: asBetStatus(bet.status),
        createdAt: bet.created_at,
      };
    });

    return NextResponse.json({ bets: result });
  } catch (error) {
    return jsonError(error);
  }
}

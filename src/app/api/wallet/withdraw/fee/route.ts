import { NextResponse, type NextRequest } from 'next/server';
import { getBscWithdrawFee } from '@/lib/binance';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    enforceRateLimit(`withdraw-fee:${profile.id}`, 60, 60_000);

    const feeInfo = await getBscWithdrawFee();

    return NextResponse.json(feeInfo, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

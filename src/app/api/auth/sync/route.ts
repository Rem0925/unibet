import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';

export async function POST(request: NextRequest) {
  try {
    let options: { username?: string; binanceUid?: string } | undefined = undefined;
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        options = {
          username: typeof body.username === 'string' ? body.username.trim() : undefined,
          binanceUid: typeof body.binanceUid === 'string' ? body.binanceUid.trim() : undefined,
        };
      }
    } catch {
      // Ignored: request body is optional
    }

    const { profile } = await requireUser(request, options);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

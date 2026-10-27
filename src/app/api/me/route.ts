import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

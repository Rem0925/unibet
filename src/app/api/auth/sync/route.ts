import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { jsonError } from '@/lib/server/http';

/**
 * Called right after login. It returns the profile and creates it if the
 * auth.users trigger has not run (older database migration).
 */
export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireUser(request);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

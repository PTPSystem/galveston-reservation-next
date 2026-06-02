import { NextResponse } from 'next/server';
import { syncVrboCalendar } from '@/lib/vrbo-sync';

export const dynamic = 'force-dynamic';

// Vercel Cron Job endpoint
// This should only be called by Vercel's cron system
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  // Verify the cron secret (Vercel sends it as Bearer token)
  if (process.env.CRON_SECRET) {
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    if (authHeader !== expectedAuth) {
      console.warn('[Cron] Unauthorized attempt to run VRBO sync');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  } else {
    console.warn('[Cron] CRON_SECRET not set - allowing sync (not recommended for production)');
  }

  try {
    console.log('[Cron] Starting scheduled VRBO calendar sync...');
    const result = await syncVrboCalendar();

    console.log('[Cron] VRBO sync completed:', result);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron] VRBO sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Cron sync failed',
      },
      { status: 500 }
    );
  }
}

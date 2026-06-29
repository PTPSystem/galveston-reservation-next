import { NextResponse } from 'next/server';
import { syncVrboCalendar } from '@/lib/vrbo-sync';

export const dynamic = 'force-dynamic';

// Vercel Cron Job endpoint — only callable with CRON_SECRET Bearer token
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[Cron] CRON_SECRET is not set — refusing sync');
    return NextResponse.json(
      { success: false, error: 'Cron endpoint is not configured' },
      { status: 503 }
    );
  }

  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader !== expectedAuth) {
    console.warn('[Cron] Unauthorized attempt to run VRBO sync');
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
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

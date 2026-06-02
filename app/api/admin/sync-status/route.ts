import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Lightweight status endpoint for last VRBO iCal sync (used by admin UI)
// No role check inside (consistent with rates/emails/holidays/sync-vrbo APIs);
// protection comes from being called only from within authenticated /admin pages.
export async function GET() {
  try {
    const latest = await prisma.syncLog.findFirst({
      where: { syncType: 'vrbo_ical_import' },
      orderBy: { startedAt: 'desc' },
    });

    const recent = await prisma.syncLog.findMany({
      where: { syncType: 'vrbo_ical_import' },
      orderBy: { startedAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      latest: latest || null,
      recent: recent || [],
      hasData: !!latest,
    });
  } catch (error: any) {
    console.error('Failed to fetch sync status:', error);
    return NextResponse.json(
      { error: 'Failed to load sync status', latest: null, recent: [] },
      { status: 500 }
    );
  }
}

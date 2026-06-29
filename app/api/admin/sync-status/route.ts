import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

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

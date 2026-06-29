import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { syncVrboCalendar } = await import('@/lib/vrbo-sync');
    const result = await syncVrboCalendar();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('VRBO sync API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Sync failed' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}

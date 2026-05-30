import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Dynamic import to avoid build-time issues with node-ical
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

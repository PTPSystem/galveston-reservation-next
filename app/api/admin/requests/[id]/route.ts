import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = parseInt(id);

  if (isNaN(requestId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    // Delete child records first to satisfy FK constraints (no cascade on schema)
    await prisma.pricingAdjustment.deleteMany({
      where: { bookingRequestId: requestId },
    });

    await prisma.calendarEvent.deleteMany({
      where: { bookingRequestId: requestId },
    });

    await prisma.bookingRequest.delete({
      where: { id: requestId },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Failed to delete booking request:', e);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}

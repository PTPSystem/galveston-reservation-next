import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = parseInt(id);
  const body = await request.json();

  if (isNaN(requestId)) {
    return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
  }

  // Block status changes that imply review/pricing for VRBO
  const booking = await prisma.bookingRequest.findUnique({ where: { id: requestId }, select: { source: true, status: true } });
  if (booking?.source === 'VRBO' && ['REVIEWING', 'CONFIRMED'].includes(body.status)) {
    return NextResponse.json({ error: 'Cannot review or confirm VRBO-synced bookings via this interface' }, { status: 403 });
  }

  const allowedStatuses = ['REVIEWING', 'CONFIRMED', 'REJECTED', 'CANCELLED'] as const;
  const newStatus = body.status;

  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const updated = await prisma.bookingRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        ...(newStatus === 'CONFIRMED' ? { approvedAt: new Date() } : {}),
        ...(newStatus === 'REJECTED' ? { rejectedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

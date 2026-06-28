import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = parseInt(id);
  const body = await request.json();

  // Prevent price changes for VRBO synced bookings
  const booking = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    select: { source: true },
  });
  if (booking?.source === 'VRBO') {
    return NextResponse.json({ error: 'Cannot modify pricing for VRBO-synced bookings' }, { status: 403 });
  }

  const adjustment = await prisma.pricingAdjustment.create({
    data: {
      bookingRequestId: requestId,
      adjustmentType: body.adjustmentType,
      amount: body.amount,
      reason: body.reason,
      appliedBy: 'Admin', // TODO: replace with real user later
    },
  });

  return NextResponse.json(adjustment);
}

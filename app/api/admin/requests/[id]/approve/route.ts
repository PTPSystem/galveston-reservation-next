import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = parseInt(id);
  const body = await request.json();

  const updated = await prisma.bookingRequest.update({
    where: { id: requestId },
    data: {
      status: 'CONFIRMED',
      approvedAt: new Date(),
      pricing: body.pricing,
    },
  });

  // TODO: Send email with quote to guest
  // TODO: Create calendar event if needed

  return NextResponse.json({ success: true, request: updated });
}

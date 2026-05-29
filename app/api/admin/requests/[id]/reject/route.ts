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

  try {
    const updated = await prisma.bookingRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: body.reason || 'Rejected by admin',
      },
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('Reject error:', error);
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
  }
}

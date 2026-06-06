import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

async function checkRole() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    return false;
  }
  return true;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkRole())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const blockId = parseInt(id);
  const body = await request.json();

  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const start = new Date(body.startDate);
  const end = new Date(body.endDate);

  // Check overlap with confirmed bookings (excluding perhaps itself but since blocked not booking ok)
  const overlappingBooking = await prisma.bookingRequest.findFirst({
    where: {
      status: 'CONFIRMED',
      startDate: { lt: end },
      endDate: { gt: start },
    },
  });

  if (overlappingBooking) {
    return NextResponse.json({ 
      error: 'This date range overlaps with an existing confirmed booking. Please check the calendar.' 
    }, { status: 400 });
  }

  const updated = await prisma.blockedPeriod.update({
    where: { id: blockId },
    data: {
      startDate: start,
      endDate: end,
      reason: body.reason || null,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkRole())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const blockId = parseInt(id);

  await prisma.blockedPeriod.delete({
    where: { id: blockId },
  });

  return NextResponse.json({ success: true });
}

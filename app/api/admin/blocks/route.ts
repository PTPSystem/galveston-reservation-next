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

export async function GET() {
  if (!(await checkRole())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const blocks = await prisma.blockedPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });
  return NextResponse.json(blocks);
}

export async function POST(request: NextRequest) {
  if (!(await checkRole())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  // Basic overlap check against confirmed bookings (optional but recommended)
  const start = new Date(body.startDate);
  const end = new Date(body.endDate);

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

  const block = await prisma.blockedPeriod.create({
    data: {
      startDate: start,
      endDate: end,
      reason: body.reason || null,
    },
  });

  return NextResponse.json(block, { status: 201 });
}

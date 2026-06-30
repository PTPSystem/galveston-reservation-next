import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';
import { overlappingDateRangeWhere } from '@/lib/date-range';

export async function GET() {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const blocks = await prisma.blockedPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });
  return NextResponse.json(blocks);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = await request.json();

  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const start = new Date(body.startDate);
  const end = new Date(body.endDate);

  const overlappingBooking = await prisma.bookingRequest.findFirst({
    where: {
      status: 'CONFIRMED',
      ...overlappingDateRangeWhere(start, end),
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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET() {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const holidays = await prisma.holidayPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });
  return NextResponse.json(holidays);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const body = await request.json();

  const holiday = await prisma.holidayPeriod.create({
    data: {
      name: body.name,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      rate: body.rate,
      notes: body.notes,
    },
  });

  return NextResponse.json(holiday, { status: 201 });
}

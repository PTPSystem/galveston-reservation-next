import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const holidays = await prisma.holidayPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });
  return NextResponse.json(holidays);
}

export async function POST(request: NextRequest) {
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

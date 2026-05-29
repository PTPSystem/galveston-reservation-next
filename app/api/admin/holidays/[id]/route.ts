import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);
  const body = await request.json();

  const updated = await prisma.holidayPeriod.update({
    where: { id },
    data: {
      name: body.name,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      rate: body.rate,
      notes: body.notes,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);

  await prisma.holidayPeriod.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

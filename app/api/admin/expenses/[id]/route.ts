import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const formData = await request.formData();

  const description = formData.get('description') as string;
  const dateStr = formData.get('date') as string;
  const amountStr = formData.get('amount') as string;
  const file = formData.get('attachment') as File | null;

  if (!description || !dateStr || !amountStr) {
    return NextResponse.json({ error: 'Description, date and amount are required' }, { status: 400 });
  }

  const existing = await prisma.ownerExpense.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  let attachment = existing.attachment;
  if (file && file.size > 0) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    attachment = `data:${file.type};base64,${buffer.toString('base64')}`;
  }

  const expense = await prisma.ownerExpense.update({
    where: { id },
    data: {
      description,
      date: new Date(dateStr),
      amount: parseFloat(amountStr),
      attachment,
    },
  });

  return NextResponse.json(expense);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  await prisma.ownerExpense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

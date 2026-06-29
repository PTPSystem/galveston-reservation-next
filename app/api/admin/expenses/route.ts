import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET() {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const expenses = await prisma.ownerExpense.findMany({
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const formData = await request.formData();

  const description = formData.get('description') as string;
  const dateStr = formData.get('date') as string;
  const amountStr = formData.get('amount') as string;
  const file = formData.get('attachment') as File | null;

  if (!description || !dateStr || !amountStr) {
    return NextResponse.json({ error: 'Description, date and amount are required' }, { status: 400 });
  }

  let attachment: string | null = null;
  if (file && file.size > 0) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    attachment = `data:${file.type};base64,${buffer.toString('base64')}`;
  }

  const expense = await prisma.ownerExpense.create({
    data: {
      description,
      date: new Date(dateStr),
      amount: parseFloat(amountStr),
      attachment,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireOwnerSession } from '@/lib/admin-auth';

export async function GET() {
  const authResult = await requireOwnerSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      emailVerified: true,
      lastEmailVerification: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

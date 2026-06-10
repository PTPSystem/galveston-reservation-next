import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role as 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER';

  // Only Admin and Owner can list users
  if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

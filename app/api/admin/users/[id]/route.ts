import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
  });

  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  const userRole = currentUser.role as 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER';

  if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { role }: { role: 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER' } = await request.json();

  if (!role) {
    return NextResponse.json({ error: 'Role is required' }, { status: 400 });
  }

  // Role restrictions
  if (userRole === 'OWNER' && role === 'ADMIN') {
    return NextResponse.json({ error: 'Owners cannot assign Admin role' }, { status: 403 });
  }

  // Prevent removing last admin? Optional, but good to have
  if (role !== 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (targetUser?.role === 'ADMIN' && adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last Admin' }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}

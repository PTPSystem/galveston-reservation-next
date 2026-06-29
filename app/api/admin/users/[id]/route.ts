import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireOwnerSession, type AdminRole } from '@/lib/admin-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const currentUser = authResult.user;
  const { id } = await params;
  const { role }: { role: AdminRole } = await request.json();

  if (!role) {
    return NextResponse.json({ error: 'Role is required' }, { status: 400 });
  }

  if (currentUser.role === 'OWNER' && role === 'ADMIN') {
    return NextResponse.json({ error: 'Owners cannot assign Admin role' }, { status: 403 });
  }

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

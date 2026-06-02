import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// DELETE: Delete a pending invite
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role as 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER';

  if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const invite = await prisma.invite.findUnique({
    where: { id },
  });

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: 'Cannot delete a used invite' }, { status: 400 });
  }

  await prisma.invite.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

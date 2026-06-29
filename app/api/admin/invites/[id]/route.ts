import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireOwnerSession } from '@/lib/admin-auth';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;

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

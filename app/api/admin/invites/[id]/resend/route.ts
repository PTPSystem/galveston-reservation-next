import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendInviteEmail } from '@/lib/email';
import { requireOwnerSession } from '@/lib/admin-auth';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOwnerSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const currentUser = authResult.user;
  const { id } = await params;

  const invite = await prisma.invite.findUnique({
    where: { id },
    include: { inviter: true },
  });

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: 'Cannot resend a used invite' }, { status: 400 });
  }

  if (currentUser.role === 'OWNER' && invite.role === 'ADMIN') {
    return NextResponse.json({ error: 'Owners cannot manage Admin invites' }, { status: 403 });
  }

  const newToken = randomBytes(32).toString('hex');
  const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const updatedInvite = await prisma.invite.update({
    where: { id },
    data: {
      token: newToken,
      expiresAt: newExpiresAt,
    },
    include: { inviter: true },
  });

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${newToken}`;

  await sendInviteEmail({
    to: updatedInvite.email,
    inviteLink,
    inviterName: currentUser.name || updatedInvite.inviter?.name || undefined,
    role: updatedInvite.role,
  });

  return NextResponse.json({ success: true, invite: updatedInvite });
}

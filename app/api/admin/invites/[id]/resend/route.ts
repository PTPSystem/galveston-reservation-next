import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendInviteEmail } from '@/lib/email';

// POST: Resend an invite (regenerate token and send email)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  // Role restrictions (same as create)
  if (currentUser.role === 'PROPERTY_MANAGER') {
    return NextResponse.json({ error: 'Property Managers cannot manage invites' }, { status: 403 });
  }

  if (currentUser.role === 'OWNER' && invite.role === 'ADMIN') {
    return NextResponse.json({ error: 'Owners cannot manage Admin invites' }, { status: 403 });
  }

  // Regenerate token and extend expiry
  const newToken = randomBytes(32).toString('hex');
  const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const updatedInvite = await prisma.invite.update({
    where: { id },
    data: {
      token: newToken,
      expiresAt: newExpiresAt,
    },
    include: { inviter: true },
  });

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${newToken}`;

  // Resend email
  await sendInviteEmail({
    to: updatedInvite.email,
    inviteLink,
    inviterName: currentUser.name || updatedInvite.inviter?.name || undefined,
    role: updatedInvite.role,
  });

  return NextResponse.json({ success: true, invite: updatedInvite });
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendInviteEmail } from '@/lib/email';
import { requireOwnerSession, type AdminRole } from '@/lib/admin-auth';

export async function GET() {
  const authResult = await requireOwnerSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const invites = await prisma.invite.findMany({
    where: { usedAt: null },
    include: { inviter: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(invites);
}

export async function POST(request: NextRequest) {
  const authResult = await requireOwnerSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const currentUser = authResult.user;
  const { email, role }: { email: string; role: AdminRole } = await request.json();

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role required' }, { status: 400 });
  }

  if (currentUser.role === 'OWNER' && role === 'ADMIN') {
    return NextResponse.json({ error: 'Owners cannot invite Admins' }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
  }

  const pending = await prisma.invite.findFirst({
    where: { email, usedAt: null },
  });
  if (pending) {
    return NextResponse.json({ error: 'Pending invite already exists for this email' }, { status: 400 });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const invite = await prisma.invite.create({
    data: {
      email,
      role,
      token,
      invitedBy: currentUser.id,
      expiresAt,
    },
    include: { inviter: true },
  });

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${token}`;

  await sendInviteEmail({
    to: email,
    inviteLink,
    inviterName: currentUser.name || undefined,
    role,
  });

  return NextResponse.json({ success: true, invite });
}

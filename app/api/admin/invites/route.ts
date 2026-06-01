import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendInviteEmail } from '@/lib/email';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as any).role as 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER';

  // Only Admin and Owner can view invites
  if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  const { email, role }: { email: string; role: 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER' } = await request.json();

  if (!email || !role) {
    return NextResponse.json({ error: 'Email and role required' }, { status: 400 });
  }

  // Role restrictions
  if (currentUser.role === 'PROPERTY_MANAGER') {
    return NextResponse.json({ error: 'Property Managers cannot invite users' }, { status: 403 });
  }

  if (currentUser.role === 'OWNER' && role === 'ADMIN') {
    return NextResponse.json({ error: 'Owners cannot invite Admins' }, { status: 403 });
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
  }

  // Check for pending invite
  const pending = await prisma.invite.findFirst({
    where: { email, usedAt: null },
  });
  if (pending) {
    return NextResponse.json({ error: 'Pending invite already exists for this email' }, { status: 400 });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const invite = await prisma.invite.create({
    data: {
      email,
      role: role as any,
      token,
      invitedBy: currentUser.id,
      expiresAt,
    },
    include: { inviter: true },
  });

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${token}`;

  // Send email
  await sendInviteEmail({
    to: email,
    inviteLink,
    inviterName: currentUser.name || undefined,
    role,
  });

  return NextResponse.json({ success: true, invite });
}

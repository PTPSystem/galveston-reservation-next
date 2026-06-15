import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(
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

  const targetUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check role restrictions for reset (same as invite)
  // For now allow as long as current user has access

  // Delete any existing pending invites for this email (to avoid duplicates)
  await prisma.invite.deleteMany({
    where: { email: targetUser.email, usedAt: null },
  });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const invite = await prisma.invite.create({
    data: {
      email: targetUser.email,
      role: targetUser.role,
      token,
      invitedBy: currentUser.id,
      expiresAt,
    },
    include: { inviter: true },
  });

  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  await sendPasswordResetEmail({
    to: targetUser.email,
    resetLink,
    role: targetUser.role,
  });

  return NextResponse.json({ 
    success: true, 
    message: `Password reset email sent to ${targetUser.email}` 
  });
}

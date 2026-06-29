import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
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

  const targetUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.invite.deleteMany({
    where: { email: targetUser.email, usedAt: null },
  });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.invite.create({
    data: {
      email: targetUser.email,
      role: targetUser.role,
      token,
      invitedBy: currentUser.id,
      expiresAt,
    },
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

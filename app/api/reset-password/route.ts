import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

// GET: Validate reset token and return account info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { inviter: true },
  });

  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This reset link has expired' }, { status: 400 });
  }

  // Ensure this is for an existing user (password reset context)
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (!existingUser) {
    return NextResponse.json({ error: 'No account found for this email' }, { status: 400 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
  });
}

// POST: Set new password using reset token
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid reset link' }, { status: 404 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Reset link expired' }, { status: 400 });
    }

    // Must be for an existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 400 });
    }

    const hashedPassword = await hash(password, 12);

    // Update the existing user's password
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        emailVerified: new Date(),
        lastEmailVerification: new Date(),
      },
    });

    // Mark invite as used
    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ success: true, userId: existingUser.id });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}

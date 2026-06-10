import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

// GET: Validate invite token
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
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired' }, { status: 400 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    invitedBy: invite.inviter?.name || 'Admin',
  });
}

// POST: Accept invite and set password
export async function POST(request: NextRequest) {
  try {
    const { token, password, name } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
    }

    // Check if user already exists (this can happen for password resets)
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    const hashedPassword = await hash(password, 12);

    let userId: string;

    if (existingUser) {
      // Password reset for existing user - update password, do not change role
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          name: name || existingUser.name,
          emailVerified: new Date(),
          lastEmailVerification: new Date(),
        },
      });
      userId = existingUser.id;
    } else {
      // New user from invite
      const user = await prisma.user.create({
        data: {
          email: invite.email,
          name: name || null,
          password: hashedPassword,
          role: invite.role,
          emailVerified: new Date(),
          lastEmailVerification: new Date(),
        },
      });
      userId = user.id;
    }

    // Mark invite as used
    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ success: true, userId, wasReset: !!existingUser });
  } catch (error) {
    console.error('Invite acceptance error:', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}

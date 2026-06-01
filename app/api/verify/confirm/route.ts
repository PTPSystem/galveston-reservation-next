import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { email, code } = await request.json();

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
  }

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: email,
      token: code,
      expires: { gt: new Date() },
    },
  });

  if (!tokenRecord) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  // Delete used token
  await prisma.verificationToken.delete({ where: { token: code } });

  // Update user verification
  await prisma.user.update({
    where: { email },
    data: {
      emailVerified: new Date(),
      lastEmailVerification: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

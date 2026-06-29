import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  const sessionEmail = session?.user?.email;

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, code } = await request.json();

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
  }

  if (email.toLowerCase() !== sessionEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: sessionEmail,
      token: code,
      expires: { gt: new Date() },
    },
  });

  if (!tokenRecord) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  await prisma.verificationToken.delete({ where: { token: code } });

  const now = new Date();
  await prisma.user.update({
    where: { email: sessionEmail },
    data: {
      emailVerified: now,
      lastEmailVerification: now,
    },
  });

  return NextResponse.json({
    success: true,
    lastEmailVerification: now.toISOString(),
  });
}

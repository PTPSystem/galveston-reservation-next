import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendVerificationCodeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal if user exists
    return NextResponse.json({ success: true });
  }

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store code in VerificationToken for simplicity (reuse model)
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: code,
      expires,
    },
  });

  await sendVerificationCodeEmail({ to: email, code });

  return NextResponse.json({ success: true });
}

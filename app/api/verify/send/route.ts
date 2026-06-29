import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendVerificationCodeEmail } from '@/lib/email';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  const sessionEmail = session?.user?.email;

  if (!sessionEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  if (email.toLowerCase() !== sessionEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { email: sessionEmail } });
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.verificationToken.deleteMany({
    where: { identifier: sessionEmail },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: sessionEmail,
      token: code,
      expires,
    },
  });

  await sendVerificationCodeEmail({ to: sessionEmail, code });

  return NextResponse.json({ success: true });
}

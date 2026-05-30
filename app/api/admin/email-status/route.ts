import { NextResponse } from 'next/server';
import { getEmailConfigStatus } from '@/lib/email';

export async function GET() {
  const status = getEmailConfigStatus();

  return NextResponse.json({
    ...status,
    readyToSend: status.hasApiKey && status.isFromEmailConfigured,
    recommendations: [
      !status.hasApiKey && 'Set RESEND_API_KEY in Vercel environment variables',
      !status.isFromEmailConfigured && 'Set RESEND_FROM_EMAIL to a verified address in Resend (e.g. bookings@yourdomain.com)',
      'Verify your sending domain in the Resend dashboard (https://resend.com/domains)',
    ].filter(Boolean),
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getEmailRecipients, updateEmailRecipients } from '@/lib/email-settings';
import { requireAdminSession } from '@/lib/admin-auth';

export async function GET() {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const recipients = await getEmailRecipients();
    return NextResponse.json(recipients);
  } catch (error) {
    console.error('Failed to fetch email settings:', error);
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error 
      ? `Database error: ${error.message}` 
      : 'Failed to load email settings. The email_settings table may not exist yet.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body = await request.json();

    const { propertyManagerEmail, ownerEmail } = body;

    if (!propertyManagerEmail || !ownerEmail) {
      return NextResponse.json(
        { error: 'Both propertyManagerEmail and ownerEmail are required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(propertyManagerEmail) || !emailRegex.test(ownerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const updated = await updateEmailRecipients({
      propertyManagerEmail: propertyManagerEmail.trim(),
      ownerEmail: ownerEmail.trim(),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update email settings:', error);
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error 
      ? `Database error: ${error.message}` 
      : 'Failed to save email settings. The email_settings table may not exist yet — run the migration SQL.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendQuoteEmail, sendInternalBookingConfirmedEmail } from '@/lib/email';
import { getEmailRecipients } from '@/lib/email-settings';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = parseInt(id);
  const body = await request.json();

  const updated = await prisma.bookingRequest.update({
    where: { id: requestId },
    data: {
      status: 'CONFIRMED',
      approvedAt: new Date(),
      pricing: body.pricing,
    },
  });

  // Send quote email to guest
  if (updated.approvalToken) {
    await sendQuoteEmail({
      to: updated.guestEmail,
      guestName: updated.guestName,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      pricing: body.pricing,
      approvalToken: updated.approvalToken,
    });
  }

  // Notify internal recipients (Property Manager + Owner)
  const recipients = await getEmailRecipients();
  const internalEmails = [recipients.propertyManagerEmail, recipients.ownerEmail].filter(Boolean);

  if (internalEmails.length > 0) {
    await sendInternalBookingConfirmedEmail({
      recipients: internalEmails,
      guestName: updated.guestName,
      guestEmail: updated.guestEmail,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      pricing: body.pricing,
      bookingId: updated.id,
    });
  }

  // (No external calendar event creation needed; iCal export + VRBO import + CONFIRMED records handle blocking.)

  return NextResponse.json({ success: true, request: updated });
}

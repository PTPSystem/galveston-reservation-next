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

  // Block approve/pricing for VRBO
  const booking = await prisma.bookingRequest.findUnique({ where: { id: requestId }, select: { source: true } });
  if (booking?.source === 'VRBO') {
    return NextResponse.json({ error: 'Cannot approve or price VRBO-synced bookings here' }, { status: 403 });
  }

  const updateData: any = {
    status: 'CONFIRMED',
    approvedAt: new Date(),
    pricing: body.pricing,
  };
  if (body.startDate) updateData.startDate = new Date(body.startDate);
  if (body.endDate) updateData.endDate = new Date(body.endDate);

  const updated = await prisma.bookingRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  // Use the (possibly extended) dates for email if provided in body
  const emailStart = body.startDate ? new Date(body.startDate).toISOString() : updated.startDate.toISOString();
  const emailEnd = body.endDate ? new Date(body.endDate).toISOString() : updated.endDate.toISOString();

  // Send quote email to guest (will reflect new dates/total if extended)
  if (updated.approvalToken) {
    await sendQuoteEmail({
      to: updated.guestEmail,
      guestName: updated.guestName,
      startDate: emailStart,
      endDate: emailEnd,
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
      startDate: emailStart,
      endDate: emailEnd,
      pricing: body.pricing,
      bookingId: updated.id,
    });
  }

  // (No external calendar event creation needed; iCal export + VRBO import + CONFIRMED records handle blocking.)

  return NextResponse.json({ success: true, request: updated });
}

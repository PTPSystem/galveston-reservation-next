import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendInternalBookingConfirmedEmail } from '@/lib/email';
import { getEmailRecipients } from '@/lib/email-settings';
import { requireAdminSession } from '@/lib/admin-auth';
import {
  availabilityConflictMessage,
  findAvailabilityConflict,
} from '@/lib/availability';

/**
 * Mark deposit received (or waived) and confirm the booking.
 * body.action: 'received' | 'waive'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  const requestId = parseInt(id, 10);
  if (isNaN(requestId)) {
    return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === 'waive' ? 'waive' : 'received';

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.source === 'VRBO') {
    return NextResponse.json(
      { error: 'Cannot manage deposits for VRBO-synced bookings here' },
      { status: 403 }
    );
  }

  const conflict = await findAvailabilityConflict(booking.startDate, booking.endDate, {
    excludeBookingId: requestId,
  });
  if (conflict) {
    return NextResponse.json(
      { error: availabilityConflictMessage(conflict) },
      { status: 409 }
    );
  }

  const existingPricing =
    booking.pricing && typeof booking.pricing === 'object'
      ? (booking.pricing as Record<string, unknown>)
      : {};

  if (
    action === 'received' &&
    (typeof existingPricing.depositAmount !== 'number' ||
      (existingPricing.depositAmount as number) < 0)
  ) {
    return NextResponse.json(
      { error: 'Send a quote with a deposit amount before marking deposit received' },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const pricing = {
    ...existingPricing,
    depositStatus: action === 'waive' ? 'WAIVED' : 'RECEIVED',
    depositReceivedAt: nowIso,
    ...(typeof body.note === 'string' && body.note.trim()
      ? { depositNote: body.note.trim() }
      : {}),
  };

  const updated = await prisma.bookingRequest.update({
    where: { id: requestId },
    data: {
      pricing: pricing as object,
      status: 'CONFIRMED',
      approvedAt: new Date(),
    },
  });

  const recipients = await getEmailRecipients();
  const internalEmails = [recipients.propertyManagerEmail, recipients.ownerEmail].filter(
    Boolean
  ) as string[];

  if (internalEmails.length > 0) {
    await sendInternalBookingConfirmedEmail({
      recipients: internalEmails,
      guestName: updated.guestName,
      guestEmail: updated.guestEmail,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      pricing,
      bookingId: updated.id,
    });
  }

  return NextResponse.json({
    success: true,
    action,
    status: updated.status,
    depositStatus: (pricing as { depositStatus?: string }).depositStatus,
    depositAmount: (pricing as { depositAmount?: number }).depositAmount,
  });
}

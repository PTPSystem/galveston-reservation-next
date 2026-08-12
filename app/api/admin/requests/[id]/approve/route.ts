import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendQuoteEmail } from '@/lib/email';
import { requireAdminSession } from '@/lib/admin-auth';
import {
  availabilityConflictMessage,
  findAvailabilityConflict,
} from '@/lib/availability';
import { defaultDepositAmount } from '@/lib/types/pricing';

/**
 * Persist quote pricing and optionally email the guest an invoice.
 *
 * body.action:
 *  - 'draft'      → save pricing/dates only (no email); PENDING → REVIEWING
 *  - 'send_quote' → save pricing, set depositStatus REQUESTED, email invoice (default)
 *
 * Does NOT confirm the booking or block the calendar — use /deposit for that.
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
  const requestId = parseInt(id);
  const body = await request.json();
  const action = body.action === 'draft' ? 'draft' : 'send_quote';

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    select: {
      source: true,
      startDate: true,
      endDate: true,
      status: true,
      pricing: true,
      guestEmail: true,
      guestName: true,
      approvalToken: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.source === 'VRBO') {
    return NextResponse.json(
      { error: 'Cannot approve or price VRBO-synced bookings here' },
      { status: 403 }
    );
  }

  const nextStart = body.startDate ? new Date(body.startDate) : booking.startDate;
  const nextEnd = body.endDate ? new Date(body.endDate) : booking.endDate;

  const conflict = await findAvailabilityConflict(nextStart, nextEnd, {
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

  const incoming =
    body.pricing && typeof body.pricing === 'object' ? body.pricing : {};

  const totalGuestPrice = Number(incoming.totalGuestPrice ?? existingPricing.totalGuestPrice ?? 0);
  let depositAmount =
    typeof incoming.depositAmount === 'number'
      ? incoming.depositAmount
      : typeof existingPricing.depositAmount === 'number'
        ? (existingPricing.depositAmount as number)
        : defaultDepositAmount(totalGuestPrice);

  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    return NextResponse.json({ error: 'depositAmount must be a non-negative number' }, { status: 400 });
  }
  depositAmount = Math.round(depositAmount * 100) / 100;

  const priorStatus = (existingPricing.depositStatus as string) || null;
  const depositStatus =
    action === 'send_quote'
      ? priorStatus === 'RECEIVED' || priorStatus === 'WAIVED'
        ? priorStatus
        : 'REQUESTED'
      : incoming.depositStatus || priorStatus || undefined;

  const pricing = {
    ...existingPricing,
    ...incoming,
    depositAmount,
    depositStatus,
    depositReceivedAt:
      depositStatus === 'RECEIVED' || depositStatus === 'WAIVED'
        ? existingPricing.depositReceivedAt || null
        : null,
  };

  const updateData: Record<string, unknown> = {
    pricing,
    // Quotes awaiting deposit stay REVIEWING; never auto-CONFIRMED here
    status: booking.status === 'CONFIRMED' ? 'CONFIRMED' : 'REVIEWING',
  };
  if (body.startDate) updateData.startDate = new Date(body.startDate);
  if (body.endDate) updateData.endDate = new Date(body.endDate);

  const updated = await prisma.bookingRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  const emailStart = body.startDate
    ? new Date(body.startDate).toISOString()
    : updated.startDate.toISOString();
  const emailEnd = body.endDate
    ? new Date(body.endDate).toISOString()
    : updated.endDate.toISOString();

  if (action === 'send_quote' && updated.approvalToken) {
    await sendQuoteEmail({
      to: updated.guestEmail,
      guestName: updated.guestName,
      startDate: emailStart,
      endDate: emailEnd,
      pricing,
      approvalToken: updated.approvalToken,
    });
  }

  return NextResponse.json({
    success: true,
    action,
    request: updated,
    depositStatus: pricing.depositStatus,
    depositAmount: pricing.depositAmount,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * Manually link (or unlink) a VRBO payout row to a booking request.
 * Body: { reservationId: string, bookingRequestId: number | null }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const reservationId =
      typeof body.reservationId === 'string' ? body.reservationId.trim() : '';
    const bookingRequestId =
      body.bookingRequestId === null || body.bookingRequestId === ''
        ? null
        : Number(body.bookingRequestId);

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId is required' }, { status: 400 });
    }

    if (
      bookingRequestId !== null &&
      (!Number.isInteger(bookingRequestId) || bookingRequestId < 1)
    ) {
      return NextResponse.json(
        { error: 'bookingRequestId must be a positive integer or null' },
        { status: 400 }
      );
    }

    const payout = await prisma.vrboPayout.findUnique({
      where: { reservationId },
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    if (bookingRequestId === null) {
      await prisma.vrboPayout.update({
        where: { reservationId },
        data: { bookingRequestId: null },
      });
      return NextResponse.json({
        success: true,
        message: `Unlinked ${reservationId}`,
        reservationId,
        bookingRequestId: null,
      });
    }

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: {
        id: true,
        guestName: true,
        pricing: true,
        source: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Free the unique booking_request_id slot if another payout owns it
    await prisma.vrboPayout.updateMany({
      where: {
        bookingRequestId,
        NOT: { reservationId },
      },
      data: {
        bookingRequestId: null,
        ...(payout.payout !== 0
          ? { payout: 0, grossBookingAmount: 0, deductions: 0 }
          : {}),
      },
    });

    await prisma.vrboPayout.update({
      where: { reservationId },
      data: { bookingRequestId },
    });

    const csvGuestFull = [payout.travelerFirstName, payout.travelerLastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const currentGuest = (booking.guestName || '').trim();
    const isPlaceholder =
      /^reserved\b|^blocked\b/i.test(currentGuest) || currentGuest.length < 3;
    const shouldUpdateName =
      isPlaceholder &&
      csvGuestFull.length > 3 &&
      currentGuest.toLowerCase() !== csvGuestFull.toLowerCase();

    const updateData: Record<string, unknown> = {};
    if (shouldUpdateName) {
      updateData.guestName = csvGuestFull;
    }

    if (payout.payout !== 0) {
      const current = (booking.pricing as Record<string, unknown>) || {};
      updateData.pricing = {
        ...current,
        totalGuestPrice: payout.payout,
        managementFee: payout.payout * 0.22,
        ownerProceeds: payout.payout * 0.78,
        vrboGrossBooking: payout.grossBookingAmount,
        vrboDeductions: payout.deductions,
        vrboPayout: payout.payout,
        vrboPayoutDate: payout.payoutDate
          ? payout.payoutDate.toISOString().split('T')[0]
          : null,
        vrboLodgingTaxOwnerRemits: payout.lodgingTaxOwnerRemits,
        vrboTaxWithheld: payout.taxWithheld,
      };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.bookingRequest.update({
        where: { id: bookingRequestId },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Linked ${reservationId} to booking #${bookingRequestId}`,
      reservationId,
      bookingRequestId,
      guestName: (updateData.guestName as string) || booking.guestName,
    });
  } catch (error: any) {
    console.error('VRBO manual match failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save match' },
      { status: 500 }
    );
  }
}

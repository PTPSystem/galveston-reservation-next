import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Only CONFIRMED bookings block dates for new requests.
    // Filter to only periods that end after today (i.e. currently or future unavailable).
    // This ensures the front-page "Currently unavailable" list and calendar disabled days
    // never show historical/past periods.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const confirmedBookings = await prisma.bookingRequest.findMany({
      where: {
        status: 'CONFIRMED',
        endDate: { gt: today },
      },
      select: {
        startDate: true,
        endDate: true,
        guestName: true, // Optional: could hide this for privacy
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    const blockedPeriods = await prisma.blockedPeriod.findMany({
      where: {
        endDate: { gt: today },
      },
      select: {
        startDate: true,
        endDate: true,
        reason: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    const unavailablePeriods = [
      ...confirmedBookings.map(booking => ({
        startDate: booking.startDate.toISOString().split('T')[0],
        endDate: booking.endDate.toISOString().split('T')[0],
        source: 'booking' as const,
        // We can omit guestName for privacy if desired
      })),
      ...blockedPeriods.map(block => ({
        startDate: block.startDate.toISOString().split('T')[0],
        endDate: block.endDate.toISOString().split('T')[0],
        source: 'blocked' as const,
        reason: block.reason,
      })),
    ].sort((a, b) => a.startDate.localeCompare(b.startDate));

    return NextResponse.json({
      unavailable: unavailablePeriods,
    });
  } catch (error) {
    console.error('Failed to fetch availability:', error);
    return NextResponse.json(
      { error: 'Failed to load availability' },
      { status: 500 }
    );
  }
}

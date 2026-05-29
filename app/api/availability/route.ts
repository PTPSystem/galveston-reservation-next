import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Only CONFIRMED bookings block dates for new requests
    const confirmedBookings = await prisma.bookingRequest.findMany({
      where: {
        status: 'CONFIRMED',
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

    const unavailablePeriods = confirmedBookings.map(booking => ({
      startDate: booking.startDate.toISOString().split('T')[0],
      endDate: booking.endDate.toISOString().split('T')[0],
      // We can omit guestName for privacy if desired
    }));

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

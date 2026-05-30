import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Simple .ics generator for VRBO
// GET /api/ical/vrbo
export async function GET() {
  try {
    const confirmedBookings = await prisma.bookingRequest.findMany({
      where: {
        status: 'CONFIRMED',
        source: 'DIRECT', // Only export our own bookings, not the ones we imported from VRBO
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        guestName: true,
        createdAt: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bayfront Retreat//NONSGML Booking Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const booking of confirmedBookings) {
      const uid = `bayfront-${booking.id}@bayfrontretreat.com`;
      const dtStamp = booking.createdAt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtStart = booking.startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtEnd = booking.endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART;VALUE=DATE:${dtStart.substring(0, 8)}`,
        `DTEND;VALUE=DATE:${dtEnd.substring(0, 8)}`,
        `SUMMARY:Bayfront Retreat - Booked`,
        `DESCRIPTION:Confirmed booking for ${booking.guestName}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bayfront-retreat.ics"',
      },
    });
  } catch (error) {
    console.error('Failed to generate VRBO iCal export:', error);
    return NextResponse.json({ error: 'Failed to generate calendar' }, { status: 500 });
  }
}

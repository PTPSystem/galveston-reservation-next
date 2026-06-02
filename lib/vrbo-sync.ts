import ICAL from 'ical.js';
import prisma from '@/lib/prisma';

const VRBO_ICAL_URL = process.env.VRBO_ICAL_URL || '';

interface ParsedEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
}

export async function syncVrboCalendar(): Promise<{
  success: boolean;
  eventsProcessed: number;
  eventsAdded: number;
  eventsUpdated: number;
  message: string;
}> {
  if (!VRBO_ICAL_URL) {
    // Record this as a failed sync so the admin UI (last sync status) can surface the misconfiguration
    try {
      await prisma.syncLog.create({
        data: {
          syncType: 'vrbo_ical_import',
          status: 'error',
          eventsProcessed: 0,
          message: 'VRBO_ICAL_URL environment variable is not set',
          errorDetails: 'Set VRBO_ICAL_URL in your environment (Vercel or .env)',
          startedAt: new Date(),
        },
      });
    } catch (logErr) {
      console.error('Failed to log missing VRBO_ICAL_URL:', logErr);
    }
    return {
      success: false,
      eventsProcessed: 0,
      eventsAdded: 0,
      eventsUpdated: 0,
      message: 'VRBO_ICAL_URL environment variable is not set',
    };
  }

  try {
    // Fetch the raw iCal data
    const response = await fetch(VRBO_ICAL_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch VRBO iCal: ${response.status} ${response.statusText}`);
    }

    const icsData = await response.text();

    // Parse with ical.js
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const vrboEvents: ParsedEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      if (!event.startDate || !event.endDate) continue;

      vrboEvents.push({
        uid: event.uid || `generated-${Date.now()}`,
        summary: event.summary || 'VRBO Booking',
        start: event.startDate.toJSDate(),
        end: event.endDate.toJSDate(),
      });
    }

    let added = 0;
    let updated = 0;

    for (const ev of vrboEvents) {
      const existing = await prisma.bookingRequest.findUnique({
        where: { externalId: ev.uid },
      });

      if (existing) {
        await prisma.bookingRequest.update({
          where: { id: existing.id },
          data: {
            startDate: ev.start,
            endDate: ev.end,
            guestName: ev.summary || existing.guestName,
            updatedAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.bookingRequest.create({
          data: {
            source: 'VRBO',
            status: 'CONFIRMED',
            guestName: ev.summary || 'VRBO Guest',
            guestEmail: 'bookings@vrbo.com',
            startDate: ev.start,
            endDate: ev.end,
            numGuests: 1,
            specialRequests: 'Imported from VRBO calendar',
            externalId: ev.uid,
          },
        });
        added++;
      }
    }

    await prisma.syncLog.create({
      data: {
        syncType: 'vrbo_ical_import',
        status: 'success',
        eventsProcessed: vrboEvents.length,
        eventsAdded: added,
        eventsUpdated: updated,
        message: `Synced ${vrboEvents.length} events from VRBO`,
        startedAt: new Date(),
      },
    });

    return {
      success: true,
      eventsProcessed: vrboEvents.length,
      eventsAdded: added,
      eventsUpdated: updated,
      message: `Successfully synced ${vrboEvents.length} VRBO events (${added} new, ${updated} updated)`,
    };
  } catch (error: any) {
    console.error('VRBO iCal sync failed:', error);

    await prisma.syncLog.create({
      data: {
        syncType: 'vrbo_ical_import',
        status: 'error',
        eventsProcessed: 0,
        message: 'VRBO sync failed',
        errorDetails: error.message || String(error),
        startedAt: new Date(),
      },
    });

    return {
      success: false,
      eventsProcessed: 0,
      eventsAdded: 0,
      eventsUpdated: 0,
      message: `Sync failed: ${error.message || 'Unknown error'}`,
    };
  }
}

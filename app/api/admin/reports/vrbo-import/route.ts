import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { parse as parseDate } from 'date-fns';

export async function POST(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseVrboCsv(text);

  let imported = 0;
  let matched = 0;
  let unmatched: string[] = [];
  const debugRows: any[] = [];

  for (const row of rows) {
    const resId = row['Reservation ID'] || row['ReservationID'] || row['reservation id'];
    if (!resId) continue;

    const checkIn = parseVrboDate(row['Check-in'] || row['Check In'] || row['check-in']);
    const checkOut = parseVrboDate(row['Check-out'] || row['Check Out'] || row['check-out']);
    const payoutDateStr = row['Payout date'] || row['Payout Date'];
    const payoutDate = payoutDateStr ? parseVrboDate(payoutDateStr) : null;

    const gross = parseFloat(row['Gross booking amount'] || row['Gross booking'] || '0') || 0;
    const deductions = parseFloat(row['Deductions'] || '0') || 0;
    const payout = parseFloat(row['Payout'] || '0') || 0;
    const lodgingTax = parseFloat(row['Lodging Tax Owner Remits'] || row['Lodging Tax'] || '0') || 0;
    const taxWithheld = parseFloat(row['Tax Withheld'] || '0') || 0;
    const currency = row['Payout currency'] || 'USD';

    // Match to existing VRBO booking **purely by dates** (start + end).
    // NO name matching at all. 
    // The CSV "Reservation ID" (HA-...) is NEVER used to query or match any BookingRequest.
    // It is only stored in VrboPayout.reservationId.
    let matchedBooking: any = null;
    let matchMethod: string | null = null;

    let csvStartKey: string | undefined;
    let csvEndKey: string | undefined;
    let allVrbo: any[] | undefined;
    let dateMatches: any[] | undefined;

    function toDateKey(d: Date | string): string {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toISOString().slice(0, 10); // YYYY-MM-DD UTC
    }

    function dateKeyToNumber(key: string): number {
      return parseInt(key.replace(/-/g, ''), 10);
    }

    if (checkIn && checkOut) {
      // Fetch all and filter in JS (avoids enum query quirks)
      const allBookings = await prisma.bookingRequest.findMany({
        select: { id: true, startDate: true, endDate: true, guestName: true, externalId: true, source: true },
      });
      allVrbo = allBookings.filter((b: any) => b.source === 'VRBO');

      csvStartKey = toDateKey(checkIn);
      csvEndKey = toDateKey(checkOut);

      dateMatches = allVrbo.filter(b => {
        return toDateKey(b.startDate) === csvStartKey && toDateKey(b.endDate) === csvEndKey;
      });

      if (dateMatches.length > 0) {
        matchedBooking = dateMatches[0];
        matchMethod = dateMatches.length === 1 
          ? 'date-only' 
          : `date-only (multiple: ${dateMatches.length}, took first)`;
      }

      // Tolerant fallback for legacy data where iCal sync stored slightly shifted dates
      // (due to toJSDate() + local TZ on the machine that ran the sync).
      if (!matchedBooking && csvStartKey && allVrbo) {
        const csvStartNum = dateKeyToNumber(csvStartKey);
        const tolerantStarts = allVrbo.filter((b: any) => {
          const dbS = dateKeyToNumber(toDateKey(b.startDate));
          return Math.abs(dbS - csvStartNum) <= 1;
        });
        if (tolerantStarts.length > 0) {
          matchedBooking = tolerantStarts[0];
          matchMethod = tolerantStarts.length === 1 
            ? 'tolerant-date-only' 
            : `tolerant-date-only (multiple, took first)`;
        }
      }
    }

    // Collect debug for this row (will be returned in response)
    const thisDebug: any = {
      resId,
      rawCheckIn: row['Check-in'] || row['Check In'] || row['check-in'],
      rawCheckOut: row['Check-out'] || row['Check Out'] || row['check-out'],
      checkInISO: checkIn ? checkIn.toISOString() : null,
      checkOutISO: checkOut ? checkOut.toISOString() : null,
      csvStartKey,
      csvEndKey,
      matchMethod: matchMethod || 'none',
      matchedId: matchedBooking?.id || null,
      dateMatchesCount: (typeof dateMatches !== 'undefined' ? dateMatches.length : 0),
    };
    if (typeof dateMatches !== 'undefined') {
      thisDebug.dateMatches = dateMatches.map((d: any) => ({ id: d.id, guestName: d.guestName, externalId: d.externalId }));
    }
    if (typeof allVrbo !== 'undefined' && allVrbo.length < 30) {
      thisDebug.allVrboKeys = allVrbo.map((b: any) => {
        const bStartKey = toDateKey(b.startDate);
        const bEndKey = toDateKey(b.endDate);
        const startMatch = bStartKey === csvStartKey;
        const endMatch = bEndKey === csvEndKey;
        const tolerantStartMatch = Math.abs(dateKeyToNumber(bStartKey) - dateKeyToNumber(csvStartKey || '')) <= 1;
        return {
          id: b.id,
          guestName: b.guestName,
          externalId: b.externalId,
          startKey: bStartKey,
          endKey: bEndKey,
          startMatch,
          endMatch,
          tolerantStartMatch,
        };
      });
    }
    debugRows.push(thisDebug);

    const bookingRequestId = matchedBooking?.id || null;

    // Re-fetch full record (we only selected limited fields in the date matching queries)
    // so we can read guestName + pricing for the update/enrichment.
    if (matchedBooking) {
      const full = await prisma.bookingRequest.findUnique({
        where: { id: matchedBooking.id },
        select: { id: true, guestName: true, pricing: true },
      });
      if (full) matchedBooking = full as any;
    }

    // Upsert the payout
    await prisma.vrboPayout.upsert({
      where: { reservationId: resId },
      create: {
        reservationId: resId,
        propertyId: row['Property ID'] || row['PropertyID'],
        unitId: row['Unit ID'] || row['UnitID'],
        address: row['Address'],
        travelerFirstName: row['Traveler First Name'],
        travelerLastName: row['Traveler Last Name'],
        bookingStatus: row['Booking status'] || row['Booking Status'],
        checkIn,
        checkOut,
        nights: parseInt(row['Nights'] || '0') || 0,
        payoutDate,
        grossBookingAmount: gross,
        deductions,
        payout,
        lodgingTaxOwnerRemits: lodgingTax,
        taxWithheld,
        payoutCurrency: currency,
        raw: row,
        bookingRequestId,
      },
      update: {
        grossBookingAmount: gross,
        deductions,
        payout,
        payoutDate,
        lodgingTaxOwnerRemits: lodgingTax,
        taxWithheld,
        raw: row,
        bookingRequestId,
      },
    });

    imported++;

    if (matchedBooking) {
      matched++;

      // If the stored guestName is a VRBO placeholder (common from iCal feeds),
      // upgrade it to the real name from the payout statement for better future matching + display.
      const currentGuest = (matchedBooking.guestName || '').trim();
      const isPlaceholder = /^reserved\b|^blocked\b/i.test(currentGuest) || currentGuest.length < 3;
      const realName = [row['Traveler First Name'], row['Traveler Last Name']].filter(Boolean).join(' ').trim();
      const shouldUpdateName = isPlaceholder && realName && realName.length > 3 && currentGuest.toLowerCase() !== realName.toLowerCase();

      const updateData: any = {};
      if (shouldUpdateName) {
        updateData.guestName = realName;
      }

      // Enrich the booking's pricing JSON with VRBO payout data for unified reports
      const current = (matchedBooking.pricing as any) || {};
      updateData.pricing = {
        ...current,
        vrboGrossBooking: gross,
        vrboDeductions: deductions,
        vrboPayout: payout,
        vrboPayoutDate: payoutDate ? payoutDate.toISOString().split('T')[0] : null,
        vrboLodgingTaxOwnerRemits: lodgingTax,
        vrboTaxWithheld: taxWithheld,
      };

      await prisma.bookingRequest.update({
        where: { id: matchedBooking.id },
        data: updateData,
      });
    } else {
      unmatched.push(resId);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    matched,
    unmatched,
    message: `Imported ${imported} rows. Matched ${matched} to existing VRBO bookings.`,
    debug: {
      note: 'Matching is PURELY by dates (exact start+end, with tolerant start-date fallback for legacy data). No names or Reservation IDs are used for matching BookingRequests. debug.rows shows parsed keys + matchMethod (date-only / tolerant-date-only / none).',
      rows: debugRows,
    },
  });
}

function parseVrboCsv(text: string): any[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect delimiter (tab or comma)
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));

  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: any = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || '';
    });
    rows.push(row);
  }
  return rows;
}

function parseVrboDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);

  // Always normalize to UTC midnight to avoid TZ drift between CSV parse and iCal import
  // Common VRBO formats: "May 22, 2026", "22-May-2026", "05/22/2026", "2026-05-22"
  const s = dateStr.trim();

  // 1. "May 22, 2026" or "22 May 2026"
  let m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const monStr = m[1].slice(0, 3).toLowerCase();
    const day = parseInt(m[2], 10);
    const yr = parseInt(m[3], 10);
    const months: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[monStr] ?? 0;
    return new Date(Date.UTC(yr, month, day));
  }

  // 2. "22-May-26" or "22-May-2026"
  m = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monStr = m[2].slice(0, 3).toLowerCase();
    let yr = parseInt(m[3], 10);
    if (yr < 50) yr += 2000;
    const months: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[monStr] ?? 0;
    return new Date(Date.UTC(yr, month, day));
  }

  // 3. ISO-ish or slashed "2026-05-22", "05/22/2026", "05-22-2026"
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])));
  }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += 2000;
    // Assume US order (month/day) as VRBO uses for US properties
    return new Date(Date.UTC(yr, parseInt(m[1]) - 1, parseInt(m[2])));
  }

  // Fallback: parse and normalize whatever we got to its UTC date component
  const native = new Date(s);
  if (!isNaN(native.getTime())) {
    return new Date(Date.UTC(
      native.getUTCFullYear(),
      native.getUTCMonth(),
      native.getUTCDate()
    ));
  }

  return new Date(0);
}

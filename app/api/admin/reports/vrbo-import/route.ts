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

    // Try to match existing VRBO booking
    // IMPORTANT:
    // - CSV "Reservation ID" (e.g. HA-Y7Q22R) is the friendly code from VRBO owner portal / payout reports.
    // - iCal sync stores a completely different opaque UID into externalId.
    // Primary match by externalId almost never succeeds.
    let matchedBooking = await prisma.bookingRequest.findFirst({
      where: {
        source: 'VRBO',
        externalId: resId,
      },
    });

    let matchMethod = matchedBooking ? 'externalId' : null;

    if (!matchedBooking && checkIn && checkOut) {
      const firstName = (row['Traveler First Name'] || '').trim().toLowerCase();
      const lastName = (row['Traveler Last Name'] || row['Traveler Last'] || '').trim().toLowerCase();
      const fullTraveler = (row['Traveler First Name'] + ' ' + (row['Traveler Last Name'] || '')).trim().toLowerCase();

      const nameTokens = [lastName, firstName, fullTraveler].filter(Boolean);

      // Robust approach: fetch all VRBO bookings (small number) and match in JS using date keys.
      // This avoids any Prisma <-> timestamptz / TZ serialization differences.
      const allVrbo = await prisma.bookingRequest.findMany({
        where: { source: 'VRBO' },
        select: { id: true, startDate: true, endDate: true, guestName: true, externalId: true },
      });

      function toDateKey(d: Date | string): string {
        const dt = d instanceof Date ? d : new Date(d);
        return dt.toISOString().slice(0, 10); // YYYY-MM-DD UTC
      }

      const csvStartKey = toDateKey(checkIn);
      const csvEndKey = toDateKey(checkOut);

      const dateMatches = allVrbo.filter(b => {
        return toDateKey(b.startDate) === csvStartKey && toDateKey(b.endDate) === csvEndKey;
      });

      // Try name tokens first among the date matches
      for (const token of nameTokens) {
        if (!token) continue;
        const byName = dateMatches.find(b => (b.guestName || '').toLowerCase().includes(token));
        if (byName) {
          matchedBooking = byName as any;  // we only selected a few fields, but id is there; later code only uses .id
          matchMethod = 'date+name:' + token;
          break;
        }
      }

      // No name match — fall back to pure date if exactly one (or pick first)
      if (!matchedBooking && dateMatches.length > 0) {
        matchedBooking = dateMatches[0] as any;
        matchMethod = dateMatches.length === 1 ? 'date-only' : 'date-only (first of ' + dateMatches.length + ')';
      }
    }

    const bookingRequestId = matchedBooking?.id || null;

    // If we matched via the JS date path we only have partial fields. Re-fetch full record so we can read guestName + pricing.
    if (matchedBooking && matchMethod && !matchMethod.startsWith('externalId')) {
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
    // Debug info (visible in browser Network tab when you upload)
    debug: {
      note: 'Primary externalId match rarely works because iCal UID != CSV Reservation ID',
      unmatchedCount: unmatched.length,
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

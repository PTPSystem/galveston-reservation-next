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
    // Note: externalId from iCal sync is a UUID (the iCal UID), while CSV "Reservation ID" is e.g. HA-Y7Q22R.
    // Primary match rarely succeeds; we rely on robust date + name fallback.
    let matchedBooking = await prisma.bookingRequest.findFirst({
      where: {
        source: 'VRBO',
        externalId: resId,
      },
    });

    if (!matchedBooking && checkIn && checkOut) {
      const firstName = (row['Traveler First Name'] || '').trim().toLowerCase();
      const lastName = (row['Traveler Last Name'] || row['Traveler Last'] || '').trim().toLowerCase();
      const fullTraveler = (row['Traveler First Name'] + ' ' + (row['Traveler Last Name'] || '')).trim().toLowerCase();

      // Build a normalized list of name tokens to search for
      const nameTokens = [lastName, firstName, fullTraveler].filter(Boolean);

      // Use date-range matching (day window) + flexible name to survive TZ/parser differences
      // and placeholder names like "Reserved - Christy" or "Blocked" from iCal feeds.
      const dayMs = 24 * 60 * 60 * 1000;

      // First, try with name tokens (last or first)
      for (const token of nameTokens) {
        if (!token) continue;
        matchedBooking = await prisma.bookingRequest.findFirst({
          where: {
            source: 'VRBO',
            startDate: {
              gte: new Date(checkIn.getTime()),
              lt: new Date(checkIn.getTime() + dayMs),
            },
            endDate: {
              gte: new Date(checkOut.getTime()),
              lt: new Date(checkOut.getTime() + dayMs),
            },
            guestName: {
              contains: token,
              mode: 'insensitive',
            },
          },
        });
        if (matchedBooking) break;
      }

      // If still no match, try date range only (no name). For a single-property calendar,
      // the date window is usually unique among VRBO bookings.
      if (!matchedBooking) {
        const candidates = await prisma.bookingRequest.findMany({
          where: {
            source: 'VRBO',
            startDate: {
              gte: new Date(checkIn.getTime()),
              lt: new Date(checkIn.getTime() + dayMs),
            },
            endDate: {
              gte: new Date(checkOut.getTime()),
              lt: new Date(checkOut.getTime() + dayMs),
            },
          },
          orderBy: { id: 'asc' },
        });

        if (candidates.length === 1) {
          matchedBooking = candidates[0];
        } else if (candidates.length > 1 && nameTokens.length > 0) {
          // Pick best candidate by name overlap if multiple on same dates (rare)
          const best = candidates.find(c => {
            const gn = (c.guestName || '').toLowerCase();
            return nameTokens.some(t => gn.includes(t));
          });
          matchedBooking = best || candidates[0];
        }
      }
    }

    const bookingRequestId = matchedBooking?.id || null;

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

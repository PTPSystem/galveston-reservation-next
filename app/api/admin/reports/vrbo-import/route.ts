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
    let matchedBooking = await prisma.bookingRequest.findFirst({
      where: {
        source: 'VRBO',
        externalId: resId,
      },
    });

    if (!matchedBooking) {
      // Fallback: match by dates + last name
      const lastName = (row['Traveler Last Name'] || row['Traveler Last'] || '').trim().toLowerCase();
      if (lastName && checkIn && checkOut) {
        matchedBooking = await prisma.bookingRequest.findFirst({
          where: {
            source: 'VRBO',
            startDate: checkIn,
            endDate: checkOut,
            guestName: {
              contains: lastName,
              mode: 'insensitive',
            },
          },
        });
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
      // Enrich the booking's pricing JSON with VRBO data for unified reports
      const current = (matchedBooking.pricing as any) || {};
      await prisma.bookingRequest.update({
        where: { id: matchedBooking.id },
        data: {
          pricing: {
            ...current,
            vrboGrossBooking: gross,
            vrboDeductions: deductions,
            vrboPayout: payout,
            vrboPayoutDate: payoutDate ? payoutDate.toISOString().split('T')[0] : null,
            vrboLodgingTaxOwnerRemits: lodgingTax,
            vrboTaxWithheld: taxWithheld,
          },
        },
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
  // Try native first
  const native = new Date(dateStr);
  if (!isNaN(native.getTime()) && dateStr.length > 6) return native;

  // Handle "22-May-26" or "22-May-2026"
  const match = dateStr.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const mon = match[2].slice(0, 3).toLowerCase();
    let yr = parseInt(match[3], 10);
    if (yr < 50) yr += 2000;

    const months: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[mon] ?? 0;
    return new Date(yr, month, day);
  }

  return new Date(dateStr);
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * VRBO owner statement CSV import.
 *
 * Newer VRBO exports use columns like Guest Name, Your Revenue, Payable To You,
 * Number of Nights, Stay Tax *, and may include multiple rows per Reservation ID
 * (Rent, Refund, loyalty/UNKNOWN). Older exports used Gross booking amount /
 * Deductions / Traveler First/Last Name.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const text = await file.text();
  const rawRows = parseVrboCsv(text);
  const rows = selectBestRowsPerReservation(rawRows);

  let imported = 0;
  let matched = 0;
  let unmatched: string[] = [];
  const skipped: string[] = [];
  const debugRows: any[] = [];

  for (const { row, resId, skippedReason } of rows) {
    if (skippedReason) {
      skipped.push(`${resId}: ${skippedReason}`);
      continue;
    }

    const checkIn = parseVrboDate(row['Check-in'] || row['Check In'] || row['check-in']);
    const checkOut = parseVrboDate(row['Check-out'] || row['Check Out'] || row['check-out']);
    const payoutDateStr =
      row['Payout date'] ||
      row['Payout Date'] ||
      row['Disbursement Date'] ||
      row['Payment Date'];
    const payoutDate = payoutDateStr ? parseVrboDate(payoutDateStr) : null;

    const amounts = extractFinancials(row);
    const currency = row['Payout currency'] || row['Currency'] || 'USD';
    const nights =
      parseInt(row['Nights'] || row['Number of Nights'] || '0', 10) || 0;

    const { firstName, lastName } = extractGuestNames(row);

    // Match to existing VRBO booking **purely by dates** (start + end).
    let matchedBooking: any = null;
    let matchMethod: string | null = null;

    let csvStartKey: string | undefined;
    let csvEndKey: string | undefined;
    let allVrbo: any[] | undefined;
    let dateMatches: any[] | undefined;
    let csvStartParts: any = null;
    let csvEndParts: any = null;

    function getDateParts(d: Date | string) {
      const dt = d instanceof Date ? d : new Date(d);
      return {
        year: dt.getUTCFullYear(),
        month: dt.getUTCMonth() + 1,
        day: dt.getUTCDate(),
      };
    }

    function getDateKey(d: Date | string): string {
      const p = getDateParts(d);
      return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    }

    if (checkIn && checkOut && !isInvalidDate(checkIn) && !isInvalidDate(checkOut)) {
      const allBookings = await prisma.bookingRequest.findMany({
        select: { id: true, startDate: true, endDate: true, guestName: true, externalId: true, source: true },
      });
      allVrbo = allBookings.filter((b: any) => b.source === 'VRBO');

      csvStartKey = getDateKey(checkIn);
      csvEndKey = getDateKey(checkOut);
      csvStartParts = getDateParts(checkIn);
      csvEndParts = getDateParts(checkOut);

      dateMatches = allVrbo.filter((b) => {
        const dbStart = getDateParts(b.startDate);
        const dbEnd = getDateParts(b.endDate);
        return (
          dbStart.year === csvStartParts.year &&
          dbStart.month === csvStartParts.month &&
          dbStart.day === csvStartParts.day &&
          dbEnd.year === csvEndParts.year &&
          dbEnd.month === csvEndParts.month &&
          dbEnd.day === csvEndParts.day
        );
      });

      if (dateMatches.length > 0) {
        matchedBooking = dateMatches[0];
        matchMethod =
          dateMatches.length === 1
            ? 'date-only'
            : `date-only (multiple: ${dateMatches.length}, took first)`;
      }

      if (!matchedBooking && csvStartParts && csvEndParts && allVrbo) {
        const tolerantStarts = allVrbo.filter((b: any) => {
          const dbStart = getDateParts(b.startDate);
          const dbEnd = getDateParts(b.endDate);
          const startDayDiff = Math.abs(
            (dbStart.year - csvStartParts.year) * 365 +
              (dbStart.month - csvStartParts.month) * 30 +
              (dbStart.day - csvStartParts.day)
          );
          const endDayDiff = Math.abs(
            (dbEnd.year - csvEndParts.year) * 365 +
              (dbEnd.month - csvEndParts.month) * 30 +
              (dbEnd.day - csvEndParts.day)
          );
          return startDayDiff <= 1 && endDayDiff <= 1;
        });
        if (tolerantStarts.length > 0) {
          matchedBooking = tolerantStarts[0];
          matchMethod =
            tolerantStarts.length === 1
              ? 'tolerant-date-only'
              : `tolerant-date-only (multiple, took first)`;
        }
      }

      if (!matchedBooking && csvStartParts && allVrbo) {
        const startOnlyMatches = allVrbo.filter((b: any) => {
          const dbStart = getDateParts(b.startDate);
          return (
            dbStart.year === csvStartParts.year &&
            dbStart.month === csvStartParts.month &&
            dbStart.day === csvStartParts.day
          );
        });
        if (startOnlyMatches.length > 0) {
          matchedBooking = startOnlyMatches[0];
          matchMethod =
            startOnlyMatches.length === 1
              ? 'start-date-only'
              : `start-date-only (multiple, took first)`;
        }
      }
    }

    const thisDebug: any = {
      resId,
      paymentType: row['Payment Type'] || row['PaymentType'] || '',
      guestName: row['Guest Name'] || [firstName, lastName].filter(Boolean).join(' '),
      rawCheckIn: row['Check-in'] || row['Check In'] || row['check-in'],
      rawCheckOut: row['Check-out'] || row['Check Out'] || row['check-out'],
      parsedCheckIn: checkIn && !isInvalidDate(checkIn) ? checkIn.toISOString() : null,
      parsedCheckOut: checkOut && !isInvalidDate(checkOut) ? checkOut.toISOString() : null,
      amounts,
      csvStartKey,
      csvEndKey,
      csvStartParts,
      csvEndParts,
      matchMethod: matchMethod || 'none',
      matchedId: matchedBooking?.id || null,
      dateMatchesCount: typeof dateMatches !== 'undefined' ? dateMatches.length : 0,
    };
    if (typeof dateMatches !== 'undefined') {
      thisDebug.dateMatches = dateMatches.map((d: any) => ({
        id: d.id,
        guestName: d.guestName,
        externalId: d.externalId,
      }));
    }
    if (typeof allVrbo !== 'undefined' && allVrbo.length < 30 && csvStartParts) {
      thisDebug.allVrboKeys = allVrbo.map((b: any) => {
        const bStartParts = getDateParts(b.startDate);
        const bEndParts = getDateParts(b.endDate);
        return {
          id: b.id,
          guestName: b.guestName,
          externalId: b.externalId,
          startKey: getDateKey(b.startDate),
          endKey: getDateKey(b.endDate),
          startParts: bStartParts,
          endParts: bEndParts,
          startMatch:
            bStartParts.year === csvStartParts.year &&
            bStartParts.month === csvStartParts.month &&
            bStartParts.day === csvStartParts.day,
          endMatch:
            bEndParts.year === csvEndParts.year &&
            bEndParts.month === csvEndParts.month &&
            bEndParts.day === csvEndParts.day,
        };
      });
    }
    debugRows.push(thisDebug);

    const bookingRequestId = matchedBooking?.id || null;

    if (matchedBooking) {
      const full = await prisma.bookingRequest.findUnique({
        where: { id: matchedBooking.id },
        select: { id: true, guestName: true, pricing: true },
      });
      if (full) matchedBooking = full as any;
    }

    await prisma.vrboPayout.upsert({
      where: { reservationId: resId },
      create: {
        reservationId: resId,
        propertyId: row['Property ID'] || row['PropertyID'],
        unitId: row['Unit ID'] || row['UnitID'],
        address: row['Address'],
        travelerFirstName: firstName || null,
        travelerLastName: lastName || null,
        bookingStatus: row['Booking status'] || row['Booking Status'] || row['Payment Type'],
        checkIn: checkIn && !isInvalidDate(checkIn) ? checkIn : new Date(0),
        checkOut: checkOut && !isInvalidDate(checkOut) ? checkOut : new Date(0),
        nights,
        payoutDate,
        grossBookingAmount: amounts.gross,
        deductions: amounts.deductions,
        payout: amounts.payout,
        lodgingTaxOwnerRemits: amounts.lodgingTax,
        taxWithheld: amounts.taxWithheld,
        payoutCurrency: currency,
        raw: row,
        bookingRequestId,
      },
      update: {
        grossBookingAmount: amounts.gross,
        deductions: amounts.deductions,
        payout: amounts.payout,
        payoutDate,
        lodgingTaxOwnerRemits: amounts.lodgingTax,
        taxWithheld: amounts.taxWithheld,
        travelerFirstName: firstName || undefined,
        travelerLastName: lastName || undefined,
        bookingStatus: row['Booking status'] || row['Booking Status'] || row['Payment Type'],
        raw: row,
        bookingRequestId,
        checkIn: checkIn && !isInvalidDate(checkIn) ? checkIn : undefined,
        checkOut: checkOut && !isInvalidDate(checkOut) ? checkOut : undefined,
        nights,
      },
    });

    imported++;

    if (matchedBooking) {
      matched++;

      const currentGuest = (matchedBooking.guestName || '').trim();
      const isPlaceholder =
        /^reserved\b|^blocked\b/i.test(currentGuest) || currentGuest.length < 3;
      const realName = [firstName, lastName].filter(Boolean).join(' ').trim();
      const shouldUpdateName =
        isPlaceholder &&
        realName &&
        realName.length > 3 &&
        currentGuest.toLowerCase() !== realName.toLowerCase();

      const updateData: any = {};
      if (shouldUpdateName) {
        updateData.guestName = realName;
      }

      const current = (matchedBooking.pricing as any) || {};
      updateData.pricing = {
        ...current,
        totalGuestPrice: amounts.payout,
        managementFee: amounts.payout * 0.22,
        ownerProceeds: amounts.payout * 0.78,
        vrboGrossBooking: amounts.gross,
        vrboDeductions: amounts.deductions,
        vrboPayout: amounts.payout,
        vrboPayoutDate: payoutDate ? payoutDate.toISOString().split('T')[0] : null,
        vrboLodgingTaxOwnerRemits: amounts.lodgingTax,
        vrboTaxWithheld: amounts.taxWithheld,
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
    skipped,
    message: `Imported ${imported} reservations. Matched ${matched} to existing VRBO bookings.${
      skipped.length ? ` Skipped ${skipped.length} non-financial rows.` : ''
    }`,
    debug: {
      note: 'Uses best financial row per Reservation ID (prefers Payment Type=Rent). Parses $-formatted amounts. Matches bookings by dates only.',
      rows: debugRows,
    },
  });
}

/** Parse currency like "$4,328.99", "($1,678.83)", "UNKNOWN", "0.00" */
export function parseMoney(value: string | undefined | null): number {
  if (value == null) return 0;
  const s = String(value).trim();
  if (!s || /^unknown$/i.test(s) || s === '-' || s === '—' || s === '–') return 0;

  const wrappedNegative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[,$%\s]/g, '').replace(/^\(/, '').replace(/\)$/, '').replace(/^\$/, '');
  if (!cleaned || cleaned === '-') return 0;

  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  if (wrappedNegative) return -Math.abs(n);
  return n;
}

function extractFinancials(row: Record<string, string>) {
  // New Payment Data export
  const yourRevenue = parseMoney(row['Your Revenue']);
  const payableToYou = parseMoney(row['Payable To You']);
  const payoutCol = parseMoney(row['Payout']);
  const guestPayment = parseMoney(row['Guest Payment']);
  const commission = Math.abs(parseMoney(row['Commission']));
  const serviceFee = Math.abs(parseMoney(row['Service Fee']));
  const processingFee = Math.abs(parseMoney(row['Payment Processing Fee']));

  // Legacy owner statement columns
  const legacyGross = parseMoney(row['Gross booking amount'] || row['Gross booking']);
  const legacyDeductions = parseMoney(row['Deductions']);
  const legacyPayout = parseMoney(row['Payout']);

  const gross = yourRevenue || legacyGross || guestPayment || 0;
  const payout =
    (payableToYou !== 0 ? payableToYou : 0) ||
    (payoutCol !== 0 ? payoutCol : 0) ||
    legacyPayout ||
    0;
  const deductions =
    legacyDeductions ||
    (commission || serviceFee || processingFee
      ? commission + serviceFee + processingFee
      : Math.max(0, Math.abs(gross) - Math.abs(payout)));

  const lodgingTax = parseMoney(
    row['Stay Tax You Remit'] ||
      row['Lodging Tax Owner Remits'] ||
      row['Lodging Tax'] ||
      '0'
  );
  const taxWithheld = Math.abs(
    parseMoney(row['Stay Tax We Remit'] || row['Tax Withheld'] || '0')
  );

  return { gross, deductions, payout, lodgingTax, taxWithheld };
}

function extractGuestNames(row: Record<string, string>): { firstName: string; lastName: string } {
  const first = (row['Traveler First Name'] || '').trim();
  const last = (row['Traveler Last Name'] || '').trim();
  if (first || last) return { firstName: first, lastName: last };

  const full = (row['Guest Name'] || '').trim();
  if (!full) return { firstName: '', lastName: '' };
  const parts = full.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Newer CSVs have multiple rows per reservation (Rent, Refund, loyalty/UNKNOWN).
 * Keep the most financially meaningful row so UNKNOWN loyalty lines do not
 * overwrite Rent amounts with zeros.
 */
function selectBestRowsPerReservation(
  rawRows: Record<string, string>[]
): Array<{ row: Record<string, string>; resId: string; skippedReason?: string }> {
  const byRes = new Map<string, Record<string, string>[]>();

  for (const row of rawRows) {
    const resId = (
      row['Reservation ID'] ||
      row['ReservationID'] ||
      row['reservation id'] ||
      ''
    ).trim();
    if (!resId) continue;
    const list = byRes.get(resId) || [];
    list.push(row);
    byRes.set(resId, list);
  }

  const selected: Array<{ row: Record<string, string>; resId: string; skippedReason?: string }> =
    [];

  for (const [resId, group] of byRes) {
    let best: Record<string, string> | null = null;
    let bestScore = -Infinity;

    for (const row of group) {
      const score = scoreFinancialRow(row);
      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }

    if (!best || bestScore < 0) {
      selected.push({
        row: best || group[0],
        resId,
        skippedReason: 'no usable payout amounts (loyalty/UNKNOWN only)',
      });
      continue;
    }

    selected.push({ row: best, resId });
  }

  return selected;
}

function scoreFinancialRow(row: Record<string, string>): number {
  const paymentType = (row['Payment Type'] || row['PaymentType'] || '').trim().toLowerCase();
  const amounts = extractFinancials(row);
  const absPayout = Math.abs(amounts.payout);
  const absGross = Math.abs(amounts.gross);

  if (absPayout === 0 && absGross === 0) return -1;

  let score = absPayout * 10 + absGross;
  if (paymentType === 'rent') score += 1_000_000;
  else if (paymentType === 'refund') score += 100_000;
  else if (paymentType === 'batch payout') score += 10;
  else if (!paymentType) score -= 50_000; // loyalty / empty type
  return score;
}

function isInvalidDate(d: Date): boolean {
  return !d || isNaN(d.getTime()) || d.getTime() === 0;
}

function parseVrboCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  function parseCsvRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map((v) => v.replace(/^"|"$/g, ''));
  }

  const headers = parseCsvRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || '';
    });
    rows.push(row);
  }
  return rows;
}

function parseVrboDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);

  const s = dateStr.trim();

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

  m = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monStr = m[2].slice(0, 3).toLowerCase();
    let yr = parseInt(m[3], 10);
    if (yr < 50) yr += 2000;
    else if (yr < 100) yr += 2000;
    const months: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[monStr] ?? 0;
    return new Date(Date.UTC(yr, month, day));
  }

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])));
  }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += 2000;
    return new Date(Date.UTC(yr, parseInt(m[1]) - 1, parseInt(m[2])));
  }

  const native = new Date(s);
  if (!isNaN(native.getTime())) {
    return new Date(
      Date.UTC(native.getUTCFullYear(), native.getUTCMonth(), native.getUTCDate())
    );
  }

  return new Date(0);
}

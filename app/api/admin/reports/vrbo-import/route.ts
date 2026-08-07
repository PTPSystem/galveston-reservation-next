import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * VRBO owner statement CSV import.
 *
 * Supports:
 * 1) Payout Summary Report (preferred): Gross booking amount / Deductions / Payout,
 *    Traveler First/Last Name, Check-in like "July 10, 2026"
 * 2) Payment Data Property export: Your Revenue / Payable To You / Guest Name,
 *    multiple rows per Reservation ID (Rent, Refund, loyalty/UNKNOWN)
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
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
  const errors: string[] = [];
  const debugRows: any[] = [];

  for (const { row, resId, skippedReason, score } of rows) {
    if (skippedReason) {
      skipped.push(`${resId}: ${skippedReason} (score=${score})`);
      continue;
    }

    try {

    const checkIn = parseVrboDate(
      getField(row, 'Check-in', 'Check In', 'check-in')
    );
    const checkOut = parseVrboDate(
      getField(row, 'Check-out', 'Check Out', 'check-out')
    );
    const payoutDateStr =
      getField(row, 'Payout date', 'Payout Date', 'Disbursement Date', 'Payment Date');
    const payoutDate = payoutDateStr ? parseVrboDate(payoutDateStr) : null;

    const amounts = extractFinancials(row);
    const currency = getField(row, 'Payout currency', 'Currency') || 'USD';
    const nights =
      parseInt(getField(row, 'Nights', 'Number of Nights') || '0', 10) || 0;

    const { firstName, lastName } = extractGuestNames(row);
    const csvGuestFull = [firstName, lastName].filter(Boolean).join(' ').trim();

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

      // Name fallback for iCal placeholders like "Reserved - Bette"
      if (!matchedBooking && csvGuestFull && allVrbo) {
        const guestToken = csvGuestFull.split(/\s+/)[0].toLowerCase();
        const nameMatches = allVrbo.filter((b: any) => {
          const g = (b.guestName || '').toLowerCase();
          return g.includes(guestToken) || guestToken.length > 2 && g.includes(guestToken);
        });
        if (nameMatches.length === 1) {
          matchedBooking = nameMatches[0];
          matchMethod = 'guest-name-fallback';
        }
      }
    }

    const thisDebug: any = {
      resId,
      paymentType: getField(row, 'Payment Type', 'PaymentType'),
      guestName: getField(row, 'Guest Name') || csvGuestFull,
      rawCheckIn: getField(row, 'Check-in', 'Check In', 'check-in'),
      rawCheckOut: getField(row, 'Check-out', 'Check Out', 'check-out'),
      parsedCheckIn: checkIn && !isInvalidDate(checkIn) ? checkIn.toISOString() : null,
      parsedCheckOut: checkOut && !isInvalidDate(checkOut) ? checkOut.toISOString() : null,
      amounts,
      score,
      csvStartKey,
      csvEndKey,
      csvStartParts,
      csvEndParts,
      matchMethod: matchMethod || 'none',
      matchedId: matchedBooking?.id || null,
      matchedGuest: matchedBooking?.guestName || null,
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

    const existingPayout = await prisma.vrboPayout.findUnique({
      where: { reservationId: resId },
      select: { payout: true, grossBookingAmount: true },
    });

    // VRBO sometimes reissues a different HA- ID for the same stay; an older
    // payout row may already hold the unique booking_request_id link.
    let linkedByBooking: { reservationId: string; payout: number; grossBookingAmount: number } | null =
      null;
    if (bookingRequestId) {
      linkedByBooking = await prisma.vrboPayout.findFirst({
        where: {
          bookingRequestId,
          NOT: { reservationId: resId },
        },
        select: {
          reservationId: true,
          payout: true,
          grossBookingAmount: true,
        },
      });
    }

    const safeGross =
      amounts.gross !== 0
        ? amounts.gross
        : existingPayout?.grossBookingAmount || linkedByBooking?.grossBookingAmount || 0;
    const safePayout =
      amounts.payout !== 0
        ? amounts.payout
        : existingPayout?.payout || linkedByBooking?.payout || 0;

    if (bookingRequestId) {
      await prisma.vrboPayout.updateMany({
        where: {
          bookingRequestId,
          NOT: { reservationId: resId },
        },
        data: {
          bookingRequestId: null,
          // Avoid double-counting the same stay under two HA- IDs in reports
          ...(amounts.payout !== 0
            ? { payout: 0, grossBookingAmount: 0, deductions: 0 }
            : {}),
        },
      });
    }

    await prisma.vrboPayout.upsert({
      where: { reservationId: resId },
      create: {
        reservationId: resId,
        propertyId: getField(row, 'Property ID', 'PropertyID') || null,
        unitId: getField(row, 'Unit ID', 'UnitID') || null,
        address: getField(row, 'Address') || null,
        travelerFirstName: firstName || null,
        travelerLastName: lastName || null,
        bookingStatus:
          getField(row, 'Booking status', 'Booking Status', 'Payment Type') || null,
        checkIn: checkIn && !isInvalidDate(checkIn) ? checkIn : new Date(0),
        checkOut: checkOut && !isInvalidDate(checkOut) ? checkOut : new Date(0),
        nights,
        payoutDate,
        grossBookingAmount: safeGross,
        deductions: amounts.deductions,
        payout: safePayout,
        lodgingTaxOwnerRemits: amounts.lodgingTax,
        taxWithheld: amounts.taxWithheld,
        payoutCurrency: currency,
        raw: row,
        bookingRequestId,
      },
      update: {
        grossBookingAmount: safeGross,
        deductions: amounts.deductions,
        payout: safePayout,
        payoutDate,
        lodgingTaxOwnerRemits: amounts.lodgingTax,
        taxWithheld: amounts.taxWithheld,
        travelerFirstName: firstName || undefined,
        travelerLastName: lastName || undefined,
        bookingStatus:
          getField(row, 'Booking status', 'Booking Status', 'Payment Type') || undefined,
        raw: row,
        bookingRequestId,
        checkIn: checkIn && !isInvalidDate(checkIn) ? checkIn : undefined,
        checkOut: checkOut && !isInvalidDate(checkOut) ? checkOut : undefined,
        nights,
      },
    });

    imported++;
    thisDebug.unlinkedPriorReservationId = linkedByBooking?.reservationId || null;

    if (matchedBooking) {
      matched++;

      const currentGuest = (matchedBooking.guestName || '').trim();
      const isPlaceholder =
        /^reserved\b|^blocked\b/i.test(currentGuest) || currentGuest.length < 3;
      const realName = csvGuestFull;
      const shouldUpdateName =
        isPlaceholder &&
        realName &&
        realName.length > 3 &&
        currentGuest.toLowerCase() !== realName.toLowerCase();

      // Only write pricing when we have a real payout; do not re-zero matched stays
      if (safePayout !== 0 || shouldUpdateName) {
        const updateData: any = {};
        if (shouldUpdateName) {
          updateData.guestName = realName;
        }
        if (safePayout !== 0) {
          const current = (matchedBooking.pricing as any) || {};
          updateData.pricing = {
            ...current,
            totalGuestPrice: safePayout,
            managementFee: safePayout * 0.22,
            ownerProceeds: safePayout * 0.78,
            vrboGrossBooking: safeGross,
            vrboDeductions: amounts.deductions,
            vrboPayout: safePayout,
            vrboPayoutDate: payoutDate ? payoutDate.toISOString().split('T')[0] : null,
            vrboLodgingTaxOwnerRemits: amounts.lodgingTax,
            vrboTaxWithheld: amounts.taxWithheld,
          };
        }

        await prisma.bookingRequest.update({
          where: { id: matchedBooking.id },
          data: updateData,
        });
      }
    } else {
      unmatched.push(resId);
    }
    } catch (rowError: any) {
      const msg = rowError?.message || String(rowError);
      errors.push(`${resId}: ${msg}`);
      debugRows.push({
        resId,
        error: msg,
        matchMethod: 'error',
      });
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    imported,
    matched,
    unmatched,
    skipped,
    errors,
    message: `Imported ${imported} reservations. Matched ${matched} to existing VRBO bookings.${
      skipped.length ? ` Skipped ${skipped.length} non-financial rows.` : ''
    }${errors.length ? ` ${errors.length} row error(s).` : ''}`,
    error: errors.length ? errors.slice(0, 3).join(' | ') : undefined,
    debug: {
      note: 'Uses best financial row per Reservation ID (prefers Payment Type=Rent). Parses $-formatted amounts. Matches bookings by dates only. Re-links when VRBO reissues a different HA- ID for the same stay.',
      rows: debugRows,
    },
  });
  } catch (error: any) {
    console.error('VRBO import failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Import failed',
        message: error?.message || 'Import failed',
      },
      { status: 500 }
    );
  }
}

/** Parse currency like "$4,328.99", "($1,678.83)", "UNKNOWN", "0.00" */
export function parseMoney(value: string | undefined | null): number {
  if (value == null) return 0;
  let s = String(value).trim();
  if (!s || /^unknown$/i.test(s) || s === '-' || s === '—' || s === '–') return 0;

  const wrappedNegative = /^\(.*\)$/.test(s);
  const leadingNegative = s.startsWith('-');
  // Keep digits and dot only (handles $, commas, spaces, unicode currency)
  s = s.replace(/[^0-9.]/g, '');
  if (!s) return 0;

  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (wrappedNegative || leadingNegative) return -Math.abs(n);
  return n;
}

function firstNonZero(...vals: number[]): number {
  for (const v of vals) {
    if (typeof v === 'number' && !isNaN(v) && v !== 0) return v;
  }
  return 0;
}

function extractFinancials(row: Record<string, string>) {
  const yourRevenue = parseMoney(getField(row, 'Your Revenue'));
  const payableToYou = parseMoney(getField(row, 'Payable To You'));
  const payoutCol = parseMoney(getField(row, 'Payout'));
  const guestPayment = parseMoney(getField(row, 'Guest Payment'));
  const commission = Math.abs(parseMoney(getField(row, 'Commission')));
  const serviceFee = Math.abs(parseMoney(getField(row, 'Service Fee')));
  const processingFee = Math.abs(parseMoney(getField(row, 'Payment Processing Fee')));

  const legacyGross = parseMoney(
    getField(row, 'Gross booking amount') || getField(row, 'Gross booking')
  );
  const legacyDeductions = parseMoney(getField(row, 'Deductions'));
  const legacyPayout = parseMoney(getField(row, 'Payout'));

  const gross = firstNonZero(yourRevenue, legacyGross, guestPayment);

  // Prefer Payable To You / Payout; if those are UNKNOWN/0, fall back to Your Revenue
  // so loyalty lines still carry a usable amount when no Rent row exists.
  const payout = firstNonZero(
    payableToYou,
    payoutCol,
    legacyPayout,
    yourRevenue > 0 ? yourRevenue : 0,
    legacyGross > 0 ? legacyGross : 0
  );

  const deductions =
    legacyDeductions ||
    (commission || serviceFee || processingFee
      ? commission + serviceFee + processingFee
      : Math.max(0, Math.abs(gross) - Math.abs(payout)));

  const lodgingTax = parseMoney(
    getField(row, 'Stay Tax You Remit') ||
      getField(row, 'Lodging Tax Owner Remits') ||
      getField(row, 'Lodging Tax') ||
      '0'
  );
  const taxWithheld = Math.abs(
    parseMoney(getField(row, 'Stay Tax We Remit') || getField(row, 'Tax Withheld') || '0')
  );

  return { gross, deductions, payout, lodgingTax, taxWithheld };
}

/** Case/BOM-insensitive field getter for VRBO CSV headers */
function getField(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    if (row[name] != null && row[name] !== '') return row[name];
  }
  const entries = Object.entries(row);
  for (const name of names) {
    const target = name.replace(/^\uFEFF/, '').trim().toLowerCase();
    for (const [k, v] of entries) {
      if (k.replace(/^\uFEFF/, '').trim().toLowerCase() === target) return v || '';
    }
  }
  return '';
}

function extractGuestNames(row: Record<string, string>): { firstName: string; lastName: string } {
  const first = getField(row, 'Traveler First Name').trim();
  const last = getField(row, 'Traveler Last Name').trim();
  if (first || last) return { firstName: first, lastName: last };

  const full = getField(row, 'Guest Name').trim();
  if (!full) return { firstName: '', lastName: '' };
  const parts = full.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Newer CSVs have multiple rows per reservation (Rent, Refund, loyalty/UNKNOWN).
 * Keep the most financially meaningful row so loyalty/UNKNOWN lines do not
 * overwrite Rent amounts with zeros.
 */
function selectBestRowsPerReservation(
  rawRows: Record<string, string>[]
): Array<{ row: Record<string, string>; resId: string; skippedReason?: string; score?: number }> {
  const byRes = new Map<string, Record<string, string>[]>();

  for (const row of rawRows) {
    const resId = getField(row, 'Reservation ID', 'ReservationID', 'reservation id').trim();
    if (!resId) continue;
    const list = byRes.get(resId) || [];
    list.push(row);
    byRes.set(resId, list);
  }

  const selected: Array<{
    row: Record<string, string>;
    resId: string;
    skippedReason?: string;
    score?: number;
  }> = [];

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

    // Only skip when every row for this reservation has literally no money fields.
    // Never drop Rent/Refund rows just because scoring is imperfect.
    if (!best || bestScore < 0) {
      const hasTypedPayment = group.some((r) => {
        const t = getField(r, 'Payment Type', 'PaymentType').trim().toLowerCase();
        return t === 'rent' || t === 'refund';
      });
      if (!hasTypedPayment) {
        selected.push({
          row: best || group[0],
          resId,
          skippedReason: 'no usable payout amounts (loyalty/UNKNOWN only)',
          score: bestScore,
        });
        continue;
      }
    }

    selected.push({ row: best || group[0], resId, score: bestScore });
  }

  return selected;
}

function scoreFinancialRow(row: Record<string, string>): number {
  const paymentType = getField(row, 'Payment Type', 'PaymentType').trim().toLowerCase();
  const amounts = extractFinancials(row);
  const payout = amounts.payout;
  const gross = amounts.gross;
  const absPayout = Math.abs(payout);
  const absGross = Math.abs(gross);

  if (absPayout === 0 && absGross === 0) return -1;

  // Prefer real Rent settlements with positive payout above everything else
  if (paymentType === 'rent') {
    return 2_000_000 + (payout > 0 ? payout * 10 : absPayout);
  }
  // Positive payable amounts (any type)
  if (payout > 0) return 1_000_000 + payout * 10 + absGross;
  // Loyalty / empty type with revenue but UNKNOWN payout — still usable after fallback
  if (!paymentType && gross > 0) return 100_000 + gross;
  // Refunds are real financial events but should not beat a positive Rent/payout
  if (paymentType === 'refund') return 10_000 + absPayout;
  if (paymentType === 'batch payout') return 10 + absPayout;

  return absPayout + absGross;
}

function isInvalidDate(d: Date): boolean {
  return !d || isNaN(d.getTime()) || d.getTime() === 0;
}

function parseVrboCsv(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present
  const cleanedText = text.replace(/^\uFEFF/, '');
  const lines = cleanedText.trim().split(/\r?\n/);
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

  const headers = parseCsvRow(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
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

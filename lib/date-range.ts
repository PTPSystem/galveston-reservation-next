/**
 * Stay dates are stored as America/Chicago wall times:
 * check-in 3:00 PM, check-out 11:00 AM so back-to-back listings do not overlap.
 */
export const PROPERTY_TIME_ZONE = 'America/Chicago';
export const CHECK_IN_HOUR = 15;
export const CHECK_OUT_HOUR = 11;
export const CHECK_IN_TIME_LABEL = '3:00 PM';
export const CHECK_OUT_TIME_LABEL = '11:00 AM';

export type StayDateRole = 'check-in' | 'check-out';
export type UnavailableSource = 'booking' | 'blocked';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** Convert a civil date/time in the property time zone to a UTC Date. */
export function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = PROPERTY_TIME_ZONE
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(utc), timeZone);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    utc += desired - actual;
  }
  return new Date(utc);
}

/**
 * Calendar-day key (YYYY-MM-DD) for a stay instant.
 * Date-only strings and legacy UTC-midnight values keep their stated calendar day.
 * Timed instants use America/Chicago.
 */
export function stayDateKey(d: string | Date): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const dateOnly = d.slice(0, 10);
    if (!d.includes('T') || /T00:00:00(\.000)?Z?$/.test(d)) {
      return dateOnly;
    }
    d = new Date(d);
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (
    dt.getUTCHours() === 0 &&
    dt.getUTCMinutes() === 0 &&
    dt.getUTCSeconds() === 0
  ) {
    return dt.toISOString().split('T')[0];
  }
  const p = zonedParts(dt, PROPERTY_TIME_ZONE);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toStayCheckIn(input: string | Date): Date {
  const [y, m, d] = stayDateKey(input).split('-').map(Number);
  return wallTimeToUtc(y, m, d, CHECK_IN_HOUR, 0);
}

export function toStayCheckOut(input: string | Date): Date {
  const [y, m, d] = stayDateKey(input).split('-').map(Number);
  return wallTimeToUtc(y, m, d, CHECK_OUT_HOUR, 0);
}

export function stayNights(start: string | Date, end: string | Date): number {
  const [sy, sm, sd] = stayDateKey(start).split('-').map(Number);
  const [ey, em, ed] = stayDateKey(end).split('-').map(Number);
  return Math.round(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / (1000 * 60 * 60 * 24)
  );
}

export function formatStayDate(
  d: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const instant = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? toStayCheckIn(d)
    : d instanceof Date
      ? d
      : new Date(d);
  return instant.toLocaleDateString('en-US', {
    timeZone: PROPERTY_TIME_ZONE,
    ...options,
  });
}

function isDateOnlyString(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isUtcMidnightInstant(d: string | Date): boolean {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return false;
  return (
    dt.getUTCHours() === 0 &&
    dt.getUTCMinutes() === 0 &&
    dt.getUTCSeconds() === 0 &&
    dt.getUTCMilliseconds() === 0
  );
}

export function formatStayDateTime(
  d: string | Date,
  role: StayDateRole = 'check-in'
): string {
  const dateOnly = typeof d === 'string' && isDateOnlyString(d);
  const instant =
    dateOnly || isUtcMidnightInstant(d)
      ? role === 'check-out'
        ? toStayCheckOut(d)
        : toStayCheckIn(d)
      : d instanceof Date
        ? d
        : new Date(d);
  return instant.toLocaleString('en-US', {
    timeZone: PROPERTY_TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** YYYY-MM-DD plus N calendar days (UTC date arithmetic, no DST shift). */
export function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Local midnight Date for a YYYY-MM-DD calendar day (for DayPicker). */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Half-open stay [check-in date, check-out date) vs an unavailable period.
 * Bookings free the checkout calendar day for the next 3pm check-in.
 * Manual blocks occupy their end date too.
 */
export function stayOverlapsUnavailablePeriod(
  stayStart: string,
  stayEnd: string,
  period: { startDate: string; endDate: string; source?: UnavailableSource }
): boolean {
  const stayS = stayStart.slice(0, 10);
  const stayE = stayEnd.slice(0, 10);
  const periodS = period.startDate.slice(0, 10);
  const periodEExclusive =
    period.source === 'blocked'
      ? addCalendarDays(period.endDate, 1)
      : period.endDate.slice(0, 10);
  return stayS < periodEExclusive && stayE > periodS;
}

/** Inclusive local date range to disable on the public calendar. */
export function unavailableDisabledRange(period: {
  startDate: string;
  endDate: string;
  source?: UnavailableSource;
}): { from: Date; to: Date } | null {
  const from = parseLocalDate(period.startDate);
  const lastOccupied =
    period.source === 'blocked'
      ? period.endDate
      : addCalendarDays(period.endDate, -1);
  if (lastOccupied < period.startDate.slice(0, 10)) return null;
  return { from, to: parseLocalDate(lastOccupied) };
}

/**
 * Half-open stay intervals [check-in, check-out).
 * Checkout morning is available for the next guest (back-to-back stays allowed).
 */
export function dateRangesOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date,
  endB: string | Date
): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return aStart < bEnd && bStart < aEnd;
}

/** Prisma filter for stays overlapping [startDate, endDate). */
export function overlappingDateRangeWhere(startDate: Date, endDate: Date) {
  return {
    startDate: { lt: endDate },
    endDate: { gt: startDate },
  };
}

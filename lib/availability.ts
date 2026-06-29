import prisma from '@/lib/prisma';

export type AvailabilityConflict = 'booking' | 'blocked';

/** Prisma filter for date ranges that overlap [startDate, endDate). */
export function overlappingDateRangeWhere(startDate: Date, endDate: Date) {
  return {
    startDate: { lt: endDate },
    endDate: { gt: startDate },
  };
}

/**
 * Returns whether the requested stay conflicts with a CONFIRMED booking
 * or admin-blocked period. Matches the overlap logic used on the calendar.
 */
export async function findAvailabilityConflict(
  startDate: Date,
  endDate: Date
): Promise<AvailabilityConflict | null> {
  const overlap = overlappingDateRangeWhere(startDate, endDate);

  const [overlappingBooking, overlappingBlock] = await Promise.all([
    prisma.bookingRequest.findFirst({
      where: { status: 'CONFIRMED', ...overlap },
      select: { id: true },
    }),
    prisma.blockedPeriod.findFirst({
      where: overlap,
      select: { id: true },
    }),
  ]);

  if (overlappingBooking) {
    return 'booking';
  }

  if (overlappingBlock) {
    return 'blocked';
  }

  return null;
}

export function availabilityConflictMessage(
  conflict: AvailabilityConflict
): string {
  if (conflict === 'booking') {
    return 'Those dates are not available. Please choose different dates.';
  }

  return 'Those dates are blocked and unavailable. Please choose different dates.';
}

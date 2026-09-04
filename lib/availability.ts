import prisma from '@/lib/prisma';
import {
  overlappingDateRangeWhere,
  stayDateKey,
  stayOverlapsUnavailablePeriod,
} from '@/lib/date-range';

export type AvailabilityConflict = 'booking' | 'blocked';

export { dateRangesOverlap, overlappingDateRangeWhere } from '@/lib/date-range';

export function availabilityConflictMessage(
  conflict: AvailabilityConflict
): string {
  if (conflict === 'booking') {
    return 'Those dates are not available. Please choose different dates.';
  }

  return 'Those dates are blocked and unavailable. Please choose different dates.';
}

/**
 * Returns whether the requested stay conflicts with a CONFIRMED booking
 * or admin-blocked period. Matches the overlap logic used on the calendar.
 */
export async function findAvailabilityConflict(
  startDate: Date,
  endDate: Date,
  options?: { excludeBookingId?: number }
): Promise<AvailabilityConflict | null> {
  const overlap = overlappingDateRangeWhere(startDate, endDate);
  const excludeId = options?.excludeBookingId;

  const stayStartKey = stayDateKey(startDate);
  const stayEndKey = stayDateKey(endDate);

  const [overlappingBooking, candidateBlocks] = await Promise.all([
    prisma.bookingRequest.findFirst({
      where: {
        status: 'CONFIRMED',
        ...overlap,
        ...(excludeId != null ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    }),
    prisma.blockedPeriod.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: new Date(`${stayStartKey}T00:00:00.000Z`) },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  if (overlappingBooking) {
    return 'booking';
  }

  const overlappingBlock = candidateBlocks.some((block) =>
    stayOverlapsUnavailablePeriod(stayStartKey, stayEndKey, {
      startDate: stayDateKey(block.startDate),
      endDate: stayDateKey(block.endDate),
      source: 'blocked',
    })
  );

  if (overlappingBlock) {
    return 'blocked';
  }

  return null;
}

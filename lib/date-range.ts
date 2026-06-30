/**
 * Half-open stay intervals [check-in, check-out).
 * Checkout day is available for the next guest (back-to-back stays allowed).
 */
export function dateRangesOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date,
  endB: string | Date
): boolean {
  const toKey = (d: string | Date) =>
    typeof d === 'string' ? d.slice(0, 10) : d.toISOString().split('T')[0];

  const aStart = toKey(startA);
  const aEnd = toKey(endA);
  const bStart = toKey(startB);
  const bEnd = toKey(endB);

  return aStart < bEnd && bStart < aEnd;
}

/** Prisma filter for stays overlapping [startDate, endDate). */
export function overlappingDateRangeWhere(startDate: Date, endDate: Date) {
  return {
    startDate: { lt: endDate },
    endDate: { gt: startDate },
  };
}

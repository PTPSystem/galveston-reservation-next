import prisma from '@/lib/prisma';
import { seedDefaultHolidaysIfEmpty, seedDefaultEmailSettingsIfEmpty } from '@/lib/seed-holidays';
import HolidayCalendarClient from './HolidayCalendarClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Force dynamic rendering so this page doesn't require DB access at build time
export const dynamic = 'force-dynamic';

export default async function AdminHolidaysPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    redirect('/login');
  }

  // Automatically seed default holidays and email settings if empty
  await seedDefaultHolidaysIfEmpty();
  await seedDefaultEmailSettingsIfEmpty();

  const rawHolidays = await prisma.holidayPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });

  // Convert Date objects from Prisma to ISO strings for the client
  const holidays = rawHolidays.map(h => ({
    ...h,
    startDate: h.startDate.toISOString(),
    endDate: h.endDate.toISOString(),
  }));

  const rawBlocks = await prisma.blockedPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });

  const blocks = rawBlocks.map(b => ({
    ...b,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
  }));

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Holiday, Peak &amp; Blocked Dates</h1>
          <p className="text-slate-700 text-sm mt-1">
            Manage holiday/peak periods (for special pricing) and manually blocked dates (unavailable on the calendar). PM/Owner can add/remove dates here. New blocks are checked against existing confirmed bookings.
          </p>
        </div>
      </div>

      <HolidayCalendarClient initialHolidays={holidays} initialBlocks={blocks} />
    </div>
  );
}

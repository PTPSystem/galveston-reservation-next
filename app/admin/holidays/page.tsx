import prisma from '@/lib/prisma';
import { seedDefaultHolidaysIfEmpty, seedDefaultEmailSettingsIfEmpty } from '@/lib/seed-holidays';
import HolidayCalendarClient from './HolidayCalendarClient';

// Force dynamic rendering so this page doesn't require DB access at build time
export const dynamic = 'force-dynamic';

export default async function AdminHolidaysPage() {
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

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Holiday & Peak Period Calendar</h1>
          <p className="text-slate-700 text-sm mt-1">
            Manage dates that use the special holiday rate. Click any row or the Edit button to modify.
          </p>
        </div>
      </div>

      <HolidayCalendarClient initialHolidays={holidays} />
    </div>
  );
}

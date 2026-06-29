import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import QuoteClient from './QuoteClient';
import { auth } from '@/lib/auth';
import { ADMIN_ROLES, needsEmailReconfirmation } from '@/lib/admin-auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function AdminQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!role || !ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
    redirect('/login');
  }

  const lastVerification = (session?.user as { lastEmailVerification?: Date | string | null })
    ?.lastEmailVerification;
  if (needsEmailReconfirmation(lastVerification ? new Date(lastVerification) : null)) {
    const email = session?.user?.email ?? '';
    redirect(`/verify?email=${encodeURIComponent(email)}`);
  }

  const { id } = await params;
  const requestId = parseInt(id);

  if (isNaN(requestId)) notFound();

  const bookingRequest = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    include: {
      adjustments: {
        orderBy: { createdAt: 'desc' },
      },
      vrboPayout: true,
    },
  });

  if (!bookingRequest) notFound();

  // Load active holiday periods for rate calculation
  const holidayPeriods = await prisma.holidayPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });

  // Load current rate settings (for base rates, weekly discount, cleaning fee)
  const rateSetting = (await prisma.rateSetting.findFirst()) ?? {
    // Fallback defaults if none set yet
    id: 0,
    weekdayRate: 500,
    weekendRate: 650,
    holidayRate: 700,
    weeklyDiscount: 350,
    cleaningFee: 300,
    updatedAt: new Date(),
  } as any;

  // Serialize dates to strings for the client component (avoids Date object issues)
  const serializedRequest = {
    ...bookingRequest,
    startDate: bookingRequest.startDate.toISOString().split('T')[0],
    endDate: bookingRequest.endDate.toISOString().split('T')[0],
    createdAt: bookingRequest.createdAt.toISOString(),
    updatedAt: bookingRequest.updatedAt.toISOString(),
    approvedAt: bookingRequest.approvedAt?.toISOString() || null,
    rejectedAt: bookingRequest.rejectedAt?.toISOString() || null,
    source: bookingRequest.source,
    adjustments: bookingRequest.adjustments.map(adj => ({
      ...adj,
      createdAt: adj.createdAt.toISOString(),
    })),
    vrboPayout: bookingRequest.vrboPayout
      ? {
          ...bookingRequest.vrboPayout,
          checkIn: bookingRequest.vrboPayout.checkIn.toISOString().split('T')[0],
          checkOut: bookingRequest.vrboPayout.checkOut.toISOString().split('T')[0],
          payoutDate: bookingRequest.vrboPayout.payoutDate
            ? bookingRequest.vrboPayout.payoutDate.toISOString().split('T')[0]
            : null,
          importedAt: bookingRequest.vrboPayout.importedAt.toISOString(),
        }
      : null,
  };

  const serializedHolidays = holidayPeriods.map(h => ({
    ...h,
    startDate: h.startDate.toISOString().split('T')[0],
    endDate: h.endDate.toISOString().split('T')[0],
  }));

  const serializedRates = {
    weekdayRate: rateSetting.weekdayRate,
    weekendRate: rateSetting.weekendRate,
    holidayRate: rateSetting.holidayRate,
    weeklyDiscount: rateSetting.weeklyDiscount,
    cleaningFee: rateSetting.cleaningFee,
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
      <QuoteClient
        bookingRequest={serializedRequest as any}
        holidayPeriods={serializedHolidays as any}
        rateSettings={serializedRates}
      />
    </div>
  );
}

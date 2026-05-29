import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import QuoteClient from './QuoteClient';

export default async function AdminQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = parseInt(id);

  if (isNaN(requestId)) notFound();

  const bookingRequest = await prisma.bookingRequest.findUnique({
    where: { id: requestId },
    include: {
      adjustments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!bookingRequest) notFound();

  // Load active holiday periods for rate calculation
  const holidayPeriods = await prisma.holidayPeriod.findMany({
    orderBy: { startDate: 'asc' },
  });

  // Serialize dates to strings for the client component (avoids Date object issues)
  const serializedRequest = {
    ...bookingRequest,
    startDate: bookingRequest.startDate.toISOString().split('T')[0],
    endDate: bookingRequest.endDate.toISOString().split('T')[0],
    createdAt: bookingRequest.createdAt.toISOString(),
    updatedAt: bookingRequest.updatedAt.toISOString(),
    approvedAt: bookingRequest.approvedAt?.toISOString() || null,
    rejectedAt: bookingRequest.rejectedAt?.toISOString() || null,
    adjustments: bookingRequest.adjustments.map(adj => ({
      ...adj,
      createdAt: adj.createdAt.toISOString(),
    })),
  };

  const serializedHolidays = holidayPeriods.map(h => ({
    ...h,
    startDate: h.startDate.toISOString().split('T')[0],
    endDate: h.endDate.toISOString().split('T')[0],
  }));

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <QuoteClient
        bookingRequest={serializedRequest as any}
        holidayPeriods={serializedHolidays as any}
      />
    </div>
  );
}

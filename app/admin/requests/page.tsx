import prisma from '@/lib/prisma';
import SyncVrboButton from './SyncVrboButton';
import RequestsClient from './RequestsClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Force dynamic rendering so this page doesn't try to fetch data at build time
export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    redirect('/login');
  }

  const requests = await prisma.bookingRequest.findMany({
    take: 100,
  });

  // Smart sort for admin workflow:
  // 1. Items needing attention (PENDING + REVIEWING) at the top
  // 2. Then REJECTED → CONFIRMED → CANCELLED
  // 3. Within each group, sort by trip start date (soonest first)
  const statusPriority: Record<string, number> = {
    PENDING: 1,
    REVIEWING: 2,
    REJECTED: 3,
    CONFIRMED: 4,
    CANCELLED: 5,
  };

  requests.sort((a, b) => {
    const prioA = statusPriority[a.status] ?? 99;
    const prioB = statusPriority[b.status] ?? 99;

    if (prioA !== prioB) {
      return prioA - prioB; // lower number = higher priority (on top)
    }

    // Same priority group → sort by start date (soonest trips first)
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
        <h1 className="text-2xl font-semibold">Booking Requests</h1>
        
        <SyncVrboButton />
      </div>

      <RequestsClient requests={requests} />
    </div>
  );
}

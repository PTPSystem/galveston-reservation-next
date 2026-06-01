import prisma from '@/lib/prisma';
import Link from 'next/link';
import SyncVrboButton from './SyncVrboButton';
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

      {/* Mobile Card View — much better than forcing horizontal scroll on phones */}
      <div className="md:hidden space-y-4">
        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-slate-800">
            No booking requests yet.
          </div>
        ) : (
          requests.map((req) => {
            const nights = Math.ceil(
              (new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            const startDate = new Date(req.startDate).toLocaleDateString();
            const endDate = new Date(req.endDate).toLocaleDateString();
            const submitted = new Date(req.createdAt).toLocaleDateString();

            return (
              <div key={req.id} className="bg-white rounded-2xl border shadow-sm p-4">
                {/* Guest + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-lg text-slate-900 leading-tight">{req.guestName}</div>
                    <div className="text-sm text-slate-700 break-all">{req.guestEmail}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      req.status === 'REVIEWING' ? 'bg-blue-100 text-blue-700' :
                      req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      req.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                      req.status === 'CANCELLED' ? 'bg-slate-200 text-slate-700' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {req.status}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                      req.source === 'VRBO' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {req.source}
                    </span>
                  </div>
                </div>

                {/* Key details */}
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600 flex-shrink-0">Dates</span>
                    <span className="font-medium text-slate-900 text-right">
                      {startDate} → {endDate}
                      <span className="text-slate-500 font-normal"> ({nights} nights)</span>
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Guests</span>
                    <span className="font-medium text-slate-900">{req.numGuests}</span>
                  </div>

                  <div className="flex justify-between gap-4 text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Submitted</span>
                    <span className="text-slate-600">{submitted}</span>
                  </div>
                </div>

                {/* Primary action — large and easy to tap */}
                <Link
                  href={`/admin/requests/${req.id}`}
                  className="mt-4 block w-full text-center py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-base transition-colors"
                >
                  Review Request
                </Link>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop / Tablet Table View (md and up) */}
      <div className="hidden md:block">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left font-semibold">Guest</th>
                  <th className="px-4 sm:px-6 py-3 text-left font-semibold">Dates</th>
                  <th className="px-3 sm:px-6 py-3 text-center font-semibold">Nights</th>
                  <th className="px-3 sm:px-6 py-3 text-center font-semibold">Guests</th>
                  <th className="px-4 sm:px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-3 sm:px-6 py-3 text-left font-semibold">Source</th>
                  <th className="hidden lg:table-cell px-4 sm:px-6 py-3 text-left font-semibold">Submitted</th>
                  <th className="sticky right-0 z-10 bg-slate-50 px-3 sm:px-4 py-3 w-20 text-right font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-800">
                      No booking requests yet.
                    </td>
                  </tr>
                )}
                {requests.map((req) => {
                  const nights = Math.ceil(
                    (new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={req.id} className="group hover:bg-slate-50">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="font-medium">{req.guestName}</div>
                        <div className="text-xs text-slate-800">{req.guestEmail}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm">
                        {new Date(req.startDate).toLocaleDateString()} → {new Date(req.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-center font-medium">{nights}</td>
                      <td className="px-3 sm:px-6 py-4 text-center">{req.numGuests}</td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          req.status === 'REVIEWING' ? 'bg-blue-100 text-blue-700' :
                          req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          req.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                          req.status === 'CANCELLED' ? 'bg-slate-200 text-slate-700' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                          req.source === 'VRBO' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {req.source}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-4 sm:px-6 py-4 text-sm text-slate-800">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="sticky right-0 z-10 bg-white group-hover:bg-slate-50 px-3 sm:px-4 py-4 text-right">
                        <Link
                          href={`/admin/requests/${req.id}`}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 active:bg-emerald-100 transition-colors whitespace-nowrap shadow-sm"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

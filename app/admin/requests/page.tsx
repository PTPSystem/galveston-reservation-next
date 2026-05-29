import prisma from '@/lib/prisma';
import Link from 'next/link';

// Force dynamic rendering so this page doesn't try to fetch data at build time
export const dynamic = 'force-dynamic';

export default async function AdminRequestsPage() {
  const requests = await prisma.bookingRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-semibold mb-6">Booking Requests</h1>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Guest</th>
              <th className="px-6 py-3 text-left font-semibold">Dates</th>
              <th className="px-6 py-3 text-center font-semibold">Nights</th>
              <th className="px-6 py-3 text-center font-semibold">Guests</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Submitted</th>
              <th className="px-6 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-800">
                  No booking requests yet.
                </td>
              </tr>
            )}
            {requests.map((req) => {
              const nights = Math.ceil(
                (new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{req.guestName}</div>
                    <div className="text-xs text-slate-800">{req.guestEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Date(req.startDate).toLocaleDateString()} → {new Date(req.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{nights}</td>
                  <td className="px-6 py-4 text-center">{req.numGuests}</td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 text-sm text-slate-800">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/requests/${req.id}`}
                      className="inline-flex items-center px-4 py-1.5 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
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
  );
}

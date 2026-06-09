'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface Request {
  id: number;
  guestName: string;
  guestEmail: string;
  startDate: string | Date;
  endDate: string | Date;
  numGuests: number;
  status: string;
  source: string;
  createdAt: string | Date;
}

interface RequestsClientProps {
  requests: Request[];
}

export default function RequestsClient({ requests: initialRequests }: RequestsClientProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Filters - default to "needs attention": PENDING + REVIEWING (needs review) + upcoming CONFIRMED
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>(['PENDING', 'REVIEWING', 'CONFIRMED']);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'DIRECT' | 'VRBO'>('ALL');

  // Sorting: null = use the initial server-provided smart order
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const statusOptions = ['PENDING', 'REVIEWING', 'REJECTED', 'CONFIRMED', 'CANCELLED', 'PAST'];

  const statusPriority: Record<string, number> = {
    PENDING: 1,
    REVIEWING: 2,
    REJECTED: 3,
    CONFIRMED: 4,
    CANCELLED: 5,
  };

  const toggleStatus = (status: string) => {
    setStatusFilters(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilters([]);           // show every status (including past CONFIRMED)
    setSourceFilter('ALL');
    setSortColumn(null);
    setSortDirection('asc');
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...initialRequests];

    // Apply search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.guestName.toLowerCase().includes(q) ||
          r.guestEmail.toLowerCase().includes(q)
      );
    }

    // Apply status filters (multi-select), with special handling for 'PAST'
    if (statusFilters.length > 0) {
      result = result.filter((r) => {
        const matchesRealStatus = statusFilters.includes(r.status);
        const matchesPast = statusFilters.includes('PAST') && r.status === 'CONFIRMED' && new Date(r.endDate) < today;
        return matchesRealStatus || matchesPast;
      });
    }

    // "Needs attention" rule for CONFIRMED: only upcoming (unless PAST is also selected)
    if (statusFilters.includes('CONFIRMED') && !statusFilters.includes('PAST')) {
      result = result.filter((r) => {
        if (r.status !== 'CONFIRMED') return true;
        const start = new Date(r.startDate);
        start.setHours(0, 0, 0, 0);
        return start >= today;
      });
    }

    // Apply source filter
    if (sourceFilter !== 'ALL') {
      result = result.filter((r) => r.source === sourceFilter);
    }

    // Apply sort if a column is selected
    if (sortColumn) {
      result.sort((a, b) => {
        let valA: any;
        let valB: any;

        switch (sortColumn) {
          case 'guest':
            valA = a.guestName.toLowerCase();
            valB = b.guestName.toLowerCase();
            break;
          case 'startDate':
            valA = new Date(a.startDate).getTime();
            valB = new Date(b.startDate).getTime();
            break;
          case 'nights': {
            const nightsA = Math.ceil(
              (new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            const nightsB = Math.ceil(
              (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            valA = nightsA;
            valB = nightsB;
            break;
          }
          case 'guests':
            valA = a.numGuests;
            valB = b.numGuests;
            break;
          case 'status':
            valA = statusPriority[a.status] ?? 99;
            valB = statusPriority[b.status] ?? 99;
            break;
          case 'source':
            valA = a.source;
            valB = b.source;
            break;
          case 'submitted':
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
            break;
          default:
            return 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    // If no sort selected, preserve the original server smart order after filtering

    return result;
  }, [initialRequests, searchTerm, statusFilters, sourceFilter, sortColumn, sortDirection]);

  const getSortIndicator = (column: string) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <>
      {/* Filters */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Source quick filter */}
          <div className="flex rounded-xl border overflow-hidden text-sm">
            {(['ALL', 'DIRECT', 'VRBO'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-4 py-2.5 transition-colors ${
                  sourceFilter === s
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                {s === 'ALL' ? 'All Sources' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 mr-1">Status:</span>
          {statusOptions.map((status) => {
            const isActive = statusFilters.includes(status);
            const colorClass =
              status === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200' :
              status === 'REVIEWING' ? 'bg-blue-100 text-blue-700 border-blue-200' :
              status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
              status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
              status === 'PAST' ? 'bg-slate-200 text-slate-700 border-slate-300' :
              'bg-slate-200 text-slate-700 border-slate-300';

            const displayLabel = status === 'PAST' ? 'Past Stays' : status;

            return (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  isActive 
                    ? `${colorClass} ring-1 ring-offset-1` 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {displayLabel}
              </button>
            );
          })}

          <button
            onClick={() => {
              setStatusFilters(['PENDING', 'REVIEWING', 'CONFIRMED']);
              setSourceFilter('ALL');
              setSearchTerm('');
              setSortColumn(null);
              setSortDirection('asc');
            }}
            className="px-3 py-1 text-sm rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium"
          >
            Needs Attention (default)
          </button>

          {(searchTerm || statusFilters.length > 0 || sourceFilter !== 'ALL' || sortColumn) && (
            <button
              onClick={resetFilters}
              className="ml-1 text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Show all
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Showing {filteredAndSorted.length} of {initialRequests.length} requests
          {sortColumn && <span className="ml-2">(sorted by {sortColumn})</span>}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredAndSorted.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center text-slate-800">
            No matching booking requests.
          </div>
        ) : (
          filteredAndSorted.map((req) => {
            const nights = Math.ceil(
              (new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            const startDate = new Date(req.startDate).toLocaleDateString();
            const endDate = new Date(req.endDate).toLocaleDateString();
            const submitted = new Date(req.createdAt).toLocaleDateString();

            return (
              <div key={req.id} className="bg-white rounded-2xl border shadow-sm p-4">
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

      {/* Desktop / Tablet Table View */}
      <div className="hidden md:block">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th 
                    onClick={() => handleSort('guest')}
                    className="px-4 sm:px-6 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Guest {getSortIndicator('guest')}
                  </th>
                  <th 
                    onClick={() => handleSort('startDate')}
                    className="px-4 sm:px-6 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Dates {getSortIndicator('startDate')}
                  </th>
                  <th 
                    onClick={() => handleSort('nights')}
                    className="px-3 sm:px-6 py-3 text-center font-semibold cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Nights {getSortIndicator('nights')}
                  </th>
                  <th 
                    onClick={() => handleSort('guests')}
                    className="px-3 sm:px-6 py-3 text-center font-semibold cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Guests {getSortIndicator('guests')}
                  </th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="px-4 sm:px-6 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Status {getSortIndicator('status')}
                  </th>
                  <th 
                    onClick={() => handleSort('source')}
                    className="px-3 sm:px-6 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Source {getSortIndicator('source')}
                  </th>
                  <th 
                    onClick={() => handleSort('submitted')}
                    className="hidden lg:table-cell px-4 sm:px-6 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 select-none"
                  >
                    Submitted {getSortIndicator('submitted')}
                  </th>
                  <th className="sticky right-0 z-10 bg-slate-50 px-3 sm:px-4 py-3 w-20 text-right font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAndSorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-800">
                      No matching booking requests.
                    </td>
                  </tr>
                )}
                {filteredAndSorted.map((req) => {
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
    </>
  );
}

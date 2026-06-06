'use client';

import { useState, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import Link from 'next/link';

interface UnavailablePeriod {
  startDate: string;
  endDate: string;
  source?: 'booking' | 'blocked';
  reason?: string | null;
}

export default function AvailabilityCalendar() {
  const [unavailablePeriods, setUnavailablePeriods] = useState<UnavailablePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const res = await fetch('/api/availability');
        if (res.ok) {
          const data = await res.json();
          setUnavailablePeriods(data.unavailable || []);
        }
      } catch (error) {
        console.error('Failed to load availability', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, []);

  const disabledDays = unavailablePeriods.map(period => ({
    from: new Date(period.startDate),
    to: new Date(period.endDate),
  }));

  const hasConflict = selectedRange?.from && selectedRange?.to
    ? unavailablePeriods.some(period => {
        const periodStart = new Date(period.startDate);
        const periodEnd = new Date(period.endDate);
        return !(selectedRange.to! < periodStart || selectedRange.from! > periodEnd);
      })
    : false;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const bookingLink = selectedRange?.from && selectedRange?.to && !hasConflict
    ? `/request?startDate=${selectedRange.from.toISOString().split('T')[0]}&endDate=${selectedRange.to.toISOString().split('T')[0]}`
    : null;

  return (
    <div className="bg-white p-8 rounded-2xl border">
      <h2 className="text-2xl font-semibold tracking-tight mb-2 text-center">Check Availability</h2>
      <p className="text-center text-slate-600 mb-6 text-sm">
        Select dates below to see if they are available and start your request.
      </p>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading calendar...</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1">
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={setSelectedRange}
              disabled={disabledDays}
              numberOfMonths={2}
              pagedNavigation
              className="mx-auto"
              modifiersClassNames={{
                disabled: 'rdp-day_disabled bg-red-100 text-red-700',
              }}
            />
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
                <span className="text-slate-600">Unavailable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border border-slate-300 rounded" />
                <span className="text-slate-600">Available</span>
              </div>
            </div>
          </div>

          <div className="flex-1 lg:max-w-xs">
            {selectedRange?.from && selectedRange?.to ? (
              <div className="bg-slate-50 p-6 rounded-xl">
                <div className="text-sm text-slate-500 mb-1">You selected</div>
                <div className="font-medium text-lg mb-4">
                  {formatDate(selectedRange.from)} — {formatDate(selectedRange.to)}
                </div>

                {hasConflict ? (
                  <div className="text-red-600 text-sm mb-4">
                    These dates overlap with unavailable periods.
                  </div>
                ) : (
                  <Link
                    href={bookingLink!}
                    className="inline-flex w-full justify-center items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Request These Dates →
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-slate-500 text-sm bg-slate-50 p-6 rounded-xl">
                Select a date range on the calendar to check availability and start your booking request.
              </div>
            )}

            {unavailablePeriods.length > 0 && (
              <div className="mt-6">
                <div className="text-sm font-medium mb-2">Currently unavailable:</div>
                <ul className="text-xs text-slate-600 space-y-1 max-h-40 overflow-auto">
                  {unavailablePeriods.slice(0, 6).map((p, i) => (
                    <li key={i}>
                      {new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                      {new Date(p.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {p.source === 'blocked' && <span className="ml-1 text-red-600">(manually blocked{p.reason ? `: ${p.reason}` : ''})</span>}
                    </li>
                  ))}
                  {unavailablePeriods.length > 6 && <li>+{unavailablePeriods.length - 6} more</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

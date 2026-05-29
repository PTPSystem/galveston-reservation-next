'use client';

import { useState, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

interface UnavailablePeriod {
  startDate: string;
  endDate: string;
}

export default function AvailabilityPage() {
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

  // Convert unavailable periods to Date objects for the calendar
  const disabledDays = unavailablePeriods.map(period => ({
    from: new Date(period.startDate),
    to: new Date(period.endDate),
  }));

  // Check if selected range has conflicts
  const hasConflict = selectedRange?.from && selectedRange?.to
    ? unavailablePeriods.some(period => {
        const periodStart = new Date(period.startDate);
        const periodEnd = new Date(period.endDate);
        return !(selectedRange.to! < periodStart || selectedRange.from! > periodEnd);
      })
    : false;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8">
        <a href="/" className="text-sm text-emerald-600 hover:underline">← Back to Bayfront Retreat</a>
        <h1 className="text-3xl font-semibold tracking-tight mt-4">Availability Calendar</h1>
        <p className="text-slate-700 mt-2">
          Dates shown in red are currently unavailable (confirmed bookings).
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading availability...</div>
      ) : (
        <div className="grid md:grid-cols-5 gap-8">
          {/* Calendar */}
          <div className="md:col-span-3 bg-white p-6 rounded-2xl border">
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={setSelectedRange}
              disabled={disabledDays}
              numberOfMonths={2}
              pagedNavigation
              className="mx-auto"
              modifiersClassNames={{
                disabled: 'rdp-day_disabled bg-red-100 text-red-700 line-through',
              }}
            />
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                <span className="text-slate-600">Unavailable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border border-slate-300 rounded"></div>
                <span className="text-slate-600">Available</span>
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border">
              <h2 className="font-semibold text-lg mb-4">Selected Dates</h2>
              {selectedRange?.from && selectedRange?.to ? (
                <div>
                  <p className="text-lg font-medium">
                    {formatDate(selectedRange.from)} — {formatDate(selectedRange.to)}
                  </p>
                  {hasConflict && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      These dates overlap with unavailable periods. Please choose different dates.
                    </div>
                  )}
                  {!hasConflict && (
                    <p className="mt-3 text-sm text-emerald-600">These dates appear to be available.</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-600">Select a date range on the calendar to check availability.</p>
              )}
            </div>

            {unavailablePeriods.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border">
                <h2 className="font-semibold text-lg mb-4">Currently Unavailable</h2>
                <ul className="space-y-2 text-sm">
                  {unavailablePeriods.map((period, index) => (
                    <li key={index} className="flex justify-between border-b pb-2 last:border-none">
                      <span>
                        {new Date(period.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —{' '}
                        {new Date(period.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 mt-4">
                  These dates are already confirmed and cannot be booked.
                </p>
              </div>
            )}

            <div className="pt-4">
              <a
                href="/request"
                className="inline-flex w-full items-center justify-center px-8 py-4 bg-emerald-600 text-white rounded-2xl font-semibold hover:bg-emerald-700 transition-colors"
              >
                Request These Dates →
              </a>
              <p className="text-center text-xs text-slate-500 mt-3">
                This is not an instant booking. All requests are reviewed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

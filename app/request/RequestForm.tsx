'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function RequestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numGuests, setNumGuests] = useState(4);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const guestDropdownRef = useRef<HTMLDivElement>(null);

  // Availability data
  const [unavailablePeriods, setUnavailablePeriods] = useState<Array<{ startDate: string; endDate: string }>>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  // Prefill dates from URL (coming from calendar on homepage)
  const searchParams = useSearchParams();
  useEffect(() => {
    const urlStart = searchParams.get('startDate');
    const urlEnd = searchParams.get('endDate');
    if (urlStart && !startDate) setStartDate(urlStart);
    if (urlEnd && !endDate) setEndDate(urlEnd);
  }, [searchParams]);

  // Close guest dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (guestDropdownRef.current && !guestDropdownRef.current.contains(event.target as Node)) {
        setGuestDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch unavailable dates (CONFIRMED bookings)
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
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, []);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStartDate(newStart);

    if (newStart) {
      const nextDay = new Date(newStart);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];

      if (!endDate || endDate <= newStart) {
        setEndDate(nextDayStr);
      }
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  // Check if selected dates overlap with unavailable periods
  const hasDateConflict = startDate && endDate && unavailablePeriods.some(period => {
    return !(endDate < period.startDate || startDate > period.endDate);
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!startDate) newErrors.startDate = 'Check-in date is required';
    if (!endDate) newErrors.endDate = 'Check-out date is required';
    if (startDate && endDate && endDate <= startDate) {
      newErrors.endDate = 'Check-out must be after check-in';
    }
    if (!numGuests || numGuests < 1 || numGuests > 10) {
      newErrors.numGuests = 'Please select between 1 and 10 guests';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      guestName: formData.get('guestName'),
      guestEmail: formData.get('guestEmail'),
      guestPhone: formData.get('guestPhone') || '',
      startDate,
      endDate,
      numGuests,
      specialRequests: formData.get('specialRequests') || '',
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        setSubmitted(true);
      } else {
        const errorMsg = result.details 
          ? Object.values(result.details).flat().join(', ')
          : result.error || 'Something went wrong. Please try again.';
        setSubmitError(errorMsg);
      }
    } catch (error) {
      setSubmitError('Failed to submit request. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-lg text-center">
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <i className="fa-solid fa-check text-emerald-600 text-4xl"></i>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-4 text-slate-900">Request Received</h1>
          <p className="text-slate-700 text-lg mb-6">
            Thank you. We will review your dates and send you a personalized quote within 24 hours.
          </p>

          <div className="bg-white rounded-2xl border p-6 text-left text-sm space-y-3">
            <div className="font-medium text-slate-900">What happens next:</div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700">
              <li>We’ll check availability for your dates.</li>
              <li>You’ll receive a custom quote by email.</li>
              <li>Reply to the email or call us to confirm your stay.</li>
            </ol>
          </div>

          <a 
            href="/" 
            className="inline-block mt-8 text-emerald-600 hover:underline font-medium"
          >
            ← Back to Bayfront Retreat
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="mb-8">
        <a href="/" className="text-sm text-emerald-600 hover:underline">← Back to Bayfront Retreat</a>
        <h1 className="text-3xl font-semibold tracking-tight mt-4">Request to Book</h1>
        <p className="text-slate-800 mt-2">This is not an instant booking. All requests are reviewed by the host.</p>
      </div>

      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative space-y-6 bg-white p-8 rounded-2xl border">
        {/* Close button */}
        <a 
          href="/" 
          className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-800 text-white text-2xl leading-none rounded-full w-8 h-8 flex items-center justify-center"
          aria-label="Close booking window"
        >
          <i className="fa-solid fa-times"></i>
        </a>

        {/* Availability Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          <div className="font-medium text-amber-800 mb-1">Check the calendar below for availability</div>
          {!loadingAvailability && unavailablePeriods.length > 0 ? (
            <p className="text-amber-700 text-xs">Some dates are already confirmed. See the calendar on the homepage for details.</p>
          ) : (
            <p className="text-amber-600 text-xs">No dates are currently confirmed as unavailable.</p>
          )}
        </div>

        <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">Check-in Date</label>
            <input
              type="date"
              name="startDate"
              value={startDate}
              onChange={handleStartDateChange}
              required
              className={`w-full border rounded-lg px-4 py-2.5 ${errors.startDate ? 'border-red-500' : ''}`}
            />
            {errors.startDate && <p className="text-sm text-red-600 mt-1">{errors.startDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">Check-out Date</label>
            <input
              type="date"
              name="endDate"
              value={endDate}
              onChange={handleEndDateChange}
              min={startDate ? new Date(new Date(startDate).getTime() + 86400000).toISOString().split('T')[0] : undefined}
              required
              className={`w-full border rounded-lg px-4 py-2.5 ${errors.endDate ? 'border-red-500' : ''}`}
            />
            {errors.endDate && <p className="text-sm text-red-600 mt-1">{errors.endDate}</p>}
          </div>
        </div>

        {hasDateConflict && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ The dates you selected overlap with already confirmed bookings. Please choose different dates.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">Number of Guests</label>
          
          <div className="relative" ref={guestDropdownRef}>
            <button
              type="button"
              onClick={() => setGuestDropdownOpen(!guestDropdownOpen)}
              className="w-full flex items-center justify-between border border-slate-300 rounded-lg px-4 py-3 text-base font-medium bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
            >
              <span className="text-slate-900 font-medium">{numGuests} guest{numGuests > 1 ? 's' : ''}</span>
              <i className={`fa-solid fa-chevron-down transition-transform text-slate-900 ${guestDropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {guestDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto py-1">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setNumGuests(n);
                      setGuestDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-[15px] hover:bg-slate-100 flex items-center justify-between ${
                      numGuests === n 
                        ? 'bg-emerald-50 text-slate-900 font-semibold' 
                        : 'text-slate-900 font-medium'
                    }`}
                  >
                    <span>{n} guest{n > 1 ? 's' : ''}</span>
                    {numGuests === n && (
                      <i className="fa-solid fa-check text-emerald-600"></i>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input type="hidden" name="numGuests" value={numGuests} />
          {errors.numGuests && <p className="text-sm text-red-600 mt-1">{errors.numGuests}</p>}
          <p className="text-xs text-slate-600 mt-1">Maximum 10 guests</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">Full Name</label>
            <input type="text" name="guestName" required className="w-full border rounded-lg px-4 py-2.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">Phone Number</label>
            <input type="tel" name="guestPhone" className="w-full border rounded-lg px-4 py-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">Email Address</label>
          <input type="email" name="guestEmail" required className="w-full border rounded-lg px-4 py-2.5" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">Special Requests (optional)</label>
          <textarea name="specialRequests" rows={4} className="w-full border rounded-lg px-4 py-2.5" placeholder="e.g. Bringing a well-behaved pet, early check-in request, etc." />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-semibold py-3.5 rounded-xl transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
        </button>

        <p className="text-center text-xs text-slate-800">
          You will receive a response with pricing within 24 hours.
        </p>
      </form>
    </div>
  );
}

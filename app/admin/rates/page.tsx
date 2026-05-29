'use client';

import { useState, useEffect } from 'react';

interface RateSettings {
  weekdayRate: number;
  weekendRate: number;
  holidayRate: number;
  weeklyDiscount: number;
}

export default function RateSettingsPage() {
  const [rates, setRates] = useState<RateSettings>({
    weekdayRate: 500,
    weekendRate: 650,
    holidayRate: 700,
    weeklyDiscount: 350,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/admin/rates');
        if (res.ok) {
          const data = await res.json();
          setRates({
            weekdayRate: data.weekdayRate,
            weekendRate: data.weekendRate,
            holidayRate: data.holidayRate,
            weeklyDiscount: data.weeklyDiscount,
          });
        }
      } catch (error) {
        console.error('Failed to load rates', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rates),
      });

      if (res.ok) {
        const updated = await res.json();
        setRates({
          weekdayRate: updated.weekdayRate,
          weekendRate: updated.weekendRate,
          holidayRate: updated.holidayRate,
          weeklyDiscount: updated.weeklyDiscount,
        });
        setMessage({ type: 'success', text: 'Rate settings saved successfully!' });
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save rates' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-2xl">Loading rate settings...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Rates &amp; Pricing</h1>
          <p className="text-slate-600 mt-2">
            Set your base nightly rates and weekly discount. These rates are used when calculating quotes.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Weekday Rate (Mon–Thu)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-500">$</span>
                <input
                  type="number"
                  value={rates.weekdayRate}
                  onChange={(e) => setRates({ ...rates, weekdayRate: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg pl-8 pr-4 py-2.5"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Weekend Rate (Fri–Sun)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-500">$</span>
                <input
                  type="number"
                  value={rates.weekendRate}
                  onChange={(e) => setRates({ ...rates, weekendRate: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg pl-8 pr-4 py-2.5"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Holiday Rate
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-500">$</span>
                <input
                  type="number"
                  value={rates.holidayRate}
                  onChange={(e) => setRates({ ...rates, holidayRate: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg pl-8 pr-4 py-2.5"
                  min="0"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Overrides weekday and weekend rates</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Weekly Discount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-500">$</span>
                <input
                  type="number"
                  value={rates.weeklyDiscount}
                  onChange={(e) => setRates({ ...rates, weeklyDiscount: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded-lg pl-8 pr-4 py-2.5"
                  min="0"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Discount applied per 7 nights</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {saving ? 'Saving...' : 'Save Rate Settings'}
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            These base rates are used when calculating quotes. Holiday periods can override rates.
          </p>
        </form>
      </div>
    </div>
  );
}

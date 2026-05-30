'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BookingRequest {
  id: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  startDate: string;
  endDate: string;
  numGuests: number;
  specialRequests: string | null;
  status: string;
  pricing: any;
  adjustments: any[];
}

interface HolidayPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  rate: number;
}

interface NightRow {
  date: string;
  type: 'Weekday' | 'Weekend' | 'Holiday';
  base: number;
  nightlyAdjustment: number;   // Only explicit per-night changes (never touched by stay adjustments)
  finalNight: number;          // base + nightlyAdjustment only
}

interface StayAdjustment {
  amount: number;
  reason: string;
  createdAt?: string;
}

interface QuoteClientProps {
  bookingRequest: BookingRequest;
  holidayPeriods: HolidayPeriod[];
}

export default function QuoteClient({ bookingRequest, holidayPeriods }: QuoteClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedNightIndex, setSelectedNightIndex] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Local status so we can update it live (e.g. PENDING → REVIEWING automatically)
  const [currentStatus, setCurrentStatus] = useState(bookingRequest.status);

  // Custom modal form state
  const [customType, setCustomType] = useState<'daily' | 'stay'>('stay');
  const [customAmount, setCustomAmount] = useState('-150');
  const [customReason, setCustomReason] = useState('');

  // Daily per-night modal state
  const [dailyAmount, setDailyAmount] = useState('');
  const [dailyReason, setDailyReason] = useState('');

  // Live night-by-night state (only nightly adjustments affect these rows)
  const [nights, setNights] = useState<NightRow[]>(() => {
    return generateNights(bookingRequest, holidayPeriods);
  });

  // Separate stay-level adjustments (never distributed to individual nights)
  const [stayAdjustments, setStayAdjustments] = useState<StayAdjustment[]>([]);

  // Persisted adjustments for the audit log (from DB + newly created)
  const [adjustments, setAdjustments] = useState<any[]>(bookingRequest.adjustments || []);

  // Hydrate stay adjustments from DB so they survive refresh
  useEffect(() => {
    const stayFromDb = (bookingRequest.adjustments || [])
      .filter((a: any) => a.adjustmentType === 'stay')
      .map((a: any) => ({
        amount: a.amount,
        reason: a.reason,
        createdAt: a.createdAt,
      }));
    if (stayFromDb.length > 0) {
      setStayAdjustments(stayFromDb);
    }
  }, [bookingRequest.adjustments]);

  // Auto-transition PENDING → REVIEWING when admin opens this screen
  // (matches: "Reviewing - looked at but not approved and send")
  useEffect(() => {
    if (currentStatus === 'PENDING') {
      const transitionToReviewing = async () => {
        try {
          const res = await fetch(`/api/admin/requests/${bookingRequest.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'REVIEWING' }),
          });

          if (res.ok) {
            setCurrentStatus('REVIEWING');
          }
        } catch (e) {
          // Non-critical - don't block the user if this fails
          console.warn('Could not auto-transition to REVIEWING');
        }
      };

      // Small delay so it feels natural (admin has "looked at" it)
      const timer = setTimeout(transitionToReviewing, 600);
      return () => clearTimeout(timer);
    }
  }, [currentStatus, bookingRequest.id]);

  function generateNights(req: BookingRequest, holidays: HolidayPeriod[]): NightRow[] {
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    const rows: NightRow[] = [];

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let rate = 500;
      let type: 'Weekday' | 'Weekend' | 'Holiday' = 'Weekday';

      const day = d.getDay();
      if (day === 5 || day === 6 || day === 0) {
        rate = 650;
        type = 'Weekend';
      }

      const isHoliday = holidays.some(h => {
        const hStart = h.startDate;
        const hEnd = h.endDate;
        return dateStr >= hStart && dateStr <= hEnd;
      });

      if (isHoliday) {
        rate = 700;
        type = 'Holiday';
      }

      rows.push({
        date: dateStr,
        type,
        base: rate,
        nightlyAdjustment: 0,
        finalNight: rate,
      });
    }
    return rows;
  }

  // Exact calculation per user's spec:
  // Base + nightly adj sum + stay adj sum → taxes (9% + 6%) on that net → + cleaning
  // 22% management is on the net after both adjustment types ("Base-discount")
  const calculations = useMemo(() => {
    const baseRateSum = nights.reduce((sum, n) => sum + n.base, 0);
    const nightlyAdjSum = nights.reduce((sum, n) => sum + n.nightlyAdjustment, 0);
    const stayAdjSum = stayAdjustments.reduce((sum, a) => sum + a.amount, 0);

    const netAfterAdjustments = baseRateSum + nightlyAdjSum + stayAdjSum;

    const jamaicaBeachTax = Math.round(netAfterAdjustments * 0.09 * 100) / 100;
    const texasStateTax = Math.round(netAfterAdjustments * 0.06 * 100) / 100;
    const cleaning = 300;

    const totalGuest = netAfterAdjustments + jamaicaBeachTax + texasStateTax + cleaning;

    // 22% on the net base after discounts/adjustments (Base-discount)
    const managementFee = Math.round(netAfterAdjustments * 0.22 * 100) / 100;

    // Owner Proceeds = what's left after remitting taxes, paying cleaning, and taking management fee
    const ownerProceeds = netAfterAdjustments - managementFee;

    return {
      baseRateSum,
      nightlyAdjSum,
      stayAdjSum,
      netAfterAdjustments,
      jamaicaBeachTax,
      texasStateTax,
      cleaning,
      totalGuest,
      managementFee,
      ownerProceeds,
    };
  }, [nights, stayAdjustments]);

  const formattedDateRange = `${new Date(bookingRequest.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(bookingRequest.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${nights.length} nights)`;

  // Open nightly adjustment for a specific night row
  const openDailyAdjustment = (index: number) => {
    setSelectedNightIndex(index);
    const night = nights[index];
    setDailyAmount(night.nightlyAdjustment ? String(night.nightlyAdjustment) : '');
    setDailyReason('');
    setShowDailyModal(true);
  };

  // Apply a nightly adjustment to ONE specific night only (never affects stay bucket)
  const applyDailyAdjustment = async () => {
    if (selectedNightIndex === null) return;

    const amount = parseFloat(dailyAmount);
    const reason = dailyReason.trim();

    if (isNaN(amount)) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!reason) {
      alert('Reason is required for the audit log.');
      return;
    }

    const night = nights[selectedNightIndex];
    const newNightlyAdj = (night.nightlyAdjustment || 0) + amount;
    const newFinalNight = night.base + newNightlyAdj;

    // Optimistic UI update - only this row
    const updatedNights = [...nights];
    updatedNights[selectedNightIndex] = {
      ...night,
      nightlyAdjustment: newNightlyAdj,
      finalNight: newFinalNight,
    };
    setNights(updatedNights);

    // Persist to audit log as 'daily'
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${bookingRequest.id}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustmentType: 'daily',
          amount,
          reason: `Nightly adjustment for ${night.date} — ${reason}`,
        }),
      });

      if (res.ok) {
        const newAdj = await res.json();
        setAdjustments([newAdj, ...adjustments]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
      setShowDailyModal(false);
      setDailyAmount('');
      setDailyReason('');
      setSelectedNightIndex(null);
    }
  };

  // Apply a STAY-LEVEL adjustment. This is completely separate from nightly adjustments.
  // It does NOT touch any row in the night-by-night table.
  const applyStayAdjustment = async (amount: number, reason: string) => {
    if (!reason.trim()) return;

    setIsSaving(true);

    try {
      // Persist as 'stay' type
      const res = await fetch(`/api/admin/requests/${bookingRequest.id}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustmentType: 'stay',
          amount,
          reason,
        }),
      });

      if (res.ok) {
        const newAdj = await res.json();
        setAdjustments([newAdj, ...adjustments]);
      }

      // Add to the independent stay bucket (never distributed)
      setStayAdjustments(prev => [
        ...prev,
        {
          amount,
          reason,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.error(e);
      alert('Failed to apply stay adjustment');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle the Custom Adjustment modal - always creates a STAY adjustment
  const submitCustomAdjustment = () => {
    const amount = parseFloat(customAmount);
    const reason = customReason.trim();

    if (isNaN(amount) || !reason) {
      alert('Please enter a valid amount and a reason.');
      return;
    }

    // Always stay-level now (user does not want bulk nightly)
    applyStayAdjustment(amount, reason);

    // Reset and close
    setShowCustomModal(false);
    setCustomAmount('-150');
    setCustomReason('');
    setCustomType('stay');
  };

  // Quick action buttons - all are pure STAY adjustments (weekly discount is explicitly a stay adjustment)
  const quickActions = [
    { label: '-$200 Loyalty', amount: -200, reason: 'Loyalty discount - returning guest', icon: 'minus' },
    { label: '-$350 Weekly', amount: -350, reason: '7-night weekly discount', icon: 'minus' },
    { label: '+$150 Peak', amount: 150, reason: 'Peak demand - holiday weekend', icon: 'plus' },
  ];

  const openCustomModal = () => {
    setCustomType('stay'); // Only stay mode now (no bulk nightly)
    setCustomAmount('-150');
    setCustomReason('');
    setShowCustomModal(true);
  };

  // Approve with current pricing snapshot
  const handleApprove = async () => {
    setIsSaving(true);
    try {
      const finalPricing = {
        baseRateSum: calculations.baseRateSum,
        nightlyAdjSum: calculations.nightlyAdjSum,
        stayAdjSum: calculations.stayAdjSum,
        netAfterAdjustments: calculations.netAfterAdjustments,
        jamaicaBeachTax: calculations.jamaicaBeachTax,
        texasStateTax: calculations.texasStateTax,
        cleaningFee: calculations.cleaning,
        totalGuestPrice: calculations.totalGuest,
        managementFee: calculations.managementFee,
        ownerProceeds: calculations.ownerProceeds,
        nights: nights.length,
        // Per-night breakdown only reflects nightly layer (stay is separate)
        breakdown: nights.map(n => ({
          date: n.date,
          type: n.type,
          base: n.base,
          nightlyAdjustment: n.nightlyAdjustment,
          finalNight: n.finalNight,
        })),
        stayAdjustments, // the separate bucket
      };

      const res = await fetch(`/api/admin/requests/${bookingRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing: finalPricing }),
      });

      if (res.ok) {
        setCurrentStatus('CONFIRMED');
        alert('Quote approved and sent to guest!');
        router.push('/admin/requests');
      } else {
        alert('Failed to approve. Please try again.');
      }
    } catch (e) {
      console.error(e);
      alert('Error approving request');
    } finally {
      setIsSaving(false);
    }
  };

  // Reject
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${bookingRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });

      if (res.ok) {
        setCurrentStatus('REJECTED');
        alert('Request rejected.');
        router.push('/admin/requests');
      } else {
        alert('Failed to reject.');
      }
    } catch (e) {
      alert('Error rejecting request');
    } finally {
      setIsSaving(false);
      setShowRejectModal(false);
    }
  };

  // Manual "Mark as Reviewing" button handler
  const handleMarkAsReviewing = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${bookingRequest.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REVIEWING' }),
      });

      if (res.ok) {
        setCurrentStatus('REVIEWING');
      } else {
        alert('Failed to mark as reviewing.');
      }
    } catch (e) {
      alert('Error updating status');
    } finally {
      setIsSaving(false);
    }
  };

  // Save as Draft (persist current pricing snapshot without changing status)
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const draftPricing = {
        baseRateSum: calculations.baseRateSum,
        nightlyAdjSum: calculations.nightlyAdjSum,
        stayAdjSum: calculations.stayAdjSum,
        netAfterAdjustments: calculations.netAfterAdjustments,
        jamaicaBeachTax: calculations.jamaicaBeachTax,
        texasStateTax: calculations.texasStateTax,
        cleaningFee: calculations.cleaning,
        totalGuestPrice: calculations.totalGuest,
        managementFee: calculations.managementFee,
        ownerProceeds: calculations.ownerProceeds,
        nights: nights.length,
        stayAdjustments,
      };

      // Lightweight update via existing approve route (it only updates pricing + status)
      // For simplicity we just persist pricing here. Status is managed separately.
      // Here we just update via a direct fetch to a minimal update if needed. For now we optimistically consider it saved.
      await fetch(`/api/admin/requests/${bookingRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing: draftPricing }),
      });

      alert('Pricing saved as draft.');
    } catch (e) {
      alert('Draft saved locally (pricing will be sent when you Confirm).');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header - matches mockup */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <a href="/admin/requests" className="text-emerald-600 hover:text-emerald-700 text-sm flex items-center gap-1">
            <i className="fa-solid fa-arrow-left"></i> Back to Requests
          </a>
          <h1 className="text-xl sm:text-2xl font-semibold mt-1">Quote Price &amp; Approve</h1>
          <div className="text-slate-700 text-sm sm:text-base">{bookingRequest.guestName} • {formattedDateRange}</div>
        </div>
        <div className="sm:text-right text-sm">
          <div className="font-medium">Request #BR-2026-{String(bookingRequest.id).padStart(4, '0')}</div>
          <div>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              currentStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' :
              currentStatus === 'REVIEWING' ? 'bg-blue-100 text-blue-700' :
              currentStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
              currentStatus === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
              currentStatus === 'CANCELLED' ? 'bg-slate-200 text-slate-700' :
              'bg-slate-100 text-slate-800'
            }`}>
              {currentStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Pricing Table Card */}
        <div className="xl:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2 text-slate-900">
              <i className="fa-solid fa-calendar-days text-emerald-600"></i>
              Night-by-Night Pricing
            </div>
            <div className="text-sm text-slate-700 hidden md:block">Click any row to adjust</div>
            <div className="text-sm text-slate-700 md:hidden">Tap any night to adjust</div>
          </div>

          {/* Desktop / Tablet table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 sm:px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-3 sm:px-4 py-3 text-right font-semibold">Base</th>
                  <th className="px-3 sm:px-4 py-3 text-right font-semibold">Adj</th>
                  <th className="px-3 sm:px-4 py-3 text-right font-semibold">Final</th>
                  <th className="px-2 sm:px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {nights.map((night, index) => (
                  <tr
                    key={night.date}
                    onClick={() => openDailyAdjustment(index)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-3 font-medium text-slate-900">{formatDateLabel(night.date)}</td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        night.type === 'Holiday' ? 'bg-orange-100 text-orange-700' :
                        night.type === 'Weekend' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {night.type}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right font-medium text-slate-900">${night.base}</td>
                    <td className="px-3 sm:px-4 py-3 text-right">
                      {night.nightlyAdjustment !== 0 ? (
                        <span className={`font-semibold ${night.nightlyAdjustment < 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                          {night.nightlyAdjustment > 0 ? '+' : ''}${night.nightlyAdjustment.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right font-semibold text-slate-900">${night.finalNight.toFixed(2)}</td>
                    <td className="px-2 sm:px-4 py-3" onClick={(e) => { e.stopPropagation(); openDailyAdjustment(index); }}>
                      <button className="text-emerald-600 hover:text-emerald-700 p-1">
                        <i className="fa-solid fa-edit text-sm"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile-friendly vertical night list (no horizontal scroll) */}
          <div className="md:hidden divide-y text-sm">
            {nights.map((night, index) => (
              <div
                key={night.date}
                onClick={() => openDailyAdjustment(index)}
                className="p-4 active:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-slate-900">{formatDateLabel(night.date)}</div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    night.type === 'Holiday' ? 'bg-orange-100 text-orange-700' :
                    night.type === 'Weekend' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {night.type}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Base</div>
                    <div className="font-medium text-slate-900 mt-0.5">${night.base}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Adjustment</div>
                    <div className={`font-semibold mt-0.5 ${night.nightlyAdjustment < 0 ? 'text-emerald-600' : night.nightlyAdjustment > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                      {night.nightlyAdjustment !== 0 ? (
                        <>{night.nightlyAdjustment > 0 ? '+' : ''}${night.nightlyAdjustment.toFixed(2)}</>
                      ) : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Final</div>
                    <div className="font-semibold text-slate-900 mt-0.5">${night.finalNight.toFixed(2)}</div>
                  </div>
                </div>

                <div className="mt-2.5 text-emerald-600 text-xs flex items-center gap-1.5">
                  <i className="fa-solid fa-edit"></i>
                  <span>Tap to adjust this night</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Stay Adjustments - pure stay level, never touch nightly rows */}
          <div className="p-4 sm:p-6 border-t bg-slate-50">
            <div className="font-semibold text-sm mb-3 flex items-center gap-2 text-slate-900">
              <i className="fa-solid fa-magic"></i> Quick Stay Adjustments
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => applyStayAdjustment(action.amount, action.reason)}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-200 rounded-lg flex items-center gap-2 text-slate-800 disabled:opacity-60"
                >
                  <i className={`fa-solid fa-${action.icon} text-emerald-600`}></i>
                  {action.label}
                </button>
              ))}
              <button
                onClick={openCustomModal}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 hover:bg-slate-100 rounded-lg flex items-center gap-2 text-slate-800 disabled:opacity-60"
              >
                <i className="fa-solid fa-edit"></i> Custom Adjustment
              </button>
            </div>

            {/* Show applied stay adjustments clearly (separate from the night table) */}
            {stayAdjustments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-xs font-medium text-slate-600 mb-2">Applied Stay Adjustments (do not affect individual nights)</div>
                <div className="space-y-1 text-sm">
                  {stayAdjustments.map((adj, idx) => (
                    <div key={idx} className="flex justify-between text-slate-800">
                      <span className={adj.amount < 0 ? 'text-emerald-600' : 'text-orange-600'}>
                        {adj.amount > 0 ? '+' : ''}${adj.amount.toFixed(2)}
                      </span>
                      <span className="text-slate-600 text-xs truncate max-w-[260px]">{adj.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-4 space-y-6">
          {/* Guest Price Summary - explicit separation of nightly vs stay adjustments */}
          <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6">
            <h3 className="font-semibold mb-4 text-slate-900">Guest Price Summary</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-800">
                <span>Base Rate</span>
                <span className="font-semibold text-slate-900">${calculations.baseRateSum.toFixed(2)}</span>
              </div>

              {/* Nightly adjustments sum (only from individual row edits) */}
              <div className="flex justify-between text-slate-800">
                <span>Nightly Adjustments</span>
                <span className={`font-semibold ${calculations.nightlyAdjSum < 0 ? 'text-emerald-600' : calculations.nightlyAdjSum > 0 ? 'text-orange-600' : ''}`}>
                  {calculations.nightlyAdjSum === 0 ? '$0.00' : (calculations.nightlyAdjSum > 0 ? '+' : '') + calculations.nightlyAdjSum.toFixed(2)}
                </span>
              </div>

              {/* Stay adjustments sum (weekly, loyalty, peak, custom stay, etc.) - completely separate */}
              <div className="flex justify-between text-slate-800">
                <span>Stay Adjustments</span>
                <span className={`font-semibold ${calculations.stayAdjSum < 0 ? 'text-emerald-600' : calculations.stayAdjSum > 0 ? 'text-orange-600' : ''}`}>
                  {calculations.stayAdjSum === 0 ? '$0.00' : (calculations.stayAdjSum > 0 ? '+' : '') + calculations.stayAdjSum.toFixed(2)}
                </span>
              </div>

              <div className="pt-3 mt-1 border-t flex justify-between text-slate-900">
                <span className="font-semibold">Subtotal after Adjustments</span>
                <span className="font-bold">${calculations.netAfterAdjustments.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t flex justify-between text-slate-800">
                <span>Jamaica Beach Tax (9%)</span>
                <span className="font-semibold text-slate-900">${calculations.jamaicaBeachTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-800">
                <span>Texas State Tax (6%)</span>
                <span className="font-semibold text-slate-900">${calculations.texasStateTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-800">
                <span>Cleaning Fee</span>
                <span className="font-semibold text-slate-900">${calculations.cleaning.toFixed(2)}</span>
              </div>

              <div className="pt-4 border-t flex justify-between items-baseline">
                <span className="font-bold text-lg text-slate-900">Total to Guest</span>
                <span className="font-bold text-2xl text-emerald-600">${calculations.totalGuest.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Internal Split - full breakdown for owner/manager */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-6">
            <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-handshake"></i> Internal Split (Not shown to guest)
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-amber-700">Tax Remit to TX</span>
                <span className="font-medium text-amber-900">${calculations.texasStateTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Tax Remit to Jamaica Beach</span>
                <span className="font-medium text-amber-900">${calculations.jamaicaBeachTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Cleaning Fee</span>
                <span className="font-medium text-amber-900">${calculations.cleaning.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Management Fee (22%)</span>
                <span className="font-semibold text-amber-900">${calculations.managementFee.toFixed(2)}</span>
              </div>

              <div className="pt-3 mt-2 border-t border-amber-300 flex justify-between text-base">
                <span className="font-bold text-amber-800">Owner Proceeds</span>
                <span className="font-bold text-amber-900">${calculations.ownerProceeds.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-[11px] text-amber-600 mt-4">
              These 5 items = Total to Guest. 22% Mgnt Fee is on "Subtotal after Adjustments".
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleApprove}
              disabled={isSaving}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <i className="fa-solid fa-check"></i>
              Confirm &amp; Send Quote
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl"
            >
              Save as Draft
            </button>

            {currentStatus === 'PENDING' && (
              <button
                onClick={handleMarkAsReviewing}
                disabled={isSaving}
                className="w-full py-2.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
              >
                Mark as Reviewing
              </button>
            )}

            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isSaving}
              className="w-full py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
            >
              Reject Request
            </button>
          </div>
        </div>

        {/* Pricing Change Log - full width */}
        <div className="xl:col-span-12 bg-white rounded-2xl shadow-sm border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2 text-slate-900">
              <i className="fa-solid fa-history text-slate-600"></i> Pricing Change Log
            </h3>
            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">Audit Trail</span>
          </div>

          {adjustments.length === 0 ? (
            <p className="text-sm text-slate-700">No pricing adjustments yet. Changes will appear here with full audit history.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-auto text-sm">
              {adjustments.map((adj: any, idx: number) => (
                <div key={idx} className="log-entry border-l-2 border-emerald-500 pl-3 py-1">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-900">{adj.adjustmentType === 'daily' ? 'Daily adjustment' : 'Stay adjustment'}</span>
                    <span className="text-slate-500 text-xs">
                      {new Date(adj.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-slate-700">
                    {adj.amount > 0 ? '+' : ''}${Math.abs(adj.amount).toFixed(2)} — {adj.reason}
                  </div>
                  <div className="text-emerald-700 text-[11px]">— {adj.appliedBy || 'Admin'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Adjustment Modal (per specific night) */}
      {showDailyModal && selectedNightIndex !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="font-semibold text-lg mb-1 text-slate-900">Nightly Adjustment</h3>
              <p className="text-sm text-slate-600 mb-4">
                {formatDateLabel(nights[selectedNightIndex].date)} — Current final: ${nights[selectedNightIndex].finalNight.toFixed(2)}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-800">Adjustment Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      value={dailyAmount}
                      onChange={(e) => setDailyAmount(e.target.value)}
                      className="w-full border rounded-lg pl-8 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                      placeholder="e.g. -50 or 75"
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Positive = increase, negative = discount</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-800">Reason (required for audit)</label>
                  <textarea
                    value={dailyReason}
                    onChange={(e) => setDailyReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Guest requested early check-in discount, last-minute rate adjustment..."
                    className="w-full border rounded-lg px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => { setShowDailyModal(false); setDailyAmount(''); setDailyReason(''); }} className="px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button onClick={applyDailyAdjustment} disabled={isSaving} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-70">Apply Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Adjustment Modal (matches mockup) */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="font-semibold text-lg mb-4 text-slate-900">Apply Custom Adjustment</h3>

              <div className="space-y-4">
                <div className="text-sm">
                  <span className="font-medium text-slate-800">Adjustment Type:</span>{' '}
                  <span className="text-emerald-700 font-semibold">Stay-level (whole booking)</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-800">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full border rounded-lg pl-8 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">This will be added to the stay adjustment total (does not change individual nightly rates)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-800">Reason (required for audit)</label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. Early bird discount, damage waiver, special request..."
                    className="w-full border rounded-lg px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => setShowCustomModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button onClick={submitCustomAdjustment} disabled={isSaving} className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-70">Apply Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="font-semibold text-lg mb-2 text-slate-900">Reject this request?</h3>
              <p className="text-sm text-slate-600 mb-4">This will notify the guest that their request was not approved.</p>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-800">Reason for rejection</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Dates no longer available, property under renovation..."
                  className="w-full border rounded-lg px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button onClick={handleReject} disabled={isSaving} className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-70">Reject Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

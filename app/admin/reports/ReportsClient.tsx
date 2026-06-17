'use client';

import { useState } from 'react';

interface MonthlySummary {
  yearMonth: string;
  monthLabel: string;
  bookings: number;
  nights: number;
  grossRevenue: number;
  cleaningFees: number;
  jamaicaTaxes: number;
  texasTaxes: number;
  managementFees: number;
  ownerProceeds: number;
  directBookings: number;
  vrboBookings: number;
  vrboGrossRevenue?: number;
  vrboPayouts?: number;
}

interface YearlyData {
  bookings: number;
  nights: number;
  grossRevenue: number;
  ownerProceeds: number;
  managementFees: number;
  vrboGrossRevenue?: number;
  vrboPayouts?: number;
}

interface ReportsClientProps {
  monthlySummaries: MonthlySummary[];
  yearlyData: YearlyData;
  currentYear: number;
}

export default function ReportsClient({ monthlySummaries, yearlyData, currentYear }: ReportsClientProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [importResult, setImportResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Get available years from data
  const availableYears = Array.from(
    new Set(monthlySummaries.map((m) => parseInt(m.yearMonth.split('-')[0])))
  ).sort((a, b) => b - a);

  // Filter by selected year
  const filteredMonths = monthlySummaries.filter((m) =>
    m.yearMonth.startsWith(String(selectedYear))
  );

  // Calculate totals for selected year (include VRBO if present)
  const yearTotals = filteredMonths.reduce(
    (acc, m) => {
      acc.bookings += m.bookings;
      acc.nights += m.nights;
      acc.grossRevenue += m.grossRevenue;
      acc.cleaningFees += m.cleaningFees;
      acc.totalTaxes += m.jamaicaTaxes + m.texasTaxes;
      acc.managementFees += m.managementFees;
      acc.ownerProceeds += m.ownerProceeds;
      acc.vrboGrossRevenue = (acc.vrboGrossRevenue || 0) + (m.vrboGrossRevenue || 0);
      acc.vrboPayouts = (acc.vrboPayouts || 0) + (m.vrboPayouts || 0);
      return acc;
    },
    {
      bookings: 0,
      nights: 0,
      grossRevenue: 0,
      cleaningFees: 0,
      totalTaxes: 0,
      managementFees: 0,
      ownerProceeds: 0,
      vrboGrossRevenue: 0,
      vrboPayouts: 0,
    }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const handleVrboImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/reports/vrbo-import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setImportResult(data);

      if (data.success) {
        // Refresh the page data by reloading (simple way)
        window.location.reload();
      }
    } catch (err) {
      setImportResult({ success: false, error: 'Upload failed' });
    } finally {
      setUploading(false);
      // reset input
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* VRBO CSV Import */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Import VRBO Payout CSV</h3>
        <p className="text-sm text-slate-600 mb-3">
          Upload the monthly owner statement CSV exported from VRBO. We will match rows to existing VRBO-synced bookings by Reservation ID (or dates + last name fallback) and store the payout details for reporting.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv,.tsv,text/csv"
            onChange={handleVrboImport}
            disabled={uploading}
            className="text-sm"
          />
          {uploading && <span className="text-sm text-slate-500">Uploading &amp; matching...</span>}
        </div>
        {importResult && (
          <div className={`mt-3 p-3 rounded text-sm ${importResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {importResult.message || importResult.error}
            {importResult.unmatched?.length > 0 && (
              <div className="mt-1 text-xs">Unmatched Reservation IDs: {importResult.unmatched.slice(0, 5).join(', ')}{importResult.unmatched.length > 5 ? '...' : ''}</div>
            )}
          </div>
        )}
      </div>

      {/* Year Selector + YTD Summary Cards */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Report Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full sm:w-auto">
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">Bookings</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1">{yearTotals.bookings}</div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">Total Nights</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1">{yearTotals.nights}</div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">Gross Revenue</div>
            <div className="text-2xl font-semibold text-emerald-600 mt-1">
              {formatCurrency(yearTotals.grossRevenue)}
            </div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">Mgmt Fees (22%)</div>
            <div className="text-2xl font-semibold text-amber-600 mt-1">
              {formatCurrency(yearTotals.managementFees)}
            </div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">Owner / VRBO Payouts</div>
            <div className="text-2xl font-semibold text-emerald-700 mt-1">
              {formatCurrency(yearTotals.ownerProceeds + (yearTotals.vrboPayouts || 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Monthly Breakdown — {selectedYear}</h3>
          <div className="text-xs text-slate-500">
            Includes imported VRBO payouts (gross &amp; net to owner)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Month</th>
                <th className="px-4 py-3 text-center font-semibold">Bookings</th>
                <th className="px-4 py-3 text-center font-semibold">Nights</th>
                <th className="px-4 py-3 text-right font-semibold">Gross Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">Cleaning</th>
                <th className="px-4 py-3 text-right font-semibold">Taxes</th>
                <th className="px-4 py-3 text-right font-semibold">Mgmt Fee</th>
                <th className="px-4 py-3 text-right font-semibold">Owner Proceeds</th>
                <th className="px-4 py-3 text-right font-semibold">VRBO Gross</th>
                <th className="px-6 py-3 text-right font-semibold">VRBO Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMonths.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
                    No data for {selectedYear}.
                  </td>
                </tr>
              )}
              {filteredMonths.map((month) => (
                <tr key={month.yearMonth} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{month.monthLabel}</td>
                  <td className="px-4 py-4 text-center">{month.bookings}</td>
                  <td className="px-4 py-4 text-center">{month.nights}</td>
                  <td className="px-4 py-4 text-right font-medium text-emerald-600">
                    {formatCurrency(month.grossRevenue)}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-700">
                    {formatCurrency(month.cleaningFees)}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-700">
                    {formatCurrency(month.jamaicaTaxes + month.texasTaxes)}
                  </td>
                  <td className="px-4 py-4 text-right text-amber-600">
                    {formatCurrency(month.managementFees)}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-emerald-700">
                    {formatCurrency(month.ownerProceeds)}
                  </td>
                  <td className="px-4 py-4 text-right text-blue-600">
                    {formatCurrency(month.vrboGrossRevenue || 0)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-blue-700">
                    {formatCurrency(month.vrboPayouts || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold border-t">
              <tr>
                <td className="px-6 py-3">Total</td>
                <td className="px-4 py-3 text-center">{yearTotals.bookings}</td>
                <td className="px-4 py-3 text-center">{yearTotals.nights}</td>
                <td className="px-4 py-3 text-right text-emerald-600">
                  {formatCurrency(yearTotals.grossRevenue)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(yearTotals.cleaningFees)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(yearTotals.totalTaxes)}
                </td>
                <td className="px-4 py-3 text-right text-amber-600">
                  {formatCurrency(yearTotals.managementFees)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {formatCurrency(yearTotals.ownerProceeds)}
                </td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {formatCurrency(yearTotals.vrboGrossRevenue || 0)}
                </td>
                <td className="px-6 py-3 text-right text-blue-700">
                  {formatCurrency(yearTotals.vrboPayouts || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="text-xs text-slate-500 space-y-1 px-1">
        <p>• Gross Revenue and Owner Proceeds for direct bookings come from our quote snapshots.</p>
        <p>• VRBO Gross / Payout come from imported owner statement CSVs (use the upload box above).</p>
        <p>• "Owner / VRBO Payouts" in cards = our ownerProceeds + imported VRBO payouts to you.</p>
        <p>• Lodging taxes shown are amounts collected (remittance responsibility varies by source).</p>
      </div>
    </div>
  );
}

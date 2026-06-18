'use client';

import { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';

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
  expenses?: number;
  bookingsList?: Array<{
    id: number;
    guestName: string;
    startDate: string;
    endDate: string;
    source: string;
    gross?: number;
  }>;
}

interface YearlyData {
  bookings: number;
  nights: number;
  grossRevenue: number;
  ownerProceeds: number;
  managementFees: number;
  vrboGrossRevenue?: number;
  vrboPayouts?: number;
  expenses?: number;
}

interface ReportsClientProps {
  monthlySummaries: MonthlySummary[];
  yearlyData: YearlyData;
  currentYear: number;
}

export default function ReportsClient({ monthlySummaries, yearlyData, currentYear }: ReportsClientProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      acc.vrboPayouts = (acc.vrboPayouts || 0) + (m.vrboPayouts || 0);
      acc.expenses = (acc.expenses || 0) + (m.expenses || 0);
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
      vrboPayouts: 0,
      expenses: 0,
    }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const handleFileUpload = async (file: File) => {
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
    } catch (err) {
      setImportResult({ success: false, error: 'Upload failed. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleVrboImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // allow selecting the same file again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      // basic validation
      if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.type.includes('csv') || file.type.includes('text')) {
        handleFileUpload(file);
      } else {
        setImportResult({ success: false, error: 'Please upload a .csv or .tsv file.' });
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* VRBO CSV Import */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Import VRBO Payout CSV</h3>
        <p className="text-sm text-slate-600 mb-3">
          Upload the monthly owner statement CSV exported from VRBO. Matching to existing VRBO bookings is done **purely by dates** (start + end only, with tolerant fallback). No names or Reservation IDs are used for matching. After a date match, placeholder names like "Reserved - ..." may be upgraded using the CSV name. When upload fails to match, expand the Debug section below to see the exact parsed date parts from your CSV vs the ones in the DB.
        </p>
        <div
          onClick={triggerFileSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-2 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 bg-white'} ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,text/csv"
            onChange={handleVrboImport}
            className="hidden"
          />

          <div className="flex flex-col items-center">
            <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
            <p className="font-medium text-slate-700">Drop your VRBO CSV here</p>
            <p className="text-sm text-slate-500 mt-1">or click anywhere in this box to choose a file</p>
            <p className="text-[10px] text-slate-400 mt-2">Accepts .csv and .tsv files exported from VRBO Owner portal</p>
          </div>
        </div>

        {uploading && (
          <div className="mt-2 text-sm text-emerald-600 flex items-center gap-2">
            <span>Uploading and matching...</span>
          </div>
        )}

        {importResult && (
          <div className={`mt-3 p-3 rounded-xl text-sm border ${importResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <div>{importResult.message || importResult.error}</div>
            {importResult.unmatched?.length > 0 && (
              <div className="mt-1.5 text-xs opacity-80">
                Unmatched CSV rows (no matching VRBO booking by date):<br />
                {importResult.unmatched.slice(0, 8).join(', ')}{importResult.unmatched.length > 8 ? ' ...' : ''}
              </div>
            )}
            {importResult.debug && (
              <details className="mt-2 text-[10px]">
                <summary className="cursor-pointer">Debug (click to see parsed dates, keys, and VRBO bookings)</summary>
                <pre className="mt-1 bg-white p-1 rounded overflow-auto max-h-64 text-[9px]">{JSON.stringify(importResult.debug, null, 2)}</pre>
              </details>
            )}
            <div className="mt-1 text-[9px] opacity-70">Tip: The debug above shows exactly what the code parsed from your CSV (rawCheckIn + csvStartParts) and the date parts from every VRBO booking in the DB (startParts). Look for the booking with 2026-05-22 to see if startMatch is true.</div>
            {importResult.success && (
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-xs underline hover:no-underline"
              >
                Reload page to see updated reports
              </button>
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
            onChange={(e) => {
              setSelectedYear(parseInt(e.target.value));
              setSelectedMonth(null);
            }}
            className="border rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 w-full sm:w-auto">
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
            <div className="text-xs text-slate-500">Owner Proceeds</div>
            <div className="text-2xl font-semibold text-emerald-700 mt-1">
              {formatCurrency(yearTotals.ownerProceeds)}
            </div>
          </div>
          <div className="bg-white rounded-2xl border p-4">
            <div className="text-xs text-slate-500">Expenses (to Owner)</div>
            <div className="text-2xl font-semibold text-red-600 mt-1">
              {formatCurrency(yearTotals.expenses || 0)}
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
                <th className="px-4 py-3 text-right font-semibold bg-green-50 text-green-700">Gross Revenue</th>
                <th className="px-4 py-3 text-right font-semibold bg-green-50 text-green-700">VRBO Payout</th>
                <th className="px-4 py-3 text-right font-semibold bg-red-50 text-red-700">Cleaning</th>
                <th className="px-4 py-3 text-right font-semibold bg-red-50 text-red-700">Taxes</th>
                <th className="px-4 py-3 text-right font-semibold bg-red-50 text-red-700">Mgmt Fee</th>
                <th className="px-4 py-3 text-right font-semibold bg-red-50 text-red-700">Expenses</th>
                <th className="px-4 py-3 text-right font-semibold">Owner Proceeds</th>
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
                  <td 
                    className="px-6 py-4 font-medium text-slate-900 cursor-pointer hover:text-emerald-600"
                    onClick={() => setSelectedMonth(selectedMonth === month.yearMonth ? null : month.yearMonth)}
                  >{month.monthLabel}</td>
                  <td className="px-4 py-4 text-center">{month.bookings}</td>
                  <td className="px-4 py-4 text-center">{month.nights}</td>
                  <td className="px-4 py-4 text-right font-medium text-green-700 bg-green-50">
                    {formatCurrency(month.grossRevenue)}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-green-700 bg-green-50">
                    {formatCurrency(month.vrboPayouts || 0)}
                  </td>
                  <td className="px-4 py-4 text-right text-red-700 bg-red-50">
                    {formatCurrency(month.cleaningFees)}
                  </td>
                  <td className="px-4 py-4 text-right text-red-700 bg-red-50">
                    {formatCurrency(month.jamaicaTaxes + month.texasTaxes)}
                  </td>
                  <td className="px-4 py-4 text-right text-red-700 bg-red-50">
                    {formatCurrency(month.managementFees)}
                  </td>
                  <td className="px-4 py-4 text-right text-red-700 bg-red-50">
                    {formatCurrency(month.expenses || 0)}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-emerald-700">
                    {formatCurrency(month.ownerProceeds)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold border-t">
              <tr>
                <td className="px-6 py-3">Total</td>
                <td className="px-4 py-3 text-center">{yearTotals.bookings}</td>
                <td className="px-4 py-3 text-center">{yearTotals.nights}</td>
                <td className="px-4 py-3 text-right text-green-700 bg-green-50">
                  {formatCurrency(yearTotals.grossRevenue)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-700 bg-green-50">
                  {formatCurrency(yearTotals.vrboPayouts || 0)}
                </td>
                <td className="px-4 py-3 text-right text-red-700 bg-red-50">
                  {formatCurrency(yearTotals.cleaningFees)}
                </td>
                <td className="px-4 py-3 text-right text-red-700 bg-red-50">
                  {formatCurrency(yearTotals.totalTaxes)}
                </td>
                <td className="px-4 py-3 text-right text-red-700 bg-red-50">
                  {formatCurrency(yearTotals.managementFees)}
                </td>
                <td className="px-4 py-3 text-right text-red-700 bg-red-50">
                  {formatCurrency(yearTotals.expenses || 0)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {formatCurrency(yearTotals.ownerProceeds)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {selectedMonth && (
          <div className="border-t p-4 bg-slate-50">
            {(() => {
              const m = filteredMonths.find(mm => mm.yearMonth === selectedMonth);
              if (!m || !m.bookingsList || m.bookingsList.length === 0) {
                return <div className="text-sm text-slate-500">No bookings recorded for this month.</div>;
              }
              return (
                <div>
                  <h4 className="font-semibold mb-2">Bookings for {m.monthLabel}</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1">Guest</th>
                        <th className="py-1">Dates</th>
                        <th className="py-1">Source</th>
                        <th className="py-1 text-right">Gross</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.bookingsList.map((b, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-1">{b.guestName}</td>
                          <td className="py-1 text-xs text-slate-600">
                            {new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()}
                          </td>
                          <td className="py-1">
                            <span className={`px-2 py-0.5 rounded text-xs ${b.source === 'VRBO' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {b.source}
                            </span>
                          </td>
                          <td className="py-1 text-right">{formatCurrency(b.gross || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button 
                    onClick={() => setSelectedMonth(null)} 
                    className="mt-2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="text-xs text-slate-500 space-y-1 px-1">
        <p>• Gross Revenue, Mgmt Fee and Owner Proceeds include direct quote snapshots + 22%/78% split applied to VRBO gross from imported payouts.</p>
        <p>• Owner Expenses are deducted from Owner Proceeds (entered via /admin/expenses).</p>
        <p>• VRBO Gross / Payout come from imported owner statement CSVs (use the upload box above).</p>
        <p>• Lodging taxes shown are amounts collected (remittance responsibility varies by source).</p>
      </div>
    </div>
  );
}

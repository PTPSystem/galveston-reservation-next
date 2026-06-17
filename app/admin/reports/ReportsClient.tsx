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
          Upload the monthly owner statement CSV exported from VRBO. We will match rows to existing VRBO-synced bookings by Reservation ID (or dates + last name fallback) and store the payout details for reporting.
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
                Unmatched Reservation IDs (not linked to any VRBO booking in the system):<br />
                {importResult.unmatched.slice(0, 8).join(', ')}{importResult.unmatched.length > 8 ? ' ...' : ''}
              </div>
            )}
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

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
}

interface YearlyData {
  bookings: number;
  nights: number;
  grossRevenue: number;
  ownerProceeds: number;
  managementFees: number;
}

interface ReportsClientProps {
  monthlySummaries: MonthlySummary[];
  yearlyData: YearlyData;
  currentYear: number;
}

export default function ReportsClient({ monthlySummaries, yearlyData, currentYear }: ReportsClientProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Get available years from data
  const availableYears = Array.from(
    new Set(monthlySummaries.map((m) => parseInt(m.yearMonth.split('-')[0])))
  ).sort((a, b) => b - a);

  // Filter by selected year
  const filteredMonths = monthlySummaries.filter((m) =>
    m.yearMonth.startsWith(String(selectedYear))
  );

  // Calculate totals for selected year
  const yearTotals = filteredMonths.reduce(
    (acc, m) => {
      acc.bookings += m.bookings;
      acc.nights += m.nights;
      acc.grossRevenue += m.grossRevenue;
      acc.cleaningFees += m.cleaningFees;
      acc.totalTaxes += m.jamaicaTaxes + m.texasTaxes;
      acc.managementFees += m.managementFees;
      acc.ownerProceeds += m.ownerProceeds;
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
    }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
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
            <div className="text-xs text-slate-500">Owner Proceeds</div>
            <div className="text-2xl font-semibold text-emerald-700 mt-1">
              {formatCurrency(yearTotals.ownerProceeds)}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Monthly Breakdown — {selectedYear}</h3>
          <div className="text-xs text-slate-500">
            Direct bookings only (full pricing data available)
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
                <th className="px-6 py-3 text-right font-semibold">Owner Proceeds</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMonths.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
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
                  <td className="px-6 py-4 text-right font-semibold text-emerald-700">
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
                <td className="px-6 py-3 text-right text-emerald-700">
                  {formatCurrency(yearTotals.ownerProceeds)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="text-xs text-slate-500 space-y-1 px-1">
        <p>• All figures are from direct bookings where we have complete pricing snapshots.</p>
        <p>• VRBO channel bookings are tracked for availability only; financials are not included here.</p>
        <p>• Taxes shown are amounts collected from guests (to be remitted).</p>
        <p>• Owner Proceeds = Net after management fee (22% of adjusted base).</p>
      </div>
    </div>
  );
}

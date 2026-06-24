import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!role || !['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(role)) {
    redirect('/login');
  }

  // Fetch all confirmed bookings with their pricing snapshots
  const bookings = await prisma.bookingRequest.findMany({
    where: {
      status: 'CONFIRMED',
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      source: true,
      pricing: true,
      guestName: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  });

  // Fetch VRBO payouts early so we can enrich per-booking gross for lists
  const vrboPayouts = await prisma.vrboPayout.findMany();
  const payoutByBookingId = new Map<number, number>();
  for (const p of vrboPayouts) {
    if (p.bookingRequestId) {
      payoutByBookingId.set(p.bookingRequestId, p.payout || 0);
    }
  }

  // Process into monthly summaries
  const monthlyMap = new Map<string, any>();

  for (const booking of bookings) {
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    const yearMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const nights = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    let gross = 0;
    let cleaning = 0;
    let jamaicaTax = 0;
    let texasTax = 0;
    let mgmtFee = 0;
    let ownerProceeds = 0;

    const p = booking.pricing as any;
    if (p) {
      if (booking.source === 'VRBO') {
        // For VRBO, contribution to summary gross/fees/owner comes from vrboPayouts loop
        // (to avoid double counting). listGross below is used only for the per-booking list.
        gross = 0;
        mgmtFee = 0;
        ownerProceeds = 0;
        cleaning = 0;
        jamaicaTax = 0;
        texasTax = 0;
      } else {
        gross = Number(p.totalGuestPrice) || 0;
        cleaning = Number(p.cleaningFee) || 0;
        jamaicaTax = Number(p.jamaicaBeachTax) || 0;
        texasTax = Number(p.texasStateTax) || 0;
        mgmtFee = Number(p.managementFee) || 0;
        ownerProceeds = Number(p.ownerProceeds) || 0;
      }
    }

    let listGross = gross;
    if (booking.source === 'VRBO') {
      const linkedPayout = payoutByBookingId.get(booking.id) || 0;
      listGross = linkedPayout || Number(p?.vrboPayout || p?.totalGuestPrice) || 0;
    }

    if (!monthlyMap.has(yearMonth)) {
      monthlyMap.set(yearMonth, {
        yearMonth,
        monthLabel,
        bookings: 0,
        nights: 0,
        grossRevenue: 0,
        cleaningFees: 0,
        jamaicaTaxes: 0,
        texasTaxes: 0,
        managementFees: 0,
        ownerProceeds: 0,
        directBookings: 0,
        vrboBookings: 0,
        vrboGrossRevenue: 0,
        vrboPayouts: 0,
        expenses: 0,
        bookingsList: [],
      });
    }

    const monthData = monthlyMap.get(yearMonth);
    if (!monthData.bookingsList) monthData.bookingsList = [];
    monthData.bookingsList.push({
      id: booking.id,
      guestName: booking.guestName,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      source: booking.source,
      gross: listGross,
    });
    monthData.bookings += 1;
    monthData.nights += nights;
    monthData.grossRevenue += gross;
    monthData.cleaningFees += cleaning;
    monthData.jamaicaTaxes += jamaicaTax;
    monthData.texasTaxes += texasTax;
    monthData.managementFees += mgmtFee;
    monthData.ownerProceeds += ownerProceeds;

    if (booking.source === 'VRBO') {
      monthData.vrboBookings += 1;
    } else {
      monthData.directBookings += 1;
    }
  }

  // Fetch owner expenses and deduct from owner's proceeds
  const ownerExpenses = await prisma.ownerExpense.findMany();

  for (const p of vrboPayouts) {
    const start = new Date(p.checkIn);
    const yearMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!monthlyMap.has(yearMonth)) {
      monthlyMap.set(yearMonth, {
        yearMonth,
        monthLabel,
        bookings: 0,
        nights: 0,
        grossRevenue: 0,
        cleaningFees: 0,
        jamaicaTaxes: 0,
        texasTaxes: 0,
        managementFees: 0,
        ownerProceeds: 0,
        directBookings: 0,
        vrboBookings: 0,
        vrboGrossRevenue: 0,
        vrboPayouts: 0,
        expenses: 0,
      });
    }

    const m = monthlyMap.get(yearMonth);
    const vGross = p.grossBookingAmount || 0;
    const vPayout = p.payout || 0;

    // Always accumulate VRBO specific numbers for the dedicated columns
    m.vrboGrossRevenue = (m.vrboGrossRevenue || 0) + vGross;
    m.vrboPayouts = (m.vrboPayouts || 0) + vPayout;

    // Add VRBO payout contribution to main columns (using payout as the gross figure)
    // This applies for both linked and unlinked. The booking loop sets gross=0 for VRBO
    // to avoid double-counting.
    m.grossRevenue = (m.grossRevenue || 0) + vPayout;
    m.managementFees = (m.managementFees || 0) + vPayout * 0.22;
    m.ownerProceeds = (m.ownerProceeds || 0) + vPayout * 0.78;

    if (!p.bookingRequestId) {
      m.bookings += 1;
      m.nights += p.nights;
      m.vrboBookings += 1;
    }
  }

  // Deduct owner expenses from ownerProceeds by month
  for (const exp of ownerExpenses) {
    const start = new Date(exp.date);
    const yearMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyMap.has(yearMonth)) {
      monthlyMap.set(yearMonth, {
        yearMonth,
        monthLabel: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        bookings: 0,
        nights: 0,
        grossRevenue: 0,
        cleaningFees: 0,
        jamaicaTaxes: 0,
        texasTaxes: 0,
        managementFees: 0,
        ownerProceeds: 0,
        directBookings: 0,
        vrboBookings: 0,
        vrboGrossRevenue: 0,
        vrboPayouts: 0,
        expenses: 0,
        bookingsList: [],
      });
    }

    const m = monthlyMap.get(yearMonth);
    m.expenses = (m.expenses || 0) + exp.amount;
    m.ownerProceeds = (m.ownerProceeds || 0) - exp.amount;
  }

  const monthlySummaries = Array.from(monthlyMap.values()).sort((a, b) =>
    b.yearMonth.localeCompare(a.yearMonth)
  );

  // Yearly totals (for current year)
  const currentYear = new Date().getFullYear();
  const yearlyData = monthlySummaries
    .filter((m) => m.yearMonth.startsWith(String(currentYear)))
    .reduce(
      (acc, m) => {
        acc.bookings += m.bookings;
        acc.nights += m.nights;
        acc.grossRevenue += m.grossRevenue;
        acc.ownerProceeds += m.ownerProceeds;
        acc.managementFees += m.managementFees;
        acc.vrboGrossRevenue = (acc.vrboGrossRevenue || 0) + (m.vrboGrossRevenue || 0);
        acc.vrboPayouts = (acc.vrboPayouts || 0) + (m.vrboPayouts || 0);
        acc.expenses = (acc.expenses || 0) + (m.expenses || 0);
        return acc;
      },
      {
        bookings: 0,
        nights: 0,
        grossRevenue: 0,
        ownerProceeds: 0,
        managementFees: 0,
        vrboGrossRevenue: 0,
        vrboPayouts: 0,
        expenses: 0,
      }
    );

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-slate-600 mt-1">
          Monthly financial summary for direct (custom) reservations + imported VRBO payouts.
        </p>
      </div>

      {/* VRBO Inquiry Note */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm">
        <div className="font-medium text-amber-800 mb-1">VRBO Financial Data</div>
        <div className="text-amber-700">
          Our iCal sync only covers availability. Use the import box below to upload VRBO owner statement CSVs to include their payouts in these reports.
          You can export statements from the VRBO Owner portal.
        </div>
      </div>

      <ReportsClient 
        monthlySummaries={monthlySummaries} 
        yearlyData={yearlyData} 
        currentYear={currentYear} 
      />
    </div>
  );
}

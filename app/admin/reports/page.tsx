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
      gross = Number(p.totalGuestPrice) || 0;
      cleaning = Number(p.cleaningFee) || 0;
      jamaicaTax = Number(p.jamaicaBeachTax) || 0;
      texasTax = Number(p.texasStateTax) || 0;
      mgmtFee = Number(p.managementFee) || 0;
      ownerProceeds = Number(p.ownerProceeds) || 0;
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
      });
    }

    const monthData = monthlyMap.get(yearMonth);
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

  // Also pull in any VRBO payouts (linked or not) and merge into monthly summaries
  const vrboPayouts = await prisma.vrboPayout.findMany();

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
      });
    }

    const m = monthlyMap.get(yearMonth);
    // Always accumulate VRBO specific numbers
    m.vrboGrossRevenue = (m.vrboGrossRevenue || 0) + (p.grossBookingAmount || 0);
    m.vrboPayouts = (m.vrboPayouts || 0) + (p.payout || 0);

    // If this payout is not linked to a booking we already counted, add to totals too
    if (!p.bookingRequestId) {
      m.bookings += 1;
      m.nights += p.nights;
      m.vrboBookings += 1;
      m.grossRevenue += p.grossBookingAmount || 0;
      m.ownerProceeds += p.payout || 0; // for VRBO, payout to owner is the key "proceeds"
    }
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

import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';

// Prevent this page from being statically generated at build time
// (it needs database access at runtime)
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function GuestQuoteView({ params }: Props) {
  const { token } = await params;

  const booking = await prisma.bookingRequest.findUnique({
    where: { approvalToken: token },
    include: {
      adjustments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!booking) {
    notFound();
  }

  const pricing = booking.pricing as any;
  const hasQuote = !!pricing?.totalGuestPrice;
  const isConfirmed = booking.status === 'CONFIRMED';
  const depositAmount =
    typeof pricing?.depositAmount === 'number' ? pricing.depositAmount : null;
  const depositStatus = pricing?.depositStatus as string | undefined;
  const balanceDue =
    depositAmount != null && typeof pricing?.totalGuestPrice === 'number'
      ? Math.max(0, pricing.totalGuestPrice - depositAmount)
      : null;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-8">
        <a href="/" className="text-sm text-emerald-600 hover:underline">
          ← Back to Bayfront Retreat
        </a>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight mb-2">Your Quote</h1>
      <p className="text-slate-700 mb-8">
        {booking.guestName} • {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
      </p>

      {!hasQuote && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
          <p className="text-amber-800">
            Your request is still being reviewed. You will receive a personalized quote by email
            within 24 hours.
          </p>
        </div>
      )}

      {hasQuote && !isConfirmed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
          <p className="text-amber-900 font-medium mb-1">Deposit required to hold dates</p>
          <p className="text-amber-800 text-sm">
            {depositAmount != null
              ? `Please send a deposit of $${depositAmount.toFixed(2)}. Once we receive it, your reservation will be confirmed.`
              : 'Please follow the deposit instructions in your quote email to confirm your stay.'}
          </p>
        </div>
      )}

      {isConfirmed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-8">
          <p className="text-emerald-900 font-medium">
            {depositStatus === 'WAIVED'
              ? 'Your reservation is confirmed (deposit waived).'
              : 'Your reservation is confirmed — deposit received. Your dates are held.'}
          </p>
        </div>
      )}

      {hasQuote && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl border p-8">
            <h2 className="font-semibold text-xl mb-6">Your Pricing</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Base Rate</span>
                <span className="font-medium">${pricing.baseRateSum?.toFixed(2) ?? '—'}</span>
              </div>
              {pricing.nightlyAdjSum !== 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Nightly Adjustments</span>
                  <span>${pricing.nightlyAdjSum?.toFixed(2)}</span>
                </div>
              )}
              {pricing.stayAdjSum !== 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Stay Adjustments</span>
                  <span>${pricing.stayAdjSum?.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-3 border-t flex justify-between font-semibold">
                <span>Subtotal after Adjustments</span>
                <span>${pricing.netAfterAdjustments?.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Jamaica Beach Tax (9%)</span>
                <span>${pricing.jamaicaBeachTax?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Texas State Tax (6%)</span>
                <span>${pricing.texasStateTax?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cleaning Fee</span>
                <span>${pricing.cleaningFee?.toFixed(2)}</span>
              </div>

              <div className="pt-4 border-t flex justify-between text-xl font-bold text-emerald-600">
                <span>Total Stay Price</span>
                <span>${pricing.totalGuestPrice?.toFixed(2)}</span>
              </div>

              {depositAmount != null && (
                <>
                  <div className="pt-3 border-t flex justify-between font-semibold text-teal-800">
                    <span>Deposit {isConfirmed ? 'Paid' : 'Due'}</span>
                    <span>${depositAmount.toFixed(2)}</span>
                  </div>
                  {balanceDue != null && (
                    <div className="flex justify-between text-slate-600">
                      <span>Balance Due Before Arrival</span>
                      <span>${balanceDue.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!isConfirmed && (
            <div className="bg-slate-50 border rounded-2xl p-6 text-center">
              <p className="font-medium text-slate-800 mb-2">How to pay the deposit</p>
              <p className="text-sm text-slate-600">
                Reply to your quote email or call us — we will share payment instructions. Your
                dates are held after we confirm the deposit.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

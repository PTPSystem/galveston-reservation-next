import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';

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

  // Only show full details if confirmed
  const isConfirmed = booking.status === 'CONFIRMED';
  const pricing = booking.pricing as any;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="mb-8">
        <a href="/" className="text-sm text-emerald-600 hover:underline">← Back to Bayfront Retreat</a>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight mb-2">Your Quote</h1>
      <p className="text-slate-700 mb-8">
        {booking.guestName} • {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
      </p>

      {!isConfirmed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
          <p className="text-amber-800">
            Your request is still being reviewed. You will receive a personalized quote by email within 24 hours.
          </p>
        </div>
      )}

      {isConfirmed && pricing && (
        <div className="space-y-8">
          {/* Pricing Summary */}
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
                <span>Total</span>
                <span>${pricing.totalGuestPrice?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <p className="font-medium text-emerald-800 mb-2">Ready to book?</p>
            <p className="text-sm text-emerald-700">
              Reply to the quote email or call us to confirm your dates.
            </p>
          </div>
        </div>
      )}

      {!isConfirmed && !pricing && (
        <div className="text-slate-600">
          We are preparing your personalized quote.
        </div>
      )}
    </div>
  );
}

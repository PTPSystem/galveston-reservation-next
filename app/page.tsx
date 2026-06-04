import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import Image from "next/image";

export default function BayfrontRetreatLanding() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero - Stunning property photo */}
      <div className="relative min-h-[88vh] flex items-center overflow-hidden bg-gradient-to-br from-blue-950 via-slate-900 to-amber-950">
        {/* Full-bleed hero photo of Bayfront Retreat.
           Place the photo you sent (the aerial view of the yellow house) at:
           public/hero.jpg   (download from chat → save as hero.jpg in the public folder)
           The gradient below provides a beautiful fallback until the photo is added.
        */}
        <Image
          src="/hero.jpg"
          alt="Bayfront Retreat — beautiful yellow waterfront home with expansive multi-level decks overlooking Galveston Bay in Jamaica Beach, Texas at golden hour"
          fill
          className="object-cover"
          priority
        />

        {/* Strong gradient overlay for excellent text contrast and depth (photo is bright sky + light house) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />
        {/* Extra left-side depth for the title area */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/30 px-4 py-1.5 rounded-full text-sm mb-5 text-white font-medium shadow-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Jamaica Beach, Galveston Bay, Texas
            </div>

            <h1 className="text-6xl sm:text-7xl font-semibold tracking-tighter mb-6 text-white drop-shadow-md">
              Bayfront Retreat
            </h1>

            <p className="text-3xl sm:text-4xl text-white mb-9 leading-tight drop-shadow-md">
              Private waterfront home on Galveston Bay.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#availability"
                className="inline-flex items-center justify-center px-9 py-4 bg-white text-slate-950 rounded-2xl font-semibold hover:bg-white/95 active:bg-white transition-all text-lg shadow-xl hover:shadow-2xl"
              >
                Request to Book
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center px-9 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-2xl font-semibold hover:bg-white/20 active:bg-white/25 transition-all text-lg"
              >
                How It Works
              </a>
            </div>

            <p className="mt-5 text-sm text-white max-w-md drop-shadow-sm">
              All bookings are subject to host approval. We do not offer instant reservations.
            </p>
          </div>
        </div>

        {/* Subtle scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block">
          <div className="flex flex-col items-center text-white/60 text-xs tracking-[2px]">
            SCROLL TO EXPLORE
            <div className="mt-1 h-px w-6 bg-white/40" />
          </div>
        </div>
      </div>

      {/* Quick Info Bar */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-y-6 text-sm">
          <div>
            <div className="font-medium text-slate-800">Location</div>
            <div>Jamaica Beach, Galveston Bay</div>
          </div>
          <div>
            <div className="font-medium text-slate-800">Guests</div>
            <div>Up to 10 guests</div>
          </div>
          <div>
            <div className="font-medium text-slate-800">Bedrooms</div>
            <div>4 bedrooms • 3 baths</div>
          </div>
          <div>
            <div className="font-medium text-slate-800">Minimum Stay</div>
            <div>2 nights (longer stays preferred in peak season)</div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight mb-8">How Booking Works</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">1</div>
            <h3 className="font-semibold text-lg">Submit a Request</h3>
            <p className="text-slate-800">Tell us your preferred dates and group size. This is not an instant booking — all requests are reviewed.</p>
          </div>
          <div className="space-y-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">2</div>
            <h3 className="font-semibold text-lg">We Review & Quote</h3>
            <p className="text-slate-800">We check availability and send you a personalized quote with full pricing breakdown (including taxes and fees) within 24 hours.</p>
          </div>
          <div className="space-y-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">3</div>
            <h3 className="font-semibold text-lg">Confirm Your Stay</h3>
            <p className="text-slate-800">Once you accept the quote and pay the deposit, your dates are secured.</p>
          </div>
        </div>

        <div className="mt-12 space-y-3 text-center">
          <a 
            href="#availability" 
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-slate-900 rounded-2xl font-semibold hover:bg-slate-100 transition-colors text-lg"
          >
            Request to Book →
          </a>
          <div className="text-sm text-slate-500">
            Select your dates below on the calendar to check availability before requesting.
          </div>
        </div>
      </div>

      {/* Availability Calendar - Book from here */}
      <div id="availability" className="border-t bg-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold tracking-tight">Check Availability &amp; Request Your Dates</h2>
            <p className="text-slate-600 mt-2">Select dates on the calendar below. If available, you can start your booking request directly.</p>
          </div>
          <AvailabilityCalendar />
        </div>
      </div>

      {/* Admin */}
      <div className="border-t bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-800">
          <a href="/admin/requests" className="text-emerald-600 hover:underline font-medium">Admin</a>
        </div>
      </div>
    </div>
  );
}
// Force fresh Vercel build - react-day-picker dependency - Fri May 29 16:48:51 CDT 2026

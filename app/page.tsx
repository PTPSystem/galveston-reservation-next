export default function BayfrontRetreatLanding() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/30 px-3 py-1 rounded-full text-sm mb-4 text-white font-medium">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Jamaica Beach, Galveston Bay, Texas
            </div>
            
            <h1 className="text-6xl font-semibold tracking-tighter mb-6 text-white">
              Bayfront Retreat
            </h1>
            
            <p className="text-2xl text-slate-200 mb-8">
              Private waterfront home on Galveston Bay.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="/request" 
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-slate-900 rounded-2xl font-semibold hover:bg-slate-100 transition-colors text-lg"
              >
                Request to Book
              </a>
              <a 
                href="#how-it-works" 
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-slate-900 rounded-2xl font-semibold text-lg"
              >
                How It Works
              </a>
            </div>
            <p className="mt-4 text-sm text-white/90">
              All bookings are subject to host approval. We do not offer instant reservations.
            </p>
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
            <div>5 bedrooms • 4.5 baths</div>
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

        <div className="mt-12">
          <a 
            href="/request" 
            className="inline-flex items-center justify-center px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-black transition-colors text-lg"
          >
            Request to Book →
          </a>
        </div>
      </div>

      {/* Admin Access (temporary) */}
      <div className="border-t bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-800">
          <strong>Property Manager:</strong>{" "}
          <a href="/admin/requests" className="text-emerald-600 hover:underline font-medium">Booking Requests</a> •{" "}
          <a href="/admin/holidays" className="text-emerald-600 hover:underline font-medium">Holiday Calendar</a>
        </div>
      </div>
    </div>
  );
}

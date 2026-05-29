import { Suspense } from 'react';
import RequestForm from './RequestForm';

export default function RequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading booking form...</p>
        </div>
      </div>
    }>
      <RequestForm />
    </Suspense>
  );
}

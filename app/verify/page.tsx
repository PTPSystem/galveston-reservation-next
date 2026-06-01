'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

function VerifyContent() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        router.push('/admin/requests');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid code');
      }
    } catch {
      setError('Failed to verify');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    await fetch('/api/verify/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    alert('New code sent');
  };

  if (!email) {
    return <div className="p-8">Invalid verification link.</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border">
        <h1 className="text-xl font-semibold mb-2">Verify your email</h1>
        <p className="text-sm text-slate-600 mb-6">A code was sent to {email}</p>

        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            className="w-full border rounded-lg px-4 py-3 text-center text-xl tracking-[8px]"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium disabled:opacity-70"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <button onClick={resendCode} className="mt-4 text-sm text-emerald-600 hover:underline w-full">
          Resend code
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}

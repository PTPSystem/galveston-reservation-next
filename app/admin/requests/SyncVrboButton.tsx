'use client';

import { useState } from 'react';

export default function SyncVrboButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/sync-vrbo', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: data.message || 'VRBO calendar synced successfully!',
        });
        // Refresh the page after a short delay so the new bookings appear
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Sync failed. Please check the console.',
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Network error while syncing. Please try again.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white text-sm font-medium rounded-xl transition-colors"
      >
        <i className={`fa-solid fa-sync ${isSyncing ? 'animate-spin' : ''}`}></i>
        {isSyncing ? 'Syncing...' : 'Sync VRBO Calendar'}
      </button>

      {message && (
        <div
          className={`text-xs px-3 py-1.5 rounded-lg max-w-[260px] text-right ${
            message.type === 'success'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

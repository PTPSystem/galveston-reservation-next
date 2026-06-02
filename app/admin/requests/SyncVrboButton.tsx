'use client';

import { useState } from 'react';

export default function SyncVrboButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Construct the iCal export URL (works for both local and production)
  const icalExportUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/ical/vrbo` 
    : '';

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

  const copyIcalLink = async () => {
    if (!icalExportUrl) return;
    try {
      await navigator.clipboard.writeText(icalExportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // fallback for older browsers
      prompt('Copy this iCal link for VRBO:', icalExportUrl);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <i className={`fa-solid fa-sync ${isSyncing ? 'animate-spin' : ''}`}></i>
          {isSyncing ? 'Syncing...' : 'Sync VRBO Calendar (Import)'}
        </button>

        <button
          onClick={copyIcalLink}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
          title="Copy iCal link to paste into VRBO"
        >
          <i className="fa-solid fa-link"></i>
          {copied ? 'Copied!' : 'Copy iCal Export Link'}
        </button>
      </div>

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

      {icalExportUrl && (
        <div className="text-[10px] text-slate-500 max-w-[300px] text-right truncate">
          Export URL for VRBO: {icalExportUrl}
        </div>
      )}
    </div>
  );
}

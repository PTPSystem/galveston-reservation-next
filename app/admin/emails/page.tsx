'use client';

import { useState, useEffect } from 'react';

interface EmailSettings {
  propertyManagerEmail: string;
  ownerEmail: string;
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>({
    propertyManagerEmail: '',
    ownerEmail: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/emails');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Failed to load email settings', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setMessage({ type: 'success', text: 'Email settings saved successfully!' });
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Email Recipients</h1>
        <p className="text-slate-600 mt-2">
          Configure who receives internal emails (new booking requests and quote confirmations).
          For now, both will receive all emails.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl border">
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">
            Property Manager Email
          </label>
          <input
            type="email"
            value={settings.propertyManagerEmail}
            onChange={(e) =>
              setSettings({ ...settings, propertyManagerEmail: e.target.value })
            }
            required
            className="w-full border rounded-lg px-4 py-2.5"
            placeholder="manager@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1.5">
            Owner Email
          </label>
          <input
            type="email"
            value={settings.ownerEmail}
            onChange={(e) => setSettings({ ...settings, ownerEmail: e.target.value })}
            required
            className="w-full border rounded-lg px-4 py-2.5"
            placeholder="owner@example.com"
          />
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : 'Save Email Settings'}
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          All internal notifications (new requests + quote confirmations) will be sent to both addresses.
        </p>
      </form>
    </div>
  );
}

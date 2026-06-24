'use client';

import { useState, useEffect, useRef } from 'react';

interface Expense {
  id: number;
  description: string;
  date: string;
  amount: number;
  attachment: string | null;
  createdAt: string;
}

export default function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    description: '',
    date: '',
    amount: '',
    file: null as File | null,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentAttachment, setCurrentAttachment] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/expenses');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const resetForm = () => {
    setForm({ description: '', date: '', amount: '', file: null });
    setEditingId(null);
    setCurrentAttachment(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('description', form.description);
    formData.append('date', form.date);
    formData.append('amount', form.amount);
    if (form.file) {
      formData.append('attachment', form.file);
    }

    const url = editingId 
      ? `/api/admin/expenses/${editingId}` 
      : '/api/admin/expenses';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        body: formData,
      });

      if (res.ok) {
        await fetchExpenses();
        resetForm();
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to save expense');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setCurrentAttachment(expense.attachment);
    setForm({
      description: expense.description,
      date: expense.date.split('T')[0],
      amount: expense.amount.toString(),
      file: null,
    });
    setError('');

    // Scroll to the form so the user sees the edit form is now active
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return;

    try {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchExpenses();
      }
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleViewAttachment = (attachment: string | null, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!attachment) return;

    // Open data URLs reliably using window.open + document write
    // This works better than <a target="_blank"> for large base64 data URLs
    const win = window.open('', '_blank');
    if (win) {
      win.document.title = 'Receipt';
      if (attachment.startsWith('data:image')) {
        win.document.body.innerHTML = `
          <div style="display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f8f8f8;">
            <img src="${attachment}" style="max-width:100%; max-height:100vh; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" alt="Receipt" />
          </div>
        `;
      } else if (attachment.startsWith('data:application/pdf')) {
        win.document.body.innerHTML = `
          <iframe src="${attachment}" style="width:100%; height:100vh; border:none;"></iframe>
        `;
      } else {
        // Fallback for other types
        win.document.body.innerHTML = `
          <div style="padding:20px; font-family:sans-serif;">
            <a href="${attachment}" download="receipt">Download Receipt</a>
          </div>
        `;
      }
    } else {
      // Last resort fallback
      const link = document.createElement('a');
      link.href = attachment;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8">
      {/* Form */}
      <div ref={formRef} className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-slate-900 mb-4">
          {editingId ? 'Edit Expense' : 'Add New Expense'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Pool maintenance - July"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Receipt Attachment (optional)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              <p className="text-xs text-slate-500 mt-1">Images or PDFs. Max size depends on your browser.</p>
              {editingId && currentAttachment && (
                <div className="mt-1 text-xs text-slate-600">
                  Current receipt:{' '}
                  <button
                    type="button"
                    onClick={() => handleViewAttachment(currentAttachment)}
                    className="text-emerald-600 hover:underline"
                  >
                    View existing
                  </button>{' '}
                  (selecting a new file will replace it)
                </div>
              )}
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Expense' : 'Add Expense'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 rounded-xl text-sm font-medium border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Expense History</h3>
          <div className="text-sm text-slate-600">
            Total: <span className="font-semibold text-slate-900">{formatCurrency(totalExpenses)}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No expenses recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold">Receipt</th>
                  <th className="px-6 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-700">{formatDate(exp.date)}</td>
                    <td className="px-4 py-4 text-slate-900">{exp.description}</td>
                    <td className="px-4 py-4 text-right font-medium text-red-600">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {exp.attachment ? (
                        <button
                          onClick={(e) => handleViewAttachment(exp.attachment, e)}
                          className="text-emerald-600 hover:underline text-xs"
                        >
                          View Receipt
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(exp)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-xs px-3 py-1.5 rounded-lg text-red-600 border border-red-200 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

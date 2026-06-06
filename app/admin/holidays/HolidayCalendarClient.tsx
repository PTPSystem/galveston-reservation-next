'use client';

import { useState, useEffect } from 'react';

interface HolidayPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  rate: number;
  notes: string | null;
}

interface BlockedPeriod {
  id: number;
  startDate: string;
  endDate: string;
  reason: string | null;
}

interface Props {
  initialHolidays: HolidayPeriod[];
  initialBlocks: BlockedPeriod[];
}

export default function HolidayCalendarClient({ initialHolidays, initialBlocks }: Props) {
  const [holidays, setHolidays] = useState<HolidayPeriod[]>(initialHolidays);
  const [blocks, setBlocks] = useState<BlockedPeriod[]>(initialBlocks);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [addType, setAddType] = useState<'holiday' | 'blocked'>('holiday'); // for add modal type

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    rate: 700,
    notes: '',
  });

  const [addForm, setAddForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    rate: 700,
    notes: '',
  });

  const [blockForm, setBlockForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  });

  const calculateNights = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const openAddModal = (type: 'holiday' | 'blocked' = 'holiday') => {
    setAddType(type);
    if (type === 'holiday') {
      setAddForm({ name: '', startDate: '', endDate: '', rate: 700, notes: '' });
    } else {
      setBlockForm({ startDate: '', endDate: '', reason: '' });
    }
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    cancelEditing();
  };

  // Start inline editing for a row
  const startEditing = (holiday: HolidayPeriod) => {
    setEditingId(holiday.id);
    setEditForm({
      name: holiday.name,
      startDate: holiday.startDate.split('T')[0],
      endDate: holiday.endDate.split('T')[0],
      rate: holiday.rate,
      notes: holiday.notes || '',
    });
  };

  // Ensure edit form is always populated when editingId changes
  useEffect(() => {
    if (editingId) {
      const current = holidays.find(h => h.id === editingId);
      if (current) {
        setEditForm({
          name: current.name,
          startDate: current.startDate.split('T')[0],
          endDate: current.endDate.split('T')[0],
          rate: current.rate,
          notes: current.notes || '',
        });
      }
    }
  }, [editingId, holidays]);

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveInlineEdit = async () => {
    if (!editingId) return;

    const payload = {
      name: editForm.name,
      startDate: editForm.startDate,
      endDate: editForm.endDate,
      rate: editForm.rate,
      notes: editForm.notes || null,
    };

    try {
      const res = await fetch(`/api/admin/holidays/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setHolidays(holidays.map(h => h.id === updated.id ? updated : h));
        setEditingId(null);
        setIsEditModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to save edit', error);
      alert('Failed to save changes');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (addType === 'holiday') {
      const payload = {
        name: addForm.name,
        startDate: addForm.startDate,
        endDate: addForm.endDate,
        rate: addForm.rate,
        notes: addForm.notes || null,
      };

      try {
        const res = await fetch('/api/admin/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const newHoliday = await res.json();
          setHolidays([...holidays, newHoliday]);
          closeAddModal();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Failed to add holiday period');
        }
      } catch (error) {
        console.error('Failed to add holiday period', error);
        alert('Failed to add');
      }
    } else {
      // blocked
      const payload = {
        startDate: blockForm.startDate,
        endDate: blockForm.endDate,
        reason: blockForm.reason || null,
      };

      try {
        const res = await fetch('/api/admin/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const newBlock = await res.json();
          setBlocks([...blocks, newBlock]);
          closeAddModal();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Failed to add blocked date (check calendar for conflicts?)');
        }
      } catch (error) {
        console.error('Failed to add blocked period', error);
        alert('Failed to add blocked date');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this holiday period?')) return;

    try {
      const res = await fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHolidays(holidays.filter(h => h.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete', error);
    }
  };

  const handleDeleteBlock = async (id: number) => {
    if (!confirm('Remove this blocked date? It will become available again on the calendar.')) return;

    try {
      const res = await fetch(`/api/admin/blocks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBlocks(blocks.filter(b => b.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete block', error);
    }
  };

  const totalNights = holidays.reduce((sum, h) => {
    return sum + calculateNights(h.startDate, h.endDate);
  }, 0);

  const removeDuplicates = async () => {
    if (!confirm('Remove all duplicate holiday periods? This will keep only one copy of each.')) return;

    try {
      const res = await fetch('/api/admin/holidays/clean-duplicates', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        // Refresh the list
        const refreshRes = await fetch('/api/admin/holidays');
        const refreshed = await refreshRes.json();
        setHolidays(refreshed);

        alert(data.message || `Removed ${data.deleted} duplicates.`);
      } else {
        alert('Failed to remove duplicates: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to remove duplicates', error);
      alert('Failed to remove duplicates. Check console for details.');
    }
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border">
          <div className="text-sm text-slate-700">Holiday/Peak Periods</div>
          <div className="text-3xl font-semibold mt-1 text-slate-900">{holidays.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border">
          <div className="text-sm text-slate-700">Total Holiday Nights</div>
          <div className="text-3xl font-semibold mt-1 text-orange-600">{totalNights}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border">
          <div className="text-sm text-slate-700">Manually Blocked</div>
          <div className="text-3xl font-semibold mt-1 text-red-600">{blocks.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border">
          <div className="text-sm text-slate-700">Blocked Nights</div>
          <div className="text-3xl font-semibold mt-1 text-red-600">
            {blocks.reduce((sum, b) => sum + Math.ceil((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000*60*60*24)) + 1, 0)}
          </div>
        </div>
      </div>

      {/* Header row with actions - shared between mobile and desktop */}
      <div className="bg-white rounded-2xl shadow-sm border mb-4">
        <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h2 className="font-semibold text-slate-900">Holiday &amp; Peak Periods (pricing)</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={removeDuplicates}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm"
            >
              <i className="fa-solid fa-broom"></i>
              <span className="hidden sm:inline">Remove Duplicates</span>
              <span className="sm:hidden">Clean Duplicates</span>
            </button>
            <button
              onClick={() => openAddModal('holiday')}
              className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm hover:bg-emerald-700"
            >
              <i className="fa-solid fa-plus"></i>
              Add Holiday Period
            </button>
          </div>
        </div>

        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-slate-900 font-semibold">Name</th>
                <th className="px-3 sm:px-6 py-3 text-left text-slate-900 font-semibold">Start</th>
                <th className="px-3 sm:px-6 py-3 text-left text-slate-900 font-semibold">End</th>
                <th className="px-3 sm:px-6 py-3 text-center text-slate-900 font-semibold">Nights</th>
                <th className="px-3 sm:px-6 py-3 text-center text-slate-900 font-semibold">Rate</th>
                <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-slate-900 font-semibold">Notes</th>
                <th className="px-4 sm:px-6 py-3 text-right text-slate-900 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {holidays.map((holiday) => {
                const nights = calculateNights(holiday.startDate, holiday.endDate);
                const isEditing = holiday.id === editingId;

                if (isEditing) {
                  // Inline editing row (desktop only)
                  return (
                    <tr key={holiday.id} className="bg-emerald-50">
                      <td className="px-4 sm:px-6 py-3">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full max-w-[160px] sm:max-w-[220px] border rounded px-2 py-1 text-sm text-slate-900 bg-white placeholder:text-slate-500"
                          placeholder="Name"
                        />
                      </td>
                      <td className="px-3 sm:px-6 py-3">
                        <input
                          type="date"
                          value={editForm.startDate}
                          onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                          className="w-full max-w-[110px] sm:max-w-[130px] border rounded px-2 py-1 text-sm text-slate-900 bg-white"
                        />
                      </td>
                      <td className="px-3 sm:px-6 py-3">
                        <input
                          type="date"
                          value={editForm.endDate}
                          onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                          className="w-full max-w-[110px] sm:max-w-[130px] border rounded px-2 py-1 text-sm text-slate-900 bg-white"
                        />
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-center font-medium ">{nights}</td>
                      <td className="px-3 sm:px-6 py-3 text-center">
                        <input
                          type="number"
                          value={editForm.rate}
                          onChange={(e) => setEditForm({ ...editForm, rate: parseInt(e.target.value) || 700 })}
                          className="w-20 border rounded px-2 py-1 text-sm text-center text-slate-900 bg-white"
                        />
                      </td>
                      <td className="hidden md:table-cell px-4 sm:px-6 py-3">
                        <input
                          type="text"
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          className="w-full max-w-[140px] border rounded px-2 py-1 text-sm text-slate-900 bg-white placeholder:text-slate-500"
                          placeholder="Notes"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={saveInlineEdit}
                            className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1 text-sm border rounded text-slate-700 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Normal display row
                return (
                  <tr 
                    key={holiday.id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => startEditing(holiday)}
                  >
                    <td className="px-4 sm:px-6 py-4 font-medium text-slate-900">{holiday.name}</td>
                    <td className="px-3 sm:px-6 py-4 text-slate-800">
                      {new Date(holiday.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-slate-800">
                      {new Date(holiday.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-3 sm:px-6 py-4 text-center font-semibold text-slate-900">{nights}</td>
                    <td className="px-3 sm:px-6 py-4 text-center">
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold">
                        ${holiday.rate}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-4 text-xs text-slate-700 max-w-xs truncate">
                      {holiday.notes || '—'}
                    </td>
                    <td className="px-4 sm:px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => startEditing(holiday)}
                          className="flex items-center gap-1.5 px-3 py-1 text-sm rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <i className="fa-solid fa-edit"></i>
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(holiday.id)}
                          className="flex items-center gap-1.5 px-3 py-1 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 transition-colors"
                        >
                          <i className="fa-solid fa-trash"></i>
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View - much easier to use on phones */}
        <div className="md:hidden divide-y">
          {holidays.length === 0 && (
            <div className="p-8 text-center text-slate-600">No holiday periods defined yet.</div>
          )}
          {holidays.map((holiday) => {
            const nights = calculateNights(holiday.startDate, holiday.endDate);

            return (
              <div key={holiday.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-lg text-slate-900">{holiday.name}</div>
                    <div className="mt-1 text-sm text-slate-700">
                      {new Date(holiday.startDate).toLocaleDateString()} → {new Date(holiday.endDate).toLocaleDateString()}
                      <span className="text-slate-500"> ({nights} nights)</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-semibold">
                      ${holiday.rate}
                    </span>
                  </div>
                </div>

                {holiday.notes && (
                  <div className="mt-2 text-sm text-slate-600 line-clamp-2">
                    {holiday.notes}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      startEditing(holiday);
                      setIsEditModalOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-300 rounded-xl hover:bg-slate-50 active:bg-slate-100"
                  >
                    <i className="fa-solid fa-edit"></i>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(holiday.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-red-200 text-red-700 rounded-xl hover:bg-red-50 active:bg-red-100"
                  >
                    <i className="fa-solid fa-trash"></i>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manually Blocked Dates Section */}
      <div className="bg-white rounded-2xl shadow-sm border mb-6">
        <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h2 className="font-semibold text-slate-900">Manually Blocked Dates (unavailable on calendar)</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openAddModal('blocked')}
              className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm hover:bg-red-700"
            >
              <i className="fa-solid fa-ban"></i>
              Add Blocked Date
            </button>
          </div>
        </div>

        {/* Desktop Table for Blocks */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left font-medium text-slate-700">Start</th>
                <th className="px-3 sm:px-6 py-3 text-left font-medium text-slate-700">End</th>
                <th className="px-3 sm:px-6 py-3 text-center font-medium text-slate-700">Nights</th>
                <th className="px-4 sm:px-6 py-3 text-left font-medium text-slate-700">Reason</th>
                <th className="px-4 sm:px-6 py-3 text-right font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {blocks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No manually blocked dates.</td>
                </tr>
              )}
              {blocks.map((block) => {
                const nights = Math.ceil((new Date(block.endDate).getTime() - new Date(block.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <tr key={block.id} className="hover:bg-red-50/30">
                    <td className="px-4 sm:px-6 py-4 text-slate-800">{new Date(block.startDate).toLocaleDateString()}</td>
                    <td className="px-3 sm:px-6 py-4 text-slate-800">{new Date(block.endDate).toLocaleDateString()}</td>
                    <td className="px-3 sm:px-6 py-4 text-center font-semibold text-red-700">{nights}</td>
                    <td className="px-4 sm:px-6 py-4 text-xs text-slate-700 max-w-xs truncate">{block.reason || '—'}</td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteBlock(block.id)}
                        className="px-3 py-1 text-sm rounded border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <i className="fa-solid fa-trash"></i> Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards for Blocks */}
        <div className="md:hidden divide-y">
          {blocks.length === 0 && (
            <div className="p-8 text-center text-slate-600">No manually blocked dates yet. Use the button above to add dates that should be unavailable (e.g. maintenance).</div>
          )}
          {blocks.map((block) => {
            const nights = Math.ceil((new Date(block.endDate).getTime() - new Date(block.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return (
              <div key={block.id} className="p-4 bg-red-50/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-lg text-red-900">
                      {new Date(block.startDate).toLocaleDateString()} → {new Date(block.endDate).toLocaleDateString()}
                      <span className="text-red-600"> ({nights} nights)</span>
                    </div>
                    {block.reason && (
                      <div className="mt-1 text-sm text-slate-600">{block.reason}</div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-red-200 text-red-700 rounded-xl hover:bg-red-50 active:bg-red-100"
                  >
                    <i className="fa-solid fa-trash"></i>
                    Remove Block
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Modal (supports both holiday and blocked) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeAddModal}>
          <div className="bg-white w-full max-w-lg mx-4 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">
                {addType === 'holiday' ? 'Add Holiday / Peak Period' : 'Add Manually Blocked Date(s)'}
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {addType === 'holiday' 
                  ? 'These dates will use the special rate when quoted. They do not block availability.'
                  : 'These dates will be marked unavailable on the public calendar and in booking requests. Checked against existing confirmed bookings.'}
              </p>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                {addType === 'holiday' ? (
                  <>
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <input
                        type="text"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        className="mt-1 w-full border rounded-lg px-4 py-2"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Start Date</label>
                        <input
                          type="date"
                          value={addForm.startDate}
                          onChange={(e) => setAddForm({ ...addForm, startDate: e.target.value })}
                          className="mt-1 w-full border rounded-lg px-4 py-2"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">End Date</label>
                        <input
                          type="date"
                          value={addForm.endDate}
                          onChange={(e) => setAddForm({ ...addForm, endDate: e.target.value })}
                          className="mt-1 w-full border rounded-lg px-4 py-2"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Rate per Night</label>
                      <input
                        type="number"
                        value={addForm.rate}
                        onChange={(e) => setAddForm({ ...addForm, rate: parseInt(e.target.value) })}
                        className="mt-1 w-full border rounded-lg px-4 py-2"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <textarea
                        value={addForm.notes}
                        onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                        className="mt-1 w-full border rounded-lg px-4 py-2"
                        rows={2}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Start Date</label>
                        <input
                          type="date"
                          value={blockForm.startDate}
                          onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })}
                          className="mt-1 w-full border rounded-lg px-4 py-2"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">End Date</label>
                        <input
                          type="date"
                          value={blockForm.endDate}
                          onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })}
                          className="mt-1 w-full border rounded-lg px-4 py-2"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Reason (optional)</label>
                      <textarea
                        value={blockForm.reason}
                        onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                        className="mt-1 w-full border rounded-lg px-4 py-2"
                        rows={2}
                        placeholder="e.g. Owner stay, maintenance, etc."
                      />
                    </div>
                    <p className="text-xs text-slate-500">Single day: set start and end to the same date. This will appear as unavailable on the public calendar.</p>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeAddModal} className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-6 py-2 ${addType === 'holiday' ? 'bg-emerald-600' : 'bg-red-600'} text-white rounded-lg text-sm font-medium`}
                  >
                    {addType === 'holiday' ? 'Add Period' : 'Add Blocked Date'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - used on mobile for much better experience */}
      {isEditModalOpen && editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeEditModal}>
          <div className="bg-white w-full max-w-lg mx-4 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Edit Holiday / Peak Period</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="mt-1 w-full border rounded-lg px-4 py-2 text-slate-900"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="mt-1 w-full border rounded-lg px-4 py-2 text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="mt-1 w-full border rounded-lg px-4 py-2 text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Rate per Night</label>
                  <input
                    type="number"
                    value={editForm.rate}
                    onChange={(e) => setEditForm({ ...editForm, rate: parseInt(e.target.value) || 700 })}
                    className="mt-1 w-full border rounded-lg px-4 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="mt-1 w-full border rounded-lg px-4 py-2 text-slate-900"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5">
                <button 
                  type="button" 
                  onClick={closeEditModal} 
                  className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  onClick={saveInlineEdit}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

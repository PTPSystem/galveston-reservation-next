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

interface Props {
  initialHolidays: HolidayPeriod[];
}

export default function HolidayCalendarClient({ initialHolidays }: Props) {
  const [holidays, setHolidays] = useState<HolidayPeriod[]>(initialHolidays);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  const calculateNights = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const openAddModal = () => {
    setAddForm({ name: '', startDate: '', endDate: '', rate: 700, notes: '' });
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
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
      }
    } catch (error) {
      console.error('Failed to save edit', error);
      alert('Failed to save changes');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      }
    } catch (error) {
      console.error('Failed to add holiday period', error);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border">
          <div className="text-sm text-slate-700">Total Periods</div>
          <div className="text-3xl font-semibold mt-1 text-slate-900">{holidays.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border">
          <div className="text-sm text-slate-700">Total Holiday Nights</div>
          <div className="text-3xl font-semibold mt-1 text-orange-600">{totalNights}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Defined Periods</h2>
          <div className="flex gap-2">
            <button
              onClick={removeDuplicates}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              <i className="fa-solid fa-broom"></i>
              Remove Duplicates
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
            >
              <i className="fa-solid fa-plus"></i>
              Add Period
            </button>
          </div>
        </div>

        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-slate-900 font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-slate-900 font-semibold">Start</th>
              <th className="px-6 py-3 text-left text-slate-900 font-semibold">End</th>
              <th className="px-6 py-3 text-center text-slate-900 font-semibold">Nights</th>
              <th className="px-6 py-3 text-center text-slate-900 font-semibold">Rate</th>
              <th className="px-6 py-3 text-left text-slate-900 font-semibold">Notes</th>
              <th className="px-6 py-3 text-right text-slate-900 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {holidays.map((holiday) => {
              const nights = calculateNights(holiday.startDate, holiday.endDate);
              const isEditing = holiday.id === editingId;

              if (isEditing) {
                // Inline editing row
                return (
                  <tr key={holiday.id} className="bg-emerald-50">
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full max-w-[220px] border rounded px-2 py-1 text-sm text-slate-900 bg-white placeholder:text-slate-500"
                        placeholder="Name"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="date"
                        value={editForm.startDate}
                        onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                        className="w-full max-w-[130px] border rounded px-2 py-1 text-sm text-slate-900 bg-white"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="date"
                        value={editForm.endDate}
                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                        className="w-full max-w-[130px] border rounded px-2 py-1 text-sm text-slate-900 bg-white"
                      />
                    </td>
                    <td className="px-6 py-3 text-center font-medium ">{nights}</td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={editForm.rate}
                        onChange={(e) => setEditForm({ ...editForm, rate: parseInt(e.target.value) || 700 })}
                        className="w-20 border rounded px-2 py-1 text-sm text-center text-slate-900 bg-white"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full max-w-[180px] border rounded px-2 py-1 text-sm text-slate-900 bg-white placeholder:text-slate-500"
                        placeholder="Notes"
                      />
                    </td>
                    <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
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
                  <td className="px-6 py-4 font-medium text-slate-900">{holiday.name}</td>
                  <td className="px-6 py-4 text-slate-800">
                    {new Date(holiday.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-slate-800">
                    {new Date(holiday.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-slate-900">{nights}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold">
                      ${holiday.rate}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-700 max-w-xs truncate">
                    {holiday.notes || '—'}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
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

      {/* Add Modal (only for adding new periods) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeAddModal}>
          <div className="bg-white w-full max-w-lg mx-4 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Add Holiday / Peak Period</h3>

              <form onSubmit={handleAddSubmit} className="space-y-4">
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

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeAddModal} className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"
                  >
                    Add Period
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

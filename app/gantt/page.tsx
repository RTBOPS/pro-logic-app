'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, setDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { deptColor } from '@/lib/departments';
import Modal from '@/components/Modal';

interface GanttRow {
  id: string;
  label: string;
  type: 'production' | 'crew' | 'scene' | 'location';
  start: string; // YYYY-MM-DD
  end: string;
  color: string;
  notes?: string;
}

const TYPE_COLORS = {
  production: '#1d4ed8',
  crew: '#0d9488',
  scene: '#7c3aed',
  location: '#d97706',
};

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function GanttPage() {
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const { data: locations } = useData('locations');

  /* Rows live in Firestore (users/{ns}/gantt_rows) via the same live hook as
   * every other page — they used to sit in useState and vanished on reload. */
  const namespace = useNamespace();
  const ns = () => namespace ?? auth.currentUser?.uid ?? '';
  const rowsCol = () => collection(db, `users/${ns()}/gantt_rows`);
  const { data: rowsRaw } = useData('gantt_rows');
  const rows = rowsRaw as GanttRow[];
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ label: '', type: 'production' as GanttRow['type'], start: '', end: '', notes: '' });
  const [viewStart, setViewStart] = useState(() => new Date().toISOString().split('T')[0]);
  const VIEW_DAYS = 28;

  const viewEnd = addDays(viewStart, VIEW_DAYS - 1);
  const viewDates = dateRange(viewStart, viewEnd);

  const weekLabels = useMemo(() => {
    const weeks: { date: string; label: string }[] = [];
    viewDates.forEach(d => {
      const day = new Date(d + 'T12:00:00');
      if (day.getDay() === 1 || d === viewStart) {
        weeks.push({ date: d, label: `${day.toLocaleDateString('en', { month: 'short', day: 'numeric' })}` });
      }
    });
    return weeks;
  }, [viewDates]);

  const addRow = async () => {
    if (!form.label || !form.start || !form.end || !ns()) return;
    await addDoc(rowsCol(), { ...form, color: TYPE_COLORS[form.type] });
    setModal(false);
    setForm({ label: '', type: 'production', start: '', end: '', notes: '' });
  };

  const removeRow = (id: string) => { if (ns()) deleteDoc(doc(db, `users/${ns()}/gantt_rows/${id}`)); };

  const addFromProduction = () => {
    const today = new Date().toISOString().split('T')[0];
    const end = addDays(today, 14);
    if (!ns()) return;
    // deterministic doc ids keep re-imports idempotent (merge, never duplicate)
    productions.forEach((p: any) => setDoc(doc(db, `users/${ns()}/gantt_rows/prod_${p.id}`), {
      label: `${p.name} (${p.client})`, type: 'production',
      start: today, end, color: TYPE_COLORS.production,
    }, { merge: true }));
  };

  const addFromCrew = () => {
    const today = new Date().toISOString().split('T')[0];
    const end = addDays(today, 7);
    if (!ns()) return;
    crew.forEach((c: any) => setDoc(doc(db, `users/${ns()}/gantt_rows/crew_${c.id}`), {
      label: `${c.name} ${c.last_name} — ${c.role || c.department || ''}`, type: 'crew',
      start: today, end, color: deptColor(c.department || 'other'),
    }, { merge: true }));
  };

  const getBarStyle = (row: GanttRow) => {
    const start = viewDates.indexOf(row.start);
    const end = viewDates.indexOf(row.end);
    if (start === -1 && end === -1) return null;
    const s = Math.max(0, start === -1 ? 0 : start);
    const e = Math.min(VIEW_DAYS - 1, end === -1 ? VIEW_DAYS - 1 : end);
    if (s > e) return null;
    const cellW = 100 / VIEW_DAYS;
    return {
      left: `${s * cellW}%`,
      width: `${(e - s + 1) * cellW}%`,
      backgroundColor: row.color + 'cc',
      borderLeft: `3px solid ${row.color}`,
    };
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gantt Chart</h1>
          <p className="text-gray-500 text-sm mt-1">Production timeline</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addFromProduction} className="text-sm border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600">+ From Productions</button>
          <button onClick={addFromCrew} className="text-sm border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-600">+ From Crew</button>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800">
            <Plus size={15} /> Add Row
          </button>
        </div>
      </div>

      {/* Timeline navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
          <button onClick={() => setViewStart(d => addDays(d, -7))} className="p-1.5 hover:bg-gray-200 rounded"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium text-gray-700 flex-1 text-center">
            {formatDate(viewStart)} — {formatDate(viewEnd)}
          </span>
          <button onClick={() => setViewStart(d => addDays(d, 7))} className="p-1.5 hover:bg-gray-200 rounded"><ChevronRight size={16} /></button>
          <button onClick={() => setViewStart(new Date().toISOString().split('T')[0])} className="text-xs text-blue-600 hover:underline ml-2">Today</button>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center text-gray-600 text-sm">
            No rows yet. Click "+ From Productions" or "+ Add Row" to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 800 }}>
              {/* Date header */}
              <div className="flex border-b">
                <div className="w-52 shrink-0 px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-r">Task / Resource</div>
                <div className="flex-1 relative h-8">
                  <div className="flex h-full">
                    {viewDates.map(d => {
                      const day = new Date(d + 'T12:00:00');
                      const isToday = d === new Date().toISOString().split('T')[0];
                      const isMonday = day.getDay() === 1;
                      return (
                        <div
                          key={d}
                          className={`flex-1 border-r border-gray-100 flex items-center justify-center ${isToday ? 'bg-blue-50' : ''}`}
                          title={d}
                        >
                          {isMonday && (
                            <span className="text-xs text-gray-600 whitespace-nowrap px-1">
                              {day.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rows */}
              {rows.map(row => {
                const barStyle = getBarStyle(row);
                return (
                  <div key={row.id} className="flex border-b hover:bg-gray-50 group">
                    <div className="w-52 shrink-0 px-4 py-3 flex items-center gap-2 border-r">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{row.label}</div>
                        <div className="text-xs text-gray-600 capitalize">{row.type}</div>
                      </div>
                      <button onClick={() => removeRow(row.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex-1 relative py-3 px-1">
                      {barStyle ? (
                        <div
                          className="absolute inset-y-2 rounded-md flex items-center px-2"
                          style={barStyle}
                          title={`${row.start} → ${row.end}`}
                        >
                          <span className="text-xs text-white font-medium truncate">{row.label}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-300 px-2 py-1">outside view</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Add Gantt Row" onClose={() => setModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Task name…" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
                {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={addRow} disabled={!form.label || !form.start || !form.end}
                className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40">Add row</button>
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

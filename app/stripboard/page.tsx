'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Film } from 'lucide-react';
import { useNamespace } from '@/hooks/useNamespace';

const INT_EXT = ['INT.', 'EXT.', 'INT./EXT.'];
const DAY_NIGHT = ['DAY', 'NIGHT', 'DAWN', 'DUSK'];
const STRIP_COLORS: Record<string, string> = {
  action: 'bg-blue-500',
  dialogue: 'bg-yellow-400',
  vfx: 'bg-purple-500',
  music: 'bg-pink-500',
  location: 'bg-green-500',
  other: 'bg-gray-400',
};

const empty = {
  scene_number: '', title: '', int_ext: 'INT.', day_night: 'DAY',
  location: '', set_name: '', pages: '', estimated_hours: '',
  cast_ids: '', description: '', shoot_day: '', production_id: '',
  category: 'action', notes: '', status: 'Not Filmed',
};

export default function StripboardPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: scenes, loading } = useData('stripboard');
  const { data: productions } = useData('productions');
  const { data: locations } = useData('locations');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterProduction, setFilterProduction] = useState('');

  const filtered = useMemo(() =>
    scenes.filter((s: any) => !filterProduction || s.production_id === filterProduction)
      .sort((a: any, b: any) => Number(a.scene_number) - Number(b.scene_number)),
    [scenes, filterProduction]);

  const byDay = useMemo(() => {
    const days: Record<string, any[]> = {};
    filtered.forEach((s: any) => {
      const d = s.shoot_day || 'Unscheduled';
      if (!days[d]) days[d] = [];
      days[d].push(s);
    });
    return Object.entries(days).sort(([a], [b]) => {
      if (a === 'Unscheduled') return 1;
      if (b === 'Unscheduled') return -1;
      return Number(a) - Number(b);
    });
  }, [filtered]);

  const open = (s?: any) => {
    if (s) { setForm(Object.fromEntries(Object.keys(empty).map(k => [k, s[k] ?? ''])) as typeof empty); setEditId(s.id); }
    else { setForm(empty); setEditId(null); }
    setModal(true);
  };

  const save = async () => {
    if (!form.scene_number) return;
    if (editId) await updateDoc(doc(db, 'users', namespace!, 'stripboard', editId), form);
    else await addDoc(collection(db, 'users', namespace!, 'stripboard'), form);
    setModal(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Remove scene?')) return;
    await deleteDoc(doc(db, 'users', namespace!, 'stripboard', id));
  };

  const fld = (label: string, k: keyof typeof empty, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const sel = (label: string, k: keyof typeof empty, opts: string[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const totalPages = filtered.reduce((sum: number, s: any) => sum + (parseFloat(s.pages) || 0), 0);
  const totalHours = filtered.reduce((sum: number, s: any) => sum + (parseFloat(s.estimated_hours) || 0), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Film size={22} /> Stripboard</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} scenes · {totalPages.toFixed(1)} pages · {totalHours.toFixed(1)} hrs</p>
        </div>
        <div className="flex gap-2">
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600"
            value={filterProduction} onChange={e => setFilterProduction(e.target.value)}>
            <option value="">All productions</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => open()}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800">
            <Plus size={15} /> Add Scene
          </button>
        </div>
      </div>

      {loading ? <div className="text-gray-600 text-sm">Loading…</div>
        : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
            No scenes yet. Add your first scene to start building the stripboard.
          </div>
        ) : (
          <div className="space-y-6">
            {byDay.map(([day, dayScenes]) => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-zinc-800 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {day === 'Unscheduled' ? 'Unscheduled' : `Shoot Day ${day}`}
                  </div>
                  <span className="text-xs text-gray-600">{dayScenes.length} scenes · {dayScenes.reduce((s: number, x: any) => s + (parseFloat(x.pages) || 0), 0).toFixed(1)} pages</span>
                </div>
                <div className="space-y-1.5">
                  {dayScenes.map((s: any) => (
                    <div key={s.id} className="flex items-stretch gap-0 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 group">
                      {/* Color strip */}
                      <div className={`w-2 shrink-0 ${STRIP_COLORS[s.category] || 'bg-gray-300'}`} />
                      {/* Scene # */}
                      <div className="w-12 shrink-0 flex items-center justify-center border-r border-gray-100 bg-gray-50">
                        <span className="font-bold text-gray-800 text-sm">{s.scene_number}</span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 px-3 py-2.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500">{s.int_ext}</span>
                          <span className="font-semibold text-gray-900 text-sm">{s.set_name || s.title || '—'}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.day_night}</span>
                          {s.status === 'Filmed' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">✓ Filmed</span>}
                        </div>
                        {s.description && <p className="text-xs text-gray-600 mt-0.5 truncate">{s.description}</p>}
                        {s.cast_ids && <p className="text-xs text-blue-500 mt-0.5">Cast: {s.cast_ids}</p>}
                      </div>
                      {/* Pages + hours */}
                      <div className="shrink-0 px-3 flex flex-col items-end justify-center border-l border-gray-100 text-right">
                        {s.pages && <span className="text-xs font-semibold text-gray-700">{s.pages} pg</span>}
                        {s.estimated_hours && <span className="text-xs text-gray-600">{s.estimated_hours}h</span>}
                      </div>
                      {/* Actions */}
                      <div className="shrink-0 flex items-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => open(s)} className="p-1.5 text-gray-600 hover:text-gray-700"><Pencil size={13} /></button>
                        <button onClick={() => remove(s.id)} className="p-1.5 text-gray-600 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && (
        <Modal title={editId ? 'Edit Scene' : 'Add Scene'} onClose={() => setModal(false)}>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              {fld('Scene #*', 'scene_number', '1')}
              {fld('Shoot Day', 'shoot_day', '1', 'number')}
              {fld('Pages', 'pages', '2/8')}
            </div>
            {fld('Scene Title', 'title', 'Opening sequence')}
            {fld('Set Name', 'set_name', 'INT. AURORA BRIDGE')}
            <div className="grid grid-cols-3 gap-3">
              {sel('INT/EXT', 'int_ext', INT_EXT)}
              {sel('Day/Night', 'day_night', DAY_NIGHT)}
              {fld('Est. Hours', 'estimated_hours', '2.5', 'number')}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Production</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.production_id} onChange={e => setForm(f => ({ ...f, production_id: e.target.value }))}>
                <option value="">— None —</option>
                {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                <option value="">— None —</option>
                {locations.map((l: any) => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            {fld('Cast (comma separated)', 'cast_ids', '1, 3, 5, 6')}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sel('Category', 'category', Object.keys(STRIP_COLORS))}
              {sel('Status', 'status', ['Not Filmed', 'Filming', 'Filmed', 'Omitted'])}
            </div>
            {fld('Notes', 'notes', 'Special equipment, weather concerns…')}
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={save} disabled={!form.scene_number}
              className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              {editId ? 'Save' : 'Add Scene'}
            </button>
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

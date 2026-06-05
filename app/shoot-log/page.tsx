'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Plus, Trash2, CheckCircle, Circle, Printer, Loader2 } from 'lucide-react';
import { useNamespace } from '@/hooks/useNamespace';

interface TakeEntry {
  id: string;
  scene: string;
  shot: string;
  take: number;
  description: string;
  lens: string;
  aperture: string;
  iso: string;
  shutter: string;
  fps: string;
  sound_roll: string;
  selected: boolean;
  notes: string;
  timestamp: string;
}

const empty: Omit<TakeEntry, 'id' | 'timestamp'> = {
  scene: '', shot: '', take: 1, description: '',
  lens: '', aperture: '', iso: '', shutter: '', fps: '24',
  sound_roll: '', selected: false, notes: '',
};

export default function ShootLogPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [takes, setTakes] = useState<TakeEntry[]>([]);
  const [form, setForm] = useState(empty);
  const [sceneFilter, setSceneFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedProduction || !namespace) return;
    const q = collection(db, 'users', getUid()!, 'productions', selectedProduction, 'takes');
    return onSnapshot(q, snap => {
      setTakes(snap.docs.map(d => ({ id: d.id, ...d.data() } as TakeEntry))
        .sort((a, b) => a.scene.localeCompare(b.scene) || a.shot.localeCompare(b.shot) || a.take - b.take));
    });
  }, [selectedProduction, namespace]);

  const addTake = async () => {
    const uid = getUid();
    if (!selectedProduction || !form.scene || !uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'productions', selectedProduction, 'takes'), {
        ...form,
        timestamp: new Date().toISOString(),
      });
      const sameTakes = takes.filter(t => t.scene === form.scene && t.shot === form.shot);
      setForm(f => ({ ...f, take: sameTakes.length + 2 }));
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = async (t: TakeEntry) => {
    const uid = getUid();
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'productions', selectedProduction, 'takes', t.id), { selected: !t.selected });
  };

  const removeTake = async (id: string) => {
    const uid = getUid();
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'productions', selectedProduction, 'takes', id));
  };

  const scenes = [...new Set(takes.map(t => t.scene))].sort();
  const filtered = sceneFilter ? takes.filter(t => t.scene === sceneFilter) : takes;

  return (
    <div className="p-4 md:p-8">
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <img src="/logo.png" alt="PRO-LOGIC" className="h-8 object-contain animate-pulse" />
            <Loader2 size={20} className="animate-spin text-gray-700" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shoot Log</h1>
          <p className="text-gray-500 text-sm mt-1">Scene & take journal</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700"
            value={selectedProduction}
            onChange={e => { setSelectedProduction(e.target.value); setForm(empty); }}
          >
            <option value="">Select production…</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProduction && (
            <button onClick={() => window.print()} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
              <Printer size={14} /> Print
            </button>
          )}
        </div>
      </div>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
          Select a production to start logging takes.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Add take form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">Log New Take</h2>
            <div className="grid grid-cols-6 gap-3">
              {[
                ['Scene', 'scene', '1', 'text'],
                ['Shot', 'shot', 'A', 'text'],
                ['Take #', 'take', '1', 'number'],
                ['Lens', 'lens', '50mm', 'text'],
                ['FPS', 'fps', '24', 'text'],
                ['Aperture', 'aperture', 'T2.8', 'text'],
                ['ISO', 'iso', '800', 'text'],
                ['Shutter', 'shutter', '1/50', 'text'],
                ['Sound Roll', 'sound_roll', 'SR-01', 'text'],
              ].map(([label, key, placeholder, type]) => (
                <div key={key as string}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type={type as string}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                    value={(form as any)[key as string]}
                    onChange={e => setForm({ ...form, [key as string]: type === 'number' ? parseInt(e.target.value) || 1 : e.target.value })}
                    placeholder={placeholder as string}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What happens in this shot…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="NG, focus, exposure…"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addTake}
                  disabled={!form.scene || saving}
                  className="w-full flex items-center justify-center gap-1.5 bg-black text-white py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-800"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Saving…' : 'Log'}
                </button>
              </div>
            </div>
          </div>

          {/* Filter */}
          {scenes.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSceneFilter('')}
                className={`text-xs px-3 py-1.5 rounded-full border ${!sceneFilter ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                All ({takes.length})
              </button>
              {scenes.map(s => (
                <button
                  key={s}
                  onClick={() => setSceneFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${sceneFilter === s ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Scene {s} ({takes.filter(t => t.scene === s).length})
                </button>
              ))}
            </div>
          )}

          {/* Takes table */}
          {filtered.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-xs" id="shoot-log-print">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="w-8 px-3 py-2">✓</th>
                    <th className="text-left px-3 py-2">Scene</th>
                    <th className="text-left px-3 py-2">Shot</th>
                    <th className="text-left px-3 py-2">Take</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-left px-3 py-2">Lens</th>
                    <th className="text-left px-3 py-2">FPS</th>
                    <th className="text-left px-3 py-2">Aperture</th>
                    <th className="text-left px-3 py-2">ISO</th>
                    <th className="text-left px-3 py-2">Shutter</th>
                    <th className="text-left px-3 py-2">Sound</th>
                    <th className="text-left px-3 py-2">Notes</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(t => (
                    <tr key={t.id} className={`hover:bg-gray-50 ${t.selected ? 'bg-green-50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleSelected(t)} className="text-gray-600">
                          {t.selected
                            ? <CheckCircle size={14} className="text-green-500" />
                            : <Circle size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{t.scene}</td>
                      <td className="px-3 py-2 text-gray-600">{t.shot}</td>
                      <td className="px-3 py-2 font-semibold">{t.take}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{t.description}</td>
                      <td className="px-3 py-2 text-gray-500">{t.lens}</td>
                      <td className="px-3 py-2 text-gray-500">{t.fps}</td>
                      <td className="px-3 py-2 text-gray-500">{t.aperture}</td>
                      <td className="px-3 py-2 text-gray-500">{t.iso}</td>
                      <td className="px-3 py-2 text-gray-500">{t.shutter}</td>
                      <td className="px-3 py-2 text-gray-500">{t.sound_roll}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate">{t.notes}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeTake(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

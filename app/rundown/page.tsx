'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import PageHeader from '@/components/PageHeader';
import { UpgradeGate } from '@/components/UpgradeGate';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Printer, Loader2, Clock,
} from 'lucide-react';

/* Run of Show / rundown — the master timing document of a live show or
   broadcast: every segment and cue, its duration, computed clock time and
   what each department does at that moment. */

type ItemType = 'segment' | 'cue' | 'break';

interface RundownItem {
  id: string;
  type: ItemType;
  title: string;
  dur: string;      // "mm:ss" or minutes
  audio: string;    // audio cue
  video: string;    // video / LED cue
  lx: string;       // lighting cue
  sfx: string;      // SFX / pyro cue
  notes: string;
}

interface Rundown {
  showStart: string;      // "20:00"
  items: RundownItem[];
  notes: string;
}

const EMPTY: Rundown = { showStart: '20:00', items: [], notes: '' };

const TYPE_STYLE: Record<ItemType, string> = {
  segment: 'bg-white',
  cue: 'bg-blue-50/50',
  break: 'bg-yellow-50',
};
const TYPE_BADGE: Record<ItemType, string> = {
  segment: 'bg-gray-200 text-gray-700',
  cue: 'bg-blue-100 text-blue-700',
  break: 'bg-yellow-100 text-yellow-700',
};

const uid8 = () => Math.random().toString(36).slice(2, 10);

/* "3:30" → 210 s; "3" → 180 s */
export function parseDur(v: string): number {
  if (!v) return 0;
  const parts = v.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 1) return parts[0] * 60;
  return parts[0] * 60 + parts[1];
}
function fmtClock(startHHMM: string, offsetSec: number): string {
  const [h, m] = startHHMM.split(':').map(n => parseInt(n, 10) || 0);
  const total = ((h * 3600 + m * 60 + offsetSec) % 86400 + 86400) % 86400;
  const hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${ss ? ':' + String(ss).padStart(2, '0') : ''}`;
}
function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function RundownInner() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [rundown, setRundown] = useState<Rundown>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [printing, setPrinting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (!selectedProduction || !getUid()) { setRundown(EMPTY); setLoaded(false); return; }
    skipNextSave.current = true;
    setLoaded(false);
    const ref = doc(db, 'users', getUid()!, 'productions', selectedProduction, 'rundown', 'main');
    return onSnapshot(ref, snap => {
      skipNextSave.current = true;
      setRundown(snap.exists() ? { ...EMPTY, ...(snap.data() as Rundown) } : EMPTY);
      setLoaded(true);
    });
  }, [selectedProduction, namespace]);

  useEffect(() => {
    if (!loaded || !selectedProduction || !getUid()) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaving('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(db, 'users', getUid()!, 'productions', selectedProduction, 'rundown', 'main'),
          { ...rundown, updated_at: new Date().toISOString() }
        );
        setSaving('saved');
        setTimeout(() => setSaving('idle'), 1500);
      } catch { setSaving('idle'); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [rundown]);

  const addItem = (type: ItemType) =>
    setRundown(r => ({
      ...r,
      items: [...r.items, {
        id: uid8(), type,
        title: type === 'break' ? 'Break / Commercial' : '',
        dur: type === 'cue' ? '0:00' : '3:00',
        audio: '', video: '', lx: '', sfx: '', notes: '',
      }],
    }));
  const update = (id: string, patch: Partial<RundownItem>) =>
    setRundown(r => ({ ...r, items: r.items.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const remove = (id: string) =>
    setRundown(r => ({ ...r, items: r.items.filter(i => i.id !== id) }));
  const move = (idx: number, dir: -1 | 1) =>
    setRundown(r => {
      const items = [...r.items];
      const j = idx + dir;
      if (j < 0 || j >= items.length) return r;
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...r, items };
    });

  /* Computed clock time for each row + total runtime */
  const { offsets, totalSec } = useMemo(() => {
    let acc = 0;
    const offsets = rundown.items.map(i => { const o = acc; acc += parseDur(i.dur); return o; });
    return { offsets, totalSec: acc };
  }, [rundown.items]);

  const exportPDF = async () => {
    if (!selectedProduction || !getUid()) return;
    setPrinting(true);
    try {
      const prodSnap = await getDoc(doc(db, 'users', getUid()!, 'productions', selectedProduction));
      const compSnap = await getDoc(doc(db, 'users', getUid()!, 'company', 'profile'));
      const { generateRundownPDF } = await import('@/lib/pdf/rundown');
      generateRundownPDF(
        { id: prodSnap.id, ...prodSnap.data() },
        compSnap.exists() ? compSnap.data() : null,
        rundown,
        rundown.items.map((i, idx) => fmtClock(rundown.showStart, offsets[idx])),
        fmtDur(totalSec),
      );
    } catch (e: any) { alert('PDF failed: ' + e.message); }
    finally { setPrinting(false); }
  };

  const cell = 'w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1.5 py-1 text-xs text-gray-800';

  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Run of Show" subtitle="Master timing: segments, cues per department and computed clock times">
        {saving !== 'idle' && (
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            {saving === 'saving' ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : '✓ Saved'}
          </span>
        )}
        <button onClick={exportPDF} disabled={!selectedProduction || rundown.items.length === 0 || printing}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800 disabled:opacity-40">
          {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Export PDF
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="max-w-sm flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Production / Show</label>
          <select value={selectedProduction} onChange={e => setSelectedProduction(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
            <option value="">Select a production…</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {selectedProduction && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Show start</label>
              <input type="time" value={rundown.showStart}
                onChange={e => setRundown(r => ({ ...r, showStart: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none" />
            </div>
            <div className="bg-gray-900 text-white rounded-xl px-4 py-2 text-sm flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              Total runtime: <span className="font-bold">{fmtDur(totalSec)}</span>
              <span className="text-gray-400">· off air {fmtClock(rundown.showStart, totalSec)}</span>
            </div>
          </>
        )}
      </div>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-500 text-sm">
          Select a production. A run of show is the show-caller&apos;s bible: every segment and
          cue in order, with duration, computed clock time, and what audio, video, lighting
          and SFX do at each moment — for a concert, a broadcast or a corporate event.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 bg-gray-50">
            <button onClick={() => addItem('segment')} className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-800">
              <Plus size={13} /> Segment
            </button>
            <button onClick={() => addItem('cue')} className="flex items-center gap-1.5 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs hover:bg-blue-50">
              <Plus size={13} /> Cue
            </button>
            <button onClick={() => addItem('break')} className="flex items-center gap-1.5 border border-yellow-300 text-yellow-700 px-3 py-1.5 rounded-lg text-xs hover:bg-yellow-50">
              <Plus size={13} /> Break
            </button>
            <span className="ml-auto text-xs text-gray-400">Durations as mm:ss — clock times compute automatically</span>
          </div>
          {rundown.items.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              Empty rundown. Add segments (songs, news blocks, speeches), cues (pyro hit,
              video roll-in, lighting look) and breaks.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1000px]">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="px-2 py-2 text-left w-8">#</th>
                    <th className="px-2 py-2 text-left w-16">Time</th>
                    <th className="px-2 py-2 text-left w-14">Dur</th>
                    <th className="px-2 py-2 text-left w-16">Type</th>
                    <th className="px-2 py-2 text-left">Segment / Cue</th>
                    <th className="px-2 py-2 text-left">Audio</th>
                    <th className="px-2 py-2 text-left">Video / LED</th>
                    <th className="px-2 py-2 text-left">Lighting</th>
                    <th className="px-2 py-2 text-left">SFX / Pyro</th>
                    <th className="px-2 py-2 text-left">Notes</th>
                    <th className="px-2 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rundown.items.map((item, i) => (
                    <tr key={item.id} className={`group ${TYPE_STYLE[item.type]} hover:bg-gray-50`}>
                      <td className="px-2 py-1 font-bold text-gray-500">{i + 1}</td>
                      <td className="px-2 py-1 font-mono font-bold text-gray-800">{fmtClock(rundown.showStart, offsets[i])}</td>
                      <td className="px-1 py-1"><input className={`${cell} font-mono`} value={item.dur} onChange={e => update(item.id, { dur: e.target.value })} placeholder="3:00" /></td>
                      <td className="px-2 py-1">
                        <select value={item.type} onChange={e => update(item.id, { type: e.target.value as ItemType })}
                          className={`text-xs rounded-full px-2 py-0.5 font-medium border-0 ${TYPE_BADGE[item.type]}`}>
                          <option value="segment">SEG</option><option value="cue">CUE</option><option value="break">BRK</option>
                        </select>
                      </td>
                      <td className="px-1 py-1"><input className={`${cell} font-medium`} value={item.title} onChange={e => update(item.id, { title: e.target.value })} placeholder="Song / block / cue name" /></td>
                      <td className="px-1 py-1"><input className={cell} value={item.audio} onChange={e => update(item.id, { audio: e.target.value })} placeholder="—" /></td>
                      <td className="px-1 py-1"><input className={cell} value={item.video} onChange={e => update(item.id, { video: e.target.value })} placeholder="—" /></td>
                      <td className="px-1 py-1"><input className={cell} value={item.lx} onChange={e => update(item.id, { lx: e.target.value })} placeholder="—" /></td>
                      <td className="px-1 py-1"><input className={cell} value={item.sfx} onChange={e => update(item.id, { sfx: e.target.value })} placeholder="—" /></td>
                      <td className="px-1 py-1"><input className={cell} value={item.notes} onChange={e => update(item.id, { notes: e.target.value })} /></td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => move(i, -1)} className="text-gray-400 hover:text-gray-700"><ChevronUp size={13} /></button>
                          <button onClick={() => move(i, 1)} className="text-gray-400 hover:text-gray-700"><ChevronDown size={13} /></button>
                          <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rundown.items.length > 0 && (
            <div className="px-5 py-3 border-t bg-gray-50">
              <input value={rundown.notes} onChange={e => setRundown(r => ({ ...r, notes: e.target.value }))}
                placeholder="General notes: showcaller position, comms channel for cues, curfew time…"
                className="w-full bg-transparent text-xs text-gray-600 focus:outline-none" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RundownPage() {
  return (
    <UpgradeGate feature="Run of Show" requires="producer">
      <RundownInner />
    </UpgradeGate>
  );
}

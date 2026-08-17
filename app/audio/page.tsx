'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { UpgradeGate } from '@/components/UpgradeGate';
import {
  Mic, Radio, Headphones, Zap, Plus, Trash2, Printer,
  ChevronUp, ChevronDown, FileText, Loader2, Search,
} from 'lucide-react';
import {
  INSTRUMENT_TEMPLATES, AUDIO_CATEGORIES, parseRider, consoleRecommendation,
  type InstrumentTemplate, type InputType,
} from '@/lib/audio-catalog';

/* ── Types stored in Firestore ── */
interface Channel {
  id: string;
  source: string;
  mic: string;
  type: InputType;
  phantom: boolean;
  stand: string;
  gain: string;
  hpf: string;
  notes: string;
}
interface WirelessRow {
  id: string;
  use: string;       // Lead Vox, IEM 1, Headset MC…
  kind: 'mic' | 'iem';
  model: string;
  band: string;      // e.g. G50 470–534 MHz
  freq: string;      // MHz
  notes: string;
}
interface MonitorMix {
  id: string;
  name: string;      // Mix 1 — Lead Vox
  type: 'wedge' | 'iem' | 'sidefill' | 'drumfill';
  members: string;   // who listens to it
  notes: string;     // what they need in the mix
}

interface AudioPlan {
  channels: Channel[];
  wireless: WirelessRow[];
  monitors: MonitorMix[];
  notes: string;
}

const EMPTY_PLAN: AudioPlan = { channels: [], wireless: [], monitors: [], notes: '' };

const TYPE_BADGE: Record<InputType, string> = {
  mic: 'bg-blue-100 text-blue-700',
  di: 'bg-green-100 text-green-700',
  line: 'bg-gray-200 text-gray-700',
  wireless: 'bg-purple-100 text-purple-700',
};

const uid8 = () => Math.random().toString(36).slice(2, 10);

function AudioPlannerInner() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');

  const [selectedProduction, setSelectedProduction] = useState('');
  const [plan, setPlan] = useState<AudioPlan>(EMPTY_PLAN);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tab, setTab] = useState<'inputs' | 'wireless' | 'monitors' | 'summary'>('inputs');
  const [showCatalog, setShowCatalog] = useState(false);
  const [showRider, setShowRider] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [riderText, setRiderText] = useState('');
  const [riderMatches, setRiderMatches] = useState<{ template: InstrumentTemplate; qty: number }[] | null>(null);
  const [printing, setPrinting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  /* ── Load plan for selected production ── */
  useEffect(() => {
    if (!selectedProduction || !getUid()) { setPlan(EMPTY_PLAN); setLoaded(false); return; }
    skipNextSave.current = true;
    setLoaded(false);
    const ref = doc(db, 'users', getUid()!, 'productions', selectedProduction, 'audio', 'plan');
    return onSnapshot(ref, snap => {
      skipNextSave.current = true;
      setPlan(snap.exists() ? { ...EMPTY_PLAN, ...(snap.data() as AudioPlan) } : EMPTY_PLAN);
      setLoaded(true);
    });
  }, [selectedProduction, namespace]);

  /* ── Debounced autosave ── */
  useEffect(() => {
    if (!loaded || !selectedProduction || !getUid()) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaving('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(db, 'users', getUid()!, 'productions', selectedProduction, 'audio', 'plan'),
          { ...plan, updated_at: new Date().toISOString() }
        );
        setSaving('saved');
        setTimeout(() => setSaving('idle'), 1500);
      } catch { setSaving('idle'); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [plan]);

  /* ── Channel helpers ── */
  const addTemplate = (template: InstrumentTemplate, qty = 1) => {
    const rows: Channel[] = [];
    for (let n = 0; n < qty; n++) {
      const suffix = qty > 1 ? ` ${n + 1}` : '';
      for (const inp of template.inputs) {
        rows.push({
          id: uid8(),
          source: inp.source + (template.inputs.length === 1 ? suffix : (qty > 1 ? ` (${template.label}${suffix})` : '')),
          mic: inp.mic, type: inp.type, phantom: inp.phantom,
          stand: inp.stand, gain: inp.gain, hpf: inp.hpf, notes: inp.notes || '',
        });
        // Wireless inputs also land on the RF worksheet
        if (inp.type === 'wireless') {
          setPlan(p => ({
            ...p,
            wireless: [...p.wireless, {
              id: uid8(), use: inp.source + suffix, kind: 'mic',
              model: inp.mic, band: '', freq: '', notes: '',
            }],
          }));
        }
      }
    }
    setPlan(p => ({ ...p, channels: [...p.channels, ...rows] }));
  };

  const updateChannel = (id: string, patch: Partial<Channel>) =>
    setPlan(p => ({ ...p, channels: p.channels.map(c => c.id === id ? { ...c, ...patch } : c) }));
  const removeChannel = (id: string) =>
    setPlan(p => ({ ...p, channels: p.channels.filter(c => c.id !== id) }));
  const moveChannel = (idx: number, dir: -1 | 1) =>
    setPlan(p => {
      const ch = [...p.channels];
      const j = idx + dir;
      if (j < 0 || j >= ch.length) return p;
      [ch[idx], ch[j]] = [ch[j], ch[idx]];
      return { ...p, channels: ch };
    });
  const addBlankChannel = () =>
    setPlan(p => ({ ...p, channels: [...p.channels, { id: uid8(), source: '', mic: '', type: 'mic', phantom: false, stand: '', gain: '', hpf: '', notes: '' }] }));

  /* ── Wireless helpers ── */
  const addWireless = (kind: 'mic' | 'iem') =>
    setPlan(p => ({ ...p, wireless: [...p.wireless, { id: uid8(), use: kind === 'iem' ? `IEM ${p.wireless.filter(w => w.kind === 'iem').length + 1}` : '', kind, model: '', band: '', freq: '', notes: '' }] }));
  const updateWireless = (id: string, patch: Partial<WirelessRow>) =>
    setPlan(p => ({ ...p, wireless: p.wireless.map(w => w.id === id ? { ...w, ...patch } : w) }));
  const removeWireless = (id: string) =>
    setPlan(p => ({ ...p, wireless: p.wireless.filter(w => w.id !== id) }));

  /* RF conflicts: two carriers closer than 0.4 MHz */
  const rfConflicts = useMemo(() => {
    const bad = new Set<string>();
    const rows = plan.wireless.filter(w => parseFloat(w.freq) > 0);
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++)
        if (Math.abs(parseFloat(rows[i].freq) - parseFloat(rows[j].freq)) < 0.4) {
          bad.add(rows[i].id); bad.add(rows[j].id);
        }
    return bad;
  }, [plan.wireless]);

  /* ── Monitor helpers ── */
  const addMonitor = (type: MonitorMix['type']) =>
    setPlan(p => ({ ...p, monitors: [...p.monitors, { id: uid8(), name: `Mix ${p.monitors.length + 1}`, type, members: '', notes: '' }] }));
  const updateMonitor = (id: string, patch: Partial<MonitorMix>) =>
    setPlan(p => ({ ...p, monitors: p.monitors.map(m => m.id === id ? { ...m, ...patch } : m) }));
  const removeMonitor = (id: string) =>
    setPlan(p => ({ ...p, monitors: p.monitors.filter(m => m.id !== id) }));

  /* ── Rider parse ── */
  const runRiderParse = () => setRiderMatches(parseRider(riderText));
  const applyRiderMatches = () => {
    riderMatches?.forEach(({ template, qty }) => addTemplate(template, qty));
    setShowRider(false); setRiderText(''); setRiderMatches(null); setTab('inputs');
  };

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    const ch = plan.channels;
    return {
      total: ch.length,
      phantom: ch.filter(c => c.phantom).length,
      dis: ch.filter(c => c.type === 'di').length,
      mics: ch.filter(c => c.type === 'mic').length,
      lines: ch.filter(c => c.type === 'line').length,
      wireless: plan.wireless.filter(w => w.kind === 'mic').length,
      iems: plan.wireless.filter(w => w.kind === 'iem').length,
      wedges: plan.monitors.filter(m => m.type === 'wedge').length,
      mixes: plan.monitors.length,
      stands: ch.filter(c => /boom|straight/i.test(c.stand)).length,
    };
  }, [plan]);

  /* ── PDF export ── */
  const exportPDF = async () => {
    if (!selectedProduction || !getUid()) return;
    setPrinting(true);
    try {
      const prodSnap = await getDoc(doc(db, 'users', getUid()!, 'productions', selectedProduction));
      const compSnap = await getDoc(doc(db, 'users', getUid()!, 'company', 'profile'));
      const { generateInputListPDF } = await import('@/lib/pdf/input-list');
      generateInputListPDF(
        { id: prodSnap.id, ...prodSnap.data() },
        compSnap.exists() ? compSnap.data() : null,
        plan,
        { console: consoleRecommendation(stats.total), ...stats }
      );
    } catch (e: any) {
      alert('PDF failed: ' + e.message);
    } finally { setPrinting(false); }
  };

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.toLowerCase();
    return INSTRUMENT_TEMPLATES.filter(t =>
      !q || t.label.toLowerCase().includes(q) || t.keywords.some(k => k.includes(q)));
  }, [catalogQuery]);

  const inputCell = 'w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1.5 py-1 text-xs text-gray-800';

  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Audio Planner" subtitle="Input list, gain structure, RF coordination & monitor mixes for live shows">
        {saving !== 'idle' && (
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            {saving === 'saving' ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : '✓ Saved'}
          </span>
        )}
        <button onClick={() => setShowRider(true)} disabled={!selectedProduction}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40">
          <FileText size={15} /> Parse Rider
        </button>
        <button onClick={exportPDF} disabled={!selectedProduction || plan.channels.length === 0 || printing}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800 disabled:opacity-40">
          {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Export PDF
        </button>
      </PageHeader>

      {/* Production selector */}
      <div className="mb-6 max-w-sm">
        <label className="block text-xs font-medium text-gray-600 mb-1">Production / Show</label>
        <select value={selectedProduction} onChange={e => setSelectedProduction(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
          <option value="">Select a production…</option>
          {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-500 text-sm">
          Select a production to start planning its audio. You can add instruments from the
          catalog (with recommended mics and gain structure) or paste the band&apos;s technical rider.
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
            {([
              ['inputs', <><Mic size={13} /> Input List ({plan.channels.length})</>],
              ['wireless', <><Radio size={13} /> Wireless / RF ({plan.wireless.length})</>],
              ['monitors', <><Headphones size={13} /> Monitors ({plan.monitors.length})</>],
              ['summary', <><Zap size={13} /> Summary</>],
            ] as [typeof tab, React.ReactNode][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-colors ${tab === id ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── INPUT LIST ── */}
          {tab === 'inputs' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 bg-gray-50">
                <button onClick={() => setShowCatalog(true)}
                  className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-800">
                  <Plus size={13} /> Add Instrument
                </button>
                <button onClick={addBlankChannel}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs hover:bg-white">
                  <Plus size={13} /> Blank Channel
                </button>
                <span className="ml-auto text-xs text-gray-400">Click any cell to edit</span>
              </div>
              {plan.channels.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  No channels yet. Add instruments from the catalog — each one comes with the
                  standard mics, phantom, stands and gain ranges a live engineer would patch.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-2 py-2 text-left w-10">Ch</th>
                        <th className="px-2 py-2 text-left">Source</th>
                        <th className="px-2 py-2 text-left">Mic / DI</th>
                        <th className="px-2 py-2 text-left w-20">Type</th>
                        <th className="px-2 py-2 text-center w-12">+48V</th>
                        <th className="px-2 py-2 text-left">Stand</th>
                        <th className="px-2 py-2 text-left w-20">Gain</th>
                        <th className="px-2 py-2 text-left w-18">HPF</th>
                        <th className="px-2 py-2 text-left">Notes</th>
                        <th className="px-2 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {plan.channels.map((c, i) => (
                        <tr key={c.id} className="hover:bg-gray-50 group">
                          <td className="px-2 py-1 font-bold text-gray-700">{i + 1}</td>
                          <td className="px-1 py-1"><input className={inputCell} value={c.source} onChange={e => updateChannel(c.id, { source: e.target.value })} placeholder="Source" /></td>
                          <td className="px-1 py-1"><input className={inputCell} value={c.mic} onChange={e => updateChannel(c.id, { mic: e.target.value })} placeholder="Mic / DI" /></td>
                          <td className="px-1 py-1">
                            <select value={c.type} onChange={e => updateChannel(c.id, { type: e.target.value as InputType })}
                              className={`text-xs rounded-full px-2 py-0.5 font-medium border-0 ${TYPE_BADGE[c.type]}`}>
                              <option value="mic">MIC</option><option value="di">DI</option>
                              <option value="line">LINE</option><option value="wireless">RF</option>
                            </select>
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button onClick={() => updateChannel(c.id, { phantom: !c.phantom })}
                              className={`text-xs font-bold px-1.5 py-0.5 rounded ${c.phantom ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                              48V
                            </button>
                          </td>
                          <td className="px-1 py-1"><input className={inputCell} value={c.stand} onChange={e => updateChannel(c.id, { stand: e.target.value })} /></td>
                          <td className="px-1 py-1"><input className={inputCell} value={c.gain} onChange={e => updateChannel(c.id, { gain: e.target.value })} /></td>
                          <td className="px-1 py-1"><input className={inputCell} value={c.hpf} onChange={e => updateChannel(c.id, { hpf: e.target.value })} /></td>
                          <td className="px-1 py-1"><input className={inputCell} value={c.notes} onChange={e => updateChannel(c.id, { notes: e.target.value })} /></td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                              <button onClick={() => moveChannel(i, -1)} className="text-gray-400 hover:text-gray-700"><ChevronUp size={13} /></button>
                              <button onClick={() => moveChannel(i, 1)} className="text-gray-400 hover:text-gray-700"><ChevronDown size={13} /></button>
                              <button onClick={() => removeChannel(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── WIRELESS / RF ── */}
          {tab === 'wireless' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 bg-gray-50">
                <button onClick={() => addWireless('mic')} className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700">
                  <Plus size={13} /> Wireless Mic
                </button>
                <button onClick={() => addWireless('iem')} className="flex items-center gap-1.5 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs hover:bg-purple-50">
                  <Plus size={13} /> IEM Transmitter
                </button>
                <span className="ml-auto text-xs text-gray-400">Keep carriers ≥ 0.4 MHz apart — conflicts turn red</span>
              </div>
              {plan.wireless.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  No RF units yet. Every wireless mic and in-ear transmitter needs its own
                  coordinated frequency so they don&apos;t interfere with each other.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[760px]">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-2 py-2 text-left">Use</th>
                        <th className="px-2 py-2 text-left w-16">Kind</th>
                        <th className="px-2 py-2 text-left">Model</th>
                        <th className="px-2 py-2 text-left">Band</th>
                        <th className="px-2 py-2 text-left w-24">Freq (MHz)</th>
                        <th className="px-2 py-2 text-left">Notes</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {plan.wireless.map((w, i) => (
                        <tr key={w.id} className={`group ${rfConflicts.has(w.id) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-3 py-1 font-bold text-gray-700">{i + 1}</td>
                          <td className="px-1 py-1"><input className={inputCell} value={w.use} onChange={e => updateWireless(w.id, { use: e.target.value })} placeholder="Lead Vox / IEM Drums…" /></td>
                          <td className="px-2 py-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.kind === 'iem' ? 'bg-teal-100 text-teal-700' : 'bg-purple-100 text-purple-700'}`}>
                              {w.kind === 'iem' ? 'IEM' : 'MIC'}
                            </span>
                          </td>
                          <td className="px-1 py-1"><input className={inputCell} value={w.model} onChange={e => updateWireless(w.id, { model: e.target.value })} placeholder="Shure ULXD / PSM900…" /></td>
                          <td className="px-1 py-1"><input className={inputCell} value={w.band} onChange={e => updateWireless(w.id, { band: e.target.value })} placeholder="G50 470–534" /></td>
                          <td className="px-1 py-1">
                            <input className={`${inputCell} ${rfConflicts.has(w.id) ? 'text-red-600 font-bold' : ''}`}
                              value={w.freq} onChange={e => updateWireless(w.id, { freq: e.target.value })} placeholder="512.375" />
                          </td>
                          <td className="px-1 py-1"><input className={inputCell} value={w.notes} onChange={e => updateWireless(w.id, { notes: e.target.value })} /></td>
                          <td className="px-2 py-1">
                            <button onClick={() => removeWireless(w.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rfConflicts.size > 0 && (
                <div className="px-5 py-3 bg-red-50 border-t border-red-100 text-xs text-red-700 font-medium">
                  ⚠ {rfConflicts.size} units have carriers closer than 0.4 MHz — they will interfere. Re-coordinate the highlighted frequencies.
                </div>
              )}
            </div>
          )}

          {/* ── MONITORS ── */}
          {tab === 'monitors' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 bg-gray-50">
                {(['wedge', 'iem', 'sidefill', 'drumfill'] as const).map(t => (
                  <button key={t} onClick={() => addMonitor(t)}
                    className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-white capitalize">
                    <Plus size={13} /> {t}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400">One row per mix output</span>
              </div>
              {plan.monitors.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  No monitor mixes yet. Plan one mix per musician (or group): wedges, in-ears,
                  side fills and drum fill — and note what each one needs to hear.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {plan.monitors.map((m, i) => (
                    <div key={m.id} className="px-5 py-3 flex flex-wrap items-center gap-3 group hover:bg-gray-50">
                      <span className="text-xs font-bold text-gray-400 w-6">M{i + 1}</span>
                      <input className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-44" value={m.name}
                        onChange={e => updateMonitor(m.id, { name: e.target.value })} placeholder="Mix name" />
                      <select value={m.type} onChange={e => updateMonitor(m.id, { type: e.target.value as MonitorMix['type'] })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs capitalize">
                        <option value="wedge">Wedge</option><option value="iem">IEM</option>
                        <option value="sidefill">Side fill</option><option value="drumfill">Drum fill</option>
                      </select>
                      <input className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[140px]" value={m.members}
                        onChange={e => updateMonitor(m.id, { members: e.target.value })} placeholder="Who (e.g. Lead singer)" list="crew-names" />
                      <input className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[180px]" value={m.notes}
                        onChange={e => updateMonitor(m.id, { notes: e.target.value })} placeholder="Needs: own vox up, keys, click…" />
                      <button onClick={() => removeMonitor(m.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <datalist id="crew-names">
                    {crew.map((c: any) => <option key={c.id} value={`${c.name} ${c.last_name || ''}`.trim()} />)}
                  </datalist>
                </div>
              )}
            </div>
          )}

          {/* ── SUMMARY ── */}
          {tab === 'summary' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Total inputs', stats.total], ['Phantom +48V', stats.phantom],
                  ['DI boxes', stats.dis], ['Wireless mics', stats.wireless], ['IEM mixes', stats.iems],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 text-sm">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Console recommendation</div>
                  <p className="text-gray-800 font-medium">{consoleRecommendation(stats.total)}</p>
                  <p className="text-xs text-gray-500 mt-1">Leave 15–20% spare channels for day-of-show surprises (guests, extra DIs, spares).</p>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Gain structure & impedance checklist</div>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                    <li>Dynamic mics: 150–300 Ω into ≥1.5 kΩ preamps — set gain so peaks hit −18 dBFS (≈0 VU).</li>
                    <li>Condensers need +48V ({stats.phantom} channels here) — engage phantom before soundcheck, mute channel first.</li>
                    <li>Hi-Z sources (passive bass/guitar pickups, piezos &gt;1 MΩ) must go through an active DI — never straight to a mic preamp.</li>
                    <li>Line-level sources (+4 dBu): pad or line input, gain near unity.</li>
                    <li>Engage the listed HPFs to clean stage rumble before it stacks up in the PA.</li>
                    <li>IEM packs and wireless receivers on coordinated frequencies only — re-scan RF on site the day of show.</li>
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Related tools</div>
                  <p className="text-xs text-gray-500">
                    Draw the stage plot in <a href="/blueprint" className="text-blue-600 hover:underline">Blueprint</a>, track
                    consoles/mics/stands in <a href="/inventory" className="text-blue-600 hover:underline">Inventory</a>, and
                    put the audio crew&apos;s call times on the <a href="/productions" className="text-blue-600 hover:underline">call sheet</a>.
                  </p>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Show notes</div>
                  <textarea value={plan.notes} onChange={e => setPlan(p => ({ ...p, notes: e.target.value }))}
                    rows={4} placeholder="Power drops, snake runs, FOH position, delay towers, recording split, union curfew…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Catalog modal ── */}
      {showCatalog && (
        <Modal title="Add Instrument" onClose={() => { setShowCatalog(false); setCatalogQuery(''); }}>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input autoFocus value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)}
              placeholder="Search: drums, bajo, keys, sax…"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2">
            {AUDIO_CATEGORIES.map(cat => {
              const items = filteredCatalog.filter(t => t.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat} className="mb-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">{cat}</div>
                  {items.map(t => (
                    <button key={t.id}
                      onClick={() => { addTemplate(t); setShowCatalog(false); setCatalogQuery(''); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-left">
                      <span className="text-sm text-gray-800">{t.label}</span>
                      <span className="text-xs text-gray-400">{t.inputs.length} ch</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {filteredCatalog.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No matches.</p>}
          </div>
        </Modal>
      )}

      {/* ── Rider parser modal ── */}
      {showRider && (
        <Modal title="Parse Technical Rider" onClose={() => { setShowRider(false); setRiderMatches(null); }}>
          {!riderMatches ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Paste the band&apos;s technical rider or lineup (English or Spanish). The planner
                detects instruments and generates the input list with recommended mics,
                phantom power and gain structure.
              </p>
              <textarea value={riderText} onChange={e => setRiderText(e.target.value)} rows={8}
                placeholder={'Ej:\nBatería completa\n2x guitarra eléctrica\nBajo\nTeclado Nord\nVoz principal inalámbrica\nCoros x2\nSaxofón\nTracks/secuencias'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black font-mono" />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowRider(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button onClick={runRiderParse} disabled={!riderText.trim()}
                  className="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40">
                  <Zap size={14} /> Detect instruments
                </button>
              </div>
            </>
          ) : (
            <>
              {riderMatches.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No instruments detected. Try listing them one per line (e.g. “drums”, “bajo”, “2x guitarra eléctrica”).
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Detected {riderMatches.length} instrument{riderMatches.length > 1 ? 's' : ''} —{' '}
                    {riderMatches.reduce((a, m) => a + m.template.inputs.length * m.qty, 0)} channels total:
                  </p>
                  <div className="max-h-[40vh] overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl mb-4">
                    {riderMatches.map(({ template, qty }) => (
                      <div key={template.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-gray-800">{qty > 1 ? `${qty}× ` : ''}{template.label}</span>
                        <span className="text-xs text-gray-400">{template.inputs.length * qty} ch</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setRiderMatches(null)} className="px-4 py-2 text-sm text-gray-500">Back</button>
                {riderMatches.length > 0 && (
                  <button onClick={applyRiderMatches}
                    className="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800">
                    <Plus size={14} /> Add to input list
                  </button>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

export default function AudioPlannerPage() {
  return (
    <UpgradeGate feature="Audio Planner" requires="pro">
      <AudioPlannerInner />
    </UpgradeGate>
  );
}

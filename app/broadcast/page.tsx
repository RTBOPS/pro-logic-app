'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import PageHeader from '@/components/PageHeader';
import { UpgradeGate } from '@/components/UpgradeGate';
import {
  Camera, MonitorPlay, Layers, Radio, Plus, Trash2, Printer, Loader2, Zap,
} from 'lucide-react';

/* Broadcast Plan — the technical director's paperwork for a live multi-camera
   broadcast (sports, awards, concerts): camera plan, replay, the graphics
   package triggered by game events, and the transmission circuits coordinated
   with the network. */

interface CameraRow {
  id: string;
  cam: string;        // Cam 1
  position: string;   // Center court high L
  type: string;       // Hard / Handheld / Steadicam / Robo / Jib / POV / Skycam
  lens: string;       // 95x box / 22x ENG…
  operator: string;
  feed: string;       // CCU 1 / RF A…
  notes: string;
}
interface ReplayRow {
  id: string;
  machine: string;    // EVS A
  channels: string;   // 6ch: 4 in / 2 out
  cameras: string;    // C1–C4 + PGM
  operator: string;
  notes: string;
}
interface GraphicRow {
  id: string;
  trigger: string;    // Basket / Timeout / Halftime / MVP…
  name: string;       // asset name
  type: string;       // Bug / Lower third / Full screen / Sponsor / Wipe
  source: string;     // Vizrt / Chyron / vMix…
  operator: string;
  status: 'to build' | 'approved' | 'loaded';
  notes: string;
}
interface FeedRow {
  id: string;
  circuit: string;    // PGM Out / Return / IFB 1…
  direction: 'out' | 'in' | 'both';
  path: string;       // Fiber / Satellite / SRT-IP / 4-wire
  endpoint: string;   // network MCR + contact
  tested: boolean;
  notes: string;
}

interface BroadcastPlan {
  cameras: CameraRow[];
  replay: ReplayRow[];
  graphics: GraphicRow[];
  feeds: FeedRow[];
  network: string;      // network / rightsholder name
  truck: string;        // OB unit + park position
  notes: string;
}

const EMPTY: BroadcastPlan = { cameras: [], replay: [], graphics: [], feeds: [], network: '', truck: '', notes: '' };

const uid8 = () => Math.random().toString(36).slice(2, 10);

/* ── Presets: standard NBA-style basketball broadcast ── */
const CAMERA_PRESET: Omit<CameraRow, 'id'>[] = [
  { cam: 'Cam 1', position: 'Center court high — game', type: 'Hard', lens: '95x box', operator: '', feed: 'CCU 1', notes: 'Main game camera' },
  { cam: 'Cam 2', position: 'Center court high — tight follow', type: 'Hard', lens: '95x box', operator: '', feed: 'CCU 2', notes: 'Hero / iso tight' },
  { cam: 'Cam 3', position: 'Slash left — high corner', type: 'Hard', lens: '86x box', operator: '', feed: 'CCU 3', notes: '' },
  { cam: 'Cam 4', position: 'Slash right — high corner', type: 'Hard', lens: '86x box', operator: '', feed: 'CCU 4', notes: '' },
  { cam: 'Cam 5', position: 'Baseline left — under basket', type: 'Handheld', lens: '22x ENG', operator: '', feed: 'RF A', notes: 'Low-post action' },
  { cam: 'Cam 6', position: 'Baseline right — under basket', type: 'Handheld', lens: '22x ENG', operator: '', feed: 'RF B', notes: '' },
  { cam: 'Cam 7', position: 'Behind backboard — slam cam', type: 'Robo', lens: 'Wide prime', operator: '', feed: 'CCU 7', notes: 'Protected glass mount' },
  { cam: 'Cam 8', position: 'Arena wide — beauty', type: 'Hard', lens: '22x', operator: '', feed: 'CCU 8', notes: 'Bumps & atmosphere' },
  { cam: 'Cam 9', position: 'Court / tunnel', type: 'Steadicam', lens: 'Zoom', operator: '', feed: 'RF C', notes: 'Intros, walk-offs' },
  { cam: 'Cam 10', position: 'Tunnel opposite — jib', type: 'Jib', lens: 'Wide zoom', operator: '', feed: 'CCU 10', notes: 'Sweeps & crowd' },
];
const REPLAY_PRESET: Omit<ReplayRow, 'id'>[] = [
  { machine: 'EVS A', channels: '6ch (4 in / 2 out)', cameras: 'C1–C4 + PGM', operator: '', notes: 'Primary replay' },
  { machine: 'EVS B', channels: '4ch (4 in)', cameras: 'C5–C8', operator: '', notes: 'ISO / melts' },
];
const GRAPHICS_PRESET: Omit<GraphicRow, 'id'>[] = [
  { trigger: 'Constant', name: 'Score bug (clock + score + fouls)', type: 'Bug', source: '', operator: '', status: 'to build', notes: 'Tied to stats feed' },
  { trigger: 'Pre-game', name: 'Starting lineups (both teams)', type: 'Full screen', source: '', operator: '', status: 'to build', notes: 'Verify spellings' },
  { trigger: 'On substitution / foul', name: 'Player lower third (headshot + stats)', type: 'Lower third', source: '', operator: '', status: 'to build', notes: '' },
  { trigger: 'Basket / scoring run', name: 'Scoring run insert (e.g. 8-0 run)', type: 'Insert', source: '', operator: '', status: 'to build', notes: '' },
  { trigger: 'Timeout', name: 'Team stats full screen', type: 'Full screen', source: '', operator: '', status: 'to build', notes: '' },
  { trigger: 'Halftime', name: 'Halftime stats package', type: 'Full screen', source: '', operator: '', status: 'to build', notes: '' },
  { trigger: 'End of game', name: 'MVP / Player of the Game', type: 'Full screen', source: '', operator: '', status: 'to build', notes: 'With final stat line' },
  { trigger: 'Replay', name: 'Sponsored replay wipe', type: 'Wipe', source: '', operator: '', status: 'to build', notes: 'Sponsor billing' },
  { trigger: 'Break in/out', name: 'Sponsor billboards', type: 'Sponsor', source: '', operator: '', status: 'to build', notes: 'Per sales order' },
  { trigger: 'Free throws', name: 'FT shooter stat insert', type: 'Insert', source: '', operator: '', status: 'to build', notes: '' },
];
const FEEDS_PRESET: Omit<FeedRow, 'id'>[] = [
  { circuit: 'PGM Out (dirty)', direction: 'out', path: 'Fiber — primary', endpoint: 'Network MCR', tested: false, notes: 'With graphics' },
  { circuit: 'PGM Out (clean)', direction: 'out', path: 'Fiber — primary', endpoint: 'Network MCR', tested: false, notes: 'No graphics' },
  { circuit: 'PGM Backup', direction: 'out', path: 'Satellite uplink', endpoint: 'Network MCR', tested: false, notes: 'Auto-failover' },
  { circuit: 'Contribution backup', direction: 'out', path: 'SRT / IP encoder', endpoint: 'Network cloud ingest', tested: false, notes: '' },
  { circuit: 'Return feed', direction: 'in', path: 'Fiber', endpoint: 'Network PGM (confidence)', tested: false, notes: 'Air check in truck' },
  { circuit: 'IFB 1 / IFB 2', direction: 'in', path: '4-wire / IP', endpoint: 'Network producer → announcers', tested: false, notes: 'Program + interrupt' },
  { circuit: 'PL coordination', direction: 'both', path: '4-wire', endpoint: 'Network MCR ↔ truck', tested: false, notes: 'Break cues' },
  { circuit: 'Stats data feed', direction: 'in', path: 'IP (league API)', endpoint: 'Graphics engine', tested: false, notes: 'Score bug source' },
];

const STATUS_BADGE: Record<GraphicRow['status'], string> = {
  'to build': 'bg-gray-200 text-gray-700',
  approved: 'bg-yellow-100 text-yellow-700',
  loaded: 'bg-green-100 text-green-700',
};

function BroadcastInner() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [plan, setPlan] = useState<BroadcastPlan>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tab, setTab] = useState<'cameras' | 'replay' | 'graphics' | 'feeds'>('cameras');
  const [printing, setPrinting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (!selectedProduction || !getUid()) { setPlan(EMPTY); setLoaded(false); return; }
    skipNextSave.current = true;
    setLoaded(false);
    const ref = doc(db, 'users', getUid()!, 'productions', selectedProduction, 'broadcast', 'plan');
    return onSnapshot(ref, snap => {
      skipNextSave.current = true;
      setPlan(snap.exists() ? { ...EMPTY, ...(snap.data() as BroadcastPlan) } : EMPTY);
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
          doc(db, 'users', getUid()!, 'productions', selectedProduction, 'broadcast', 'plan'),
          { ...plan, updated_at: new Date().toISOString() }
        );
        setSaving('saved');
        setTimeout(() => setSaving('idle'), 1500);
      } catch { setSaving('idle'); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [plan]);

  /* Generic list helpers */
  const addRow = (key: keyof BroadcastPlan, row: any) =>
    setPlan(p => ({ ...p, [key]: [...(p[key] as any[]), { ...row, id: uid8() }] }));
  const updateRow = (key: keyof BroadcastPlan, id: string, patch: any) =>
    setPlan(p => ({ ...p, [key]: (p[key] as any[]).map(r => r.id === id ? { ...r, ...patch } : r) }));
  const removeRow = (key: keyof BroadcastPlan, id: string) =>
    setPlan(p => ({ ...p, [key]: (p[key] as any[]).filter(r => r.id !== id) }));
  const loadPreset = (key: 'cameras' | 'replay' | 'graphics' | 'feeds') => {
    const presets = { cameras: CAMERA_PRESET, replay: REPLAY_PRESET, graphics: GRAPHICS_PRESET, feeds: FEEDS_PRESET }[key];
    setPlan(p => ({ ...p, [key]: [...(p[key] as any[]), ...presets.map(r => ({ ...r, id: uid8() }))] }));
  };

  const graphicsReady = useMemo(
    () => plan.graphics.length > 0 && plan.graphics.every(g => g.status === 'loaded'),
    [plan.graphics]);
  const feedsTested = useMemo(
    () => plan.feeds.length > 0 && plan.feeds.every(f => f.tested),
    [plan.feeds]);

  const exportPDF = async () => {
    if (!selectedProduction || !getUid()) return;
    setPrinting(true);
    try {
      const prodSnap = await getDoc(doc(db, 'users', getUid()!, 'productions', selectedProduction));
      const compSnap = await getDoc(doc(db, 'users', getUid()!, 'company', 'profile'));
      const { generateBroadcastPDF } = await import('@/lib/pdf/broadcast');
      generateBroadcastPDF(
        { id: prodSnap.id, ...prodSnap.data() },
        compSnap.exists() ? compSnap.data() : null,
        plan
      );
    } catch (e: any) { alert('PDF failed: ' + e.message); }
    finally { setPrinting(false); }
  };

  const cell = 'w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1.5 py-1 text-xs text-gray-800';

  const toolbar = (key: 'cameras' | 'replay' | 'graphics' | 'feeds', addLabel: string, blank: any, presetLabel: string) => (
    <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 bg-gray-50">
      <button onClick={() => addRow(key, blank)} className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-800">
        <Plus size={13} /> {addLabel}
      </button>
      <button onClick={() => loadPreset(key)} className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-white">
        <Zap size={13} /> {presetLabel}
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Broadcast Plan" subtitle="Camera plan, replay, graphics package and network transmission for live multi-cam shows">
        {saving !== 'idle' && (
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            {saving === 'saving' ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : '✓ Saved'}
          </span>
        )}
        <button onClick={exportPDF} disabled={!selectedProduction || printing || (plan.cameras.length + plan.graphics.length + plan.feeds.length === 0)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800 disabled:opacity-40">
          {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Export PDF
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="max-w-sm flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Production / Event</label>
          <select value={selectedProduction} onChange={e => setSelectedProduction(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
            <option value="">Select a production…</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {selectedProduction && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Network / rightsholder</label>
              <input value={plan.network} onChange={e => setPlan(p => ({ ...p, network: e.target.value }))}
                placeholder="ESPN, TNT, league feed…"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none w-48" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">OB truck / control room</label>
              <input value={plan.truck} onChange={e => setPlan(p => ({ ...p, truck: e.target.value }))}
                placeholder="Unit 12 — dock B, shore power"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none w-56" />
            </div>
          </>
        )}
      </div>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-500 text-sm">
          Select a production. A live broadcast needs a camera plan, replay coverage, a
          graphics package tied to game events, and tested transmission circuits with the
          network — this is that paperwork, with one-click presets for a standard
          basketball broadcast.
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
            {([
              ['cameras', <><Camera size={13} /> Cameras ({plan.cameras.length})</>],
              ['replay', <><MonitorPlay size={13} /> Replay ({plan.replay.length})</>],
              ['graphics', <><Layers size={13} /> Graphics ({plan.graphics.length}){graphicsReady && ' ✓'}</>],
              ['feeds', <><Radio size={13} /> Feeds & Network ({plan.feeds.length}){feedsTested && ' ✓'}</>],
            ] as [typeof tab, React.ReactNode][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-colors ${tab === id ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── CAMERAS ── */}
          {tab === 'cameras' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {toolbar('cameras', 'Camera',
                { cam: `Cam ${plan.cameras.length + 1}`, position: '', type: 'Hard', lens: '', operator: '', feed: '', notes: '' },
                'Load basketball preset (10 cams)')}
              {plan.cameras.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  No cameras yet. Load the basketball preset — the standard 10-position
                  plan (game highs, slashes, under-basket handhelds, slam-cam robo,
                  beauty, steadicam, jib) — and adapt it to your venue.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left w-16">Cam</th>
                        <th className="px-2 py-2 text-left">Position</th>
                        <th className="px-2 py-2 text-left w-24">Type</th>
                        <th className="px-2 py-2 text-left w-24">Lens</th>
                        <th className="px-2 py-2 text-left">Operator</th>
                        <th className="px-2 py-2 text-left w-20">Feed/CCU</th>
                        <th className="px-2 py-2 text-left">Notes</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {plan.cameras.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 group">
                          <td className="px-2 py-1"><input className={`${cell} font-bold`} value={c.cam} onChange={e => updateRow('cameras', c.id, { cam: e.target.value })} /></td>
                          <td className="px-1 py-1"><input className={cell} value={c.position} onChange={e => updateRow('cameras', c.id, { position: e.target.value })} placeholder="Where it lives" /></td>
                          <td className="px-1 py-1">
                            <select value={c.type} onChange={e => updateRow('cameras', c.id, { type: e.target.value })}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full">
                              {['Hard', 'Handheld', 'Steadicam', 'Robo', 'Jib', 'POV', 'Skycam', 'Drone'].map(t => <option key={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="px-1 py-1"><input className={cell} value={c.lens} onChange={e => updateRow('cameras', c.id, { lens: e.target.value })} placeholder="95x box" /></td>
                          <td className="px-1 py-1"><input className={cell} value={c.operator} onChange={e => updateRow('cameras', c.id, { operator: e.target.value })} placeholder="Operator" list="crew-names-bc" /></td>
                          <td className="px-1 py-1"><input className={cell} value={c.feed} onChange={e => updateRow('cameras', c.id, { feed: e.target.value })} placeholder="CCU 1" /></td>
                          <td className="px-1 py-1"><input className={cell} value={c.notes} onChange={e => updateRow('cameras', c.id, { notes: e.target.value })} /></td>
                          <td className="px-2 py-1">
                            <button onClick={() => removeRow('cameras', c.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-5 py-2.5 border-t bg-gray-50 text-xs text-gray-400">
                Tip: draw the physical camera positions on the venue map in <a href="/blueprint" className="text-blue-600 hover:underline">Blueprint</a>.
              </div>
            </div>
          )}

          {/* ── REPLAY ── */}
          {tab === 'replay' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {toolbar('replay', 'Replay unit',
                { machine: `EVS ${String.fromCharCode(65 + plan.replay.length)}`, channels: '', cameras: '', operator: '', notes: '' },
                'Load standard preset (2 units)')}
              {plan.replay.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  No replay units. Every camera worth replaying needs a record channel —
                  map which cameras each EVS records and who cuts the melts.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[720px]">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left w-24">Machine</th>
                        <th className="px-2 py-2 text-left">Channels</th>
                        <th className="px-2 py-2 text-left">Cameras recorded</th>
                        <th className="px-2 py-2 text-left">Operator</th>
                        <th className="px-2 py-2 text-left">Notes</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {plan.replay.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 group">
                          <td className="px-2 py-1"><input className={`${cell} font-bold`} value={r.machine} onChange={e => updateRow('replay', r.id, { machine: e.target.value })} /></td>
                          <td className="px-1 py-1"><input className={cell} value={r.channels} onChange={e => updateRow('replay', r.id, { channels: e.target.value })} placeholder="6ch (4 in / 2 out)" /></td>
                          <td className="px-1 py-1"><input className={cell} value={r.cameras} onChange={e => updateRow('replay', r.id, { cameras: e.target.value })} placeholder="C1–C4 + PGM" /></td>
                          <td className="px-1 py-1"><input className={cell} value={r.operator} onChange={e => updateRow('replay', r.id, { operator: e.target.value })} placeholder="Operator" list="crew-names-bc" /></td>
                          <td className="px-1 py-1"><input className={cell} value={r.notes} onChange={e => updateRow('replay', r.id, { notes: e.target.value })} /></td>
                          <td className="px-2 py-1">
                            <button onClick={() => removeRow('replay', r.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── GRAPHICS ── */}
          {tab === 'graphics' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {toolbar('graphics', 'Graphic',
                { trigger: '', name: '', type: 'Lower third', source: '', operator: '', status: 'to build', notes: '' },
                'Load basketball package (10)')}
              {plan.graphics.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  No graphics yet. Plan every on-air graphic by the game event that
                  triggers it: score bug, lineups, player stats on fouls, scoring runs,
                  halftime stats, the MVP card, sponsored replay wipes…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[940px]">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Trigger / event</th>
                        <th className="px-2 py-2 text-left">Graphic</th>
                        <th className="px-2 py-2 text-left w-28">Type</th>
                        <th className="px-2 py-2 text-left w-24">Source</th>
                        <th className="px-2 py-2 text-left">Operator</th>
                        <th className="px-2 py-2 text-left w-24">Status</th>
                        <th className="px-2 py-2 text-left">Notes</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {plan.graphics.map(g => (
                        <tr key={g.id} className="hover:bg-gray-50 group">
                          <td className="px-2 py-1"><input className={`${cell} font-medium`} value={g.trigger} onChange={e => updateRow('graphics', g.id, { trigger: e.target.value })} placeholder="Basket / Timeout / MVP…" /></td>
                          <td className="px-1 py-1"><input className={cell} value={g.name} onChange={e => updateRow('graphics', g.id, { name: e.target.value })} placeholder="Asset" /></td>
                          <td className="px-1 py-1">
                            <select value={g.type} onChange={e => updateRow('graphics', g.id, { type: e.target.value })}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full">
                              {['Bug', 'Lower third', 'Full screen', 'Insert', 'Wipe', 'Sponsor', 'Ticker'].map(t => <option key={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="px-1 py-1"><input className={cell} value={g.source} onChange={e => updateRow('graphics', g.id, { source: e.target.value })} placeholder="Vizrt / Chyron" /></td>
                          <td className="px-1 py-1"><input className={cell} value={g.operator} onChange={e => updateRow('graphics', g.id, { operator: e.target.value })} placeholder="GFX op" list="crew-names-bc" /></td>
                          <td className="px-1 py-1">
                            <select value={g.status} onChange={e => updateRow('graphics', g.id, { status: e.target.value as GraphicRow['status'] })}
                              className={`text-xs rounded-full px-2 py-0.5 font-medium border-0 ${STATUS_BADGE[g.status]}`}>
                              <option value="to build">TO BUILD</option>
                              <option value="approved">APPROVED</option>
                              <option value="loaded">LOADED</option>
                            </select>
                          </td>
                          <td className="px-1 py-1"><input className={cell} value={g.notes} onChange={e => updateRow('graphics', g.id, { notes: e.target.value })} /></td>
                          <td className="px-2 py-1">
                            <button onClick={() => removeRow('graphics', g.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {plan.graphics.length > 0 && !graphicsReady && (
                <div className="px-5 py-2.5 border-t bg-yellow-50 text-xs text-yellow-700 font-medium">
                  {plan.graphics.filter(g => g.status !== 'loaded').length} graphics not loaded yet — everything must read LOADED before air.
                </div>
              )}
            </div>
          )}

          {/* ── FEEDS & NETWORK ── */}
          {tab === 'feeds' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {toolbar('feeds', 'Circuit',
                { circuit: '', direction: 'out', path: '', endpoint: '', tested: false, notes: '' },
                'Load network preset (8 circuits)')}
              {plan.feeds.length === 0 ? (
                <div className="p-10 text-center text-gray-500 text-sm">
                  No circuits yet. This is the coordination with the network: program out
                  (primary + backup), return feed, the producer&apos;s IFB to your announcers,
                  coordination PL and the stats data feed. Every circuit gets tested
                  during the facilities check.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[880px]">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Circuit</th>
                        <th className="px-2 py-2 text-left w-16">Dir</th>
                        <th className="px-2 py-2 text-left">Path</th>
                        <th className="px-2 py-2 text-left">Endpoint / contact</th>
                        <th className="px-2 py-2 text-center w-20">Tested</th>
                        <th className="px-2 py-2 text-left">Notes</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {plan.feeds.map(f => (
                        <tr key={f.id} className="hover:bg-gray-50 group">
                          <td className="px-2 py-1"><input className={`${cell} font-medium`} value={f.circuit} onChange={e => updateRow('feeds', f.id, { circuit: e.target.value })} placeholder="PGM Out / IFB / Return…" /></td>
                          <td className="px-1 py-1">
                            <select value={f.direction} onChange={e => updateRow('feeds', f.id, { direction: e.target.value })}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5">
                              <option value="out">OUT</option><option value="in">IN</option><option value="both">I/O</option>
                            </select>
                          </td>
                          <td className="px-1 py-1"><input className={cell} value={f.path} onChange={e => updateRow('feeds', f.id, { path: e.target.value })} placeholder="Fiber / Sat / SRT / 4-wire" /></td>
                          <td className="px-1 py-1"><input className={cell} value={f.endpoint} onChange={e => updateRow('feeds', f.id, { endpoint: e.target.value })} placeholder="Network MCR + phone" /></td>
                          <td className="px-2 py-1 text-center">
                            <button onClick={() => updateRow('feeds', f.id, { tested: !f.tested })}
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.tested ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                              {f.tested ? 'TESTED' : 'PENDING'}
                            </button>
                          </td>
                          <td className="px-1 py-1"><input className={cell} value={f.notes} onChange={e => updateRow('feeds', f.id, { notes: e.target.value })} /></td>
                          <td className="px-2 py-1">
                            <button onClick={() => removeRow('feeds', f.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {plan.feeds.length > 0 && !feedsTested && (
                <div className="px-5 py-2.5 border-t bg-yellow-50 text-xs text-yellow-700 font-medium">
                  {plan.feeds.filter(f => !f.tested).length} circuits untested — complete the facilities check with the network before air.
                </div>
              )}
            </div>
          )}

          <datalist id="crew-names-bc">
            {crew.map((c: any) => <option key={c.id} value={`${c.name} ${c.last_name || ''}`.trim()} />)}
          </datalist>
        </>
      )}
    </div>
  );
}

export default function BroadcastPage() {
  return (
    <UpgradeGate feature="Broadcast Plan" requires="pro">
      <BroadcastInner />
    </UpgradeGate>
  );
}

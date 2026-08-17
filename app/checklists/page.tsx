'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { useNamespace } from '@/hooks/useNamespace';
import { auth, db } from '@/lib/firebase';
import { CheckCircle, Circle, Printer, RotateCcw, Loader2, Plus, X, Eye, Trash2, PenLine } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const DEFAULT_CHECKLISTS = {
  camera: {
    label: 'Camera Package', icon: '/icons/camera.svg',
    items: ['Camera body A','Camera body B','Camera monitor','Follow focus','Lens set (primes)','Zoom lens','ND filter set','Matte box','Top handle','Shoulder rig','Battery charger','Batteries (x4)','CFexpress cards (x6)','Card reader','Cleaning kit','Camera bag'],
  },
  audio: {
    label: 'Audio Package', icon: '/icons/audio.svg',
    items: ['Sound recorder','Boom mic (shotgun)','Lavalier mics (x4)','Wireless transmitters (x4)','Wireless receivers (x4)','Boom pole','Windscreen / blimp','Headphones','XLR cables (x6)','Audio bag','Batteries AA (x20)','Sound report forms','Slate / clapperboard'],
  },
  lighting: {
    label: 'Lighting Package', icon: '/icons/lighting.svg',
    items: ['Key light','Fill light','Back / rim light','Practicals (x4)','LED panel (x2)','HMI fresnel','Light stands (x6)','C-stands (x4)','Sandbags (x8)','Dimmer / DMX controller','Power distribution box','Extension cables (x4)','Stingers (x6)','Color gels set','Diffusion frames','Bounce card','Black wrap','Gaffer tape','Spare bulbs'],
  },
  grip: {
    label: 'Grip Package', icon: '/icons/grip.svg',
    items: ['Tripod system','Fluid head','Dolly + track','Gimbal stabilizer','Slider 100cm','Jib arm','Apple boxes (x4)','Grip clips (x10)','Clamps (x8)','Arms (x4)','Gobo head','Flags (4x4)','Silk diffusion 6x6','Black net 6x6','Hardware kit'],
  },
  production: {
    label: 'Production Essentials', icon: '/icons/production.svg',
    items: ['Call sheets (printed)','Script sides','Shot list','Storyboard printout','NDA forms','Talent releases','Location release','Walkie talkies (x6)','First aid kit','Craft services supplies','Parking permits','Location map printout','Emergency contact list','Director chair','Production table','Laptop / DIT station'],
  },
  video: {
    label: 'Video / Tech', icon: '/icons/video.svg',
    items: ["Director monitor (17\")","HDMI / SDI cables (x6)","Video village cart","External recorder","Teleprompter","HDMI splitter","Wireless video transmitter","Wireless video receiver","Screen (for projection)","Projector","Hard drives (x3)","RAID backup drive"],
  },
  team: {
    label: 'Team Readiness', icon: '/icons/team.svg',
    items: ['All crew confirmed via email/SMS','Call sheets distributed to all crew','ID badges printed and ready','NDAs signed by all crew','Deal memos signed','Emergency contacts collected','COVID / health protocols communicated','Union/SAG paperwork filed','Work permits verified (if applicable)','Dietary restrictions noted for catering','Travel arrangements confirmed','Lodging confirmed for out-of-town crew','Parking assignments distributed','Walkie talkies assigned','Department heads briefed','Safety briefing scheduled'],
  },
  location: {
    label: 'Location Scout', icon: '/icons/Location.svg',
    items: ['Location release signed','Site survey completed','Power sources identified','Generator fuel checked','Parking confirmed (cast & crew)','Load-in / load-out access confirmed','Nearest hospital noted','Emergency exits mapped','Restroom facilities confirmed','Catering / basecamp area set','WiFi / comms available','Sound/noise concerns assessed','Weather backup plan in place','Neighbor notifications sent','Local law enforcement notified (if required)','Fire extinguishers on site'],
  },
  transportation: {
    label: 'Transportation', icon: '/icons/transportation.svg',
    items: ['All vehicles inspected','Fuel topped off on all vehicles','Vehicle insurance verified','Drivers confirmed and briefed','Driver licenses verified','Load plans distributed','Grip truck loaded and locked','Camera van loaded and locked','Production van stocked','Picture cars cleaned and staged','Route to location confirmed','Parking permits for vehicles','Backup vehicle arranged','Equipment manifest in each vehicle','Emergency roadside kit in each vehicle'],
  },
  stage_rigging: {
    label: 'Stage & Rigging', icon: '/icons/grip.svg',
    items: ['Stage plot approved and distributed','Rigging plot with load calculations approved','Venue weight limits verified with house rigger','All motors/hoists load-tested','Safety cables on every flown fixture','Truss inspection completed','Stage deck rated and inspected','Barricade installed and inspected','Stage ramps and stairs secured','Risers built and rated','FOH position built (console riser)','Delay towers secured and ballasted','Exclusion zones marked during rigging','Daily rigging re-inspection scheduled'],
  },
  power: {
    label: 'Power & Distribution', icon: '/icons/lighting.svg',
    items: ['Total power load calculated per department','House power capacity confirmed with venue','Generator sized with 30% headroom','Backup generator / redundancy arranged','Licensed electrician on site','Distro placement per department mapped','Cable runs ramped or flown at crossings','Ground/earth verified on all distros','GFCI protection where wet or exterior','Audio on isolated/clean power (no dimmer sharing)','Generator fueling schedule and protocol','UPS on consoles, servers and media players','Power-up / power-down sequence agreed','Emergency power-off (EPO) locations known'],
  },
  led_video: {
    label: 'LED / Video Wall', icon: '/icons/video.svg',
    items: ['LED panel count and screen dimensions confirmed','Pixel map and resolution documented','Processors configured and redundant','Signal flow diagram (source → switcher → processor → wall)','Backup media server / playback redundancy','Content delivered in correct resolution/format','IMAG cameras positioned and shaded','Camera shading / color match completed','Video switcher programmed with show looks','Confidence monitors for talent placed','All video runs (SDI/fiber) tested','Spare panels and modules on site','LED wall power and data redundancy checked','Blackout / logo state programmed'],
  },
  sfx_pyro: {
    label: 'SFX & Pyro', icon: '/icons/production.svg',
    items: ['Licensed pyrotechnician contracted','Pyro permits filed and approved','Fire marshal inspection scheduled','Safety distances marked and enforced','Product stored per regulations','Firing system tested (with keys removed)','Cue list integrated into run of show','Fire watch assigned during show','Extinguishers staged at firing positions','Venue ceiling height verified for effects','Haze/smoke fluid stocked and detectors bypassed per venue protocol','Wind plan for outdoor effects','All-clear procedure after each effect','Emergency stop authority defined'],
  },
  security_medical: {
    label: 'Security & Medical', icon: '/icons/team.svg',
    items: ['Security company contracted and briefed','Guard posts mapped (gates, stage, barricade, backstage)','Credential zones defined (AA, backstage, stage, FOH)','Credential list distributed to all posts','Radio channel assigned to security','Ingress/egress plan with capacity counts','Show-stop procedure agreed with security lead','Paramedics / ambulance on site','Medical tent location marked','Nearest hospital route documented','Evacuation routes and muster points posted','Lost person / lost child procedure','Weather emergency triggers defined','Local police / authorities notified','Insurance certificates on file'],
  },
  backstage: {
    label: 'Backstage & Hospitality', icon: '/icons/production.svg',
    items: ['Dressing rooms assigned and labeled','Hospitality rider fulfilled per artist','Catering schedule for crew and artists','Green room stocked','Production office set up (power, wifi, printer)','Runner schedule and vehicles assigned','Artist transport / pickup times confirmed','Towels, steamer, wardrobe rack in each dressing room','Backstage credential checkpoint staffed','Quiet warm-up space arranged','Meet & greet area and schedule','Laundry / wardrobe support confirmed','Artist parking marked','Load-in / load-out meal times posted'],
  },
  live_sports: {
    label: 'Live Sports Broadcast', icon: '/icons/video.svg',
    items: ['OB truck parked, leveled and on shore power','Cable runs to all camera positions ramped/flown','Facilities check with network completed (time confirmed)','Camera meeting held (coverage assignments)','All cameras shaded and color-matched','Primary transmission path tested (fiber)','Backup transmission path tested (satellite/IP)','Return feed confirmed in truck and booth','Announcer IFB checked (program + producer interrupt)','Announcer headsets and spare checked','Courtside effects and rim mics tested','Stats data feed live into graphics engine','Score bug tested with live clock','All graphics loaded and spellings proofed','Replay machines recording all assigned cameras','Commercial format confirmed with network','Anthem and intro timings confirmed','Backup record (ISO + PGM) running'],
  },
  broadcast_studio: {
    label: 'Studio / Broadcast', icon: '/icons/camera.svg',
    items: ['Rundown loaded and distributed','Scripts loaded in teleprompter','Prompter operator briefed','Anchor IFB checked (program + interrupt)','Lav mics fitted and gain-checked per anchor','Backup lav on each anchor','Studio cameras white-balanced and matched','Camera shading checked','Lower-third graphics list loaded and proofed','Playback packages (VTRs) loaded and cued','Studio lighting preset for each block','Set pieces and monitors clean and on','Talent makeup / touch-up done','Master control / stream output verified','Record backup running','Clock sync across studio (timecode)'],
  },
};

type DefaultListId = keyof typeof DEFAULT_CHECKLISTS;

interface CustomList {
  id: string;
  label: string;
  items: string[];
}

export default function ChecklistsPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [activeList, setActiveList] = useState<string>('camera');
  const [printing, setPrinting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Custom lists
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [showNewList, setShowNewList] = useState(false);
  const [editingList, setEditingList] = useState<CustomList | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newItems, setNewItems] = useState('');

  const handlePrint = () => { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false); }, 150); };

  // Load checks from Firestore
  useEffect(() => {
    if (!selectedProduction || !getUid()) return;
    const ref = doc(db, 'users', getUid()!, 'productions', selectedProduction, 'checklists', 'main');
    return onSnapshot(ref, snap => {
      if (snap.exists()) setChecks(snap.data() as any);
      else setChecks({});
    });
  }, [selectedProduction, namespace]);

  // Load custom lists from Firestore
  useEffect(() => {
    if (!selectedProduction || !getUid()) return;
    const ref = doc(db, 'users', getUid()!, 'productions', selectedProduction, 'checklists', 'custom_lists');
    return onSnapshot(ref, snap => {
      if (snap.exists()) setCustomLists(snap.data().lists || []);
      else setCustomLists([]);
    });
  }, [selectedProduction, namespace]);

  const saveCustomLists = async (lists: CustomList[]) => {
    const uid = getUid();
    if (!uid || !selectedProduction) return;
    await setDoc(doc(db, 'users', uid, 'productions', selectedProduction, 'checklists', 'custom_lists'), { lists });
  };

  const toggle = async (listId: string, item: string) => {
    if (!selectedProduction || !getUid()) return;
    const updated = { ...checks, [listId]: { ...(checks[listId] || {}), [item]: !checks[listId]?.[item] } };
    setChecks(updated);
    await setDoc(doc(db, 'users', getUid()!, 'productions', selectedProduction, 'checklists', 'main'), updated);
  };

  const resetList = async (listId: string) => {
    if (!selectedProduction || !getUid() || !confirm('Reset this checklist?')) return;
    const updated = { ...checks, [listId]: {} };
    setChecks(updated);
    await setDoc(doc(db, 'users', getUid()!, 'productions', selectedProduction, 'checklists', 'main'), updated);
  };

  const saveNewList = async () => {
    if (!newLabel.trim() || !newItems.trim()) return;
    const items = newItems.split('\n').map(s => s.trim()).filter(Boolean);
    if (editingList) {
      const updated = customLists.map(l => l.id === editingList.id ? { ...l, label: newLabel, items } : l);
      await saveCustomLists(updated);
    } else {
      const newList: CustomList = { id: `custom_${Date.now()}`, label: newLabel, items };
      await saveCustomLists([...customLists, newList]);
      setActiveList(newList.id);
    }
    setShowNewList(false); setEditingList(null); setNewLabel(''); setNewItems('');
  };

  const deleteCustomList = async (id: string) => {
    if (!confirm('Delete this checklist?')) return;
    const updated = customLists.filter(l => l.id !== id);
    await saveCustomLists(updated);
    if (activeList === id) setActiveList('camera');
  };

  const openEditList = (list: CustomList) => {
    setEditingList(list); setNewLabel(list.label); setNewItems(list.items.join('\n')); setShowNewList(true);
  };

  // Unified list getter
  const getListDef = (id: string): { label: string; icon?: string; items: string[] } | null => {
    if (id in DEFAULT_CHECKLISTS) return DEFAULT_CHECKLISTS[id as DefaultListId];
    return customLists.find(l => l.id === id) || null;
  };

  const current = getListDef(activeList);
  const listChecks = checks[activeList] || {};
  const checkedCount = current ? current.items.filter(i => listChecks[i]).length : 0;
  const progress = current ? Math.round((checkedCount / current.items.length) * 100) : 0;

  // Overall progress across all lists
  const overallProgress = () => {
    const allLists = [...Object.keys(DEFAULT_CHECKLISTS), ...customLists.map(l => l.id)];
    let total = 0, done = 0;
    allLists.forEach(id => {
      const def = getListDef(id);
      if (!def) return;
      total += def.items.length;
      done += def.items.filter(i => checks[id]?.[i]).length;
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
  };

  return (
    <div className="p-4 md:p-8">
      {printing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm no-print">
          <img src="/logo.png" alt="PRO-LOGIC" className="h-10 object-contain mb-4 opacity-80" />
          <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full animate-[slide_1.2s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-gray-400 mt-3 tracking-wide">Preparing print…</p>
          <style>{`@keyframes slide{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`}</style>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-700/90 backdrop-blur-sm no-print">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <img src="/logo-white.svg" className="h-6 object-contain" alt="PRO-LOGIC" />
              <span className="text-sm font-medium">Print Preview — Overall {overallProgress()}% ready</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowPreview(false); handlePrint(); }}
                className="flex items-center gap-2 bg-white text-gray-900 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100">
                <Printer size={13} /> Print
              </button>
              <button onClick={() => setShowPreview(false)} className="p-1.5 text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white shadow-2xl max-w-4xl mx-auto p-8 space-y-6">
              <div className="text-center border-b pb-4">
                <img src="/logo.png" className="h-8 mx-auto mb-2 object-contain" alt="" />
                <div className="font-bold text-xl text-gray-900">
                  {productions.find((p: any) => p.id === selectedProduction)?.name || 'Production'} — Equipment Checklist
                </div>
                <div className="text-sm text-gray-500 mt-1">Overall readiness: {overallProgress()}%</div>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-2 max-w-sm mx-auto">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: `${overallProgress()}%` }} />
                </div>
              </div>
              {[...Object.entries(DEFAULT_CHECKLISTS) as [string, any][], ...customLists.map(l => [l.id, l] as [string, any])].map(([id, list]) => {
                const c = checks[id] || {};
                const done = list.items.filter((i: string) => c[i]).length;
                const pct = Math.round((done / list.items.length) * 100);
                return (
                  <div key={id} className="break-inside-avoid">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {list.icon && <img src={list.icon} className="w-5 h-5" alt="" />}
                        <span className="font-semibold text-gray-900">{list.label}</span>
                      </div>
                      <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : 'text-blue-600'}`}>{done}/{list.items.length} · {pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1 mb-2">
                      <div className={`h-1 rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4">
                      {list.items.map((item: string) => (
                        <div key={item} className="flex items-center gap-2 py-0.5">
                          {c[item]
                            ? <CheckCircle size={13} className="text-green-500 shrink-0" />
                            : <Circle size={13} className="text-gray-300 shrink-0" />}
                          <span className={`text-xs ${c[item] ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Custom List Modal */}
      {showNewList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 mb-4">{editingList ? 'Edit Checklist' : 'New Custom Checklist'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">List Name</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="e.g. Drone Package" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Items (one per line)</label>
                <textarea value={newItems} onChange={e => setNewItems(e.target.value)} rows={10}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none font-mono"
                  placeholder={"DJI Inspire 3\nExtra batteries (x4)\nND filters\nPropeller guards\n..."} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowNewList(false); setEditingList(null); setNewLabel(''); setNewItems(''); }}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveNewList} disabled={!newLabel.trim() || !newItems.trim()}
                  className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40">
                  {editingList ? 'Save Changes' : 'Create List'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader title="Equipment Checklists" subtitle="Pre-shoot verification">
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700"
          value={selectedProduction} onChange={e => setSelectedProduction(e.target.value)}>
          <option value="">Select production…</option>
          {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedProduction && (
          <>
            <button onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
              <Eye size={14} /> Preview
            </button>
            <button onClick={handlePrint} disabled={printing} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40">
              {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {printing ? 'Preparing…' : 'Print'}
            </button>
          </>
        )}
      </PageHeader>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
          Select a production to start checking equipment.
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-48 shrink-0 space-y-1">
            {/* Default lists */}
            {(Object.entries(DEFAULT_CHECKLISTS) as [DefaultListId, typeof DEFAULT_CHECKLISTS[DefaultListId]][]).map(([id, list]) => {
              const c = checks[id] || {};
              const done = list.items.filter(i => c[i]).length;
              const pct = Math.round((done / list.items.length) * 100);
              return (
                <button key={id} onClick={() => setActiveList(id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${activeList === id ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    <img src={list.icon} className="w-5 h-5 shrink-0" style={{ filter: activeList === id ? 'brightness(0) invert(1)' : undefined }} alt="" />
                    <span className="text-sm font-medium">{list.label}</span>
                  </div>
                  <div className="mt-1.5">
                    <div className={`h-1 rounded-full ${activeList === id ? 'bg-white/20' : 'bg-gray-200'}`}>
                      <div className={`h-1 rounded-full transition-all ${pct === 100 ? 'bg-green-400' : activeList === id ? 'bg-white' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={`text-xs mt-0.5 ${activeList === id ? 'text-white/60' : 'text-gray-600'}`}>{done}/{list.items.length}</div>
                  </div>
                </button>
              );
            })}

            {/* Custom lists */}
            {customLists.map(list => {
              const c = checks[list.id] || {};
              const done = list.items.filter(i => c[i]).length;
              const pct = list.items.length ? Math.round((done / list.items.length) * 100) : 0;
              return (
                <div key={list.id} className={`rounded-xl transition-colors ${activeList === list.id ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
                  <button onClick={() => setActiveList(list.id)} className="w-full text-left px-3 pt-3 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📋</span>
                      <span className="text-sm font-medium truncate">{list.label}</span>
                    </div>
                    <div className="mt-1.5">
                      <div className={`h-1 rounded-full ${activeList === list.id ? 'bg-white/20' : 'bg-gray-200'}`}>
                        <div className={`h-1 rounded-full transition-all ${pct === 100 ? 'bg-green-400' : activeList === list.id ? 'bg-white' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={`text-xs mt-0.5 ${activeList === list.id ? 'text-white/60' : 'text-gray-600'}`}>{done}/{list.items.length}</div>
                    </div>
                  </button>
                  <div className="flex gap-1 px-3 pb-2">
                    <button onClick={() => openEditList(list)} className={`text-xs p-1 rounded hover:bg-white/10 ${activeList === list.id ? 'text-white/60' : 'text-gray-400'}`} title="Edit"><PenLine size={11} /></button>
                    <button onClick={() => deleteCustomList(list.id)} className={`text-xs p-1 rounded hover:bg-white/10 ${activeList === list.id ? 'text-white/60' : 'text-gray-400'}`} title="Delete"><Trash2 size={11} /></button>
                  </div>
                </div>
              );
            })}

            {/* Add list button */}
            <button onClick={() => { setEditingList(null); setNewLabel(''); setNewItems(''); setShowNewList(true); }}
              className="w-full flex items-center gap-2 text-left px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 text-sm transition-colors">
              <Plus size={14} /> New Checklist
            </button>
          </div>

          {/* Checklist panel */}
          {current && (
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                  {(current as any).icon && <img src={(current as any).icon} className="w-7 h-7 shrink-0" alt="" />}
                  {!(current as any).icon && <span className="text-2xl">📋</span>}
                  <div>
                    <div className="font-semibold text-gray-900">{current.label}</div>
                    <div className="text-xs text-gray-600">{checkedCount} of {current.items.length} checked</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10">
                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke={progress === 100 ? '#16a34a' : '#3b82f6'} strokeWidth="3"
                        strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{progress}%</span>
                  </div>
                  <button onClick={() => resetList(activeList)} className="p-2 text-gray-600 hover:text-gray-700 rounded-lg hover:bg-gray-100" title="Reset list">
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {current.items.map(item => {
                  const checked = !!listChecks[item];
                  return (
                    <div key={item} onClick={() => toggle(activeList, item)}
                      className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors ${checked ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      {checked ? <CheckCircle size={18} className="text-green-500 shrink-0" /> : <Circle size={18} className="text-gray-300 shrink-0" />}
                      <span className={`text-sm ${checked ? 'line-through text-gray-600' : 'text-gray-800'}`}>{item}</span>
                    </div>
                  );
                })}
              </div>

              {progress === 100 && (
                <div className="flex items-center justify-center gap-2 py-4 bg-green-50 border-t border-green-100">
                  <CheckCircle size={16} className="text-green-500" />
                  <span className="text-sm font-medium text-green-700">All items checked — ready to shoot!</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

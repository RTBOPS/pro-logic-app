'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import PageHeader from '@/components/PageHeader';
import { Plus, Trash2, Printer, Loader2, Zap } from 'lucide-react';

/* Production risk assessment — the safety document every stunt, pyro cue,
   rigging point and crowd plan needs before anyone steps on site.
   Deliberately NOT plan-gated: safety tooling stays available to everyone. */

interface Hazard {
  id: string;
  activity: string;    // Stunt: car flip / Pyro: waterfall / Crowd ingress…
  hazard: string;      // what can go wrong
  severity: number;    // 1–5
  likelihood: number;  // 1–5
  mitigation: string;  // controls in place
  responsible: string; // who owns it
}

interface SafetyPlan {
  hazards: Hazard[];
  medics: string;        // on-site medical coverage
  hospital: string;      // nearest hospital + drive time
  muster: string;        // muster / evacuation point
  fireSafety: string;    // extinguishers, fire watch, permits
  preparedBy: string;
  notes: string;
}

const EMPTY: SafetyPlan = { hazards: [], medics: '', hospital: '', muster: '', fireSafety: '', preparedBy: '', notes: '' };

/* Common high-risk activities as starting points */
const HAZARD_PRESETS: Omit<Hazard, 'id'>[] = [
  { activity: 'Stunt performance', hazard: 'Performer injury during stunt', severity: 5, likelihood: 2, mitigation: 'Certified stunt coordinator; rehearsals; padding/rigging inspected; medic standing by; closed set', responsible: 'Stunt coordinator' },
  { activity: 'Pyrotechnics / SFX', hazard: 'Burns, fire, premature ignition', severity: 5, likelihood: 2, mitigation: 'Licensed pyro operator; permits filed; safety distances marked; fire watch + extinguishers; cue only from showcaller', responsible: 'SFX supervisor' },
  { activity: 'Rigging / trussing', hazard: 'Falling equipment over stage or crowd', severity: 5, likelihood: 1, mitigation: 'Certified riggers; load calculations approved; safety cables on all fixtures; daily inspection', responsible: 'Head rigger' },
  { activity: 'Crowd / audience', hazard: 'Crush, surge, blocked egress', severity: 5, likelihood: 2, mitigation: 'Barricade plan; trained security at posts; clear egress; capacity monitored; show-stop procedure agreed', responsible: 'Security lead' },
  { activity: 'Electrical / power', hazard: 'Shock, fire from distro failure', severity: 4, likelihood: 2, mitigation: 'Licensed electrician; grounded distro; cable ramps; GFCI where wet; generator fueling protocol', responsible: 'Gaffer / power tech' },
  { activity: 'Vehicle scenes / road work', hazard: 'Vehicle striking crew or talent', severity: 5, likelihood: 2, mitigation: 'Road closure permits; precision drivers; lockups with radios; rehearsed routes; spotters', responsible: '1st AD / stunt coordinator' },
  { activity: 'Weather (exterior)', hazard: 'Lightning, wind on rigging, heat', severity: 4, likelihood: 3, mitigation: 'Weather monitoring; wind-load limits for structures; hydration & shade; evacuation triggers defined', responsible: 'Production manager' },
  { activity: 'Work at height', hazard: 'Falls from truss, lifts, platforms', severity: 5, likelihood: 2, mitigation: 'Harness + certified operators for lifts; spotters; exclusion zones below', responsible: 'Head rigger' },
];

const uid8 = () => Math.random().toString(36).slice(2, 10);

function riskColor(score: number): string {
  if (score >= 15) return 'bg-red-100 text-red-700';
  if (score >= 8) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}
function riskLabel(score: number): string {
  if (score >= 15) return 'HIGH';
  if (score >= 8) return 'MED';
  return 'LOW';
}

export default function SafetyPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [plan, setPlan] = useState<SafetyPlan>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [printing, setPrinting] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (!selectedProduction || !getUid()) { setPlan(EMPTY); setLoaded(false); return; }
    skipNextSave.current = true;
    setLoaded(false);
    const ref = doc(db, 'users', getUid()!, 'productions', selectedProduction, 'safety', 'main');
    return onSnapshot(ref, snap => {
      skipNextSave.current = true;
      setPlan(snap.exists() ? { ...EMPTY, ...(snap.data() as SafetyPlan) } : EMPTY);
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
          doc(db, 'users', getUid()!, 'productions', selectedProduction, 'safety', 'main'),
          { ...plan, updated_at: new Date().toISOString() }
        );
        setSaving('saved');
        setTimeout(() => setSaving('idle'), 1500);
      } catch { setSaving('idle'); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [plan]);

  const addHazard = (preset?: Omit<Hazard, 'id'>) =>
    setPlan(p => ({
      ...p,
      hazards: [...p.hazards, preset
        ? { ...preset, id: uid8() }
        : { id: uid8(), activity: '', hazard: '', severity: 3, likelihood: 3, mitigation: '', responsible: '' }],
    }));
  const update = (id: string, patch: Partial<Hazard>) =>
    setPlan(p => ({ ...p, hazards: p.hazards.map(h => h.id === id ? { ...h, ...patch } : h) }));
  const remove = (id: string) =>
    setPlan(p => ({ ...p, hazards: p.hazards.filter(h => h.id !== id) }));

  const highRisks = useMemo(() => plan.hazards.filter(h => h.severity * h.likelihood >= 15).length, [plan.hazards]);

  const exportPDF = async () => {
    if (!selectedProduction || !getUid()) return;
    setPrinting(true);
    try {
      const prodSnap = await getDoc(doc(db, 'users', getUid()!, 'productions', selectedProduction));
      const compSnap = await getDoc(doc(db, 'users', getUid()!, 'company', 'profile'));
      const { generateRiskAssessmentPDF } = await import('@/lib/pdf/risk-assessment');
      generateRiskAssessmentPDF(
        { id: prodSnap.id, ...prodSnap.data() },
        compSnap.exists() ? compSnap.data() : null,
        plan
      );
    } catch (e: any) { alert('PDF failed: ' + e.message); }
    finally { setPrinting(false); }
  };

  const cell = 'w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1.5 py-1 text-xs text-gray-800';
  const fld = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Safety & Risk Assessment" subtitle="Hazard matrix, mitigations and emergency plan — sign it before anyone steps on site">
        {saving !== 'idle' && (
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            {saving === 'saving' ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : '✓ Saved'}
          </span>
        )}
        <button onClick={exportPDF} disabled={!selectedProduction || plan.hazards.length === 0 || printing}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800 disabled:opacity-40">
          {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Export PDF
        </button>
      </PageHeader>

      <div className="mb-6 max-w-sm">
        <label className="block text-xs font-medium text-gray-600 mb-1">Production</label>
        <select value={selectedProduction} onChange={e => setSelectedProduction(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
          <option value="">Select a production…</option>
          {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-500 text-sm">
          Select a production. Stunts, pyro, rigging over people, crowds, vehicles and
          weather all demand a written risk assessment: what can go wrong, how bad,
          how likely, and what you&apos;re doing about it.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Hazard matrix */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2 bg-gray-50">
              <button onClick={() => addHazard()} className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-800">
                <Plus size={13} /> Hazard
              </button>
              <button onClick={() => setShowPresets(s => !s)} className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-white">
                <Zap size={13} /> Common hazards
              </button>
              {highRisks > 0 && (
                <span className="ml-auto text-xs font-bold text-red-600">⚠ {highRisks} HIGH risk{highRisks > 1 ? 's' : ''} — mitigate before shooting</span>
              )}
            </div>
            {showPresets && (
              <div className="px-5 py-3 border-b bg-gray-50/50 flex flex-wrap gap-2">
                {HAZARD_PRESETS.map(h => (
                  <button key={h.activity} onClick={() => { addHazard(h); }}
                    className="text-xs border border-gray-200 rounded-full px-3 py-1 text-gray-600 hover:bg-white hover:border-gray-300">
                    + {h.activity}
                  </button>
                ))}
              </div>
            )}
            {plan.hazards.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-sm">
                No hazards listed. Use “Common hazards” for the classics — stunts, pyro,
                rigging, crowd, power, vehicles, weather, work at height.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1000px]">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left w-8">#</th>
                      <th className="px-2 py-2 text-left">Activity</th>
                      <th className="px-2 py-2 text-left">Hazard</th>
                      <th className="px-2 py-2 text-center w-14">Sev 1–5</th>
                      <th className="px-2 py-2 text-center w-14">Lik 1–5</th>
                      <th className="px-2 py-2 text-center w-16">Risk</th>
                      <th className="px-2 py-2 text-left">Mitigation / controls</th>
                      <th className="px-2 py-2 text-left w-36">Responsible</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {plan.hazards.map((h, i) => {
                      const score = h.severity * h.likelihood;
                      return (
                        <tr key={h.id} className="hover:bg-gray-50 group align-top">
                          <td className="px-3 py-2 font-bold text-gray-500">{i + 1}</td>
                          <td className="px-1 py-1"><input className={cell} value={h.activity} onChange={e => update(h.id, { activity: e.target.value })} placeholder="Stunt / pyro / rigging…" /></td>
                          <td className="px-1 py-1"><input className={cell} value={h.hazard} onChange={e => update(h.id, { hazard: e.target.value })} placeholder="What can go wrong" /></td>
                          <td className="px-2 py-1 text-center">
                            <select value={h.severity} onChange={e => update(h.id, { severity: parseInt(e.target.value) })} className="border border-gray-200 rounded px-1 py-0.5 text-xs">
                              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1 text-center">
                            <select value={h.likelihood} onChange={e => update(h.id, { likelihood: parseInt(e.target.value) })} className="border border-gray-200 rounded px-1 py-0.5 text-xs">
                              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskColor(score)}`}>{score} {riskLabel(score)}</span>
                          </td>
                          <td className="px-1 py-1"><input className={cell} value={h.mitigation} onChange={e => update(h.id, { mitigation: e.target.value })} placeholder="Controls in place" /></td>
                          <td className="px-1 py-1"><input className={cell} value={h.responsible} onChange={e => update(h.id, { responsible: e.target.value })} placeholder="Owner" list="crew-names-safety" /></td>
                          <td className="px-2 py-2">
                            <button onClick={() => remove(h.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <datalist id="crew-names-safety">
                  {crew.map((c: any) => <option key={c.id} value={`${c.name} ${c.last_name || ''}`.trim()} />)}
                </datalist>
              </div>
            )}
          </div>

          {/* Emergency plan */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Emergency Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">On-site medical coverage</label>
                <input className={fld} value={plan.medics} onChange={e => setPlan(p => ({ ...p, medics: e.target.value }))} placeholder="2 paramedics + ambulance on standby, position stage left" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nearest hospital (+ drive time)</label>
                <input className={fld} value={plan.hospital} onChange={e => setPlan(p => ({ ...p, hospital: e.target.value }))} placeholder="General Hospital, Av. Central 123 — 12 min" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Muster / evacuation point</label>
                <input className={fld} value={plan.muster} onChange={e => setPlan(p => ({ ...p, muster: e.target.value }))} placeholder="Parking lot B, north gate" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fire safety</label>
                <input className={fld} value={plan.fireSafety} onChange={e => setPlan(p => ({ ...p, fireSafety: e.target.value }))} placeholder="Extinguishers at stage L/R + FOH; fire watch during pyro; permit #…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prepared by</label>
                <input className={fld} value={plan.preparedBy} onChange={e => setPlan(p => ({ ...p, preparedBy: e.target.value }))} placeholder="Name & role" list="crew-names-safety" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Additional notes</label>
                <input className={fld} value={plan.notes} onChange={e => setPlan(p => ({ ...p, notes: e.target.value }))} placeholder="Safety briefing time, show-stop authority, weather triggers…" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

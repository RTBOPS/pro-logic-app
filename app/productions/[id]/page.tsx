'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useData } from '@/hooks/useData';
import Link from 'next/link';
import {
  ArrowLeft, Users, Package, X, Mail, CheckCircle,
  Clock, XCircle, CloudSun, RefreshCw, Calendar, MapPin,
  Search, Filter, Plus
} from 'lucide-react';
import { DEPARTMENTS, deptColor, deptLabel, statusStyle } from '@/lib/departments';
import { sendConfirmationEmail, sendSMS } from '@/lib/notifications';

const STATUSES = ['new', 'active', 'completed', 'cancelled'];
const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

/* ─── Weather widget ─────────────────────────────────────────────── */
function WeatherCard({ location }: { location: any }) {
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeather = useCallback(async () => {
    setLoading(true); setError('');
    const params = new URLSearchParams();
    if (location.lat && location.lon) { params.set('lat', location.lat); params.set('lon', location.lon); }
    else if (location.city || location.address) params.set('city', `${location.city || location.address}`);
    else { setError('No location data for weather'); setLoading(false); return; }
    const res = await fetch(`/api/weather?${params}`);
    const data = await res.json();
    if (data.error) setError(data.error === 'OPENWEATHER_API_KEY not configured' ? 'Add OPENWEATHER_API_KEY to .env.local to enable weather' : data.error);
    else setForecast(data.forecast || []);
    setLoading(false);
  }, [location]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  if (error) return <p className="text-xs text-gray-400 flex items-center gap-1"><CloudSun size={12} /> {error}</p>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <CloudSun size={14} className="text-blue-500" />
        <span className="text-xs font-medium text-gray-600">Forecast — {location.name}</span>
        <button onClick={fetchWeather} className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw size={11} /></button>
      </div>
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {forecast.map((day: any) => (
            <div key={day.date} className="shrink-0 bg-gray-50 rounded-xl border border-gray-100 p-2 text-center min-w-[76px]">
              <div className="text-xs text-gray-400">{new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              <img src={`https://openweathermap.org/img/wn/${day.icon}.png`} className="w-8 h-8 mx-auto" alt="" />
              <div className="text-xs font-semibold text-gray-800">{day.temp_high}°F / {day.temp_low}°F</div>
              <div className="text-xs text-blue-500">{day.precipitation}% 💧</div>
              <div className="text-xs text-gray-400 capitalize leading-tight">{day.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Confirmation icon ──────────────────────────────────────────── */
function ConfirmIcon({ status }: { status: string }) {
  if (status === 'confirmed') return <CheckCircle size={13} className="text-green-500" />;
  if (status === 'declined') return <XCircle size={13} className="text-red-500" />;
  return <Clock size={13} className="text-yellow-500" />;
}

/* ─── Main page ──────────────────────────────────────────────────── */
type Tab = 'overview' | 'crew' | 'equipment';

export default function ProductionDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [production, setProduction] = useState<any>(null);
  const [assignedCrew, setAssignedCrew] = useState<any[]>([]);
  const [assignedGear, setAssignedGear] = useState<any[]>([]);
  const { data: allCrew } = useData('crew');
  const { data: allInventory } = useData('inventory');
  const { data: locations } = useData('locations');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [crewSearch, setCrewSearch] = useState('');
  const [crewDeptFilter, setCrewDeptFilter] = useState('');
  const [gearSearch, setGearSearch] = useState('');

  const loadProduction = async () => {
    const snap = await getDoc(doc(db, 'productions', id));
    if (snap.exists()) setProduction({ id: snap.id, ...snap.data() });
    setLoading(false);
  };

  const loadAssignments = async () => {
    const [crewSnap, gearSnap] = await Promise.all([
      getDocs(collection(db, 'productions', id, 'crew')),
      getDocs(collection(db, 'productions', id, 'equipment')),
    ]);
    setAssignedCrew(crewSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setAssignedGear(gearSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { loadProduction(); loadAssignments(); }, [id]);

  const updateStatus = async (status: string) => {
    await updateDoc(doc(db, 'productions', id), { status });
    setProduction((p: any) => ({ ...p, status }));
  };

  /* ── Crew assignment ── */
  const addCrew = async (crewId: string) => {
    if (assignedCrew.find(c => c.crew_id === crewId)) return;
    const member = allCrew.find((c: any) => c.id === crewId);
    if (!member) return;
    const token = crypto.randomUUID();
    await addDoc(collection(db, 'productions', id, 'crew'), {
      crew_id: crewId,
      name: `${member.name} ${member.last_name}`,
      role: member.role, department: member.department || 'other',
      picture: member.picture, email: member.email || '', phone: member.phone || '',
      confirmation_status: 'pending', confirm_token: token,
    });
    await loadAssignments();
  };

  const removeCrew = async (assignId: string) => {
    await deleteDoc(doc(db, 'productions', id, 'crew', assignId));
    await loadAssignments();
  };

  /* ── Equipment assignment ── */
  const addEquipment = async (itemId: string) => {
    if (assignedGear.find(g => g.item_id === itemId)) return;
    const item = allInventory.find((i: any) => i.id === itemId);
    if (!item) return;
    await addDoc(collection(db, 'productions', id, 'equipment'), {
      item_id: itemId, name: item.name, brand: item.brand, model: item.model, category: item.category,
    });
    await loadAssignments();
  };

  const removeEquipment = async (assignId: string) => {
    await deleteDoc(doc(db, 'productions', id, 'equipment', assignId));
    await loadAssignments();
  };

  /* ── Confirmation email ── */
  const sendConfirmation = async (member: any) => {
    if (!member.email) { alert('No email for this crew member.'); return; }
    setSending(member.id);
    const location = locations.find((l: any) => l.id === production?.location_id);
    const ok = await sendConfirmationEmail({
      to: member.email, crewName: member.name, role: member.role || '',
      productionName: production?.name, client: production?.client,
      token: member.confirm_token, location: location?.name,
      shootDates: production?.start_date ? `${production.start_date} → ${production.end_date || ''}` : undefined,
    });
    if (!ok) alert('Email failed — check SENDGRID_API_KEY in .env.local');
    await updateDoc(doc(db, 'productions', id, 'crew', member.id), { email_sent_at: new Date().toISOString() });
    await loadAssignments();
    setSending(null);
  };

  const sendAllPending = async () => {
    for (const m of assignedCrew.filter(c => c.confirmation_status === 'pending' && c.email))
      await sendConfirmation(m);
  };

  const sendSMSToMember = async (member: any) => {
    if (!member.phone) { alert('No phone number for this crew member.'); return; }
    setSending(member.id + '-sms');
    const location = locations.find((l: any) => l.id === production?.location_id);
    const ok = await sendSMS({
      to: member.phone, crewName: member.name, role: member.role || '',
      productionName: production?.name, client: production?.client,
      location: location?.name,
      shootDates: production?.start_date ? `${production.start_date} → ${production.end_date || ''}` : undefined,
    });
    if (!ok) alert('SMS failed — check Twilio credentials in environment variables.');
    setSending(null);
  };

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;
  if (!production) return <div className="p-8 text-red-500">Production not found.</div>;

  const location = locations.find((l: any) => l.id === production.location_id);
  const confirmedCount = assignedCrew.filter(c => c.confirmation_status === 'confirmed').length;
  const pendingCount = assignedCrew.filter(c => c.confirmation_status === 'pending').length;

  // Crew grouped by department (for overview tab)
  const crewByDept = assignedCrew.reduce((acc: Record<string, any[]>, c) => {
    const d = c.department || 'other';
    acc[d] = [...(acc[d] || []), c];
    return acc;
  }, {});

  // Filtered lists for crew/equipment tabs
  const unassignedCrew = allCrew
    .filter((c: any) => !assignedCrew.find(a => a.crew_id === c.id))
    .filter((c: any) => {
      const q = crewSearch.toLowerCase();
      return (!q || `${c.name} ${c.last_name} ${c.role}`.toLowerCase().includes(q)) &&
        (!crewDeptFilter || (c.department || 'other') === crewDeptFilter);
    });

  const unassignedGear = allInventory
    .filter((i: any) => !assignedGear.find(a => a.item_id === i.id))
    .filter((i: any) => {
      const q = gearSearch.toLowerCase();
      return !q || `${i.name} ${i.brand} ${i.model}`.toLowerCase().includes(q);
    });

  return (
    <div className="p-8">
      <Link href="/productions" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ArrowLeft size={14} /> Back to Productions
      </Link>

      {/* ── Header card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{production.name}</h1>
            <p className="text-gray-500 mt-0.5">{production.client}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
              {location && <span className="flex items-center gap-1"><MapPin size={13} />{location.name}</span>}
              {production.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {new Date(production.start_date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {production.end_date && <> → {new Date(production.end_date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</>}
                </span>
              )}
            </div>
          </div>
          <select
            value={production.status}
            onChange={e => updateStatus(e.target.value)}
            className={`border-0 rounded-full px-3 py-1.5 text-sm font-medium cursor-pointer ${STATUS_COLOR[production.status] || 'bg-gray-100 text-gray-600'}`}
          >
            {STATUSES.map(s => <option key={s} value={s} className="bg-white text-gray-800 capitalize">{s}</option>)}
          </select>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 text-sm mb-4">
          <div className="bg-gray-50 rounded-xl px-4 py-2 text-center">
            <div className="font-bold text-gray-900">{assignedCrew.length}</div>
            <div className="text-xs text-gray-400">Crew</div>
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-2 text-center">
            <div className="font-bold text-green-700">{confirmedCount}</div>
            <div className="text-xs text-gray-400">Confirmed</div>
          </div>
          <div className="bg-yellow-50 rounded-xl px-4 py-2 text-center">
            <div className="font-bold text-yellow-700">{pendingCount}</div>
            <div className="text-xs text-gray-400">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-xl px-4 py-2 text-center">
            <div className="font-bold text-blue-700">{assignedGear.length}</div>
            <div className="text-xs text-gray-400">Equipment</div>
          </div>
        </div>

        {/* Weather */}
        {location && <WeatherCard location={location} />}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(['overview', 'crew', 'equipment'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t === 'crew' && `Crew (${assignedCrew.length})`}
            {t === 'equipment' && `Equipment (${assignedGear.length})`}
            {t === 'overview' && 'Overview'}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <span className="font-semibold text-gray-800 flex items-center gap-2"><Users size={15} />Crew Summary</span>
              <button onClick={() => setTab('crew')} className="text-xs text-blue-600 hover:underline">Manage →</button>
            </div>
            {assignedCrew.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">
                No crew yet. <button onClick={() => setTab('crew')} className="text-blue-500 hover:underline">Add crew →</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {Object.entries(crewByDept).map(([deptId, members]) => (
                  <div key={deptId}>
                    <div className="px-5 py-1.5 bg-gray-50 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: deptColor(deptId) }} />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{deptLabel(deptId)} ({members.length})</span>
                    </div>
                    {members.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                        {c.picture && <img src={c.picture} className="w-7 h-7 rounded-full object-cover" alt="" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                          <div className="text-xs text-gray-400">{c.role}</div>
                        </div>
                        <ConfirmIcon status={c.confirmation_status || 'pending'} />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle(c.confirmation_status || 'pending')}`}>
                          {c.confirmation_status || 'pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <span className="font-semibold text-gray-800 flex items-center gap-2"><Package size={15} />Equipment Summary</span>
              <button onClick={() => setTab('equipment')} className="text-xs text-blue-600 hover:underline">Manage →</button>
            </div>
            {assignedGear.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">
                No equipment yet. <button onClick={() => setTab('equipment')} className="text-blue-500 hover:underline">Add equipment →</button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {assignedGear.map(g => (
                  <li key={g.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Package size={13} className="text-gray-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{g.name}</div>
                      <div className="text-xs text-gray-400">{g.brand} {g.model}</div>
                    </div>
                    {g.category && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{g.category}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Crew tab ── */}
      {tab === 'crew' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-800">Crew Assignment</span>
              {pendingCount > 0 && (
                <button onClick={sendAllPending} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1">
                  <Mail size={11} /> Send all confirmations ({pendingCount})
                </button>
              )}
            </div>
          </div>

          {/* Two-column: assigned | available */}
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {/* Left: assigned */}
            <div>
              <div className="px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Assigned ({assignedCrew.length})
              </div>
              {assignedCrew.length === 0 ? (
                <div className="p-6 text-sm text-gray-400 text-center">No crew assigned yet</div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                  {assignedCrew.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                      {c.picture && <img src={c.picture} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                        <div className="text-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: deptColor(c.department || 'other') }} />
                          <span className="text-gray-400">{c.role || deptLabel(c.department)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ConfirmIcon status={c.confirmation_status || 'pending'} />
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusStyle(c.confirmation_status || 'pending')}`}>
                          {c.confirmation_status || 'pending'}
                        </span>
                      </div>
                      <div className="flex gap-1 ml-1">
                        {c.email && (
                          <button onClick={() => sendConfirmation(c)} disabled={sending === c.id} title="Send confirmation email" className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-50">
                            <Mail size={12} />
                          </button>
                        )}
                        {c.phone && (
                          <button onClick={() => sendSMSToMember(c)} disabled={sending === c.id + '-sms'} title="Send SMS notification" className="p-1.5 text-gray-400 hover:text-green-600 disabled:opacity-50">
                            💬
                          </button>
                        )}
                        <button onClick={() => removeCrew(c.id)} className="p-1.5 text-gray-400 hover:text-red-500"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: available to add */}
            <div>
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Available to add</span>
              </div>
              <div className="px-4 py-3 border-b flex gap-2">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none" placeholder="Search…"
                    value={crewSearch} onChange={e => setCrewSearch(e.target.value)} />
                </div>
                <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600"
                  value={crewDeptFilter} onChange={e => setCrewDeptFilter(e.target.value)}>
                  <option value="">All depts</option>
                  {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
              {unassignedCrew.length === 0 ? (
                <div className="p-6 text-sm text-gray-400 text-center">{allCrew.length === 0 ? 'No crew in database yet.' : 'All crew already assigned.'}</div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[460px] overflow-y-auto">
                  {unassignedCrew.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                      {c.picture && <img src={c.picture} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{c.name} {c.last_name}</div>
                        <div className="text-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: deptColor(c.department || 'other') }} />
                          <span className="text-gray-400">{c.role || deptLabel(c.department || 'other')}</span>
                        </div>
                      </div>
                      <button onClick={() => addCrew(c.id)} className="flex items-center gap-1 text-xs bg-black text-white px-2.5 py-1 rounded-lg hover:bg-zinc-700">
                        <Plus size={11} /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Equipment tab ── */}
      {tab === 'equipment' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b">
            <span className="font-semibold text-gray-800">Equipment Assignment</span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {/* Left: assigned */}
            <div>
              <div className="px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Assigned ({assignedGear.length})
              </div>
              {assignedGear.length === 0 ? (
                <div className="p-6 text-sm text-gray-400 text-center">No equipment assigned yet</div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                  {assignedGear.map(g => (
                    <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                      <Package size={14} className="text-gray-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{g.name}</div>
                        <div className="text-xs text-gray-400">{g.brand} {g.model}</div>
                      </div>
                      {g.category && <span className="text-xs text-gray-400 shrink-0">{g.category}</span>}
                      <button onClick={() => removeEquipment(g.id)} className="p-1.5 text-gray-400 hover:text-red-500"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: available */}
            <div>
              <div className="px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">Available to add</div>
              <div className="px-4 py-3 border-b">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none"
                    placeholder="Search equipment…" value={gearSearch} onChange={e => setGearSearch(e.target.value)} />
                </div>
              </div>
              {unassignedGear.length === 0 ? (
                <div className="p-6 text-sm text-gray-400 text-center">{allInventory.length === 0 ? 'No inventory yet.' : 'All items assigned.'}</div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[460px] overflow-y-auto">
                  {unassignedGear.map((i: any) => (
                    <div key={i.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                      <Package size={13} className="text-gray-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{i.name}</div>
                        <div className="text-xs text-gray-400">{i.brand} {i.model} · {i.category}</div>
                      </div>
                      <button onClick={() => addEquipment(i.id)} className="flex items-center gap-1 text-xs bg-black text-white px-2.5 py-1 rounded-lg hover:bg-zinc-700 shrink-0">
                        <Plus size={11} /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useData } from '@/hooks/useData';
import Link from 'next/link';
import { ArrowLeft, Users, Package, X, Mail, CheckCircle, Clock, XCircle, CloudSun, RefreshCw } from 'lucide-react';
import { DEPARTMENTS, deptColor, deptLabel, statusStyle } from '@/lib/departments';
import { sendConfirmationEmail } from '@/lib/notifications';

const STATUSES = ['new', 'active', 'completed', 'cancelled'];
const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

function WeatherCard({ location }: { location: any }) {
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch_ = useCallback(async () => {
    setLoading(true); setError('');
    const params = new URLSearchParams();
    if (location.lat && location.lon) {
      params.set('lat', location.lat); params.set('lon', location.lon);
    } else if (location.city || location.address) {
      params.set('city', `${location.city || location.address},${location.country || ''}`);
    } else { setError('No location data'); setLoading(false); return; }
    const res = await fetch(`/api/weather?${params}`);
    const data = await res.json();
    if (data.error) setError(data.error);
    else setForecast(data.forecast || []);
    setLoading(false);
  }, [location]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (error) return (
    <div className="text-xs text-gray-400 flex items-center gap-1">
      <CloudSun size={12} /> {error === 'OPENWEATHER_API_KEY not configured' ? 'Add OPENWEATHER_API_KEY to .env.local' : error}
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <CloudSun size={14} className="text-blue-500" />
        <span className="text-xs font-medium text-gray-600">Weather Forecast — {location.name}</span>
        <button onClick={fetch_} className="ml-auto text-gray-400 hover:text-gray-600"><RefreshCw size={12} /></button>
      </div>
      {loading ? (
        <div className="text-xs text-gray-400">Loading forecast…</div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {forecast.map((day: any) => (
            <div key={day.date} className="shrink-0 bg-white rounded-xl border border-gray-100 p-2 text-center min-w-[80px]">
              <div className="text-xs text-gray-400 mb-1">{new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              <img src={`https://openweathermap.org/img/wn/${day.icon}.png`} className="w-8 h-8 mx-auto" alt="" />
              <div className="text-xs font-semibold text-gray-800">{day.temp_high}°F</div>
              <div className="text-xs text-gray-400">{day.temp_low}°F</div>
              <div className="text-xs text-blue-500 mt-0.5">{day.precipitation}% 💧</div>
              <div className="text-xs text-gray-400 capitalize leading-tight mt-0.5">{day.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmIcon({ status }: { status: string }) {
  if (status === 'confirmed') return <CheckCircle size={14} className="text-green-500" />;
  if (status === 'declined') return <XCircle size={14} className="text-red-500" />;
  return <Clock size={14} className="text-yellow-500" />;
}

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

  const loadProduction = async () => {
    const snap = await getDoc(doc(db, 'productions', id));
    if (snap.exists()) setProduction({ id: snap.id, ...snap.data() });
    setLoading(false);
  };

  const loadAssignments = async () => {
    const crewSnap = await getDocs(collection(db, 'productions', id, 'crew'));
    setAssignedCrew(crewSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const gearSnap = await getDocs(collection(db, 'productions', id, 'equipment'));
    setAssignedGear(gearSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { loadProduction(); loadAssignments(); }, [id]);

  const updateStatus = async (status: string) => {
    await updateDoc(doc(db, 'productions', id), { status });
    setProduction((p: any) => ({ ...p, status }));
  };

  const addCrew = async (crewId: string) => {
    if (assignedCrew.find(c => c.crew_id === crewId)) return;
    const member = allCrew.find((c: any) => c.id === crewId);
    if (!member) return;
    const token = crypto.randomUUID();
    await addDoc(collection(db, 'productions', id, 'crew'), {
      crew_id: crewId,
      name: `${member.name} ${member.last_name}`,
      role: member.role,
      department: member.department || 'other',
      picture: member.picture,
      email: member.email || '',
      phone: member.phone || '',
      confirmation_status: 'pending',
      confirm_token: token,
    });
    await loadAssignments();
  };

  const removeCrew = async (assignId: string) => {
    await deleteDoc(doc(db, 'productions', id, 'crew', assignId));
    await loadAssignments();
  };

  const addEquipment = async (itemId: string) => {
    if (assignedGear.find(g => g.item_id === itemId)) return;
    const item = allInventory.find((i: any) => i.id === itemId);
    if (!item) return;
    await addDoc(collection(db, 'productions', id, 'equipment'), {
      item_id: itemId, name: item.name, brand: item.brand, model: item.model,
    });
    await loadAssignments();
  };

  const removeEquipment = async (assignId: string) => {
    await deleteDoc(doc(db, 'productions', id, 'equipment', assignId));
    await loadAssignments();
  };

  const sendConfirmation = async (member: any) => {
    if (!member.email) { alert('No email address for this crew member.'); return; }
    setSending(member.id);
    const location = locations.find((l: any) => l.id === production?.location_id);
    const ok = await sendConfirmationEmail({
      to: member.email,
      crewName: member.name,
      role: member.role || '',
      productionName: production?.name,
      client: production?.client,
      token: member.confirm_token,
      location: location?.name,
    });
    if (!ok) alert('Email failed — check SENDGRID_API_KEY in .env.local');
    await updateDoc(doc(db, 'productions', id, 'crew', member.id), { email_sent_at: new Date().toISOString() });
    await loadAssignments();
    setSending(null);
  };

  const sendAllPending = async () => {
    const pending = assignedCrew.filter(c => c.confirmation_status === 'pending' && c.email);
    for (const m of pending) await sendConfirmation(m);
  };

  // Group crew by department
  const crewByDept = assignedCrew.reduce((acc: Record<string, any[]>, c) => {
    const dept = c.department || 'other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(c);
    return acc;
  }, {});

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;
  if (!production) return <div className="p-8 text-red-500">Production not found.</div>;

  const location = locations.find((l: any) => l.id === production.location_id);
  const unassignedCrew = allCrew.filter((c: any) => !assignedCrew.find(a => a.crew_id === c.id));
  const unassignedGear = allInventory.filter((i: any) => !assignedGear.find(a => a.item_id === i.id));
  const pendingCount = assignedCrew.filter(c => c.confirmation_status === 'pending').length;
  const confirmedCount = assignedCrew.filter(c => c.confirmation_status === 'confirmed').length;

  return (
    <div className="p-8">
      <Link href="/productions" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={14} /> Back to Productions
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{production.name}</h1>
            <p className="text-gray-500 mt-1">{production.client}</p>
            {location && <p className="text-sm text-gray-400 mt-0.5">{location.name}</p>}
          </div>
          <select
            value={production.status}
            onChange={e => updateStatus(e.target.value)}
            className={`border-0 rounded-full px-3 py-1 text-sm font-medium cursor-pointer ${STATUS_COLOR[production.status] || 'bg-gray-100 text-gray-600'}`}
          >
            {STATUSES.map(s => <option key={s} value={s} className="bg-white text-gray-800 capitalize">{s}</option>)}
          </select>
        </div>

        {/* Weather */}
        {location && <WeatherCard location={location} />}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Crew by department — spans 2 cols */}
        <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 font-semibold text-gray-800">
                <Users size={16} /> Crew ({assignedCrew.length})
              </div>
              {confirmedCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{confirmedCount} confirmed</span>
              )}
              {pendingCount > 0 && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{pendingCount} pending</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <button
                  onClick={sendAllPending}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <Mail size={11} /> Send all confirmations
                </button>
              )}
              {unassignedCrew.length > 0 && (
                <select
                  onChange={e => { if (e.target.value) { addCrew(e.target.value); e.target.value = ''; } }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600"
                  defaultValue=""
                >
                  <option value="">+ Add crew</option>
                  {DEPARTMENTS.map(dept => {
                    const deptCrew = unassignedCrew.filter((c: any) => (c.department || 'other') === dept.id);
                    if (!deptCrew.length) return null;
                    return (
                      <optgroup key={dept.id} label={dept.label}>
                        {deptCrew.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name} {c.last_name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {assignedCrew.length === 0 ? (
            <div className="p-8 text-sm text-gray-400 text-center">No crew assigned yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {Object.entries(crewByDept).map(([deptId, members]) => (
                <div key={deptId}>
                  <div className="px-6 py-2 flex items-center gap-2 bg-gray-50">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: deptColor(deptId) }}
                    />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {deptLabel(deptId)} ({members.length})
                    </span>
                  </div>
                  {members.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-6 py-3">
                      {c.picture && <img src={c.picture} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.role || '—'}</div>
                      </div>
                      {/* Confirmation status */}
                      <div className="flex items-center gap-1.5">
                        <ConfirmIcon status={c.confirmation_status || 'pending'} />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle(c.confirmation_status || 'pending')}`}>
                          {c.confirmation_status || 'pending'}
                        </span>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-2">
                        {c.email && (
                          <button
                            onClick={() => sendConfirmation(c)}
                            disabled={sending === c.id}
                            title={`Send confirmation to ${c.email}`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                          >
                            <Mail size={13} />
                          </button>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="p-1.5 text-gray-400 hover:text-green-600" title={c.phone}>
                            📱
                          </a>
                        )}
                        <button onClick={() => removeCrew(c.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equipment */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Package size={16} /> Equipment ({assignedGear.length})
            </div>
            {unassignedGear.length > 0 && (
              <select
                onChange={e => { if (e.target.value) { addEquipment(e.target.value); e.target.value = ''; } }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
                defaultValue=""
              >
                <option value="">+ Add</option>
                {unassignedGear.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
          </div>
          {assignedGear.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">No equipment assigned</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {assignedGear.map(g => (
                <li key={g.id} className="flex items-center gap-3 px-6 py-3">
                  <Package size={14} className="text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{g.name}</div>
                    <div className="text-xs text-gray-400">{g.brand} {g.model}</div>
                  </div>
                  <button onClick={() => removeEquipment(g.id)} className="text-gray-300 hover:text-red-500">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

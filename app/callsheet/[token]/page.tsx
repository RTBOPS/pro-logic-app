'use client';

import { useEffect, useState, use } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MapPin, Clock, Users, Calendar, CloudSun } from 'lucide-react';

const DEPT_COLORS: Record<string, string> = {
  camera: '#1d4ed8', audio: '#0d9488', lighting: '#d97706', grip: '#78716c',
  production: '#7c3aed', art: '#db2777', wardrobe: '#7c2d12', vfx: '#065f46',
  cast: '#b45309', transportation: '#374151', catering: '#166534', other: '#6b7280',
  direction: '#1d4ed8',
};

export default function PublicCallSheet({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [production, setProduction] = useState<any>(null);
  const [crew, setCrew] = useState<any[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Read the shared_callsheets token (public read in Firestore rules)
        const tokenSnap = await getDoc(doc(db, 'shared_callsheets', token));
        if (!tokenSnap.exists()) { setStatus('error'); return; }

        const data = tokenSnap.data();

        // New tokens carry a full snapshot — no auth needed for anything else
        if (data.snapshot) {
          const snap = data.snapshot;
          setProduction(snap.production);
          setCrew(
            (snap.crew || []).slice().sort((a: any, b: any) =>
              (a.department || '').localeCompare(b.department || ''))
          );
          setLocation(snap.location || null);
          setCompany(snap.company || null);
          setStatus('ready');
          return;
        }

        // Legacy tokens (pre-snapshot): live reads — only work for signed-in owners
        const { uid, productionId } = data;
        const [prodSnap, crewSnap, locsSnap, compSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid, 'productions', productionId)),
          getDocs(collection(db, 'users', uid, 'productions', productionId, 'crew')),
          getDocs(collection(db, 'users', uid, 'locations')),
          getDoc(doc(db, 'users', uid, 'company', 'profile')),
        ]);

        if (!prodSnap.exists()) { setStatus('error'); return; }

        const prod = { id: prodSnap.id, ...prodSnap.data() };
        setProduction(prod);

        const crewList = crewSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (a.department || '').localeCompare(b.department || ''));
        setCrew(crewList);

        const locs = locsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLocation(locs.find((l: any) => l.id === (prod as any).location_id) || null);

        if (compSnap.exists()) setCompany(compSnap.data());

        setStatus('ready');
      } catch {
        setStatus('error');
      }
    };
    load();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="PRO-LOGIC" className="h-8 object-contain animate-pulse" />
          <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gray-800 rounded-full animate-[slide_1.2s_ease-in-out_infinite]" />
          </div>
          <style>{`@keyframes slide{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`}</style>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <img src="/logo.png" alt="PRO-LOGIC" className="h-8 mx-auto mb-4 object-contain" />
          <h1 className="font-bold text-gray-800 mb-2">Call sheet not found</h1>
          <p className="text-sm text-gray-500">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  const brandColor = company?.primary_color || '#18181b';
  const shootDate = production.start_date
    ? new Date(production.start_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  // Group crew by department
  const byDept: Record<string, any[]> = {};
  crew.forEach(c => {
    const dept = c.department || 'other';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(c);
  });

  return (
    <div className="min-h-screen w-full bg-gray-50 pb-10">
      {/* Header bar */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: brandColor }}>
        {company?.logo_url
          ? <div className="bg-white rounded px-2 py-1"><img src={company.logo_url} className="h-7 object-contain" style={{ maxWidth: 80 }} alt="" /></div>
          : <span className="text-white font-bold text-sm">{company?.name || 'STUDIO'}</span>}
        <img src="/logo-white.svg" className="h-6 object-contain" alt="PRO-LOGIC" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* Title block */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ background: `${brandColor}15` }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: brandColor }}>
              Call Sheet — Confidential
            </div>
            <h1 className="text-xl font-black text-gray-900">{production.name}</h1>
            {production.client && <div className="text-sm text-gray-500 mt-0.5">Client: {production.client}</div>}
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {shootDate && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <div>
                  <div className="text-xs text-gray-400">Shoot Date</div>
                  <div className="font-medium text-gray-800">{shootDate}</div>
                </div>
              </div>
            )}
            {production.call_time && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400 shrink-0" />
                <div>
                  <div className="text-xs text-gray-400">General Call Time</div>
                  <div className="font-bold text-gray-900 text-lg">{production.call_time}</div>
                </div>
              </div>
            )}
            {location && (
              <div className="flex items-start gap-2 sm:col-span-2">
                <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-400">Location</div>
                  <div className="font-medium text-gray-800">{location.name}</div>
                  {location.address && <div className="text-xs text-gray-500 mt-0.5">{location.address}</div>}
                </div>
              </div>
            )}
            {production.notes && (
              <div className="sm:col-span-2 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
                <div className="text-xs font-bold text-yellow-700 mb-1 uppercase tracking-wide">Notes</div>
                <div className="text-sm text-gray-700 whitespace-pre-line">{production.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Crew by department */}
        {crew.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center gap-2 bg-gray-50">
              <Users size={14} className="text-gray-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Crew — {crew.length} members
              </span>
            </div>
            {Object.entries(byDept).map(([dept, members]) => (
              <div key={dept}>
                <div className="px-5 py-2 text-xs font-bold uppercase tracking-widest border-b border-gray-50"
                  style={{ color: DEPT_COLORS[dept] || '#6b7280', backgroundColor: `${DEPT_COLORS[dept] || '#6b7280'}08` }}>
                  {dept.charAt(0).toUpperCase() + dept.slice(1)}
                </div>
                {members.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                    {c.picture
                      ? <img src={c.picture} className="w-9 h-9 rounded-full object-cover shrink-0 border-2"
                          style={{ borderColor: DEPT_COLORS[dept] || '#e5e7eb' }} alt="" />
                      : <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: DEPT_COLORS[dept] || '#6b7280' }}>
                          {c.name?.charAt(0)}{c.name?.split(' ')[1]?.charAt(0) || ''}
                        </div>}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.role || dept}</div>
                    </div>
                    {(c.call_time || production.call_time) && (
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-400">Call</div>
                        <div className="font-bold text-sm" style={{ color: brandColor }}>
                          {c.call_time || production.call_time}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto px-4 mt-6 text-center">
        <img src="/logo.png" alt="PRO-LOGIC" className="h-6 mx-auto mb-1 object-contain opacity-40" />
        <p className="text-xs text-gray-400">
          This call sheet is confidential. Powered by PRO-LOGIC Studio.
        </p>
      </div>
    </div>
  );
}

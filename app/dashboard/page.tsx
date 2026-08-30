'use client';

import { useData } from '@/hooks/useData';
import { Film, Users, Package, MapPin, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { useAuth } from '@/hooks/useAuth';
import { removeSampleData } from '@/lib/sample-data';
import { Sparkles } from 'lucide-react';
import { auth } from '@/lib/firebase';

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

// Total checklist items across all default categories
const DEFAULT_ITEM_COUNTS: Record<string, number> = {
  camera: 16, audio: 13, lighting: 19, grip: 15,
  production: 16, video: 12, team: 16, location: 16, transportation: 15,
  stage_rigging: 14, power: 14, led_video: 14, sfx_pyro: 14,
  security_medical: 15, backstage: 14, broadcast_studio: 16, live_sports: 18,
};
const TOTAL_DEFAULT_ITEMS = Object.values(DEFAULT_ITEM_COUNTS).reduce((a, b) => a + b, 0);

export default function Dashboard() {
  const namespace = useNamespace();
  const { user, profile } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [sampleGone, setSampleGone] = useState(false);
  const clearSample = async () => {
    const uid = namespace || user?.uid;
    if (!uid || !confirm('Remove all sample data? Your own data is not affected.')) return;
    setClearing(true);
    try { await removeSampleData(uid); setSampleGone(true); window.location.reload(); }
    finally { setClearing(false); }
  };
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions, loading: lp } = useData('productions');
  const { data: crew, loading: lc } = useData('crew');
  const { data: inventory, loading: li } = useData('inventory');
  const { data: locations } = useData('locations');

  // Checklist readiness per production
  const [readiness, setReadiness] = useState<Record<string, number>>({});

  // PayPal return flow: ?subscribed=pro|studio — the webhook activates the
  // plan server-side, so poll the profile until it flips (or we time out)
  const [activating, setActivating] = useState<null | 'pending' | 'done' | 'timeout'>(null);
  const [activatedPlan, setActivatedPlan] = useState('');

  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get('subscribed');
    if (!plan) return;
    setActivating('pending');
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const u = auth.currentUser;
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          const p = snap.exists() ? (snap.data() as any).plan : null;
          if (p === plan) {
            setActivatedPlan(p);
            setActivating('done');
            clearInterval(timer);
            window.history.replaceState({}, '', '/dashboard');
            return;
          }
        } catch { /* keep polling */ }
      }
      if (tries >= 20) { setActivating('timeout'); clearInterval(timer); }
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const uid = getUid();
    if (!uid || productions.length === 0) return;
    const recent = productions.slice(0, 6);
    Promise.all(
      recent.map(async (p: any) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'productions', p.id, 'checklists', 'main'));
          const snap2 = await getDoc(doc(db, 'users', uid, 'productions', p.id, 'checklists', 'custom_lists'));
          const data = snap.exists() ? snap.data() as Record<string, Record<string, boolean>> : {};
          // Count default items checked
          let done = 0;
          let total = TOTAL_DEFAULT_ITEMS;
          Object.entries(DEFAULT_ITEM_COUNTS).forEach(([listId, count]) => {
            const listChecks = data[listId] || {};
            done += Object.values(listChecks).filter(Boolean).length;
          });
          // Count custom list items
          if (snap2.exists()) {
            const customLists = snap2.data().lists || [];
            customLists.forEach((list: any) => {
              total += list.items.length;
              const listChecks = data[list.id] || {};
              done += Object.values(listChecks).filter(Boolean).length;
            });
          }
          return [p.id, total > 0 ? Math.round((done / total) * 100) : 0] as [string, number];
        } catch {
          return [p.id, 0] as [string, number];
        }
      })
    ).then(results => {
      setReadiness(Object.fromEntries(results));
    });
  }, [productions, namespace]);

  const stats = [
    { label: 'Productions', value: productions.length, icon: Film, href: '/productions', color: 'text-purple-600 bg-purple-50' },
    { label: 'Crew', value: crew.length, icon: Users, href: '/crew', color: 'text-blue-600 bg-blue-50' },
    { label: 'Equipment', value: inventory.length, icon: Package, href: '/inventory', color: 'text-green-600 bg-green-50' },
    { label: 'Locations', value: locations.length, icon: MapPin, href: '/locations', color: 'text-orange-600 bg-orange-50' },
  ];

  const recent = productions.slice(0, 6);

  return (
    <div className="p-4 md:p-8">
      {profile?.hasSampleData && !sampleGone && (
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <Sparkles size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1 min-w-[220px]">
            You're looking at <b>sample data</b> — a ready-made production so you can try call sheets,
            budgets and documents right away. Remove it whenever you're ready to start your own.
          </p>
          <button onClick={clearSample} disabled={clearing}
            className="bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-amber-600 disabled:opacity-50">
            {clearing ? 'Removing…' : 'Remove sample data'}
          </button>
        </div>
      )}
      {activating === 'pending' && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl px-5 py-3.5 text-sm flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin shrink-0" />
          Payment approved — activating your plan. This usually takes a few seconds…
        </div>
      )}
      {activating === 'done' && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-2xl px-5 py-3.5 text-sm font-medium">
          🎉 Your <span className="capitalize">{activatedPlan}</span> plan is now active. Welcome aboard!
        </div>
      )}
      {activating === 'timeout' && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-2xl px-5 py-3.5 text-sm">
          Payment received. Activation is taking longer than usual — refresh this page in a minute.
          If your plan doesn&apos;t appear, contact support.
        </div>
      )}
      <PageHeader title="Dashboard" subtitle="Overview of your studio operations" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={href} href={href}>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
              <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}><Icon size={20} /></div>
              <div className="text-2xl font-bold text-gray-900">{lp || lc || li ? '—' : value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Shoot Readiness */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-green-600" />
              <h2 className="font-semibold text-gray-800">Shoot Readiness</h2>
            </div>
            <Link href="/checklists" className="text-sm text-blue-600 hover:underline">Manage checklists</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map((p: any) => {
              const pct = readiness[p.id] ?? null;
              const color = pct === null ? 'bg-gray-200' : pct === 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-400' : 'bg-gray-300';
              return (
                <Link key={p.id} href="/checklists" className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                      <span className={`text-xs font-bold ml-3 shrink-0 ${pct === 100 ? 'text-green-600' : 'text-gray-500'}`}>
                        {pct === null ? '—' : `${pct}%`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  </div>
                  {pct === 100 && <span className="text-xs text-green-600 font-medium shrink-0">✓ Ready</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent productions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Recent Productions</h2>
          <Link href="/productions" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        {lp ? (
          <div className="p-6 text-gray-600 text-sm">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-6 text-gray-600 text-sm">No productions yet.</div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-gray-50">
            {recent.map((p: any) => {
              const loc = locations.find((l: any) => l.id === p.location_id);
              return (
                <Link key={p.id} href={`/productions/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                    <div className="text-xs text-gray-600">{p.client}{loc?.name ? ` · ${loc.name}` : ''}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ml-2 ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                </Link>
              );
            })}
          </div>
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent.map((p: any) => {
                const loc = locations.find((l: any) => l.id === p.location_id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <Link href={`/productions/${p.id}`} className="hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{p.client}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{loc?.name || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}

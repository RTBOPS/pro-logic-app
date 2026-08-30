'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Users, DollarSign, Zap, HardDrive, Megaphone, RefreshCw } from 'lucide-react';

/* Owner-only operations dashboard. The API decides who is an admin —
 * everyone else gets a 403 and the "not authorized" screen. */

const fmtBytes = (n: number) => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};
const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const PLAN_CHIP: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  producer: 'bg-blue-50 text-blue-700',
  pro: 'bg-blue-50 text-blue-700',
  broadcast: 'bg-amber-50 text-amber-700',
  studio: 'bg-purple-50 text-purple-700',
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.status === 403) { setDenied(true); return; }
      if (res.ok) setData(await res.json());
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [user]);

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (denied) return <div className="p-8 text-sm text-gray-500">This area is for the platform owner only.</div>;
  if (!data) return <div className="p-8 text-sm text-gray-400">Loading admin data…</div>;

  const s = data.summary;
  const cards = [
    { label: 'Users', v: String(s.totalUsers), sub: `+${s.signups30d} in 30 days`, icon: Users },
    { label: 'MRR (active subs)', v: money(s.mrr), sub: Object.entries(s.planCounts).map(([k, v]) => `${k}: ${v}`).join(' · '), icon: DollarSign },
    { label: 'Event passes', v: String(s.eventPassesTotal), sub: `${s.eventPasses30d} in 30d · ${money(s.eventPassRevenue)} lifetime`, icon: Zap },
    { label: 'Storage', v: fmtBytes(s.storageTotal), sub: s.storageError || 'file bucket total', icon: HardDrive },
    { label: 'Commissions owed', v: money(s.pendingCommissions), sub: `${money(s.paidCommissions)} already paid`, icon: Megaphone },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-gray-500 text-sm">Accounts, revenue and consumption — owner only.</p>
        </div>
        <button onClick={load} disabled={busy} className="flex items-center gap-1.5 border border-gray-200 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <c.icon size={16} className="text-amber-500 mb-1" />
            <div className="text-xl font-bold text-gray-900 tabular-nums">{c.v}</div>
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">Storage by folder</div>
          {Object.entries(s.storageByFolder as Record<string, number>)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-b-0">
                <span className="text-gray-600 font-mono text-xs">{k}/</span>
                <span className="text-gray-900 tabular-nums">{fmtBytes(v)}</span>
              </div>
            ))}
          {Object.keys(s.storageByFolder).length === 0 && <div className="text-xs text-gray-400">No files yet.</div>}
        </div>
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Top storage users</div>
          {data.users
            .filter((u: any) => u.storageBytes > 0)
            .sort((a: any, b: any) => b.storageBytes - a.storageBytes)
            .slice(0, 8)
            .map((u: any) => (
              <div key={u.uid} className="flex justify-between items-center px-4 py-2 border-b border-gray-50 last:border-b-0 text-sm">
                <span className="text-gray-700">{u.email || u.uid}</span>
                <span className="text-gray-900 font-medium tabular-nums">{fmtBytes(u.storageBytes)}</span>
              </div>
            ))}
          {data.users.every((u: any) => !u.storageBytes) && <div className="p-4 text-xs text-gray-400">No files yet.</div>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Accounts ({data.users.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">MRR</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2">Referred by</th>
                <th className="px-4 py-2">Event pass</th>
                <th className="px-4 py-2 text-right">Storage</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u: any) => (
                <tr key={u.uid} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-4 py-2">
                    <div className="text-gray-900">{u.email || '—'}</div>
                    <div className="text-[11px] text-gray-400">{u.name}{u.hasSampleData ? ' · sample data' : ''}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${PLAN_CHIP[u.plan] || PLAN_CHIP.free}`}>{u.plan}</span>
                    {u.planStatus && u.planStatus !== 'active' && <span className="text-[10px] text-gray-400 ml-1">{u.planStatus}</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-gray-700">{u.mrr ? money(u.mrr) : '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US') : '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs font-mono">{u.referredBy || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{u.eventPassUntil ? (new Date(u.eventPassUntil) > new Date() ? 'active' : 'expired') : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{u.storageBytes ? fmtBytes(u.storageBytes) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        MRR counts active subscriptions at their monthly value (annual plans prorated). Firestore read/write consumption
        lives in the Firebase console — storage above is the file bucket, the main variable cost.
      </p>
    </div>
  );
}

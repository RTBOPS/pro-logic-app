'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, limit, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Megaphone, Copy, Check, Users, DollarSign, Clock, ShieldCheck } from 'lucide-react';

/* Partner program: 10% of every payment from customers you refer, for their
 * first 12 months. Attribution via ?ref= links; commissions are written by
 * the payment webhook, so what partners see here is exactly what was paid. */

const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function PartnersPage() {
  const { user, profile, loading } = useAuth();
  const [aff, setAff] = useState<any | null | undefined>(undefined); // undefined = loading
  const [codeInput, setCodeInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [adminData, setAdminData] = useState<any | null>(null);
  const [marking, setMarking] = useState('');

  // Find my partner profile
  useEffect(() => {
    if (!user) { if (!loading) setAff(null); return; }
    (async () => {
      try {
        const q = await getDocs(query(collection(db, 'affiliates'), where('uid', '==', user.uid), limit(1)));
        if (q.empty) { setAff(null); return; }
        const d = q.docs[0];
        setAff({ code: d.id, ...d.data() });
      } catch { setAff(null); }
    })();
  }, [user, loading]);

  // Load my referrals + commissions
  useEffect(() => {
    if (!aff?.code) return;
    (async () => {
      try {
        const r = await getDocs(query(collection(db, 'affiliates', aff.code, 'referrals'), orderBy('at', 'desc'), limit(100)));
        setReferrals(r.docs.map(d => d.data()));
      } catch {}
      try {
        const c = await getDocs(query(collection(db, 'affiliates', aff.code, 'commissions'), orderBy('created', 'desc'), limit(200)));
        setCommissions(c.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
    })();
  }, [aff?.code]);

  // Owner-only admin view (the API decides; 403 for everyone else)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/affiliates', { headers: { Authorization: `Bearer ${idToken}` } });
        if (res.ok) setAdminData(await res.json());
      } catch {}
    })();
  }, [user]);

  const join = async () => {
    if (!user) return;
    const code = codeInput.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,24}$/.test(code)) { setJoinError('3–24 characters: letters, numbers and dashes.'); return; }
    setJoining(true); setJoinError('');
    try {
      const existing = await getDoc(doc(db, 'affiliates', code));
      if (existing.exists()) { setJoinError('That code is taken — try another.'); setJoining(false); return; }
      const data = {
        uid: user.uid,
        name: profile?.displayName || '',
        email: profile?.email || user.email || '',
        active: true,
        created: new Date().toISOString(),
      };
      await setDoc(doc(db, 'affiliates', code), data);
      setAff({ code, ...data });
    } catch (e: any) {
      setJoinError(e?.message || 'Could not create your code.');
    } finally { setJoining(false); }
  };

  const link = aff ? `${typeof window !== 'undefined' ? window.location.origin : 'https://pro-logic.studio'}/?ref=${aff.code}` : '';
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const pending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.commission || 0), 0);
  const paidTotal = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.commission || 0), 0);

  const markPaid = async (code: string) => {
    if (!user || !confirm(`Mark ALL pending commissions for "${code}" as paid?`)) return;
    setMarking(code);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action: 'mark_paid', code }),
      });
      const data = await res.json();
      if (data.ok) {
        const refreshed = await fetch('/api/affiliates', { headers: { Authorization: `Bearer ${idToken}` } });
        if (refreshed.ok) setAdminData(await refreshed.json());
      } else alert(data.error || 'Failed');
    } finally { setMarking(''); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partner Program</h1>
        <p className="text-gray-500 text-sm">Earn 10% of every payment from customers you bring, for their first 12 months.</p>
      </div>

      {aff === undefined && <div className="text-sm text-gray-400">Loading…</div>}

      {aff === null && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg">
          <div className="inline-flex p-3 rounded-2xl bg-amber-50 text-amber-500 mb-3"><Megaphone size={22} /></div>
          <h2 className="font-semibold text-gray-900 mb-1">Become a partner</h2>
          <p className="text-sm text-gray-500 mb-4">
            Pick your referral code. You'll get a personal link — anyone who signs up through it and
            subscribes earns you <strong>10% of everything they pay for 12 months</strong>, tracked
            automatically from real payments. Payouts monthly via PayPal.
          </p>
          <div className="flex gap-2">
            <div className="flex items-center border border-gray-200 rounded-xl px-3 flex-1">
              <span className="text-sm text-gray-400">pro-logic.studio/?ref=</span>
              <input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="carol"
                className="flex-1 py-2 text-sm focus:outline-none min-w-0" />
            </div>
            <button onClick={join} disabled={joining} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-black disabled:opacity-40">
              {joining ? 'Creating…' : 'Join'}
            </button>
          </div>
          {joinError && <p className="text-xs text-red-500 mt-2">{joinError}</p>}
        </div>
      )}

      {aff && (
        <div className="space-y-4">
          <div className="bg-zinc-950 rounded-2xl p-5 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="text-[11px] uppercase tracking-widest text-amber-400 font-semibold">Your referral link</div>
              <div className="text-white font-mono text-sm mt-1 break-all">{link}</div>
            </div>
            <button onClick={copyLink} className="flex items-center gap-1.5 bg-amber-400 text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-300">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Sign-ups', v: String(referrals.length), icon: Users },
              { label: 'Conversions', v: String(new Set(commissions.map(c => c.buyer_uid)).size), icon: ShieldCheck },
              { label: 'Pending', v: money(pending), icon: Clock },
              { label: 'Paid out', v: money(paidTotal), icon: DollarSign },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <s.icon size={16} className="text-amber-500 mb-1" />
                <div className="text-xl font-bold text-gray-900 tabular-nums">{s.v}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Commissions</div>
            {commissions.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                No commissions yet. Share your link — when someone you referred pays, it shows up here automatically.
              </div>
            )}
            {commissions.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-b-0 text-sm">
                <div className="flex-1 min-w-[140px]">
                  <span className="text-gray-800">{c.buyer_label}</span>
                  <span className="text-gray-400 text-xs ml-2 capitalize">{c.plan}{c.source === 'event_pass' ? ' (event pass)' : ''}</span>
                </div>
                <div className="text-gray-500 text-xs">{c.created ? new Date(c.created).toLocaleDateString('en-US') : ''}</div>
                <div className="text-gray-500 tabular-nums">{money(c.amount)}</div>
                <div className="font-semibold text-gray-900 tabular-nums">→ {money(c.commission)}</div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>

          {referrals.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Sign-ups from your link</div>
              {referrals.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 last:border-b-0 text-sm">
                  <span className="text-gray-700">{r.name || 'New user'}</span>
                  <span className="text-xs text-gray-400">{r.at ? new Date(r.at).toLocaleDateString('en-US') : ''}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Commissions are recorded automatically from confirmed payments (10% of each payment during the
            customer's first 12 months, before payment-processor fees and taxes). Payouts are sent monthly
            to your PayPal. Self-referrals don't count.
          </p>
        </div>
      )}

      {/* Owner admin panel */}
      {adminData?.affiliates && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Program admin</h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {adminData.affiliates.length === 0 && <div className="p-6 text-sm text-gray-500 text-center">No partners yet.</div>}
            {adminData.affiliates.map((a: any) => (
              <div key={a.code} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 text-sm">
                <div className="flex-1 min-w-[160px]">
                  <span className="font-mono font-semibold text-gray-900">{a.code}</span>
                  <span className="text-gray-500 ml-2">{a.name}</span>
                  <div className="text-xs text-gray-400">{a.email} · {a.signups} sign-ups</div>
                </div>
                <div className="text-xs text-gray-500">Pending <span className="font-semibold text-amber-600 tabular-nums">{money(a.pending)}</span></div>
                <div className="text-xs text-gray-500">Paid <span className="font-semibold text-green-700 tabular-nums">{money(a.paid)}</span></div>
                <button
                  onClick={() => markPaid(a.code)}
                  disabled={marking === a.code || a.pending === 0}
                  className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black disabled:opacity-30"
                >
                  {marking === a.code ? 'Marking…' : 'Mark paid'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Send each partner their pending total via PayPal, then hit "Mark paid".</p>
        </div>
      )}
    </div>
  );
}

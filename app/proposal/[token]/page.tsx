'use client';

import { useEffect, useState, use } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, XCircle, FileText } from 'lucide-react';

/* Public proposal page — the client opens the unguessable link, reviews the
   quote and accepts or declines. No account needed. */
export default function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>('loading');
  const [snap, setSnap] = useState<any>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'proposal_tokens', token))
      .then(s => {
        if (!s.exists() || !s.data()?.snapshot) { setStatus('not_found'); return; }
        setSnap(s.data()!.snapshot);
        setResponse(s.data()!.response || null);
        setStatus('found');
      })
      .catch(() => setStatus('not_found'));
  }, [token]);

  const respond = async (r: 'accepted' | 'declined') => {
    setResponding(true);
    try {
      await updateDoc(doc(db, 'proposal_tokens', token), { response: r, responded_at: serverTimestamp() });
      setResponse(r);
    } catch {
      alert('Could not record your response — please try again.');
    } finally { setResponding(false); }
  };

  const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading proposal…</div>;
  if (status === 'not_found') return <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">This proposal link is invalid or has been removed.</div>;

  const total = snap.total ?? (snap.items || []).reduce((s: number, it: any) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-zinc-950 text-white px-6 py-5">
            <div className="text-[11px] uppercase tracking-widest text-amber-400 font-semibold">{snap.company_name}</div>
            <h1 className="text-xl font-bold mt-1">{snap.title}</h1>
            <div className="text-sm text-zinc-400 mt-0.5">
              Proposal {snap.number}{snap.client_name ? ` · for ${snap.client_name}` : ''}{snap.production_name ? ` · ${snap.production_name}` : ''}
            </div>
          </div>

          <div className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-200">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(snap.items || []).map((it: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2.5 text-gray-800">{it.desc}</td>
                    <td className="py-2.5 text-right text-gray-600 tabular-nums">{it.qty}</td>
                    <td className="py-2.5 text-right text-gray-600 tabular-nums">{money(Number(it.rate) || 0)}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900 tabular-nums">{money((Number(it.qty) || 0) * (Number(it.rate) || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-3">
              <div className="bg-gray-50 rounded-xl px-4 py-2 text-right">
                <div className="text-[11px] uppercase tracking-wider text-gray-400">Total</div>
                <div className="text-2xl font-bold text-gray-900 tabular-nums">{money(total)}</div>
              </div>
            </div>

            {snap.terms && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1 flex items-center gap-1"><FileText size={12} /> Terms</div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{snap.terms}</p>
              </div>
            )}
            {snap.valid_until && <p className="text-xs text-gray-400 mt-4">This proposal is valid until {snap.valid_until}.</p>}

            <div className="mt-6 border-t border-gray-100 pt-5">
              {response ? (
                <div className={`flex items-center gap-2 justify-center py-3 rounded-xl text-sm font-semibold ${response === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {response === 'accepted' ? <CheckCircle size={17} /> : <XCircle size={17} />}
                  {response === 'accepted' ? 'You accepted this proposal. We will be in touch shortly!' : 'You declined this proposal.'}
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => respond('accepted')} disabled={responding}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40">
                    <CheckCircle size={16} /> Accept proposal
                  </button>
                  <button onClick={() => respond('declined')} disabled={responding}
                    className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 disabled:opacity-40">
                    <XCircle size={16} /> Decline
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-center text-[11px] text-gray-400 mt-4">Powered by Pro-Logic Studio</div>
      </div>
    </div>
  );
}

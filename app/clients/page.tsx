'use client';

import { useEffect, useState } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, setDoc, getDoc, collection, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { UpgradeGate } from '@/components/UpgradeGate';
import Modal from '@/components/Modal';
import { generateProposal } from '@/lib/pdf/proposal';
import { Plus, Pencil, Trash2, Mail, Phone, FileText, Link2, Eye, Building2 } from 'lucide-react';

const emptyClient = { name: '', company: '', email: '', phone: '', notes: '' };
const emptyItem = { desc: '', qty: 1, rate: 0 };
const emptyProposal = {
  title: '', client_id: '', production_id: '', valid_until: '',
  items: [{ ...emptyItem }], terms: '', status: 'Draft',
};

const STATUS_STYLE: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-50 text-blue-600',
  Accepted: 'bg-green-50 text-green-700',
  Declined: 'bg-red-50 text-red-600',
};

export default function ClientsPage() {
  return (
    <UpgradeGate feature="Clients & Proposals" requires="producer">
      <ClientsInner />
    </UpgradeGate>
  );
}

function ClientsInner() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: clients } = useData('clients');
  const { data: proposals } = useData('proposals');
  const { data: productions } = useData('productions');
  const [tab, setTab] = useState<'clients' | 'proposals'>('clients');
  const [modal, setModal] = useState<'client' | 'proposal' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [cForm, setCForm] = useState(emptyClient);
  const [pForm, setPForm] = useState<any>(emptyProposal);
  const [company, setCompany] = useState<any>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    getDoc(doc(db, 'users', uid, 'company', 'profile')).then(s => { if (s.exists()) setCompany(s.data()); });
  }, [namespace]);

  // Pull client responses from shared proposal tokens back into proposal status
  useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    proposals.forEach(async (p: any) => {
      if (!p.token || !['Sent'].includes(p.status)) return;
      try {
        const t = await getDoc(doc(db, 'proposal_tokens', p.token));
        const resp = t.data()?.response;
        if (resp === 'accepted') await updateDoc(doc(db, 'users', uid, 'proposals', p.id), { status: 'Accepted' });
        if (resp === 'declined') await updateDoc(doc(db, 'users', uid, 'proposals', p.id), { status: 'Declined' });
      } catch {}
    });
  }, [proposals.length]);

  const clientOf = (p: any) => clients.find((c: any) => c.id === p.client_id);
  const prodOf = (p: any) => productions.find((x: any) => x.id === p.production_id);
  const totalOf = (p: any) => (p.items || []).reduce((s: number, it: any) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const nextNumber = () => {
    const nums = proposals.map((p: any) => parseInt(String(p.number || '').replace(/\D/g, ''), 10)).filter((n: number) => !isNaN(n));
    return `PRO-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
  };

  // ── Clients CRUD ──
  const saveClient = async () => {
    const uid = getUid();
    if (!uid || !cForm.name.trim()) return;
    if (editId) await updateDoc(doc(db, 'users', uid, 'clients', editId), { ...cForm });
    else await addDoc(collection(db, 'users', uid, 'clients'), { ...cForm, created: serverTimestamp() });
    setModal(null); setEditId(null);
  };
  const deleteClient = async (id: string) => {
    const uid = getUid();
    if (!uid || !confirm('Delete this client?')) return;
    await deleteDoc(doc(db, 'users', uid, 'clients', id));
  };

  // ── Proposals CRUD ──
  const saveProposal = async () => {
    const uid = getUid();
    if (!uid || !pForm.title.trim() || !pForm.client_id) { alert('Title and client are required.'); return; }
    const data = { ...pForm, items: pForm.items.filter((it: any) => it.desc.trim()) };
    if (editId) await updateDoc(doc(db, 'users', uid, 'proposals', editId), data);
    else await addDoc(collection(db, 'users', uid, 'proposals'), { ...data, number: nextNumber(), created: serverTimestamp() });
    setModal(null); setEditId(null);
  };
  const deleteProposal = async (p: any) => {
    const uid = getUid();
    if (!uid || !confirm(`Delete proposal ${p.number}?`)) return;
    if (p.token) { try { await deleteDoc(doc(db, 'proposal_tokens', p.token)); } catch {} }
    await deleteDoc(doc(db, 'users', uid, 'proposals', p.id));
  };

  const pdf = async (p: any, preview: boolean) => {
    setBusy(p.id);
    try {
      await generateProposal({
        production: prodOf(p) || {}, crew: [], locations: [], inventory: [],
        company, preview,
        proposal: { ...p, date: p.created?.seconds ? new Date(p.created.seconds * 1000).toLocaleDateString('en-US') : undefined },
        client: clientOf(p) || {},
      } as any);
    } catch (e: any) {
      alert(`Error generating PDF: ${e?.message || e}`);
    } finally { setBusy(''); }
  };

  const share = async (p: any) => {
    const uid = getUid();
    if (!uid) return;
    setBusy(p.id);
    try {
      const token = p.token || (crypto.randomUUID() + crypto.randomUUID().slice(0, 8)).replace(/-/g, '');
      const client = clientOf(p) || {};
      await setDoc(doc(db, 'proposal_tokens', token), {
        uid, proposalId: p.id,
        snapshot: {
          number: p.number, title: p.title, items: p.items || [], terms: p.terms || '',
          valid_until: p.valid_until || '', total: totalOf(p),
          client_name: [client.name, client.company].filter(Boolean).join(' — '),
          production_name: prodOf(p)?.name || '',
          company_name: company?.name || 'Pro-Logic Studio',
        },
        response: null, responded_at: null, created: serverTimestamp(),
      }, { merge: true });
      await updateDoc(doc(db, 'users', uid, 'proposals', p.id), { token, status: p.status === 'Draft' ? 'Sent' : p.status });
      const url = `${window.location.origin}/proposal/${token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(`Share link copied:\n${url}\n\nThe client can review and accept or decline — the status updates here automatically.`);
    } catch (e: any) {
      alert(`Could not create the link: ${e?.message || e}`);
    } finally { setBusy(''); }
  };

  const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900';
  const label = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients & Proposals</h1>
          <p className="text-gray-500 text-sm">Your client book, and quotes they can accept online.</p>
        </div>
        <button
          onClick={() => {
            setEditId(null);
            if (tab === 'clients') { setCForm(emptyClient); setModal('client'); }
            else { setPForm({ ...emptyProposal, items: [{ ...emptyItem }] }); setModal('proposal'); }
          }}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-black"
        >
          <Plus size={15} /> {tab === 'clients' ? 'New client' : 'New proposal'}
        </button>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {(['clients', 'proposals'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'clients' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.length === 0 && <div className="col-span-full bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500 text-sm">No clients yet — add your first one.</div>}
          {clients.map((c: any) => (
            <div key={c.id} className="group bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  {c.company && <div className="text-sm text-gray-500 flex items-center gap-1"><Building2 size={12} />{c.company}</div>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setCForm({ ...emptyClient, ...c }); setEditId(c.id); setModal('client'); }} className="p-1.5 text-gray-400 hover:text-gray-900"><Pencil size={14} /></button>
                  <button onClick={() => deleteClient(c.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {c.email && <div className="flex items-center gap-1.5"><Mail size={13} className="text-gray-400" />{c.email}</div>}
                {c.phone && <div className="flex items-center gap-1.5"><Phone size={13} className="text-gray-400" />{c.phone}</div>}
                {c.notes && <div className="text-xs text-gray-400 mt-1">{c.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'proposals' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {proposals.length === 0 && <div className="p-10 text-center text-gray-500 text-sm">No proposals yet — create one and share the link with your client.</div>}
          {proposals
            .slice()
            .sort((a: any, b: any) => (b.created?.seconds || 0) - (a.created?.seconds || 0))
            .map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
                <div className="font-mono text-xs text-gray-500 w-16">{p.number}</div>
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium text-gray-900 text-sm">{p.title}</div>
                  <div className="text-xs text-gray-500">{clientOf(p)?.name || 'No client'}{prodOf(p) ? ` · ${prodOf(p).name}` : ''}</div>
                </div>
                <div className="text-sm font-semibold text-gray-900 tabular-nums">{money(totalOf(p))}</div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] || STATUS_STYLE.Draft}`}>{p.status}</span>
                <div className="flex gap-1">
                  <button title="Preview PDF" onClick={() => pdf(p, true)} disabled={busy === p.id} className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-40"><Eye size={15} /></button>
                  <button title="Download PDF" onClick={() => pdf(p, false)} disabled={busy === p.id} className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-40"><FileText size={15} /></button>
                  <button title="Share link" onClick={() => share(p)} disabled={busy === p.id} className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-40"><Link2 size={15} /></button>
                  <button title="Edit" onClick={() => { setPForm({ ...emptyProposal, ...p, items: (p.items?.length ? p.items : [{ ...emptyItem }]).map((it: any) => ({ ...it })) }); setEditId(p.id); setModal('proposal'); }} className="p-1.5 text-gray-400 hover:text-gray-900"><Pencil size={15} /></button>
                  <button title="Delete" onClick={() => deleteProposal(p)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Client modal */}
      {modal === 'client' && (
        <Modal title={editId ? 'Edit client' : 'New client'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className={label}>Name *</label><input className={input} value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} /></div>
            <div><label className={label}>Company</label><input className={input} value={cForm.company} onChange={e => setCForm({ ...cForm, company: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Email</label><input className={input} value={cForm.email} onChange={e => setCForm({ ...cForm, email: e.target.value })} /></div>
              <div><label className={label}>Phone</label><input className={input} value={cForm.phone} onChange={e => setCForm({ ...cForm, phone: e.target.value })} /></div>
            </div>
            <div><label className={label}>Notes</label><textarea rows={2} className={input} value={cForm.notes} onChange={e => setCForm({ ...cForm, notes: e.target.value })} /></div>
            <button onClick={saveClient} className="w-full bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-black">Save client</button>
          </div>
        </Modal>
      )}

      {/* Proposal modal */}
      {modal === 'proposal' && (
        <Modal title={editId ? `Edit proposal` : 'New proposal'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className={label}>Title *</label><input className={input} placeholder="Live broadcast package — 12 games" value={pForm.title} onChange={e => setPForm({ ...pForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Client *</label>
                <select className={input} value={pForm.client_id} onChange={e => setPForm({ ...pForm, client_id: e.target.value })}>
                  <option value="">Select…</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Production</label>
                <select className={input} value={pForm.production_id} onChange={e => setPForm({ ...pForm, production_id: e.target.value })}>
                  <option value="">None</option>
                  {productions.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className={label}>Valid until</label><input type="date" className={input} value={pForm.valid_until} onChange={e => setPForm({ ...pForm, valid_until: e.target.value })} /></div>
            <div>
              <label className={label}>Line items</label>
              <div className="space-y-2">
                {pForm.items.map((it: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input className={input} placeholder="Description" value={it.desc} onChange={e => { const items = [...pForm.items]; items[i] = { ...it, desc: e.target.value }; setPForm({ ...pForm, items }); }} />
                    <input type="number" className={`${input} !w-16`} placeholder="Qty" value={it.qty} onChange={e => { const items = [...pForm.items]; items[i] = { ...it, qty: Number(e.target.value) }; setPForm({ ...pForm, items }); }} />
                    <input type="number" className={`${input} !w-24`} placeholder="Rate" value={it.rate} onChange={e => { const items = [...pForm.items]; items[i] = { ...it, rate: Number(e.target.value) }; setPForm({ ...pForm, items }); }} />
                    <button onClick={() => setPForm({ ...pForm, items: pForm.items.filter((_: any, j: number) => j !== i) })} className="text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setPForm({ ...pForm, items: [...pForm.items, { ...emptyItem }] })} className="mt-2 text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"><Plus size={12} /> Add item</button>
              <div className="text-right text-sm font-semibold text-gray-900 mt-1">
                Total: {money(pForm.items.reduce((s: number, it: any) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0))}
              </div>
            </div>
            <div><label className={label}>Terms</label><textarea rows={3} className={input} placeholder="50% deposit to book the dates. Balance due on delivery…" value={pForm.terms} onChange={e => setPForm({ ...pForm, terms: e.target.value })} /></div>
            <button onClick={saveProposal} className="w-full bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-black">Save proposal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

'use client';

import { UpgradeGate } from '@/components/UpgradeGate';
import { useState, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { Plus, Trash2, Pencil, ExternalLink, Upload } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';

const KINDS = [
  ['insurance', 'Insurance certificate'],
  ['permit', 'Filming permit'],
  ['license', 'License (music, drone…)'],
  ['contract', 'Signed contract'],
  ['other', 'Other'],
] as const;

const EMPTY = { name: '', kind: 'insurance', production_id: '', expires: '', notes: '', url: '', filename: '' };

function statusOf(expires: string): ['ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'NO EXPIRY', string] {
  if (!expires) return ['NO EXPIRY', 'bg-gray-100 text-gray-500'];
  const days = Math.ceil((new Date(expires + 'T23:59:59').getTime() - Date.now()) / 86400000);
  if (days < 0) return ['EXPIRED', 'bg-red-100 text-red-700'];
  if (days <= 30) return ['EXPIRING', 'bg-amber-100 text-amber-700'];
  return ['ACTIVE', 'bg-green-100 text-green-700'];
}

export default function CompliancePage() {
  const namespace = useNamespace();
  const getUid = () => namespace ?? auth.currentUser?.uid ?? null;
  const { data: productions } = useData('productions');
  const { data: docs } = useData('compliance_docs');

  const [prodFilter, setProdFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = docs
    .filter((d: any) => !prodFilter || d.production_id === prodFilter)
    .sort((a: any, b: any) => String(a.expires || '9999').localeCompare(String(b.expires || '9999')));

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid;
    if (!file || !uid) return;
    setUploading(true);
    try {
      const path = `compliance/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setForm(f => ({ ...f, url, filename: file.name, name: f.name || file.name.replace(/\.[^.]+$/, '') }));
    } catch (err: any) { alert('Upload failed: ' + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const saveDoc = async () => {
    const uid = getUid(); if (!uid || !form.name) return;
    if (editId) await updateDoc(doc(db, 'users', uid, 'compliance_docs', editId), form);
    else await addDoc(collection(db, 'users', uid, 'compliance_docs'), { ...form, added: new Date().toISOString().split('T')[0] });
    setModal(false); setEditId(null); setForm({ ...EMPTY });
  };
  const del = async (id: string) => { const uid = getUid(); if (uid) await deleteDoc(doc(db, 'users', uid, 'compliance_docs', id)); };

  const inp = 'w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-gray-400';
  const expSoon = docs.filter((d: any) => statusOf(d.expires)[0] === 'EXPIRING').length;
  const expired = docs.filter((d: any) => statusOf(d.expires)[0] === 'EXPIRED').length;

  return (
    <UpgradeGate feature="Permits & Insurance" requires="producer">
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Permits & Insurance" subtitle="Certificates, permits and licenses — tracked with expiry alerts">
        <select value={prodFilter} onChange={e => setProdFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">All productions</option>
          {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => { setEditId(null); setForm({ ...EMPTY, production_id: prodFilter }); setModal(true); }}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700">
          <Plus size={15} /> Add document
        </button>
      </PageHeader>

      {(expSoon > 0 || expired > 0) && (
        <div className="mb-4 flex gap-3">
          {expired > 0 && <div className="flex-1 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm font-semibold">⚠ {expired} expired document{expired > 1 ? 's' : ''}</div>}
          {expSoon > 0 && <div className="flex-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2.5 text-sm font-semibold">⏳ {expSoon} expiring within 30 days</div>}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="px-4 py-2 text-left">Document</th><th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Production</th><th className="px-2 py-2 text-left">Expires</th><th className="px-2 py-2 text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((d: any) => {
              const [st, cls] = statusOf(d.expires);
              const prod = productions.find((p: any) => p.id === d.production_id);
              return (
                <tr key={d.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-gray-800">{d.name}</div>
                    {d.notes && <div className="text-xs text-gray-400">{d.notes}</div>}
                  </td>
                  <td className="px-2 py-2.5 text-gray-600">{KINDS.find(k => k[0] === d.kind)?.[1] || d.kind}</td>
                  <td className="px-2 py-2.5 text-gray-500">{prod?.name || '—'}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap text-gray-600">{d.expires || '—'}</td>
                  <td className="px-2 py-2.5"><span className={`text-[11px] font-black px-2 py-1 rounded-full ${cls}`}>{st}</span></td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap">
                    {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="inline-block text-gray-400 hover:text-blue-600 p-1 align-middle"><ExternalLink size={14} /></a>}
                    <button onClick={() => { setEditId(d.id); setForm({ ...EMPTY, ...d }); setModal(true); }} className="text-gray-400 hover:text-gray-700 p-1"><Pencil size={14} /></button>
                    <button onClick={() => del(d.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-12 text-sm">Nothing tracked yet — add your first certificate or permit.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit document' : 'Add document'} onClose={() => { setModal(false); setEditId(null); }}>
          <div className="space-y-3">
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50">
              <Upload size={15} /> {uploading ? 'Uploading…' : form.filename ? form.filename : 'Upload file (PDF / image)'}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={upload} />
            <input placeholder="Document name (e.g. COI — General Liability)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className={inp}>
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" value={form.expires} onChange={e => setForm(f => ({ ...f, expires: e.target.value }))} className={inp} title="Expiry date" />
            </div>
            <select value={form.production_id} onChange={e => setForm(f => ({ ...f, production_id: e.target.value }))} className={inp}>
              <option value="">— production (optional) —</option>
              {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input placeholder="Notes (policy #, issuing authority…)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
            <button onClick={saveDoc} className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-gray-700">{editId ? 'Save changes' : 'Add'}</button>
          </div>
        </Modal>
      )}
    </div>
    </UpgradeGate>
  );
}

'use client';

import { UpgradeGate } from '@/components/UpgradeGate';
import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { Plus, Trash2, Pencil } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';

const BUDGET_CATEGORIES = [
  'Above the Line', 'Production', 'Camera', 'Lighting & Grip', 'Sound',
  'Art / Set', 'Wardrobe & HMU', 'Locations', 'Travel & Transport',
  'Post-Production', 'Insurance & Legal', 'Contingency', 'Other',
];
const PO_STATUSES = ['Draft', 'Sent', 'Approved', 'Received', 'Paid'] as const;
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const EMPTY_LINE = { production_id: '', category: 'Production', item: '', qty: '1', rate: '', actual: '', notes: '' };
const EMPTY_DOC = { production_id: '', kind: 'po', number: '', vendor: '', description: '', amount: '', status: 'Draft', date: '' };

export default function BudgetPage() {
  const namespace = useNamespace();
  const getUid = () => namespace ?? auth.currentUser?.uid ?? null;
  const { data: productions } = useData('productions');
  const { data: lines } = useData('budget_lines');
  const { data: fdocs } = useData('finance_docs');

  const [tab, setTab] = useState<'budget' | 'orders'>('budget');
  const [prodFilter, setProdFilter] = useState('');
  const [modal, setModal] = useState<null | 'line' | 'doc'>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState({ ...EMPTY_LINE });
  const [docForm, setDocForm] = useState({ ...EMPTY_DOC });

  const fLines = lines.filter((l: any) => !prodFilter || l.production_id === prodFilter);
  const fDocs = fdocs.filter((d: any) => !prodFilter || d.production_id === prodFilter);

  const est = (l: any) => (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0);
  const act = (l: any) => parseFloat(l.actual) || 0;
  const totalEst = fLines.reduce((s: number, l: any) => s + est(l), 0);
  const totalAct = fLines.reduce((s: number, l: any) => s + act(l), 0);

  const nextNumber = (kind: string) => {
    const prefix = kind === 'po' ? 'PO' : 'INV';
    const nums = fdocs.filter((d: any) => d.kind === kind).map((d: any) => parseInt(String(d.number).replace(/\D/g, ''), 10) || 0);
    return `${prefix}-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  };

  const saveLine = async () => {
    const uid = getUid(); if (!uid || !lineForm.item) return;
    const payload = { ...lineForm, production_id: lineForm.production_id || prodFilter };
    if (editId) await updateDoc(doc(db, 'users', uid, 'budget_lines', editId), payload);
    else await addDoc(collection(db, 'users', uid, 'budget_lines'), payload);
    setModal(null); setEditId(null); setLineForm({ ...EMPTY_LINE });
  };
  const saveDoc = async () => {
    const uid = getUid(); if (!uid || !docForm.vendor) return;
    const payload = { ...docForm, number: docForm.number || nextNumber(docForm.kind), production_id: docForm.production_id || prodFilter, date: docForm.date || new Date().toISOString().split('T')[0] };
    if (editId) await updateDoc(doc(db, 'users', uid, 'finance_docs', editId), payload);
    else await addDoc(collection(db, 'users', uid, 'finance_docs'), payload);
    setModal(null); setEditId(null); setDocForm({ ...EMPTY_DOC });
  };
  const del = async (col: string, id: string) => { const uid = getUid(); if (uid) await deleteDoc(doc(db, 'users', uid, col, id)); };
  const setStatus = async (id: string, status: string) => { const uid = getUid(); if (uid) await updateDoc(doc(db, 'users', uid, 'finance_docs', id), { status }); };

  const inp = 'w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-gray-400';

  return (
    <UpgradeGate feature="Budget & Finance" requires="producer">
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Budget & Finance" subtitle="Estimates vs actuals, purchase orders, invoices">
        <select value={prodFilter} onChange={e => setProdFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">All productions</option>
          {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </PageHeader>

      <div className="flex items-center gap-2 mb-5">
        {(['budget', 'orders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'budget' ? 'Budget' : 'POs & Invoices'}
          </button>
        ))}
        <button onClick={() => { setEditId(null); if (tab === 'budget') { setLineForm({ ...EMPTY_LINE, production_id: prodFilter }); setModal('line'); } else { setDocForm({ ...EMPTY_DOC, production_id: prodFilter }); setModal('doc'); } }}
          className="ml-auto flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700">
          <Plus size={15} /> {tab === 'budget' ? 'Add line' : 'Add PO / invoice'}
        </button>
      </div>

      {tab === 'budget' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {([['Estimated', totalEst, 'text-gray-900'], ['Actual', totalAct, totalAct > totalEst ? 'text-red-600' : 'text-green-700'], ['Variance', totalEst - totalAct, totalEst - totalAct < 0 ? 'text-red-600' : 'text-green-700']] as [string, number, string][]).map(([lab, val, cls]) => (
              <div key={lab} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-[11px] uppercase tracking-widest text-gray-400 font-bold">{lab}</div>
                <div className={`text-2xl font-black mt-1 ${cls}`}>{money(val)}</div>
              </div>
            ))}
          </div>
          {BUDGET_CATEGORIES.map(cat => {
            const rows = fLines.filter((l: any) => l.category === cat);
            if (rows.length === 0) return null;
            const ce = rows.reduce((s: number, l: any) => s + est(l), 0);
            const ca = rows.reduce((s: number, l: any) => s + act(l), 0);
            return (
              <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-800">{cat}</span>
                  <span className="text-xs text-gray-500">est {money(ce)} · actual {money(ca)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((l: any) => (
                      <tr key={l.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2">{l.item}{l.notes && <span className="text-xs text-gray-400 ml-2">{l.notes}</span>}</td>
                        <td className="px-2 py-2 text-right text-gray-500 whitespace-nowrap">{l.qty} × {money(parseFloat(l.rate) || 0)}</td>
                        <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{money(est(l))}</td>
                        <td className={`px-2 py-2 text-right whitespace-nowrap ${act(l) > est(l) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{l.actual ? money(act(l)) : '—'}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <button onClick={() => { setEditId(l.id); setLineForm({ ...EMPTY_LINE, ...l }); setModal('line'); }} className="text-gray-400 hover:text-gray-700 p-1"><Pencil size={14} /></button>
                          <button onClick={() => del('budget_lines', l.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {fLines.length === 0 && <p className="text-sm text-gray-400 text-center py-10">No budget lines yet — add the first one.</p>}
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr><th className="px-4 py-2 text-left">#</th><th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Vendor</th><th className="px-2 py-2 text-left">Description</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Status</th><th></th></tr>
            </thead>
            <tbody>
              {[...fDocs].sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))).map((d: any) => (
                <tr key={d.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2 font-mono font-semibold">{d.number}</td>
                  <td className="px-2 py-2 uppercase text-xs font-bold text-gray-500">{d.kind}</td>
                  <td className="px-2 py-2">{d.vendor}</td>
                  <td className="px-2 py-2 text-gray-600">{d.description}</td>
                  <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{money(parseFloat(d.amount) || 0)}</td>
                  <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{d.date}</td>
                  <td className="px-2 py-2">
                    <select value={d.status} onChange={e => setStatus(d.id, e.target.value)}
                      className={`text-xs font-bold rounded-lg px-2 py-1 border ${d.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : d.status === 'Draft' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {PO_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button onClick={() => { setEditId(d.id); setDocForm({ ...EMPTY_DOC, ...d }); setModal('doc'); }} className="text-gray-400 hover:text-gray-700 p-1"><Pencil size={14} /></button>
                    <button onClick={() => del('finance_docs', d.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {fDocs.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-10 text-sm">No purchase orders or invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'line' && (
        <Modal title={editId ? 'Edit budget line' : 'Add budget line'} onClose={() => { setModal(null); setEditId(null); }}>
          <div className="space-y-3">
            <select value={lineForm.production_id} onChange={e => setLineForm(f => ({ ...f, production_id: e.target.value }))} className={inp}>
              <option value="">— production —</option>
              {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={lineForm.category} onChange={e => setLineForm(f => ({ ...f, category: e.target.value }))} className={inp}>
              {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Item (e.g. Camera package rental)" value={lineForm.item} onChange={e => setLineForm(f => ({ ...f, item: e.target.value }))} className={inp} />
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="Qty / days" value={lineForm.qty} onChange={e => setLineForm(f => ({ ...f, qty: e.target.value }))} className={inp} />
              <input placeholder="Rate $" value={lineForm.rate} onChange={e => setLineForm(f => ({ ...f, rate: e.target.value }))} className={inp} />
              <input placeholder="Actual $ (later)" value={lineForm.actual} onChange={e => setLineForm(f => ({ ...f, actual: e.target.value }))} className={inp} />
            </div>
            <input placeholder="Notes" value={lineForm.notes} onChange={e => setLineForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
            <button onClick={saveLine} className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-gray-700">{editId ? 'Save changes' : 'Add line'}</button>
          </div>
        </Modal>
      )}
      {modal === 'doc' && (
        <Modal title={editId ? 'Edit PO / invoice' : 'New PO / invoice'} onClose={() => { setModal(null); setEditId(null); }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={docForm.kind} onChange={e => setDocForm(f => ({ ...f, kind: e.target.value }))} className={inp}>
                <option value="po">Purchase Order</option>
                <option value="invoice">Invoice (received)</option>
              </select>
              <input placeholder={`Number (auto: ${nextNumber(docForm.kind)})`} value={docForm.number} onChange={e => setDocForm(f => ({ ...f, number: e.target.value }))} className={inp} />
            </div>
            <select value={docForm.production_id} onChange={e => setDocForm(f => ({ ...f, production_id: e.target.value }))} className={inp}>
              <option value="">— production —</option>
              {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input placeholder="Vendor" value={docForm.vendor} onChange={e => setDocForm(f => ({ ...f, vendor: e.target.value }))} className={inp} />
            <input placeholder="Description" value={docForm.description} onChange={e => setDocForm(f => ({ ...f, description: e.target.value }))} className={inp} />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Amount $" value={docForm.amount} onChange={e => setDocForm(f => ({ ...f, amount: e.target.value }))} className={inp} />
              <input type="date" value={docForm.date} onChange={e => setDocForm(f => ({ ...f, date: e.target.value }))} className={inp} />
            </div>
            <button onClick={saveDoc} className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-gray-700">{editId ? 'Save changes' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
    </UpgradeGate>
  );
}

'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { useData } from '@/hooks/useData';
import { Printer, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

interface ReturnRow { assetId: string; equipment: string; qtyReturned: string; condition: string; }
const emptyRow = (): ReturnRow => ({ assetId: '', equipment: '', qtyReturned: '1', condition: 'Excellent' });
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Damaged'];
const FUNCTIONAL_ITEMS = ['Power Up', 'Recording Function', 'Audio Inputs', 'Outputs', 'Battery System', 'Screen / Viewfinder', 'Connectors'];
const DAMAGE_OPTIONS = ['No Damage Found', 'Cosmetic Damage', 'Functional Damage', 'Missing Parts', 'Missing Accessories'];
const ACTION_OPTIONS = ['Return to Inventory', 'Cleaning Required', 'Preventive Maintenance', 'Repair Required', 'Send to Manufacturer', 'Remove from Service', 'Retire Asset'];

export default function ReturnPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [info, setInfo] = useState({ agreementNo: '', dateReturned: '', timeReturned: '', projectName: '', returnedBy: '', inspectedBy: '' });
  const [equipment, setEquipment] = useState<ReturnRow[]>([emptyRow()]);
  const [functional, setFunctional] = useState<Record<string, 'pass' | 'fail' | ''>>({});
  const [funcNotes, setFuncNotes] = useState<Record<string, string>>({});
  const [damage, setDamage] = useState<Record<string, boolean>>({});
  const [detailedFindings, setDetailedFindings] = useState('');
  const [actions, setActions] = useState<Record<string, boolean>>({});
  const [repairCost, setRepairCost] = useState('');
  const [inspectorName, setInspectorName] = useState('');

  const setInfo1 = (k: string, v: string) => setInfo(f => ({ ...f, [k]: v }));
  const addRow = () => setEquipment(r => [...r, emptyRow()]);
  const removeRow = (i: number) => setEquipment(r => r.filter((_, idx) => idx !== i));
  const setRow = (i: number, k: keyof ReturnRow, v: string) =>
    setEquipment(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const save = async () => {
    const uid = getUid();
    if (!uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'equipment_return'), {
        ...info, equipment, functional, funcNotes, damage, detailedFindings, actions, repairCost, inspectorName, createdAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <img src="/logo.png" alt="PRO-LOGIC" className="h-8 object-contain animate-pulse" />
            <Loader2 size={20} className="animate-spin text-gray-700" />
          </div>
        </div>
      )}
      <div className="no-print">
        <PageHeader title="Equipment Return Inspection" subtitle="VIDEO PRODUCTION EQUIPMENT RETURN INSPECTION REPORT">
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
              <Printer size={14} /> Print
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </PageHeader>
      </div>

      <div className="space-y-6 mt-4">
        {/* Return Info */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Return Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[['Rental Agreement No.', 'agreementNo', 'text'], ['Date Returned', 'dateReturned', 'date'], ['Time Returned', 'timeReturned', 'time']].map(([label, key, type]) => (
              <div key={key as string}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input type={type as string} value={(info as any)[key as string]} onChange={e => setInfo1(key as string, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
            ))}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
              <select value={info.projectName} onChange={e => setInfo1('projectName', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black">
                <option value="">Select…</option>
                {productions.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Returned By</label>
              <select value={info.returnedBy} onChange={e => setInfo1('returnedBy', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black">
                <option value="">Select…</option>
                {crew.map((c: any) => <option key={c.id} value={`${c.name} ${c.last_name}`}>{c.name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Inspected By</label>
              <input value={info.inspectedBy} onChange={e => setInfo1('inspectedBy', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
            </div>
          </div>
        </section>

        {/* Returned Equipment */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Returned Equipment Inspection</h2>
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              <Plus size={12} /> Add Row
            </button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Asset ID</th>
                <th className="text-left px-3 py-2">Equipment</th>
                <th className="text-left px-3 py-2 w-20">Qty</th>
                <th className="text-left px-3 py-2">Condition In</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {equipment.map((row, i) => (
                <tr key={i}>
                  {(['assetId', 'equipment'] as const).map(k => (
                    <td key={k} className="px-2 py-1">
                      <input value={row[k]} onChange={e => setRow(i, k, e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black" />
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    <input type="number" min="1" value={row.qtyReturned} onChange={e => setRow(i, 'qtyReturned', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
                  </td>
                  <td className="px-2 py-1">
                    <select value={row.condition} onChange={e => setRow(i, 'condition', e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
                      {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    {equipment.length > 1 && <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Functional Inspection */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Functional Inspection</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Inspection Item</th>
                <th className="px-3 py-2 w-20">Pass</th>
                <th className="px-3 py-2 w-20">Fail</th>
                <th className="text-left px-3 py-2">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {FUNCTIONAL_ITEMS.map(item => (
                <tr key={item} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-700">{item}</td>
                  <td className="px-3 py-2 text-center">
                    <input type="radio" name={`func-${item}`} checked={functional[item] === 'pass'}
                      onChange={() => setFunctional(s => ({ ...s, [item]: 'pass' }))} className="w-4 h-4" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="radio" name={`func-${item}`} checked={functional[item] === 'fail'}
                      onChange={() => setFunctional(s => ({ ...s, [item]: 'fail' }))} className="w-4 h-4" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={funcNotes[item] || ''} onChange={e => setFuncNotes(s => ({ ...s, [item]: e.target.value }))}
                      className="w-full border-b border-gray-200 text-xs px-1 focus:outline-none focus:border-gray-400" placeholder="—" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Damage + Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Damage Assessment</h2>
            <div className="space-y-2">
              {DAMAGE_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!damage[opt]} onChange={e => setDamage(s => ({ ...s, [opt]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300" />
                  {opt}
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Detailed Findings</label>
              <textarea value={detailedFindings} onChange={e => setDetailedFindings(e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none" />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Action Required</h2>
            <div className="space-y-2">
              {ACTION_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!actions[opt]} onChange={e => setActions(s => ({ ...s, [opt]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300" />
                  {opt}
                </label>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Repair Cost ($)</label>
              <input type="number" value={repairCost} onChange={e => setRepairCost(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="0.00" />
            </div>
          </section>
        </div>

        {/* Inspector Signature */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Inspector Signature</h2>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-500 mb-1">Inspector Name</label>
            <input value={inspectorName} onChange={e => setInspectorName(e.target.value)}
              className="w-full border-b-2 border-gray-300 pb-1 text-sm focus:outline-none focus:border-black" placeholder="Name & title" />
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body > div > aside, body > div > div:first-child { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { useData } from '@/hooks/useData';
import { Printer, Save, Plus, Trash2, Loader2, PackagePlus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SignaturePad from '@/components/SignaturePad';
import InventoryPicker from '@/components/InventoryPicker';

interface EquipmentRow {
  assetId: string; category: string; description: string; serialNumber: string; qty: string; condition: string;
}
const emptyRow = (): EquipmentRow => ({ assetId: '', category: '', description: '', serialNumber: '', qty: '1', condition: 'Excellent' });
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const ACCESSORIES = ['Battery', 'Charger', 'Power Supply', 'Media Cards', 'Tripod', 'Case', 'Cables', 'Other'];
const INSPECTION_ITEMS = ['Physical Appearance', 'Power On Test', 'Recording Test', 'Audio Test', 'Connectors', 'LCD/Monitor'];

export default function CheckoutPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const { data: inventory } = useData('inventory');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  };

  const [info, setInfo] = useState({
    agreementNo: '', dateOut: '', timeOut: '', projectName: '', client: '',
    crewMember: '', contactNumber: '', returnDueDate: '',
  });
  const [equipment, setEquipment] = useState<EquipmentRow[]>([emptyRow()]);
  const [accessories, setAccessories] = useState<Record<string, boolean>>({});
  const [otherAccessory, setOtherAccessory] = useState('');
  const [inspection, setInspection] = useState<Record<string, 'pass' | 'fail' | ''>>({});
  const [inspectionNotes, setInspectionNotes] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [issuedBySig, setIssuedBySig] = useState('');
  const [receivedBySig, setReceivedBySig] = useState('');
  const [issuedByName, setIssuedByName] = useState('');
  const [receivedByName, setReceivedByName] = useState('');

  const setInfo1 = (k: string, v: string) => setInfo(f => ({ ...f, [k]: v }));
  const addRow = () => setEquipment(r => [...r, emptyRow()]);
  const removeRow = (i: number) => setEquipment(r => r.filter((_, idx) => idx !== i));
  const setRow = (i: number, k: keyof EquipmentRow, v: string) =>
    setEquipment(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const addFromInventory = (item: any) => {
    setEquipment(r => [...r.filter(row => row.description || row.assetId), {
      assetId: item.item_id || item.id?.slice(-6).toUpperCase() || '',
      category: item.category || '',
      description: [item.name, item.brand, item.model].filter(Boolean).join(' '),
      serialNumber: item.serial_number || '',
      qty: '1',
      condition: item.condition || 'Excellent',
    }]);
  };

  const save = async () => {
    const uid = getUid();
    if (!uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'equipment_checkout'), {
        ...info, equipment, accessories, otherAccessory, inspection, inspectionNotes,
        remarks, issuedByName, issuedBySig, receivedByName, receivedBySig,
        createdAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Loading overlay */}
      {(saving || printing) && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <img src="/logo.png" alt="PRO-LOGIC" className="h-10 object-contain mb-4 opacity-80" />
          <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full animate-[slide_1.2s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-gray-400 mt-3 tracking-wide">{printing ? 'Preparing print…' : 'Saving…'}</p>
          <style>{`@keyframes slide{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`}</style>
        </div>
      )}

      {showPicker && <InventoryPicker inventory={inventory} onSelect={addFromInventory} onClose={() => setShowPicker(false)} />}

      <div className="no-print">
        <PageHeader title="Equipment Check-Out" subtitle="VIDEO PRODUCTION EQUIPMENT CHECK-OUT FORM">
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={printing || saving}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40">
              {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {printing ? 'Preparing…' : 'Print'}
            </button>
            <button onClick={save} disabled={saving || printing}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </PageHeader>
      </div>

      <div className="space-y-6 mt-4">
        {/* Rental Information */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Rental Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Rental Agreement No.', 'agreementNo', 'text'],
              ['Date Out', 'dateOut', 'date'],
              ['Time Out', 'timeOut', 'time'],
              ['Return Due Date', 'returnDueDate', 'date'],
            ].map(([label, key, type]) => (
              <div key={key as string}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input type={type as string} value={(info as any)[key as string]} onChange={e => setInfo1(key as string, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
              <select value={info.projectName} onChange={e => setInfo1('projectName', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black">
                <option value="">Select…</option>
                {productions.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
              <input value={info.client} onChange={e => setInfo1('client', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Crew Member Responsible</label>
              <select value={info.crewMember} onChange={e => setInfo1('crewMember', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black">
                <option value="">Select…</option>
                {crew.map((c: any) => <option key={c.id} value={`${c.name} ${c.last_name}`}>{c.name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Contact Number</label>
              <input value={info.contactNumber} onChange={e => setInfo1('contactNumber', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
            </div>
          </div>
        </section>

        {/* Equipment Issued */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Equipment Issued</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black">
                <PackagePlus size={12} /> From Inventory
              </button>
              <button onClick={addRow}
                className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                <Plus size={12} /> Blank Row
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Asset ID</th>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-left px-3 py-2">Serial Number</th>
                  <th className="text-left px-3 py-2 w-16">Qty</th>
                  <th className="text-left px-3 py-2">Condition Out</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {equipment.map((row, i) => (
                  <tr key={i}>
                    {(['assetId', 'category', 'description', 'serialNumber'] as const).map(k => (
                      <td key={k} className="px-2 py-1">
                        <input value={row[k]} onChange={e => setRow(i, k, e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black" />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <input type="number" min="1" value={row.qty} onChange={e => setRow(i, 'qty', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
                    </td>
                    <td className="px-2 py-1">
                      <select value={row.condition} onChange={e => setRow(i, 'condition', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
                        {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 text-center">
                      {equipment.length > 1 && (
                        <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Accessories */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Accessories Included</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ACCESSORIES.map(a => (
              <label key={a} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!accessories[a]} onChange={e => setAccessories(acc => ({ ...acc, [a]: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300" />
                {a === 'Other' ? (
                  <span className="flex items-center gap-1">Other:
                    <input value={otherAccessory} onChange={e => setOtherAccessory(e.target.value)}
                      className="border-b border-gray-300 text-xs px-1 w-20 focus:outline-none" placeholder="specify" />
                  </span>
                ) : a}
              </label>
            ))}
          </div>
        </section>

        {/* Pre-Rental Inspection */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Pre-Rental Condition Verification</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Inspection Item</th>
                <th className="px-3 py-2 w-20">Pass</th>
                <th className="px-3 py-2 w-20">Fail</th>
                <th className="text-left px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {INSPECTION_ITEMS.map(item => (
                <tr key={item} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-700">{item}</td>
                  <td className="px-3 py-2 text-center">
                    <input type="radio" name={`inspection-${item}`} checked={inspection[item] === 'pass'}
                      onChange={() => setInspection(s => ({ ...s, [item]: 'pass' }))} className="w-4 h-4" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="radio" name={`inspection-${item}`} checked={inspection[item] === 'fail'}
                      onChange={() => setInspection(s => ({ ...s, [item]: 'fail' }))} className="w-4 h-4" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={inspectionNotes[item] || ''} onChange={e => setInspectionNotes(s => ({ ...s, [item]: e.target.value }))}
                      className="w-full border-b border-gray-200 text-xs px-1 focus:outline-none focus:border-gray-400" placeholder="—" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Remarks */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Remarks</h2>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
            placeholder="Any additional notes…" />
        </section>

        {/* Signatures */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-5 text-sm uppercase tracking-wide">Signatures</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Issued By — Name & Title</label>
                <input value={issuedByName} onChange={e => setIssuedByName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Name & title" />
              </div>
              <SignaturePad label="Issued By — Signature" value={issuedBySig} onChange={setIssuedBySig} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Received By — Name & Title</label>
                <input value={receivedByName} onChange={e => setReceivedByName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Name & title" />
              </div>
              <SignaturePad label="Received By — Signature" value={receivedBySig} onChange={setReceivedBySig} />
            </div>
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

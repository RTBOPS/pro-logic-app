'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { Printer, Save, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SignaturePad from '@/components/SignaturePad';

const RETIREMENT_REASONS = ['End of Useful Life', 'Excessive Repair Cost', 'Obsolete Technology', 'Physical Damage', 'Lost / Stolen', 'Manufacturer Support Ended', 'Other'];
const DISPOSITION_METHODS = ['Recycled', 'Sold', 'Donated', 'Scrapped', 'Parts Salvaged', 'Destroyed'];

export default function RetirementPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 150);
  };

  const [asset, setAsset] = useState({ assetId: '', equipmentDescription: '', manufacturer: '', model: '', serialNumber: '', purchaseDate: '', purchaseCost: '' });
  const [reasons, setReasons] = useState<Record<string, boolean>>({});
  const [evaluationSummary, setEvaluationSummary] = useState('');
  const [disposition, setDisposition] = useState('');
  const [operationsManager, setOperationsManager] = useState('');
  const [operationsManagerSig, setOperationsManagerSig] = useState('');
  const [technicalDirector, setTechnicalDirector] = useState('');
  const [technicalDirectorSig, setTechnicalDirectorSig] = useState('');

  const setAsset1 = (k: string, v: string) => setAsset(f => ({ ...f, [k]: v }));

  const save = async () => {
    const uid = getUid();
    if (!uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'equipment_retirement'), {
        asset, reasons, evaluationSummary, disposition, operationsManager, operationsManagerSig, technicalDirector, technicalDirectorSig, createdAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
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
      <div className="no-print">
        <PageHeader title="Asset Retirement / Disposal" subtitle="ASSET RETIREMENT / DISPOSAL REPORT">
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={printing || saving}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40">
              {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {printing ? 'Preparing…' : 'Print'}
            </button>
            <button onClick={save} disabled={saving || printing} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </PageHeader>
      </div>

      <div className="space-y-6 mt-4">
        {/* Asset Details */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Asset Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ['Asset ID', 'assetId', 'text'],
              ['Equipment Description', 'equipmentDescription', 'text'],
              ['Manufacturer', 'manufacturer', 'text'],
              ['Model', 'model', 'text'],
              ['Serial Number', 'serialNumber', 'text'],
              ['Purchase Date', 'purchaseDate', 'date'],
              ['Purchase Cost ($)', 'purchaseCost', 'number'],
            ].map(([label, key, type]) => (
              <div key={key as string}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input type={type as string} value={(asset as any)[key as string]} onChange={e => setAsset1(key as string, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Retirement Reason */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Retirement Reason</h2>
            <div className="space-y-2">
              {RETIREMENT_REASONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!reasons[opt]} onChange={e => setReasons(s => ({ ...s, [opt]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300" />
                  {opt}
                </label>
              ))}
            </div>
          </section>

          {/* Disposition */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Disposition Method</h2>
            <div className="space-y-2">
              {DISPOSITION_METHODS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="disposition" checked={disposition === opt} onChange={() => setDisposition(opt)}
                    className="w-4 h-4" />
                  {opt}
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Evaluation Summary */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Evaluation Summary</h2>
          <textarea value={evaluationSummary} onChange={e => setEvaluationSummary(e.target.value)} rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
            placeholder="Summary of condition and reasons for retirement…" />
        </section>

        {/* Approval */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Approval</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Operations Manager — Name & Title</label>
                <input value={operationsManager} onChange={e => setOperationsManager(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="Name & title" />
              </div>
              <SignaturePad label="Operations Manager — Signature" value={operationsManagerSig} onChange={setOperationsManagerSig} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Technical Director — Name & Title</label>
                <input value={technicalDirector} onChange={e => setTechnicalDirector(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="Name & title" />
              </div>
              <SignaturePad label="Technical Director — Signature" value={technicalDirectorSig} onChange={setTechnicalDirectorSig} />
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

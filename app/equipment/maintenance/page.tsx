'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { Printer, Save, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SignaturePad from '@/components/SignaturePad';

const ISSUE_CATEGORIES = ['Electrical', 'Mechanical', 'Software/Firmware', 'Physical Damage', 'Calibration', 'Other'];
const MAINTENANCE_ACTIONS = ['Cleaned', 'Adjusted', 'Repaired', 'Replaced Component', 'Firmware Updated', 'Sent to Vendor'];
const FINAL_STATUS = ['Returned to Service', 'Monitor Performance', 'Retired', 'Awaiting Parts', 'Beyond Economical Repair'];

export default function MaintenancePage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [asset, setAsset] = useState({ assetId: '', equipmentName: '', manufacturer: '', model: '', serialNumber: '' });
  const [problem, setProblem] = useState({ reportedBy: '', dateReported: '', issueCategories: {} as Record<string, boolean>, failureDescription: '' });
  const [maintenanceActions, setMaintenanceActions] = useState<Record<string, boolean>>({});
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [finalStatus, setFinalStatus] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [technicianSig, setTechnicianSig] = useState('');

  const setAsset1 = (k: string, v: string) => setAsset(f => ({ ...f, [k]: v }));

  const save = async () => {
    const uid = getUid();
    if (!uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'equipment_maintenance'), {
        asset, problem, maintenanceActions, technicianNotes, technicianName, technicianSig, finalStatus, createdAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {saving && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <img src="/logo.png" alt="PRO-LOGIC" className="h-10 object-contain mb-4 opacity-80" />
            <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gray-900 rounded-full animate-[slide_1.2s_ease-in-out_infinite]" />
            </div>
            <p className="text-xs text-gray-400 mt-3 tracking-wide">Saving…</p>
            <style>{`@keyframes slide{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`}</style>
          </div>
        </div>
      )}
      <div className="no-print">
        <PageHeader title="Maintenance Report" subtitle="EQUIPMENT MAINTENANCE REPORT">
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
        {/* Asset Info */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Asset Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[['Asset ID', 'assetId'], ['Equipment Name', 'equipmentName'], ['Manufacturer', 'manufacturer'], ['Model', 'model'], ['Serial Number', 'serialNumber']].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input value={(asset as any)[key]} onChange={e => setAsset1(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
            ))}
          </div>
        </section>

        {/* Problem Description */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Problem Description</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reported By</label>
              <input value={problem.reportedBy} onChange={e => setProblem(p => ({ ...p, reportedBy: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date Reported</label>
              <input type="date" value={problem.dateReported} onChange={e => setProblem(p => ({ ...p, dateReported: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
            </div>
          </div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Issue Category</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {ISSUE_CATEGORIES.map(cat => (
              <label key={cat} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox"
                  checked={!!problem.issueCategories[cat]}
                  onChange={e => setProblem(p => ({ ...p, issueCategories: { ...p.issueCategories, [cat]: e.target.checked } }))}
                  className="w-4 h-4 rounded border-gray-300" />
                {cat}
              </label>
            ))}
          </div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Failure Description</label>
          <textarea value={problem.failureDescription} onChange={e => setProblem(p => ({ ...p, failureDescription: e.target.value }))} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none" />
        </section>

        {/* Maintenance Action + Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Maintenance Action</h2>
            <div className="space-y-2">
              {MAINTENANCE_ACTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={!!maintenanceActions[opt]}
                    onChange={e => setMaintenanceActions(s => ({ ...s, [opt]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300" />
                  {opt}
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Final Status</h2>
            <div className="space-y-2 mb-4">
              {FINAL_STATUS.map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="finalStatus" checked={finalStatus === opt} onChange={() => setFinalStatus(opt)}
                    className="w-4 h-4" />
                  {opt}
                </label>
              ))}
            </div>
          </section>
        </div>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Technician Notes</h2>
          <textarea value={technicianNotes} onChange={e => setTechnicianNotes(e.target.value)} rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
            placeholder="Detailed notes on work performed…" />
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-5 text-sm uppercase tracking-wide">Technician Signature</h2>
          <div className="max-w-sm space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Technician Name & Title</label>
              <input value={technicianName} onChange={e => setTechnicianName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Name & title" />
            </div>
            <SignaturePad label="Signature" value={technicianSig} onChange={setTechnicianSig} />
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

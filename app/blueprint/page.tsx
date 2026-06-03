'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useData } from '@/hooks/useData';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BlueprintItem } from '@/components/BlueprintCanvas';
import { Save, Printer } from 'lucide-react';

const BlueprintCanvas = dynamic(() => import('@/components/BlueprintCanvas'), { ssr: false });

export default function BlueprintPage() {
  const { data: productions } = useData('productions');
  const { data: locations } = useData('locations');
  const { data: inventory } = useData('inventory');
  const { data: crew } = useData('crew');

  const [selectedProduction, setSelectedProduction] = useState('');
  const [items, setItems] = useState<BlueprintItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!selectedProduction) return;
    getDoc(doc(db, 'productions', selectedProduction, 'blueprint', 'canvas')).then(snap => {
      if (snap.exists()) setItems(snap.data().items || []);
      else setItems([]);
    });
  }, [selectedProduction]);

  const save = async () => {
    if (!selectedProduction) return;
    setSaving(true);
    await setDoc(doc(db, 'productions', selectedProduction, 'blueprint', 'canvas'), { items });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const production = productions.find((p: any) => p.id === selectedProduction);
  const assignedGear = inventory.filter((i: any) =>
    items.some(item => item.label.toLowerCase().includes(i.name?.toLowerCase().split(' ')[0]))
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b bg-white shrink-0 no-print gap-2 flex-wrap">
        <div className="hidden md:block">
          <h1 className="text-xl font-bold text-gray-900">Location Blueprint</h1>
          <p className="text-gray-500 text-xs mt-0.5">Set layout & equipment placement</p>
        </div>
        <div className="flex items-center gap-2 flex-1 md:flex-none flex-wrap">
          <select
            className="flex-1 md:flex-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 min-w-0"
            value={selectedProduction}
            onChange={e => setSelectedProduction(e.target.value)}
          >
            <option value="">Select production…</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProduction && (
            <>
              <button onClick={save} disabled={saving}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-zinc-800'}`}>
                <Save size={13} /> {saving ? '…' : saved ? '✓' : 'Save'}
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
                <Printer size={13} /> Print
              </button>
            </>
          )}
        </div>
      </div>

      {!selectedProduction ? (
        <div className="flex-1 bg-white m-4 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
          Select a production to start designing your set layout.
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden min-h-0">
          {/* Canvas — full screen on mobile */}
          <div className="flex-1 overflow-hidden blueprint-canvas-wrap">
            <BlueprintCanvas items={items} onChange={setItems} productionId={selectedProduction} />
          </div>

          {/* Right panel — hidden on mobile, shown on md+ */}
          <div className="hidden md:flex w-64 shrink-0 flex-col gap-4 overflow-y-auto p-2 no-print border-l bg-gray-50">
            {/* Production info */}
            <div className="bg-zinc-900 text-white rounded-xl p-4">
              <div className="font-bold">{production?.name}</div>
              <div className="text-zinc-400 text-xs">{production?.client}</div>
            </div>

            {/* Items on canvas */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b bg-gray-50">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Items on Blueprint ({items.length})
                </div>
              </div>
              <div className="overflow-y-auto max-h-64">
                {items.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-gray-400 text-center">No items placed yet</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-400 uppercase">
                      <tr>
                        <th className="text-left px-3 py-1.5">#</th>
                        <th className="text-left px-3 py-1.5">Item</th>
                        <th className="text-left px-3 py-1.5">Cat.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="px-3 py-1.5 text-gray-400">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800">{item.label}</td>
                          <td className="px-3 py-1.5 text-gray-400">{item.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Crew */}
            {crew.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b bg-gray-50">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Crew Reference</div>
                </div>
                <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {crew.map((c: any) => (
                    <div key={c.id} className="px-3 py-2 flex items-center gap-2">
                      <img src={c.picture} className="w-6 h-6 rounded-full object-cover" alt="" />
                      <div>
                        <div className="text-xs font-medium text-gray-800">{c.name} {c.last_name}</div>
                        <div className="text-xs text-gray-400">{c.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          aside, nav, .no-print { display: none !important; visibility: hidden !important; }
          body, html { margin: 0; padding: 0; height: auto; overflow: visible; }
          body > div { display: block !important; }
          .blueprint-canvas-wrap { position: fixed !important; top: 0; left: 0; width: 100vw !important; height: 100vh !important; z-index: 9999; background: white; }
          canvas { width: 100% !important; height: 100% !important; }
        }
      `}</style>
    </div>
  );
}

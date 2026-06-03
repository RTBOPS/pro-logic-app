'use client';

import { useState, useEffect, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Printer, IdCard, Filter } from 'lucide-react';
import { deptColor, deptLabel, DEPARTMENTS } from '@/lib/departments';

const ACCESS_COLORS: Record<string, { bg: string; label: string; hex: string }> = {
  production: { bg: 'bg-purple-600', label: 'PRODUCTION', hex: '#7c3aed' },
  direction:  { bg: 'bg-blue-700',   label: 'DIRECTION',  hex: '#1d4ed8' },
  camera:     { bg: 'bg-sky-600',    label: 'CAMERA',     hex: '#0369a1' },
  electric:   { bg: 'bg-amber-500',  label: 'ELECTRIC',   hex: '#d97706' },
  grip:       { bg: 'bg-stone-500',  label: 'GRIP',       hex: '#78716c' },
  audio:      { bg: 'bg-teal-600',   label: 'AUDIO',      hex: '#0d9488' },
  art:        { bg: 'bg-pink-600',   label: 'ART',        hex: '#db2777' },
  wardrobe:   { bg: 'bg-rose-800',   label: 'WARDROBE',   hex: '#7c2d12' },
  vfx:        { bg: 'bg-emerald-700',label: 'VFX / POST', hex: '#065f46' },
  cast:       { bg: 'bg-yellow-600', label: 'CAST',       hex: '#b45309' },
  transportation:{ bg:'bg-gray-600', label:'TRANSPORT',   hex: '#374151' },
  catering:   { bg: 'bg-green-700',  label: 'CATERING',   hex: '#166534' },
  other:      { bg: 'bg-gray-500',   label: 'CREW',       hex: '#6b7280' },
};

const DEFAULT_PIC = 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg';

export default function IDCardsPage() {
  const { data: crew } = useData('crew');
  const [company, setCompany] = useState<any>(null);
  const [filterDept, setFilterDept] = useState('');
  const [filterProd, setFilterProd] = useState('');
  const { data: productions } = useData('productions');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDoc(doc(db, 'company', 'profile')).then(s => { if (s.exists()) setCompany(s.data()); });
  }, []);

  const filtered = crew.filter((c: any) => {
    const matchD = !filterDept || (c.department || 'other') === filterDept;
    return matchD;
  });

  const handlePrint = () => window.print();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><IdCard size={22} /> ID Cards</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} cards · click Print to generate all</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600"
            value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <button onClick={handlePrint}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800">
            <Printer size={14} /> Print ID Cards
          </button>
        </div>
      </div>

      <div ref={printRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 id-card-grid">
        {filtered.map((c: any) => {
          const dept = c.department || 'other';
          const access = ACCESS_COLORS[dept] || ACCESS_COLORS.other;
          return (
            <div key={c.id} className="id-card bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 flex flex-col" style={{ width: '85.6mm', minHeight: '54mm' }}>
              {/* Color header */}
              <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: access.hex }}>
                <div className="text-white">
                  {company?.logo_url
                    ? <img src={company.logo_url} className="h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="" />
                    : <span className="text-xs font-bold tracking-wide">{company?.name || 'PRO-LOGIC'}</span>}
                </div>
                <img src="/logo.png" className="h-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="PRO-LOGIC" />
              </div>

              {/* Body */}
              <div className="flex gap-3 p-3 flex-1">
                <img src={c.picture || DEFAULT_PIC} className="w-14 h-14 rounded-xl object-cover shrink-0 border-2"
                  style={{ borderColor: access.hex }} alt="" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900 text-sm leading-tight truncate">{c.name} {c.last_name}</div>
                  <div className="text-xs text-gray-500 truncate">{c.role || deptLabel(dept)}</div>
                  <div className="mt-1 text-xs text-gray-400">{c.person_code || c.id?.slice(-4).toUpperCase() || '—'}</div>
                </div>
              </div>

              {/* Access strip */}
              <div className="px-3 py-1.5 text-xs font-bold tracking-widest text-white text-center" style={{ backgroundColor: access.hex }}>
                {access.label} ACCESS
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          No crew members found. Add crew first.
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body > div > aside { display: none !important; }
          .id-card-grid { display: grid; grid-template-columns: repeat(2, 85.6mm); gap: 5mm; }
          .id-card { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; border: 1px solid #ddd !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

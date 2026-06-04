'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Printer, IdCard, CreditCard } from 'lucide-react';
import { deptLabel, DEPARTMENTS } from '@/lib/departments';
import QRCode from 'qrcode';

const ACCESS_COLORS: Record<string, { label: string; hex: string }> = {
  production:    { label: 'PRODUCTION',  hex: '#7c3aed' },
  direction:     { label: 'DIRECTION',   hex: '#1d4ed8' },
  camera:        { label: 'CAMERA',      hex: '#0369a1' },
  electric:      { label: 'ELECTRIC',    hex: '#d97706' },
  grip:          { label: 'GRIP',        hex: '#78716c' },
  audio:         { label: 'AUDIO',       hex: '#0d9488' },
  art:           { label: 'ART DEPT',    hex: '#db2777' },
  wardrobe:      { label: 'WARDROBE',    hex: '#7c2d12' },
  vfx:           { label: 'VFX / POST',  hex: '#065f46' },
  cast:          { label: 'CAST',        hex: '#b45309' },
  transportation:{ label: 'TRANSPORT',   hex: '#374151' },
  catering:      { label: 'CATERING',    hex: '#166534' },
  other:         { label: 'CREW',        hex: '#6b7280' },
};

function IDCard({ c, company, orientation }: { c: any; company: any; orientation: 'horizontal' | 'vertical' }) {
  const [qrUrl, setQrUrl] = useState('');
  const dept = c.department || 'other';
  const access = ACCESS_COLORS[dept] || ACCESS_COLORS.other;
  const code = c.person_code || c.id?.slice(-6).toUpperCase() || 'STAFF';

  useEffect(() => {
    const data = JSON.stringify({ id: code, name: `${c.name} ${c.last_name}`, role: c.role, dept: deptLabel(dept), email: c.email, phone: c.phone });
    QRCode.toDataURL(data, { width: 80, margin: 1 }).then(setQrUrl).catch(() => {});
  }, [c.id]);

  if (orientation === 'vertical') {
    return (
      <div className="id-card bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200 flex flex-col"
        style={{ width: '54mm', minHeight: '85.6mm', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        {/* Header */}
        <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: access.hex }}>
          {company?.logo_url
            ? <img src={company.logo_url} className="h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="" />
            : <span className="text-white text-xs font-bold">{company?.name || 'STUDIO'}</span>}
          <img src="/logo.png" className="h-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="" />
        </div>
        {/* Large photo */}
        <div className="flex justify-center pt-3 pb-2">
          <img src={c.picture} className="w-20 h-20 rounded-xl object-cover border-4"
            style={{ borderColor: access.hex }} alt={c.name}
            onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23e5e7eb"/><text x="40" y="44" text-anchor="middle" font-size="24" fill="%236b7280">?</text></svg>'; }} />
        </div>
        {/* Name + role */}
        <div className="px-3 text-center flex-1">
          <div className="font-bold text-gray-900 text-sm leading-tight">{c.name}</div>
          <div className="font-bold text-gray-900 text-sm">{c.last_name}</div>
          <div className="text-xs text-gray-600 mt-0.5">{c.role || deptLabel(dept)}</div>
          <div className="text-xs font-mono text-gray-500 mt-1 bg-gray-100 rounded px-2 py-0.5 inline-block">{code}</div>
        </div>
        {/* QR */}
        {qrUrl && <div className="flex justify-center pb-2"><img src={qrUrl} className="w-14 h-14" alt="QR" /></div>}
        {/* Access strip */}
        <div className="py-1.5 text-xs font-bold tracking-widest text-white text-center" style={{ backgroundColor: access.hex }}>
          {access.label}
        </div>
      </div>
    );
  }

  // Horizontal (credit card size)
  return (
    <div className="id-card bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200 flex flex-col"
      style={{ width: '85.6mm', minHeight: '54mm', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: access.hex }}>
        {company?.logo_url
          ? <img src={company.logo_url} className="h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="" />
          : <span className="text-white text-xs font-bold">{company?.name || 'STUDIO'}</span>}
        <img src="/logo.png" className="h-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="" />
      </div>
      <div className="flex gap-3 p-3 flex-1">
        <img src={c.picture} className="w-16 h-16 rounded-xl object-cover shrink-0 border-3"
          style={{ borderColor: access.hex, borderWidth: '3px', borderStyle: 'solid' }} alt={c.name}
          onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23e5e7eb"/><text x="32" y="36" text-anchor="middle" font-size="20" fill="%236b7280">?</text></svg>'; }} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 text-sm leading-tight">{c.name} {c.last_name}</div>
          <div className="text-xs text-gray-600 mt-0.5 truncate">{c.role || deptLabel(dept)}</div>
          <div className="text-xs font-mono text-gray-500 mt-1 bg-gray-100 rounded px-1.5 py-0.5 inline-block">{code}</div>
        </div>
        {qrUrl && <img src={qrUrl} className="w-14 h-14 shrink-0 rounded" alt="QR" />}
      </div>
      <div className="py-1.5 text-xs font-bold tracking-widest text-white text-center" style={{ backgroundColor: access.hex }}>
        {access.label} ACCESS
      </div>
    </div>
  );
}

export default function IDCardsPage() {
  const { data: crew } = useData('crew');
  const [company, setCompany] = useState<any>(null);
  const [filterDept, setFilterDept] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  useEffect(() => {
    getDoc(doc(db, 'company', 'profile')).then(s => { if (s.exists()) setCompany(s.data()); });
  }, []);

  const filtered = crew.filter((c: any) => !filterDept || (c.department || 'other') === filterDept);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 no-print flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><IdCard size={22} /> ID Cards</h1>
          <p className="text-gray-600 text-sm mt-1">{filtered.length} cards · QR code per card with staff info</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700"
            value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <div className="flex border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setOrientation('horizontal')}
              className={`px-3 py-2 text-xs flex items-center gap-1 ${orientation === 'horizontal' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <CreditCard size={13} /> Horizontal
            </button>
            <button onClick={() => setOrientation('vertical')}
              className={`px-3 py-2 text-xs flex items-center gap-1 ${orientation === 'vertical' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <IdCard size={13} /> Vertical
            </button>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800">
            <Printer size={14} /> Print All
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
          No crew members found. Add crew first.
        </div>
      ) : (
        <div className={`id-card-grid flex flex-wrap gap-4 ${orientation === 'vertical' ? 'items-start' : ''}`}>
          {filtered.map(c => (
            <IDCard key={c.id} c={c} company={company} orientation={orientation} />
          ))}
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body > div > aside, body > div > div:first-child { display: none !important; }
          .id-card-grid { display: flex; flex-wrap: wrap; gap: 5mm; padding: 5mm; }
          .id-card { box-shadow: none !important; border: 1px solid #ccc !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

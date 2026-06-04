'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Printer, IdCard, CreditCard } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useNamespace } from '@/hooks/useNamespace';
import { deptLabel, DEPARTMENTS } from '@/lib/departments';
import { useCompany } from '@/hooks/useCompany';
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

function IDCard({ c, company, orientation, productionName }: { c: any; company: any; orientation: 'horizontal' | 'vertical'; productionName?: string }) {
  const [qrUrl, setQrUrl] = useState('');
  const dept = c.department || 'other';
  const access = ACCESS_COLORS[dept] || ACCESS_COLORS.other;
  const code = c.person_code || c.id?.slice(-6).toUpperCase() || 'STAFF';
  // Use company primary color if available, otherwise department color
  const headerColor = company?.primary_color || access.hex;

  useEffect(() => {
    const data = JSON.stringify({ id: code, name: `${c.name} ${c.last_name}`, role: c.role, dept: deptLabel(dept), production: productionName || '', email: c.email });
    QRCode.toDataURL(data, { width: 100, margin: 1 }).then(setQrUrl).catch(() => {});
  }, [c.id]);

  const imgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).style.display = 'none';
  };

  if (orientation === 'vertical') {
    return (
      <div className="id-card bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200 flex flex-col"
        style={{ width: '54mm', minHeight: '90mm', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        {/* Header with company logo LARGE */}
        <div className="px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: headerColor }}>
          {company?.logo_url
            ? <img src={company.logo_url} className="h-7 object-contain" style={{ filter: 'brightness(0) invert(1)', maxWidth: '70px' }} alt="" />
            : <span className="text-white text-sm font-bold tracking-wide">{company?.name || 'STUDIO'}</span>}
          <img src="/logo.png" className="h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="" />
        </div>
        {/* Large photo */}
        <div className="flex justify-center pt-3 pb-1">
          <img src={c.picture} className="w-24 h-24 rounded-xl object-cover border-4"
            style={{ borderColor: headerColor }} alt={c.name} onError={imgErr} />
        </div>
        {/* Name + role */}
        <div className="px-3 text-center flex-1 pb-1">
          <div className="font-black text-gray-900 text-base leading-tight mt-1">{c.name}</div>
          <div className="font-black text-gray-900 text-base">{c.last_name}</div>
          <div className="text-xs text-gray-600 mt-0.5 font-medium">{c.role || deptLabel(dept)}</div>
          {productionName && <div className="text-xs text-gray-500 mt-0.5 italic">{productionName}</div>}
          <div className="text-xs font-mono mt-1 bg-gray-100 rounded px-2 py-0.5 inline-block" style={{ color: headerColor }}>{code}</div>
        </div>
        {/* QR */}
        {qrUrl && <div className="flex justify-center pb-1"><img src={qrUrl} className="w-16 h-16" alt="QR" /></div>}
        {/* Access strip */}
        <div className="py-1.5 text-xs font-black tracking-widest text-white text-center" style={{ backgroundColor: headerColor }}>
          {access.label}
        </div>
      </div>
    );
  }

  // Horizontal
  return (
    <div className="id-card bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200 flex flex-col"
      style={{ width: '85.6mm', minHeight: '54mm', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: headerColor }}>
        {company?.logo_url
          ? <img src={company.logo_url} className="h-7 object-contain" style={{ filter: 'brightness(0) invert(1)', maxWidth: '80px' }} alt="" />
          : <span className="text-white text-sm font-bold">{company?.name || 'STUDIO'}</span>}
        <img src="/logo.png" className="h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} alt="" />
      </div>
      <div className="flex gap-3 p-3 flex-1">
        <img src={c.picture} className="w-20 h-20 rounded-xl object-cover shrink-0"
          style={{ borderColor: headerColor, borderWidth: '3px', borderStyle: 'solid' }}
          alt={c.name} onError={imgErr} />
        <div className="flex-1 min-w-0">
          <div className="font-black text-gray-900 text-base leading-tight">{c.name} {c.last_name}</div>
          <div className="text-xs text-gray-600 mt-0.5 font-medium">{c.role || deptLabel(dept)}</div>
          {productionName && <div className="text-xs text-gray-500 italic mt-0.5">{productionName}</div>}
          <div className="text-xs font-mono mt-1 bg-gray-100 rounded px-1.5 py-0.5 inline-block" style={{ color: headerColor }}>{code}</div>
        </div>
        {qrUrl && <img src={qrUrl} className="w-16 h-16 shrink-0 rounded" alt="QR" />}
      </div>
      <div className="py-1.5 text-xs font-black tracking-widest text-white text-center" style={{ backgroundColor: headerColor }}>
        {access.label} ACCESS
      </div>
    </div>
  );
}

export default function IDCardsPage() {
  const namespace = useNamespace();
  const { data: allCrew } = useData('crew');
  const { data: productions } = useData('productions');
  const company = useCompany();
  const [filterDept, setFilterDept] = useState('');
  const [selectedProd, setSelectedProd] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [prodCrew, setProdCrew] = useState<string[]>([]); // crew IDs assigned to production
  const [loadingProd, setLoadingProd] = useState(false);

  // Load crew assigned to selected production
  useEffect(() => {
    if (!selectedProd || !namespace) { setProdCrew([]); return; }
    setLoadingProd(true);
    getDocs(collection(db, 'users', namespace, 'productions', selectedProd, 'crew')).then(snap => {
      setProdCrew(snap.docs.map(d => (d.data() as any).crew_id));
      setLoadingProd(false);
    });
  }, [selectedProd, namespace]);

  // Filter crew: if production selected, only show assigned crew
  const filtered = allCrew.filter((c: any) => {
    const inProd = !selectedProd || prodCrew.includes(c.id);
    const inDept = !filterDept || (c.department || 'other') === filterDept;
    return inProd && inDept;
  });

  const selectedProduction = productions.find((p: any) => p.id === selectedProd);

  return (
    <div className="p-4 md:p-8">
      <div className="no-print">
      <PageHeader title="ID Cards" subtitle={`${filtered.length} cards · QR code per card`}>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 min-w-[180px]"
            value={selectedProd} onChange={e => setSelectedProd(e.target.value)}>
            <option value="">All crew</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
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
      </PageHeader>
      </div>

      {selectedProd && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-sm text-blue-700 no-print">
          Showing {filtered.length} crew member{filtered.length !== 1 ? 's' : ''} assigned to <strong>{selectedProduction?.name}</strong>
          {loadingProd && ' · Loading…'}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
          {selectedProd ? 'No crew assigned to this production yet. Add crew from the production detail page.' : 'No crew members found. Add crew first.'}
        </div>
      ) : (
        <div className="id-card-grid flex flex-wrap gap-4">
          {filtered.map(c => (
            <IDCard key={c.id} c={c} company={company} orientation={orientation} productionName={selectedProduction?.name} />
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

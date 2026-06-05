'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Printer, IdCard, CreditCard, Loader2, Eye, X } from 'lucide-react';
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
        {/* Header */}
        <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: headerColor }}>
          {company?.logo_url
            ? <div className="bg-white rounded px-1.5 py-0.5"><img src={company.logo_url} className="h-6 object-contain" style={{ maxWidth: '64px' }} alt="" /></div>
            : <span className="text-white text-sm font-bold tracking-wide">{company?.name || 'STUDIO'}</span>}
          <img src="/logo-white.svg" className="h-5 object-contain" alt="" onError={e => { (e.target as HTMLImageElement).src = '/logo.png'; (e.target as HTMLImageElement).style.filter = 'brightness(0) invert(1)'; }} />
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
      <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: headerColor }}>
        {company?.logo_url
          ? <div className="bg-white rounded px-1.5 py-0.5"><img src={company.logo_url} className="h-6 object-contain" style={{ maxWidth: '72px' }} alt="" /></div>
          : <span className="text-white text-sm font-bold">{company?.name || 'STUDIO'}</span>}
        <img src="/logo-white.svg" className="h-5 object-contain" alt="" onError={e => { (e.target as HTMLImageElement).src = '/logo.png'; (e.target as HTMLImageElement).style.filter = 'brightness(0) invert(1)'; }} />
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

const AVERY_PRESETS = [
  { id: 'free',   label: 'Free flow',      perRow: 0,  cardW: '',      gap: '5mm',  pageMargin: '5mm' },
  { id: '5385',   label: 'Avery 5385 (3×4")',  perRow: 2,  cardW: '85.6mm', gap: '6mm',  pageMargin: '6mm' },
  { id: '5392',   label: 'Avery 5392 (2×3½")', perRow: 2,  cardW: '88.9mm', gap: '6mm',  pageMargin: '6mm' },
  { id: '74549',  label: 'Avery 74549 (2½×4")',perRow: 2,  cardW: '101.6mm',gap: '6mm',  pageMargin: '6mm' },
  { id: '5360',   label: 'Avery 5360 (2×3¼")', perRow: 3,  cardW: '82.5mm', gap: '4mm',  pageMargin: '6mm' },
];

export default function IDCardsPage() {
  const namespace = useNamespace();
  const { data: allCrew } = useData('crew');
  const { data: productions } = useData('productions');
  const company = useCompany();
  const [filterDept, setFilterDept] = useState('');
  const [selectedProd, setSelectedProd] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [avery, setAvery] = useState('free');
  const [prodCrew, setProdCrew] = useState<string[]>([]);
  const [loadingProd, setLoadingProd] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const averyPreset = AVERY_PRESETS.find(p => p.id === avery) || AVERY_PRESETS[0];

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 150);
  };

  // Load crew assigned to selected production
  useEffect(() => {
    const uid = getUid();
    if (!selectedProd || !uid) { setProdCrew([]); return; }
    setLoadingProd(true);
    getDocs(collection(db, 'users', uid, 'productions', selectedProd, 'crew')).then(snap => {
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
          <select
            value={avery}
            onChange={e => setAvery(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700"
            title="Avery paper preset"
          >
            {AVERY_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button onClick={() => setShowPreview(true)} disabled={filtered.length === 0}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40">
            <Eye size={14} /> Preview
          </button>
          <button onClick={handlePrint} disabled={printing}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40">
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {printing ? 'Preparing…' : 'Print All'}
          </button>
        </div>
      </PageHeader>
      </div>

      {/* Print Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-700/90 backdrop-blur-sm">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <img src="/logo-white.svg" className="h-6 object-contain" alt="PRO-LOGIC" />
              <span className="text-sm font-medium">Print Preview — {filtered.length} card{filtered.length !== 1 ? 's' : ''}</span>
              {avery !== 'free' && <span className="text-xs text-gray-400">· {AVERY_PRESETS.find(p => p.id === avery)?.label}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowPreview(false); handlePrint(); }}
                className="flex items-center gap-2 bg-white text-gray-900 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100">
                <Printer size={13} /> Print
              </button>
              <button onClick={() => setShowPreview(false)} className="p-1.5 text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>
          {/* Paper preview */}
          <div className="flex-1 overflow-auto p-6 flex justify-center">
            <div className="bg-white shadow-2xl"
              style={{ width: '215.9mm', minHeight: '279.4mm', padding: averyPreset.pageMargin }}>
              <div style={{
                display: 'flex', flexWrap: 'wrap',
                gap: averyPreset.gap,
              }}>
                {filtered.map(c => (
                  <div key={c.id} style={averyPreset.cardW ? { width: averyPreset.cardW, flexShrink: 0 } : {}}>
                    <IDCard c={c} company={company} orientation={orientation} productionName={selectedProduction?.name} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {printing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm no-print">
          <img src="/logo.png" alt="PRO-LOGIC" className="h-10 object-contain mb-4 opacity-80" />
          <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full animate-[slide_1.2s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-gray-400 mt-3 tracking-wide">Preparing print…</p>
          <style>{`@keyframes slide{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}`}</style>
        </div>
      )}

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
          .id-card-grid {
            display: flex;
            flex-wrap: wrap;
            gap: ${averyPreset.gap};
            padding: ${averyPreset.pageMargin};
            ${averyPreset.perRow > 0 ? `width: calc(${averyPreset.perRow} * ${averyPreset.cardW} + ${averyPreset.perRow - 1} * ${averyPreset.gap} + 2 * ${averyPreset.pageMargin});` : ''}
          }
          ${averyPreset.cardW ? `.id-card { width: ${averyPreset.cardW} !important; flex-shrink: 0; }` : ''}
          .id-card { box-shadow: none !important; border: 1px solid #ccc !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

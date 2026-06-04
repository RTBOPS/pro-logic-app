'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  FileText, Users, MapPin, Film, Shield, UserCheck,
  ClipboardList, Printer, Eye, Download, X
} from 'lucide-react';
import { generateCallSheet } from '@/lib/pdf/callsheet';
import { generateNDA } from '@/lib/pdf/nda';
import { generateCrewDeal } from '@/lib/pdf/crew-deal';
import { generateLocationRelease } from '@/lib/pdf/location-release';
import { generateShotList } from '@/lib/pdf/shot-list';
import { generateStripboard } from '@/lib/pdf/stripboard';
import { generateCharacterBreakdown } from '@/lib/pdf/character-breakdown';

const DOCS = [
  { id: 'call-sheet', title: 'Call Sheet', desc: 'Daily production schedule for cast & crew', icon: ClipboardList, color: 'bg-blue-50 text-blue-600', generate: generateCallSheet },
  { id: 'stripboard', title: 'Stripboard', desc: 'Professional scene scheduling board', icon: Film, color: 'bg-purple-50 text-purple-600', generate: generateStripboard },
  { id: 'shot-list', title: 'Shot List', desc: 'Detailed list of all planned shots', icon: FileText, color: 'bg-green-50 text-green-600', generate: generateShotList },
  { id: 'nda', title: 'Non-Disclosure Agreement', desc: 'NDA pre-filled with production data', icon: Shield, color: 'bg-red-50 text-red-600', generate: generateNDA },
  { id: 'character-breakdown', title: 'Character Breakdown', desc: 'Character profiles for casting & production', icon: UserCheck, color: 'bg-orange-50 text-orange-600', generate: generateCharacterBreakdown },
  { id: 'location-release', title: 'Location Release Agreement', desc: 'Permission to film at a location', icon: MapPin, color: 'bg-teal-50 text-teal-600', generate: generateLocationRelease },
  { id: 'crew-deal', title: 'Crew Deal Memo & Contract', desc: 'Standard crew deal memo with payment terms', icon: Users, color: 'bg-indigo-50 text-indigo-600', generate: generateCrewDeal },
];

export default function DocumentsPage() {
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const { data: locations } = useData('locations');
  const { data: inventory } = useData('inventory');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; dataUri: string; docItem: typeof DOCS[0] } | null>(null);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'company', 'profile')).then(s => { if (s.exists()) setCompany(s.data()); });
  }, []);

  const getContext = async (includeWeather = false) => {
    const production = productions.find((p: any) => p.id === selectedProduction);
    let weather = null;
    if (includeWeather && production) {
      try {
        // Try multiple city sources
        const loc = locations.find((l: any) => l.id === production.location_id);
        const city = loc?.city || loc?.address || production.city || production.primary_location || production.name;
        if (city) {
          const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
          const data = await res.json();
          if (!data.error && data.forecast?.length) {
            // Find forecast day matching shoot date, or use first day
            const targetDate = production.start_date;
            weather = targetDate
              ? data.forecast.find((f: any) => f.date === targetDate) || data.forecast[0]
              : data.forecast[0];
          }
        }
      } catch {}
    }
    // Load individual crew call times from production's crew subcollection
    let crewWithTimes = crew;
    if (production && selectedProduction) {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'productions', selectedProduction, 'crew'));
        const assignments = snap.docs.reduce((acc: any, d) => {
          const data = d.data() as any;
          if (data.crew_id) acc[data.crew_id] = data;
          return acc;
        }, {});
        crewWithTimes = crew.map((c: any) => ({
          ...c,
          call_time: assignments[c.id]?.call_time || '',
          confirmation_status: assignments[c.id]?.confirmation_status || '',
        }));
      } catch {}
    }
    return { production, crew: crewWithTimes, locations, inventory, weather, company };
  };

  const handlePreview = async (docItem: typeof DOCS[0]) => {
    if (!selectedProduction) { alert('Please select a production first.'); return; }
    const isCallSheet = docItem.id === 'call-sheet';
    const ctx = await getContext(isCallSheet);
    if (!ctx.production) return;
    setGenerating(docItem.id + '-preview');
    try {
      const dataUri = await docItem.generate({ ...ctx, preview: true }) as string;
      setPreview({ title: docItem.title, dataUri, docItem });
    } catch (e) {
      console.error(e);
      alert('Error generating preview.');
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = async (docItem: typeof DOCS[0]) => {
    if (!selectedProduction) { alert('Please select a production first.'); return; }
    const ctx = await getContext(docItem.id === 'call-sheet');
    if (!ctx.production) return;
    setGenerating(docItem.id + '-download');
    try {
      await docItem.generate({ ...ctx, preview: false });
    } catch (e) {
      console.error(e);
      alert('Error generating document.');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 text-sm mt-1">Generate professional production documents as PDF</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select production</label>
        <select
          className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          value={selectedProduction}
          onChange={e => setSelectedProduction(e.target.value)}
        >
          <option value="">Choose a production…</option>
          {productions.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
          ))}
        </select>
        {!selectedProduction && (
          <p className="text-xs text-gray-600 mt-2">All documents will be pre-filled with the selected production's data.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOCS.map(docItem => (
          <div key={docItem.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <div className={`inline-flex p-2.5 rounded-xl mb-3 w-fit ${docItem.color}`}>
              <docItem.icon size={20} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{docItem.title}</h3>
            <p className="text-xs text-gray-600 mb-4 flex-1">{docItem.desc}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePreview(docItem)}
                disabled={!selectedProduction || generating !== null}
                className="flex items-center justify-center gap-1.5 flex-1 border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <Eye size={13} />
                {generating === docItem.id + '-preview' ? 'Loading…' : 'Preview'}
              </button>
              <button
                onClick={() => handleDownload(docItem)}
                disabled={!selectedProduction || generating !== null}
                className="flex items-center justify-center gap-1.5 flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-black disabled:opacity-40 transition-colors"
              >
                <Download size={13} />
                {generating === docItem.id + '-download' ? 'Generating…' : 'Download'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* PDF Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
              <h2 className="font-semibold text-gray-900">{preview.title} — Preview</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(preview.docItem)}
                  disabled={generating !== null}
                  className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-black disabled:opacity-40"
                >
                  <Download size={13} />
                  {generating ? 'Downloading…' : 'Download PDF'}
                </button>
                <button onClick={() => setPreview(null)} className="p-1.5 text-gray-600 hover:text-gray-700">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={preview.dataUri}
              className="flex-1 w-full rounded-b-2xl"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

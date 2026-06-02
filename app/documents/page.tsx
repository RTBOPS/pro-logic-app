'use client';

import { useState } from 'react';
import { useData } from '@/hooks/useData';
import {
  FileText, Users, MapPin, Film, Shield, UserCheck,
  ClipboardList, BookImage, Printer
} from 'lucide-react';
import { generateCallSheet } from '@/lib/pdf/callsheet';
import { generateNDA } from '@/lib/pdf/nda';
import { generateCrewDeal } from '@/lib/pdf/crew-deal';
import { generateLocationRelease } from '@/lib/pdf/location-release';
import { generateShotList } from '@/lib/pdf/shot-list';
import { generateStripboard } from '@/lib/pdf/stripboard';
import { generateCharacterBreakdown } from '@/lib/pdf/character-breakdown';

const DOCS = [
  {
    id: 'call-sheet',
    title: 'Call Sheet',
    desc: 'Daily production schedule for cast & crew',
    icon: ClipboardList,
    color: 'bg-blue-50 text-blue-600',
    generate: generateCallSheet,
  },
  {
    id: 'stripboard',
    title: 'Stripboard',
    desc: 'Professional scene scheduling board',
    icon: Film,
    color: 'bg-purple-50 text-purple-600',
    generate: generateStripboard,
  },
  {
    id: 'shot-list',
    title: 'Shot List',
    desc: 'Detailed list of all planned shots',
    icon: FileText,
    color: 'bg-green-50 text-green-600',
    generate: generateShotList,
  },
  {
    id: 'nda',
    title: 'Non-Disclosure Agreement',
    desc: 'NDA pre-filled with production data',
    icon: Shield,
    color: 'bg-red-50 text-red-600',
    generate: generateNDA,
  },
  {
    id: 'character-breakdown',
    title: 'Character Breakdown',
    desc: 'Character profiles for casting & production',
    icon: UserCheck,
    color: 'bg-orange-50 text-orange-600',
    generate: generateCharacterBreakdown,
  },
  {
    id: 'location-release',
    title: 'Location Release Agreement',
    desc: 'Permission to film at a location',
    icon: MapPin,
    color: 'bg-teal-50 text-teal-600',
    generate: generateLocationRelease,
  },
  {
    id: 'crew-deal',
    title: 'Crew Deal Memo & Contract',
    desc: 'Standard crew deal memo with payment terms',
    icon: Users,
    color: 'bg-indigo-50 text-indigo-600',
    generate: generateCrewDeal,
  },
];

export default function DocumentsPage() {
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const { data: locations } = useData('locations');
  const { data: inventory } = useData('inventory');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (doc: typeof DOCS[0]) => {
    if (!selectedProduction) {
      alert('Please select a production first.');
      return;
    }
    const production = productions.find((p: any) => p.id === selectedProduction);
    if (!production) return;

    setGenerating(doc.id);
    try {
      await doc.generate({ production, crew, locations, inventory });
    } catch (e) {
      console.error(e);
      alert('Error generating document. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 text-sm mt-1">Generate professional production documents as PDF</p>
      </div>

      {/* Production selector */}
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
          <p className="text-xs text-gray-400 mt-2">All documents will be pre-filled with the selected production's data.</p>
        )}
      </div>

      {/* Document grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOCS.map(docItem => (
          <div
            key={docItem.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col"
          >
            <div className={`inline-flex p-2.5 rounded-xl mb-3 w-fit ${docItem.color}`}>
              <docItem.icon size={20} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{docItem.title}</h3>
            <p className="text-xs text-gray-400 mb-4 flex-1">{docItem.desc}</p>
            <button
              onClick={() => handleGenerate(docItem)}
              disabled={!selectedProduction || generating === docItem.id}
              className="flex items-center justify-center gap-2 w-full bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-black disabled:opacity-40 transition-colors"
            >
              <Printer size={14} />
              {generating === docItem.id ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

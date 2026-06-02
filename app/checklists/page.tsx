'use client';

import { useState, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, Circle, Printer, RotateCcw } from 'lucide-react';

const DEFAULT_CHECKLISTS = {
  camera: {
    label: 'Camera Package',
    emoji: '📷',
    items: [
      'Camera body A', 'Camera body B', 'Camera monitor', 'Follow focus',
      'Lens set (primes)', 'Zoom lens', 'ND filter set', 'Matte box',
      'Top handle', 'Shoulder rig', 'Battery charger', 'Batteries (x4)',
      'CFexpress cards (x6)', 'Card reader', 'Cleaning kit', 'Camera bag',
    ],
  },
  audio: {
    label: 'Audio Package',
    emoji: '🎙️',
    items: [
      'Sound recorder', 'Boom mic (shotgun)', 'Lavalier mics (x4)',
      'Wireless transmitters (x4)', 'Wireless receivers (x4)',
      'Boom pole', 'Windscreen / blimp', 'Headphones',
      'XLR cables (x6)', 'Audio bag', 'Batteries AA (x20)',
      'Sound report forms', 'Slate / clapperboard',
    ],
  },
  lighting: {
    label: 'Lighting Package',
    emoji: '💡',
    items: [
      'Key light', 'Fill light', 'Back / rim light',
      'Practicals (x4)', 'LED panel (x2)', 'HMI fresnel',
      'Light stands (x6)', 'C-stands (x4)', 'Sandbags (x8)',
      'Dimmer / DMX controller', 'Power distribution box',
      'Extension cables (x4)', 'Stingers (x6)',
      'Color gels set', 'Diffusion frames', 'Bounce card',
      'Black wrap', 'Gaffer tape', 'Spare bulbs',
    ],
  },
  grip: {
    label: 'Grip Package',
    emoji: '🔧',
    items: [
      'Tripod system', 'Fluid head', 'Dolly + track',
      'Gimbal stabilizer', 'Slider 100cm', 'Jib arm',
      'Apple boxes (x4)', 'Grip clips (x10)',
      'Clamps (x8)', 'Arms (x4)', 'Gobo head', 'Flags (4x4)',
      'Silk diffusion 6x6', 'Black net 6x6', 'Hardware kit',
    ],
  },
  production: {
    label: 'Production Essentials',
    emoji: '📋',
    items: [
      'Call sheets (printed)', 'Script sides', 'Shot list',
      'Storyboard printout', 'NDA forms', 'Talent releases',
      'Location release', 'Walkie talkies (x6)',
      'First aid kit', 'Craft services supplies',
      'Parking permits', 'Location map printout',
      'Emergency contact list', 'Director chair',
      'Production table', 'Laptop / DIT station',
    ],
  },
  video: {
    label: 'Video / Tech',
    emoji: '🖥️',
    items: [
      'Director monitor (17")', 'HDMI / SDI cables (x6)',
      'Video village cart', 'External recorder',
      'Teleprompter', 'HDMI splitter',
      'Wireless video transmitter', 'Wireless video receiver',
      'Screen (for projection)', 'Projector',
      'Hard drives (x3)', 'RAID backup drive',
    ],
  },
};

type ChecklistId = keyof typeof DEFAULT_CHECKLISTS;

export default function ChecklistsPage() {
  const { data: productions } = useData('productions');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [activeList, setActiveList] = useState<ChecklistId>('camera');

  useEffect(() => {
    if (!selectedProduction) return;
    const ref = doc(db, 'productions', selectedProduction, 'checklists', 'main');
    return onSnapshot(ref, snap => {
      if (snap.exists()) setChecks(snap.data() as any);
      else setChecks({});
    });
  }, [selectedProduction]);

  const toggle = async (listId: string, item: string) => {
    if (!selectedProduction) return;
    const updated = {
      ...checks,
      [listId]: {
        ...(checks[listId] || {}),
        [item]: !checks[listId]?.[item],
      },
    };
    setChecks(updated);
    await setDoc(doc(db, 'productions', selectedProduction, 'checklists', 'main'), updated);
  };

  const resetList = async (listId: string) => {
    if (!selectedProduction || !confirm('Reset this checklist?')) return;
    const updated = { ...checks, [listId]: {} };
    setChecks(updated);
    await setDoc(doc(db, 'productions', selectedProduction, 'checklists', 'main'), updated);
  };

  const current = DEFAULT_CHECKLISTS[activeList];
  const listChecks = checks[activeList] || {};
  const checkedCount = current.items.filter(i => listChecks[i]).length;
  const progress = Math.round((checkedCount / current.items.length) * 100);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment Checklists</h1>
          <p className="text-gray-500 text-sm mt-1">Pre-shoot verification</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700"
            value={selectedProduction}
            onChange={e => setSelectedProduction(e.target.value)}
          >
            <option value="">Select production…</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => window.print()} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          Select a production to start checking equipment.
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar: list tabs */}
          <div className="w-48 shrink-0 space-y-1">
            {(Object.entries(DEFAULT_CHECKLISTS) as [ChecklistId, typeof DEFAULT_CHECKLISTS[ChecklistId]][]).map(([id, list]) => {
              const c = checks[id] || {};
              const done = list.items.filter(i => c[i]).length;
              const pct = Math.round((done / list.items.length) * 100);
              return (
                <button
                  key={id}
                  onClick={() => setActiveList(id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${activeList === id ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{list.emoji}</span>
                    <span className="text-sm font-medium">{list.label}</span>
                  </div>
                  <div className="mt-1.5">
                    <div className={`h-1 rounded-full ${activeList === id ? 'bg-white/20' : 'bg-gray-200'}`}>
                      <div
                        className={`h-1 rounded-full transition-all ${pct === 100 ? 'bg-green-400' : activeList === id ? 'bg-white' : 'bg-blue-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className={`text-xs mt-0.5 ${activeList === id ? 'text-white/60' : 'text-gray-400'}`}>{done}/{list.items.length}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Checklist */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <span className="text-xl">{current.emoji}</span>
                <div>
                  <div className="font-semibold text-gray-900">{current.label}</div>
                  <div className="text-xs text-gray-400">{checkedCount} of {current.items.length} checked</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Progress ring */}
                <div className="relative w-10 h-10">
                  <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={progress === 100 ? '#16a34a' : '#3b82f6'} strokeWidth="3"
                      strokeDasharray={`${progress} ${100 - progress}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{progress}%</span>
                </div>
                <button onClick={() => resetList(activeList)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" title="Reset list">
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {current.items.map(item => {
                const checked = !!listChecks[item];
                return (
                  <div
                    key={item}
                    onClick={() => toggle(activeList, item)}
                    className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors ${checked ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                  >
                    {checked
                      ? <CheckCircle size={18} className="text-green-500 shrink-0" />
                      : <Circle size={18} className="text-gray-300 shrink-0" />}
                    <span className={`text-sm ${checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item}</span>
                  </div>
                );
              })}
            </div>

            {progress === 100 && (
              <div className="flex items-center justify-center gap-2 py-4 bg-green-50 border-t border-green-100">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm font-medium text-green-700">All items checked — ready to shoot!</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

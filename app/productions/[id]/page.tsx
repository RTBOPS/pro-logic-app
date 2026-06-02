'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useData } from '@/hooks/useData';
import Link from 'next/link';
import { ArrowLeft, Users, Package, Plus, X } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUSES = ['new', 'active', 'completed', 'cancelled'];

export default function ProductionDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [production, setProduction] = useState<any>(null);
  const [assignedCrew, setAssignedCrew] = useState<any[]>([]);
  const [assignedGear, setAssignedGear] = useState<any[]>([]);
  const { data: allCrew } = useData('crew');
  const { data: allInventory } = useData('inventory');
  const { data: locations } = useData('locations');
  const [loading, setLoading] = useState(true);

  const loadProduction = async () => {
    const snap = await getDoc(doc(db, 'productions', id));
    if (snap.exists()) setProduction({ id: snap.id, ...snap.data() });
    setLoading(false);
  };

  const loadAssignments = async () => {
    const crewSnap = await getDocs(collection(db, 'productions', id, 'crew'));
    setAssignedCrew(crewSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const gearSnap = await getDocs(collection(db, 'productions', id, 'equipment'));
    setAssignedGear(gearSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    loadProduction();
    loadAssignments();
  }, [id]);

  const updateStatus = async (status: string) => {
    await updateDoc(doc(db, 'productions', id), { status });
    setProduction((p: any) => ({ ...p, status }));
  };

  const addCrew = async (crewId: string) => {
    if (assignedCrew.find(c => c.crew_id === crewId)) return;
    const member = allCrew.find((c: any) => c.id === crewId);
    if (!member) return;
    await addDoc(collection(db, 'productions', id, 'crew'), {
      crew_id: crewId,
      name: `${member.name} ${member.last_name}`,
      role: member.role,
      picture: member.picture,
    });
    await loadAssignments();
  };

  const removeCrew = async (assignId: string) => {
    await deleteDoc(doc(db, 'productions', id, 'crew', assignId));
    await loadAssignments();
  };

  const addEquipment = async (itemId: string) => {
    if (assignedGear.find(g => g.item_id === itemId)) return;
    const item = allInventory.find((i: any) => i.id === itemId);
    if (!item) return;
    await addDoc(collection(db, 'productions', id, 'equipment'), {
      item_id: itemId,
      name: item.name,
      brand: item.brand,
      model: item.model,
    });
    await loadAssignments();
  };

  const removeEquipment = async (assignId: string) => {
    await deleteDoc(doc(db, 'productions', id, 'equipment', assignId));
    await loadAssignments();
  };

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>;
  if (!production) return <div className="p-8 text-red-500">Production not found.</div>;

  const location = locations.find((l: any) => l.id === production.location_id);
  const unassignedCrew = allCrew.filter((c: any) => !assignedCrew.find(a => a.crew_id === c.id));
  const unassignedGear = allInventory.filter((i: any) => !assignedGear.find(a => a.item_id === i.id));

  return (
    <div className="p-8">
      <Link href="/productions" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={14} /> Back to Productions
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{production.name}</h1>
            <p className="text-gray-500 mt-1">{production.client}</p>
            {location && <p className="text-sm text-gray-400 mt-0.5">{location.name}</p>}
          </div>
          <select
            value={production.status}
            onChange={e => updateStatus(e.target.value)}
            className={`border-0 rounded-full px-3 py-1 text-sm font-medium cursor-pointer ${STATUS_COLOR[production.status] || 'bg-gray-100 text-gray-600'}`}
          >
            {STATUSES.map(s => (
              <option key={s} value={s} className="bg-white text-gray-800 capitalize">{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Crew */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Users size={16} /> Crew ({assignedCrew.length})
            </div>
            {unassignedCrew.length > 0 && (
              <select
                onChange={e => { if (e.target.value) { addCrew(e.target.value); e.target.value = ''; } }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
                defaultValue=""
              >
                <option value="">+ Add crew</option>
                {unassignedCrew.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.last_name}</option>
                ))}
              </select>
            )}
          </div>
          {assignedCrew.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">No crew assigned</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {assignedCrew.map(c => (
                <li key={c.id} className="flex items-center gap-3 px-6 py-3">
                  {c.picture && <img src={c.picture} className="w-8 h-8 rounded-full object-cover" alt="" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.role}</div>
                  </div>
                  <button onClick={() => removeCrew(c.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Equipment */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <Package size={16} /> Equipment ({assignedGear.length})
            </div>
            {unassignedGear.length > 0 && (
              <select
                onChange={e => { if (e.target.value) { addEquipment(e.target.value); e.target.value = ''; } }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
                defaultValue=""
              >
                <option value="">+ Add equipment</option>
                {unassignedGear.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.name} — {i.brand}</option>
                ))}
              </select>
            )}
          </div>
          {assignedGear.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">No equipment assigned</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {assignedGear.map(g => (
                <li key={g.id} className="flex items-center gap-3 px-6 py-3">
                  <Package size={14} className="text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{g.name}</div>
                    <div className="text-xs text-gray-400">{g.brand} {g.model}</div>
                  </div>
                  <button onClick={() => removeEquipment(g.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Truck } from 'lucide-react';

const VEHICLE_TYPES = ['Production Van', 'Cube Truck', 'Grip Truck', 'Camera Car', 'Picture Car', 'Passenger Van', 'SUV', 'Sedan', 'Motorcycle', 'Golf Cart', 'Sprinter Van', 'Box Truck', 'Flatbed', 'Generator Truck', 'Other'];
const VEHICLE_STATUSES = ['Available', 'In Use', 'Reserved', 'In Maintenance', 'Out of Service'];
const FUEL_TYPES = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Other'];

const empty = {
  name: '', type: '', make: '', model: '', year: '', plate: '', vin: '',
  color: '', seats: '', fuel_type: '', status: 'Available',
  driver_name: '', driver_phone: '',
  insurance_policy: '', insurance_expiry: '',
  registration_expiry: '', mileage: '',
  daily_rate_usd: '', notes: '',
};

export default function TransportationPage() {
  const { data: vehicles, loading } = useData('transportation');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);

  const STATUS_COLOR: Record<string, string> = {
    Available: 'bg-green-100 text-green-700',
    'In Use': 'bg-blue-100 text-blue-700',
    Reserved: 'bg-purple-100 text-purple-700',
    'In Maintenance': 'bg-yellow-100 text-yellow-700',
    'Out of Service': 'bg-red-100 text-red-600',
  };

  const open = (v?: any) => {
    if (v) {
      setForm(Object.fromEntries(Object.keys(empty).map(k => [k, v[k] ?? ''])) as typeof empty);
      setEditId(v.id);
    } else {
      setForm(empty); setEditId(null);
    }
    setModal(v ? 'edit' : 'create');
  };
  const close = () => { setModal(null); setEditId(null); };

  const save = async () => {
    if (!form.name) return;
    if (modal === 'create') await addDoc(collection(db, 'transportation'), form);
    else if (editId) await updateDoc(doc(db, 'transportation', editId), form);
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this vehicle?')) return;
    await deleteDoc(doc(db, 'transportation', id));
  };

  const fld = (label: string, k: keyof typeof empty, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const sel = (label: string, k: keyof typeof empty, opts: string[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}>
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transportation</h1>
          <p className="text-gray-500 text-sm mt-1">{vehicles.length} vehicles</p>
        </div>
        <button onClick={() => open()}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-700">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {loading ? <div className="text-gray-400 text-sm">Loading…</div>
        : vehicles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
            No vehicles yet. Add your production fleet.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3">Vehicle</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Plate / VIN</th>
                  <th className="text-left px-5 py-3">Driver</th>
                  <th className="text-left px-5 py-3">Rate</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vehicles.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-gray-400 shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">{v.name}</div>
                          <div className="text-xs text-gray-400">{[v.year, v.make, v.model, v.color].filter(Boolean).join(' ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{v.type || '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {v.plate && <div className="font-mono">{v.plate}</div>}
                      {v.vin && <div className="text-gray-400 text-xs">{v.vin.slice(-8)}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {v.driver_name && <div>{v.driver_name}</div>}
                      {v.driver_phone && <div>{v.driver_phone}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600">
                      {v.daily_rate_usd ? `$${v.daily_rate_usd}/day` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[v.status] || 'bg-gray-100 text-gray-600'}`}>
                        {v.status || 'Available'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => open(v)} className="text-gray-400 hover:text-gray-700"><Pencil size={14} /></button>
                        <button onClick={() => remove(v.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {modal && (
        <Modal title={modal === 'create' ? 'Add Vehicle' : 'Edit Vehicle'} onClose={close}>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {fld('Vehicle name *', 'name', 'Production Van #1')}
              {sel('Type', 'type', VEHICLE_TYPES)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {fld('Make', 'make', 'Ford')}
              {fld('Model', 'model', 'Transit')}
              {fld('Year', 'year', '2023')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fld('Color', 'color', 'White')}
              {fld('Seats', 'seats', '12', 'number')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fld('License Plate', 'plate', 'ABC-1234')}
              {fld('VIN', 'vin', '1HGBH41...')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sel('Fuel Type', 'fuel_type', FUEL_TYPES)}
              {sel('Status', 'status', VEHICLE_STATUSES)}
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Driver</p>
              <div className="grid grid-cols-2 gap-3">
                {fld('Driver name', 'driver_name', 'Full name')}
                {fld('Driver phone', 'driver_phone', '+1 555…', 'tel')}
              </div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Insurance & Docs</p>
              <div className="grid grid-cols-2 gap-3">
                {fld('Insurance Policy #', 'insurance_policy', 'POL-12345')}
                {fld('Insurance Expiry', 'insurance_expiry', '', 'date')}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {fld('Registration Expiry', 'registration_expiry', '', 'date')}
                {fld('Current Mileage', 'mileage', '45000', 'number')}
              </div>
            </div>
            {fld('Daily Rate (USD)', 'daily_rate_usd', '250', 'number')}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={save} disabled={!form.name}
              className="flex-1 bg-zinc-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700">
              {modal === 'create' ? 'Add vehicle' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

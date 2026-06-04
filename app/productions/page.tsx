'use client';

import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { useRouter } from 'next/navigation';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';

const STATUSES = ['Planning', 'Pre-Production', 'Active', 'On Hold', 'Completed', 'Cancelled'];
const PROD_TYPES = ['Commercial', 'Corporate Video', 'Music Video', 'Feature Film', 'Short Film', 'Documentary', 'Live Event', 'Social Content', 'Other'];
const BILLING_STATUSES = ['Estimate', 'Quoted', 'Pending', 'Invoiced', 'Paid', 'Overdue'];
const ASPECT_RATIOS = ['16:9', '9:16', '4:3', '1:1', '2.39:1', '2.35:1', '1.85:1', '2:1'];
const RESOLUTIONS = ['4K UHD', '4K DCI', '6K', '8K', '2K', '1080p', '720p'];
const FRAME_RATES = ['23.976 fps', '24 fps', '25 fps', '29.97 fps', '30 fps', '50 fps', '59.94 fps', '60 fps', '120 fps'];

const STATUS_COLOR: Record<string, string> = {
  Planning:        'bg-blue-100 text-blue-700',
  'Pre-Production':'bg-purple-100 text-purple-700',
  Active:          'bg-green-100 text-green-700',
  'On Hold':       'bg-yellow-100 text-yellow-700',
  Completed:       'bg-gray-100 text-gray-600',
  Cancelled:       'bg-red-100 text-red-600',
};

const empty = {
  // Basic
  name: '', production_code: '', production_type: '', client: '', agency: '',
  production_company: '', status: 'Planning', project_description: '',
  // Key crew
  director: '', producer: '', line_producer: '', production_manager: '',
  // Dates & location
  start_date: '', end_date: '', prep_start_date: '', wrap_date: '',
  country: '', city: '', primary_location: '', additional_locations: '',
  location_id: '',
  // Finance
  budget_estimate_usd: '', currency: 'USD', billing_status: '', payment_terms: '',
  // Logistics
  call_time: '', wrap_time: '', crew_call_location: '', basecamp_location: '',
  parking_location: '', hospital_nearest: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  // Legal
  insurance_required: false, permit_required: false, permit_status: '',
  location_release_status: '', talent_release_status: '', music_rights_status: '',
  // Crew & Equipment needs
  equipment_needed: '', vehicles_needed: '', catering_needed: false,
  lodging_needed: false, travel_needed: false,
  number_of_crew: '', number_of_cast: '', number_of_extras: '',
  // Technical
  power_requirements: '', voltage_standard: '', generator_required: false,
  data_storage_plan: '', deliverables: '',
  aspect_ratio: '16:9', resolution: '4K UHD', frame_rate: '23.976 fps',
  audio_format: '48 kHz WAV',
};

export default function ProductionsPage() {
  const router = useRouter();
  const { data: productions, loading } = useData('productions');
  const { data: locations } = useData('locations');
  const { data: crew } = useData('crew');
  const { data: inventory } = useData('inventory');
  const { data: transportation } = useData('transportation');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(empty);
  const [formTab, setFormTab] = useState<'basic' | 'dates' | 'logistics' | 'technical'>('basic');
  const [editId, setEditId] = useState<string | null>(null);

  const openCreate = () => { setForm(empty); setFormTab('basic'); setModal('create'); };
  const openEdit = (p: any) => {
    const keys = Object.keys(empty) as (keyof typeof empty)[];
    const f: any = {};
    for (const k of keys) f[k] = p[k] ?? (empty[k]);
    setForm(f);
    setEditId(p.id);
    setFormTab('basic');
    setModal('edit');
  };
  const close = () => { setModal(null); setEditId(null); };

  const save = async () => {
    if (!form.name || !form.client) return;
    if (modal === 'create') {
      await addDoc(collection(db, 'productions'), form);
    } else if (editId) {
      await updateDoc(doc(db, 'productions', editId), form);
    }
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this production?')) return;
    await deleteDoc(doc(db, 'productions', id));
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productions</h1>
          <p className="text-gray-500 text-sm mt-1">{productions.length} total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800 transition-colors"
        >
          <Plus size={16} /> New Production
        </button>
      </div>

      {loading ? (
        <div className="text-gray-600 text-sm">Loading…</div>
      ) : productions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
          No productions yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {productions.map((p: any) => {
              const loc = locations.find((l: any) => l.id === p.location_id);
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/productions/${p.id}`} className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.client}{loc?.name ? ` · ${loc.name}` : ''}</div>
                      {p.start_date && <div className="text-xs text-gray-600 mt-1">{new Date(p.start_date+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</div>}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status]||'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                      <button onClick={() => openEdit(p)} className="text-gray-600 hover:text-gray-700"><Pencil size={14}/></button>
                      <button onClick={() => remove(p.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Desktop table */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-6 py-3">Dates</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Location</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {productions.map((p: any) => {
                const loc = locations.find((l: any) => l.id === p.location_id);
                return (
                  <tr key={p.id} className="hover:bg-blue-50 cursor-pointer group" onClick={() => router.push(`/productions/${p.id}`)}>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-1">
                        {p.name}<ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.client}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {p.start_date ? (<span>{new Date(p.start_date+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}{p.end_date&&<> → {new Date(p.end_date+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</>}</span>) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[p.status]||'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{loc?.name||'—'}</td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="text-gray-600 hover:text-gray-700 transition-colors"><Pencil size={15}/></button>
                        <button onClick={() => remove(p.id)} className="text-gray-600 hover:text-red-600 transition-colors"><Trash2 size={15}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'New Production' : 'Edit Production'} onClose={close}>
          {/* Tabs */}
          <div className="flex gap-0 border-b mb-4 -mx-1">
            {([
              { id: 'basic', label: 'Basic Info' },
              { id: 'dates', label: 'Dates & Location' },
              { id: 'logistics', label: 'Logistics' },
              { id: 'technical', label: 'Technical' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setFormTab(t.id)}
                className={`px-3 py-2 text-xs transition-colors border-b-2 ${formTab === t.id ? 'border-black text-black font-medium' : 'border-transparent text-gray-600 hover:text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {formTab === 'basic' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Name *" k="name" form={form} setForm={setForm} placeholder="Production name" />
                  <PF label="Production Code" k="production_code" form={form} setForm={setForm} placeholder="PL-2026-001" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Client *" k="client" form={form} setForm={setForm} placeholder="Client company" />
                  <PF label="Agency" k="agency" form={form} setForm={setForm} placeholder="Ad agency" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Production Company" k="production_company" form={form} setForm={setForm} placeholder="PRO-LOGIC Studio" />
                  <PSel label="Type" k="production_type" form={form} setForm={setForm} options={PROD_TYPES} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PSel label="Status" k="status" form={form} setForm={setForm} options={STATUSES} />
                  <PSel label="Billing Status" k="billing_status" form={form} setForm={setForm} options={BILLING_STATUSES} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Budget (USD)" k="budget_estimate_usd" form={form} setForm={setForm} placeholder="0" type="number" />
                  <PF label="Payment Terms" k="payment_terms" form={form} setForm={setForm} placeholder="Net 30 / 50% deposit" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Project Description</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    rows={2} value={form.project_description}
                    onChange={e => setForm({ ...form, project_description: e.target.value })} />
                </div>
                <div className="border-t pt-2 mt-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Key Crew</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['director', 'producer', 'line_producer', 'production_manager'] as const).map(k => {
                      const labels: Record<string, string> = { director: 'Director', producer: 'Producer', line_producer: 'Line Producer', production_manager: 'Production Manager' };
                      return (
                        <div key={k}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{labels[k]}</label>
                          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={form[k] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))}>
                            <option value="">— Select or type —</option>
                            {crew.map((c: any) => (
                              <option key={c.id} value={`${c.name} ${c.last_name}`}>{c.name} {c.last_name}{c.role ? ` (${c.role})` : ''}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {formTab === 'dates' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Prep Start" k="prep_start_date" form={form} setForm={setForm} type="date" />
                  <PF label="Shoot Start" k="start_date" form={form} setForm={setForm} type="date" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Shoot End" k="end_date" form={form} setForm={setForm} type="date" />
                  <PF label="Wrap Date" k="wrap_date" form={form} setForm={setForm} type="date" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Call Time" k="call_time" form={form} setForm={setForm} placeholder="06:00" />
                  <PF label="Wrap Time" k="wrap_time" form={form} setForm={setForm} placeholder="18:00" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Country" k="country" form={form} setForm={setForm} placeholder="USA" />
                  <PF label="City" k="city" form={form} setForm={setForm} placeholder="Austin, TX" />
                </div>
                <PF label="Primary Location" k="primary_location" form={form} setForm={setForm} placeholder="Circuit of the Americas" />
                <PF label="Additional Locations" k="additional_locations" form={form} setForm={setForm} placeholder="Downtown; Hill Country" />
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Location (from saved locations)</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })}>
                    <option value="">— None —</option>
                    {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </>
            )}

            {formTab === 'logistics' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Crew Call Location" k="crew_call_location" form={form} setForm={setForm} />
                  <PF label="Basecamp Location" k="basecamp_location" form={form} setForm={setForm} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Parking Location" k="parking_location" form={form} setForm={setForm} />
                  <PF label="Nearest Hospital" k="hospital_nearest" form={form} setForm={setForm} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Emergency Contact" k="emergency_contact_name" form={form} setForm={setForm} />
                  <PF label="Emergency Phone" k="emergency_contact_phone" form={form} setForm={setForm} type="tel" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <PF label="# Crew" k="number_of_crew" form={form} setForm={setForm} type="number" />
                  <PF label="# Cast" k="number_of_cast" form={form} setForm={setForm} type="number" />
                  <PF label="# Extras" k="number_of_extras" form={form} setForm={setForm} type="number" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Permit Status" k="permit_status" form={form} setForm={setForm} placeholder="Approved / In Progress…" />
                  <PF label="Location Release" k="location_release_status" form={form} setForm={setForm} placeholder="Approved / Pending…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Talent Release" k="talent_release_status" form={form} setForm={setForm} placeholder="Required / Pending…" />
                  <PF label="Music Rights" k="music_rights_status" form={form} setForm={setForm} placeholder="Cleared / Pending…" />
                </div>
                <div className="flex gap-6 py-1 flex-wrap">
                  <PCk label="Insurance required" k="insurance_required" form={form} setForm={setForm} />
                  <PCk label="Permit required" k="permit_required" form={form} setForm={setForm} />
                  <PCk label="Catering" k="catering_needed" form={form} setForm={setForm} />
                  <PCk label="Lodging" k="lodging_needed" form={form} setForm={setForm} />
                  <PCk label="Travel" k="travel_needed" form={form} setForm={setForm} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vehicles needed <span className="text-gray-600 font-normal">(from Transportation)</span></label>
                  {transportation.length === 0 ? (
                    <p className="text-xs text-gray-600 border border-dashed border-gray-200 rounded-lg px-3 py-2">No vehicles yet — add them in <strong>Transportation</strong> first.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                      {transportation.map((v: any) => {
                        const selected = (form.vehicles_needed || '').split(';').filter(Boolean).includes(v.name);
                        return (
                          <label key={v.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
                            <input type="checkbox" checked={selected} className="rounded"
                              onChange={e => {
                                const parts = (form.vehicles_needed || '').split(';').filter(Boolean);
                                const updated = e.target.checked ? [...parts, v.name] : parts.filter(x => x !== v.name);
                                setForm((f: any) => ({ ...f, vehicles_needed: updated.join(';') }));
                              }} />
                            <span className="text-sm text-gray-800">{v.name}</span>
                            {v.type && <span className="text-xs text-gray-600">{v.type}</span>}
                            {v.plate && <span className="text-xs text-gray-600 ml-auto">{v.plate}</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Equipment needed <span className="text-gray-600 font-normal">(from Inventory)</span></label>
                  {inventory.length === 0 ? (
                    <p className="text-xs text-gray-600 border border-dashed border-gray-200 rounded-lg px-3 py-2">No inventory yet — add items in <strong>Inventory</strong> first.</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto divide-y divide-gray-100">
                      {inventory.map((i: any) => {
                        const selected = (form.equipment_needed || '').split(';').filter(Boolean).includes(i.name);
                        return (
                          <label key={i.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
                            <input type="checkbox" checked={selected} className="rounded"
                              onChange={e => {
                                const parts = (form.equipment_needed || '').split(';').filter(Boolean);
                                const updated = e.target.checked ? [...parts, i.name] : parts.filter(x => x !== i.name);
                                setForm((f: any) => ({ ...f, equipment_needed: updated.join(';') }));
                              }} />
                            <span className="text-sm text-gray-800 truncate">{i.name}</span>
                            {i.brand && <span className="text-xs text-gray-600 shrink-0">{i.brand}</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {formTab === 'technical' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <PSel label="Aspect Ratio" k="aspect_ratio" form={form} setForm={setForm} options={ASPECT_RATIOS} />
                  <PSel label="Resolution" k="resolution" form={form} setForm={setForm} options={RESOLUTIONS} />
                  <PSel label="Frame Rate" k="frame_rate" form={form} setForm={setForm} options={FRAME_RATES} />
                </div>
                <PF label="Audio Format" k="audio_format" form={form} setForm={setForm} placeholder="48 kHz WAV" />
                <div className="grid grid-cols-2 gap-3">
                  <PF label="Power Requirements" k="power_requirements" form={form} setForm={setForm} placeholder="High draw; 2x 6500W" />
                  <PF label="Voltage Standard" k="voltage_standard" form={form} setForm={setForm} placeholder="120V / 240V" />
                </div>
                <PCk label="Generator required" k="generator_required" form={form} setForm={setForm} />
                <PF label="Data Storage Plan" k="data_storage_plan" form={form} setForm={setForm} placeholder="Dual SSD + cloud copy" />
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Deliverables</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    rows={2} value={form.deliverables}
                    onChange={e => setForm({ ...form, deliverables: e.target.value })}
                    placeholder="30s master; 15s cutdown; social crops" />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={save} disabled={!form.name || !form.client}
              className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-800">
              {modal === 'create' ? 'Create' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PF({ label, k, form, setForm, placeholder = '', type = 'text' }: { label: string; k: string; form: any; setForm: any; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[k] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} />
    </div>
  );
}
function PSel({ label, k, form, setForm, options }: { label: string; k: string; form: any; setForm: any; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        value={form[k] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function PCk({ label, k, form, setForm }: { label: string; k: string; form: any; setForm: any }) {
  return (
    <div className="flex items-center gap-2">
      <input type="checkbox" checked={!!form[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.checked }))} className="rounded" />
      <label className="text-sm text-gray-700">{label}</label>
    </div>
  );
}

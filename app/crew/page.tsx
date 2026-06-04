'use client';

import { useState, useMemo, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Search, Mail, Phone, Upload, Users, Merge, BookUser } from 'lucide-react';
import { DEPARTMENTS, deptColor, deptLabel } from '@/lib/departments';
import { useNamespace } from '@/hooks/useNamespace';
import PageHeader from '@/components/PageHeader';

const DEFAULT_PICTURE = 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg';

const UNION_STATUSES = ['Non-Union', 'Union', 'SAG-AFTRA', 'IATSE', 'Teamsters', 'Other'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'];
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const SHOE_SIZES_US = ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '14', '15'];

const ROLES_BY_DEPT: Record<string, string[]> = {
  production: ['Executive Producer', 'Producer', 'Line Producer', 'Production Manager', 'Production Coordinator', 'Production Assistant', 'Unit Production Manager', 'Post Production Supervisor'],
  direction: ['Director', '1st AD', '2nd AD', 'Script Supervisor', 'Continuity Supervisor'],
  camera: ['Director of Photography', 'Camera Operator', '1st AC', '2nd AC', 'DIT', 'Steadicam Operator', 'Camera PA', 'Drone Operator'],
  electric: ['Gaffer', 'Best Boy Electric', 'Electrician', 'Lighting Technician', 'Dimmer Board Operator'],
  grip: ['Key Grip', 'Best Boy Grip', 'Grip', 'Dolly Grip', 'Rigging Grip'],
  audio: ['Production Sound Mixer', 'Boom Operator', 'Sound Assistant', 'Playback Operator'],
  art: ['Production Designer', 'Art Director', 'Set Decorator', 'Prop Master', 'Prop Assistant', 'Set Dresser', 'Scenic Painter'],
  wardrobe: ['Costume Designer', 'Wardrobe Stylist', 'Wardrobe Assistant', 'Key Makeup Artist', 'Makeup Artist', 'Key Hair Stylist', 'Hair Stylist'],
  vfx: ['VFX Supervisor', 'VFX Producer', 'Compositor', 'Motion Graphics', 'Colorist', 'Editor', 'Assistant Editor'],
  cast: ['Lead Actor', 'Supporting Actor', 'Day Player', 'Stand-In', 'Stunt Performer', 'Voice Actor'],
  transportation: ['Transportation Coordinator', 'Driver Captain', 'Driver', 'Picture Car Coordinator'],
  catering: ['Craft Service', 'Catering Manager', 'Chef'],
  other: ['Other'],
};
const CLASSIFICATIONS = ['Crew', 'Cast', 'Extra', 'Vendor'];
const AVAILABILITY_STATUSES = ['Available', 'Booked', 'Hold', 'On Leave', 'Retired'];
const PAYMENT_METHODS = ['ACH', 'Check', 'Wire', 'Agent', 'Cash', 'PayPal', 'Venmo'];
const TAX_FORMS = ['W-9 Received', 'W-9 Pending', 'W-9 Needed', '1099 Filed', 'W-8 (International)', 'N/A'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'CAD', 'AUD'];

const emptyForm = {
  // Identity
  name: '', last_name: '', person_code: '', role: '', department: 'other',
  classification: 'Crew', union_status: 'Non-Union', status: 'Available',
  picture: DEFAULT_PICTURE, headshot_url: '', resume_url: '', portfolio_url: '',
  // Contact
  phone: '', email: '', address: '', city: '', state: '', country: 'USA', zip: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  // Personal
  dob: '', gender: '', shirt_size: '', shoe_size: '',
  dietary_restrictions: '', allergies: '',
  driver_license: '', passport_required: false, passport_number: '',
  work_permit_required: false, work_permit_status: '',
  // Skills
  skills: '', certifications: '', languages: '',
  // Rates
  daily_rate_usd: '', weekly_rate_usd: '', overtime_rate: '1.5x',
  currency: 'USD', payment_method: 'ACH', tax_form_status: 'W-9 Needed',
  // Agent
  agent_manager_name: '', agent_manager_email: '', agent_manager_phone: '',
  // Availability
  availability_start: '', availability_end: '',
  transport_needed: false, lodging_needed: false,
  blocked_dates: [] as { start: string; end: string; reason: string }[],
  // Notes
  notes: '',
};

export default function CrewPage() {
  const namespace = useNamespace();
  const { data: crew, loading } = useData('crew');
  const [modal, setModal] = useState<'create' | 'edit' | 'merge' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formTab, setFormTab] = useState<'identity' | 'personal' | 'rates' | 'availability'>('identity');
  const [editId, setEditId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Merge
  const [mergeA, setMergeA] = useState('');
  const [mergeB, setMergeB] = useState('');

  const filtered = useMemo(() => {
    return crew.filter((c: any) => {
      const q = search.toLowerCase();
      const matchQ = !q || `${c.name} ${c.last_name} ${c.role}`.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
      const matchD = !deptFilter || (c.department || 'other') === deptFilter;
      return matchQ && matchD;
    });
  }, [crew, search, deptFilter]);

  const byDept = useMemo(() => {
    return DEPARTMENTS.map(d => ({
      ...d,
      members: filtered.filter((c: any) => (c.department || 'other') === d.id),
    })).filter(d => d.members.length > 0);
  }, [filtered]);

  const openCreate = () => { setForm(emptyForm); setFormTab('identity'); setModal('create'); };
  const openEdit = (c: any) => {
    setForm({
      name: c.name || '', last_name: c.last_name || '', person_code: c.person_code || '',
      role: c.role || '', department: c.department || 'other',
      classification: c.classification || 'Crew', union_status: c.union_status || 'Non-Union',
      status: c.status || 'Available',
      picture: c.picture || DEFAULT_PICTURE, headshot_url: c.headshot_url || '',
      resume_url: c.resume_url || '', portfolio_url: c.portfolio_url || '',
      phone: c.phone || '', email: c.email || '',
      address: c.address || '', city: c.city || '', state: c.state || c.state_country?.split(',')[0]?.trim() || '', country: c.country || 'USA', zip: c.zip || '',
      emergency_contact_name: c.emergency_contact_name || '',
      emergency_contact_phone: c.emergency_contact_phone || '',
      dob: c.dob || '', gender: c.gender || '',
      shirt_size: c.shirt_size || '', shoe_size: c.shoe_size || '',
      dietary_restrictions: c.dietary_restrictions || '', allergies: c.allergies || '',
      driver_license: c.driver_license || '',
      passport_required: c.passport_required || false, passport_number: c.passport_number || '',
      work_permit_required: c.work_permit_required || false, work_permit_status: c.work_permit_status || '',
      skills: c.skills || '', certifications: c.certifications || '', languages: c.languages || '',
      daily_rate_usd: c.daily_rate_usd ?? '', weekly_rate_usd: c.weekly_rate_usd ?? '',
      overtime_rate: c.overtime_rate || '1.5x', currency: c.currency || 'USD',
      payment_method: c.payment_method || 'ACH', tax_form_status: c.tax_form_status || 'W-9 Needed',
      agent_manager_name: c.agent_manager_name || '', agent_manager_email: c.agent_manager_email || '',
      agent_manager_phone: c.agent_manager_phone || '',
      availability_start: c.availability_start || '', availability_end: c.availability_end || '',
      blocked_dates: c.blocked_dates || [],
      transport_needed: c.transport_needed || false, lodging_needed: c.lodging_needed || false,
      notes: c.notes || '',
    });
    setEditId(c.id);
    setFormTab('identity');
    setModal('edit');
  };
  const close = () => { setModal(null); setEditId(null); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `crew/${Date.now()}_${file.name}`;
    const snap = await uploadBytes(storageRef(storage, path), file);
    const url = await getDownloadURL(snap.ref);
    setForm(f => ({ ...f, picture: url }));
    setUploading(false);
  };

  const save = async () => {
    if (!form.name || !form.last_name) return;
    if (modal === 'create') {
      await addDoc(collection(db, 'users', namespace!, 'crew'), form);
    } else if (editId) {
      await updateDoc(doc(db, 'users', namespace!, 'crew', editId), form);
    }
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this crew member?')) return;
    await deleteDoc(doc(db, 'users', namespace!, 'crew', id));
  };

  const doMerge = async () => {
    if (!mergeA || !mergeB || mergeA === mergeB) { alert('Select two different crew members to merge.'); return; }
    const a = crew.find((c: any) => c.id === mergeA);
    const b = crew.find((c: any) => c.id === mergeB);
    if (!a || !b) return;
    const pick = (ka: any, kb: any) => ka || kb;
    const merged: any = { ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== '' && v !== false)) };
    merged.notes = [a.notes, b.notes].filter(Boolean).join(' | ');
    merged.picture = a.picture !== DEFAULT_PICTURE ? a.picture : b.picture;
    await updateDoc(doc(db, 'users', namespace!, 'crew', mergeA), merged);
    await deleteDoc(doc(db, 'users', namespace!, 'crew', mergeB));
    setMergeA(''); setMergeB(''); setModal(null);
  };

  const fld = (label: string, key: keyof typeof emptyForm, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  const slct = (label: string, key: keyof typeof emptyForm, options: string[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        value={form[key] as string} onChange={e => setForm({ ...form, [key]: e.target.value })}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const chk = (label: string, key: keyof typeof emptyForm) => (
    <div className="flex items-center gap-2">
      <input type="checkbox" checked={form[key] as boolean}
        onChange={e => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
      <label className="text-sm text-gray-700">{label}</label>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Crew & Cast" subtitle={`${crew.length} contacts`}>
        <button onClick={() => setModal('merge')} className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
          <Merge size={15} /> Merge
        </button>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">
          <Plus size={16} /> Add Member
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none"
            placeholder="Search name, role, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="">All departments</option>
          {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden">
          {(['grid', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-2 text-xs ${viewMode === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {v === 'grid' ? '⊞' : '☰'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
          {crew.length === 0 ? 'No crew members yet.' : 'No results for your search.'}
        </div>
      ) : viewMode === 'grid' ? (
        // Grid view grouped by department
        <div className="space-y-8">
          {byDept.map(dept => (
            <div key={dept.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                <h2 className="font-semibold text-gray-700">{dept.label}</h2>
                <span className="text-xs text-gray-600">({dept.members.length})</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {dept.members.map((c: any) => (
                  <CrewCard key={c.id} member={c} onEdit={() => openEdit(c)} onRemove={() => remove(c.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List view
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Department</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={c.picture || DEFAULT_PICTURE} className="w-8 h-8 rounded-full object-cover" alt="" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">{c.name} {c.last_name}</span>
                          {(c.blocked_dates || []).some((b: any) => b.start && new Date(b.end || b.start) >= new Date()) && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium" title="Has blocked dates">Blocked</span>
                          )}
                        </div>
                        {c.dob && <div className="text-xs text-gray-600">DOB: {c.dob}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: deptColor(c.department || 'other') }}>
                      {deptLabel(c.department || 'other')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.role || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {c.email && <a href={`mailto:${c.email}`} className="text-blue-500 hover:text-blue-700" title={c.email}><Mail size={14} /></a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="text-green-500 hover:text-green-700" title={c.phone}><Phone size={14} /></a>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => openEdit(c)} className="text-gray-600 hover:text-gray-700"><Pencil size={13} /></button>
                      <button onClick={() => remove(c.id)} className="text-gray-600 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Crew / Cast Member' : 'Edit Member'} onClose={close}>
          {/* Tabs */}
          <div className="flex gap-0 border-b mb-4 -mx-1">
            {([
              { id: 'identity', label: 'Identity' },
              { id: 'personal', label: 'Personal' },
              { id: 'rates', label: 'Rates & Docs' },
              { id: 'availability', label: 'Availability' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setFormTab(t.id)}
                className={`px-3 py-2 text-xs transition-colors border-b-2 ${formTab === t.id ? 'border-black text-black font-medium' : 'border-transparent text-gray-600 hover:text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">

            {formTab === 'identity' && (
              <>
                {/* Photo */}
                <div className="flex items-center gap-3 mb-1">
                  <img src={form.picture || DEFAULT_PICTURE} className="w-14 h-14 rounded-full object-cover border border-gray-200 shrink-0" alt="" />
                  <div className="flex-1 space-y-1">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-1.5 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 w-full justify-center">
                      <Upload size={11} /> {uploading ? 'Uploading…' : 'Upload photo'}
                    </button>
                    <input className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                      value={form.picture} onChange={e => setForm({ ...form, picture: e.target.value })}
                      placeholder="Or paste image URL" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {fld('First name *', 'name', 'First name')}
                  {fld('Last name *', 'last_name', 'Last name')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Person Code', 'person_code', 'CREW-001')}
                  {slct('Classification', 'classification', CLASSIFICATIONS)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                      {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role / Position</label>
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="">— Select role —</option>
                      {(ROLES_BY_DEPT[form.department] || ROLES_BY_DEPT.other).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="Other">Other / Custom</option>
                    </select>
                    {form.role === 'Other' && (
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none mt-1"
                        placeholder="Type custom role…"
                        onChange={e => setForm({ ...form, role: e.target.value })} />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {slct('Union Status', 'union_status', UNION_STATUSES)}
                  {slct('Status', 'status', AVAILABILITY_STATUSES)}
                </div>
                <div className="flex justify-end">
                  <button type="button"
                    onClick={async () => {
                      if (!('contacts' in navigator)) { alert('Contact Picker not supported. Use Chrome on Android or Safari iOS 15.4+.'); return; }
                      try {
                        const contacts = await (navigator as any).contacts.select(['name','email','tel'], { multiple: false });
                        if (contacts[0]) {
                          const c = contacts[0];
                          setForm(f => ({
                            ...f,
                            name: c.name?.[0]?.split(' ')[0] || f.name,
                            last_name: c.name?.[0]?.split(' ').slice(1).join(' ') || f.last_name,
                            phone: c.tel?.[0] || f.phone,
                            email: c.email?.[0] || f.email,
                          }));
                        }
                      } catch {}
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2 py-1 mb-1">
                    <BookUser size={11} /> Import from Contacts
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Phone', 'phone', '+1 555…', 'tel')}
                  {fld('Email', 'email', 'crew@email.com', 'email')}
                </div>
                {fld('Address', 'address', '123 Main St')}
                <div className="grid grid-cols-2 gap-3">
                  {fld('City', 'city', 'Los Angeles')}
                  {fld('State', 'state', 'CA')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fld('ZIP', 'zip', '90001')}
                  {fld('Country', 'country', 'USA')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Emergency Contact', 'emergency_contact_name', 'Contact name')}
                  {fld('Emergency Phone', 'emergency_contact_phone', '+1 555…', 'tel')}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {fld('Headshot URL', 'headshot_url', 'https://…')}
                  {fld('Resume URL', 'resume_url', 'https://…')}
                  {fld('Portfolio URL', 'portfolio_url', 'https://…')}
                </div>
              </>
            )}

            {formTab === 'personal' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Date of birth', 'dob', '', 'date')}
                  {slct('Gender', 'gender', GENDERS)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {slct('Shirt size', 'shirt_size', SHIRT_SIZES)}
                  {slct('Shoe size (US)', 'shoe_size', SHOE_SIZES_US)}
                </div>
                {fld('Dietary restrictions', 'dietary_restrictions', 'Vegetarian, Gluten-free…')}
                {fld('Allergies', 'allergies', 'Peanuts, Shellfish…')}
                {fld('Driver\'s license', 'driver_license', 'Yes / DL number')}
                <div className="grid grid-cols-2 gap-3">
                  {chk('Passport required', 'passport_required')}
                  {fld('Passport number', 'passport_number', 'XX0000000')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {chk('Work permit required', 'work_permit_required')}
                  {fld('Work permit status', 'work_permit_status', 'Approved / Pending…')}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Skills</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })}
                    placeholder="Cinematography; Drone; Color grading" />
                </div>
                {fld('Certifications', 'certifications', 'OSHA 10; FAA Part 107; First Aid')}
                {fld('Languages', 'languages', 'English; Spanish')}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </>
            )}

            {formTab === 'rates' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Daily rate (USD)', 'daily_rate_usd', '750', 'number')}
                  {fld('Weekly rate (USD)', 'weekly_rate_usd', '3500', 'number')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Overtime rate', 'overtime_rate', '1.5x')}
                  {slct('Currency', 'currency', CURRENCIES)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {slct('Payment method', 'payment_method', PAYMENT_METHODS)}
                  {slct('Tax form status', 'tax_form_status', TAX_FORMS)}
                </div>
                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agent / Manager</p>
                  {fld('Name', 'agent_manager_name', 'Agent name')}
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {fld('Email', 'agent_manager_email', 'agent@agency.com', 'email')}
                    {fld('Phone', 'agent_manager_phone', '+1 555…', 'tel')}
                  </div>
                </div>
              </>
            )}

            {formTab === 'availability' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Available from', 'availability_start', '', 'date')}
                  {fld('Available until', 'availability_end', '', 'date')}
                </div>
                <div className="flex gap-6 py-2">
                  {chk('Transport needed', 'transport_needed')}
                  {chk('Lodging needed', 'lodging_needed')}
                </div>
                {/* Blocked / unavailable dates */}
                <div className="border-t pt-3 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Blocked Dates</span>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, blocked_dates: [...(f.blocked_dates || []), { start: '', end: '', reason: '' }] }))}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >+ Add block</button>
                  </div>
                  {(form.blocked_dates || []).length === 0 && (
                    <p className="text-xs text-gray-400 italic">No blocked dates. Click "+ Add block" to mark dates as unavailable.</p>
                  )}
                  <div className="space-y-2">
                    {(form.blocked_dates || []).map((blk: any, i: number) => (
                      <div key={i} className="flex gap-2 items-center bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">
                        <input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                          value={blk.start}
                          onChange={e => setForm(f => { const bd = [...(f.blocked_dates || [])]; bd[i] = { ...bd[i], start: e.target.value }; return { ...f, blocked_dates: bd }; })} />
                        <span className="text-xs text-gray-400">→</span>
                        <input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                          value={blk.end}
                          onChange={e => setForm(f => { const bd = [...(f.blocked_dates || [])]; bd[i] = { ...bd[i], end: e.target.value }; return { ...f, blocked_dates: bd }; })} />
                        <input type="text" placeholder="Reason (optional)" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                          value={blk.reason}
                          onChange={e => setForm(f => { const bd = [...(f.blocked_dates || [])]; bd[i] = { ...bd[i], reason: e.target.value }; return { ...f, blocked_dates: bd }; })} />
                        <button type="button" onClick={() => setForm(f => ({ ...f, blocked_dates: (f.blocked_dates || []).filter((_: any, j: number) => j !== i) }))}
                          className="text-red-400 hover:text-red-600 text-xs font-bold px-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={save} disabled={!form.name || !form.last_name}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
              {modal === 'create' ? 'Add member' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Merge Modal */}
      {modal === 'merge' && (
        <Modal title="Merge Contacts" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-500 mb-4">Select two crew members to merge. The first record will be kept, the second deleted.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Keep (primary)</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={mergeA} onChange={e => setMergeA(e.target.value)}>
                <option value="">Select…</option>
                {crew.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.last_name} — {c.role}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Merge into primary (will be deleted)</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={mergeB} onChange={e => setMergeB(e.target.value)}>
                <option value="">Select…</option>
                {crew.filter((c: any) => c.id !== mergeA).map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.last_name} — {c.role}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4 mt-4 border-t">
            <button onClick={doMerge} disabled={!mergeA || !mergeB} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              Merge (irreversible)
            </button>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CrewCard({ member, onEdit, onRemove }: { member: any; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 group relative">
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 bg-white rounded-lg shadow-sm text-gray-600 hover:text-gray-700"><Pencil size={12} /></button>
        <button onClick={onRemove} className="p-1.5 bg-white rounded-lg shadow-sm text-gray-600 hover:text-red-600"><Trash2 size={12} /></button>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <img src={member.picture || DEFAULT_PICTURE} className="w-12 h-12 rounded-full object-cover shrink-0" alt="" />
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{member.name} {member.last_name}</div>
          <div className="text-xs text-gray-600 truncate">{member.role || 'No role'}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium truncate max-w-[120px]"
          style={{ backgroundColor: deptColor(member.department || 'other') }}>
          {deptLabel(member.department || 'other')}
        </span>
        <div className="flex gap-1.5 shrink-0">
          {member.email && (
            <a href={`mailto:${member.email}`} className="text-blue-400 hover:text-blue-600" title={member.email}>
              <Mail size={13} />
            </a>
          )}
          {member.phone && (
            <a href={`tel:${member.phone}`} className="text-green-400 hover:text-green-600" title={member.phone}>
              <Phone size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Search, Mail, Phone, Upload, Users, Filter, Merge } from 'lucide-react';
import { DEPARTMENTS, deptColor, deptLabel } from '@/lib/departments';

const DEFAULT_PICTURE = 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg';

const emptyForm = {
  name: '', last_name: '', role: '', department: 'other', picture: DEFAULT_PICTURE,
  phone: '', email: '', address: '', dob: '', notes: '',
};

export default function CrewPage() {
  const { data: crew, loading } = useData('crew');
  const [modal, setModal] = useState<'create' | 'edit' | 'merge' | null>(null);
  const [form, setForm] = useState(emptyForm);
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

  const openCreate = () => { setForm(emptyForm); setModal('create'); };
  const openEdit = (c: any) => {
    setForm({
      name: c.name || '', last_name: c.last_name || '', role: c.role || '',
      department: c.department || 'other', picture: c.picture || DEFAULT_PICTURE,
      phone: c.phone || '', email: c.email || '', address: c.address || '',
      dob: c.dob || '', notes: c.notes || '',
    });
    setEditId(c.id);
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
      await addDoc(collection(db, 'crew'), form);
    } else if (editId) {
      await updateDoc(doc(db, 'crew', editId), form);
    }
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this crew member?')) return;
    await deleteDoc(doc(db, 'crew', id));
  };

  const doMerge = async () => {
    if (!mergeA || !mergeB || mergeA === mergeB) { alert('Select two different crew members to merge.'); return; }
    const a = crew.find((c: any) => c.id === mergeA);
    const b = crew.find((c: any) => c.id === mergeB);
    if (!a || !b) return;
    const merged = {
      name: a.name || b.name,
      last_name: a.last_name || b.last_name,
      role: a.role || b.role,
      department: a.department || b.department || 'other',
      picture: a.picture !== DEFAULT_PICTURE ? a.picture : b.picture,
      phone: a.phone || b.phone,
      email: a.email || b.email,
      address: a.address || b.address,
      dob: a.dob || b.dob,
      notes: [a.notes, b.notes].filter(Boolean).join(' | '),
    };
    await updateDoc(doc(db, 'crew', mergeA), merged);
    await deleteDoc(doc(db, 'crew', mergeB));
    setMergeA(''); setMergeB(''); setModal(null);
  };

  const field = (label: string, key: keyof typeof emptyForm, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crew & Cast</h1>
          <p className="text-gray-500 text-sm mt-1">{crew.length} contacts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('merge')}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm hover:bg-gray-50"
          >
            <Merge size={15} /> Merge
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700"
          >
            <Plus size={16} /> Add Member
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
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
                <span className="text-xs text-gray-400">({dept.members.length})</span>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
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
                        <div className="font-medium text-gray-900">{c.name} {c.last_name}</div>
                        {c.dob && <div className="text-xs text-gray-400">DOB: {c.dob}</div>}
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
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-gray-700"><Pencil size={13} /></button>
                      <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
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
        <Modal title={modal === 'create' ? 'Add Crew Member' : 'Edit Crew Member'} onClose={close}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <img src={form.picture || DEFAULT_PICTURE} className="w-16 h-16 rounded-full object-cover border border-gray-200" alt="" />
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 w-full justify-center"
                >
                  <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload photo'}
                </button>
                <div className="mt-1">
                  <input
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    value={form.picture}
                    onChange={e => setForm({ ...form, picture: e.target.value })}
                    placeholder="Or paste image URL"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {field('First name *', 'name', 'First name')}
              {field('Last name *', 'last_name', 'Last name')}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                >
                  {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
              {field('Role / Position', 'role', 'e.g. Gaffer, DP…')}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {field('Phone', 'phone', '+1 555…', 'tel')}
              {field('Email', 'email', 'crew@email.com', 'email')}
            </div>
            {field('Address', 'address', 'Street, City, State')}
            {field('Date of birth', 'dob', '', 'date')}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Rates, special requirements…"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button
              onClick={save}
              disabled={!form.name || !form.last_name}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700"
            >
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
        <button onClick={onEdit} className="p-1.5 bg-white rounded-lg shadow-sm text-gray-400 hover:text-gray-700"><Pencil size={12} /></button>
        <button onClick={onRemove} className="p-1.5 bg-white rounded-lg shadow-sm text-gray-400 hover:text-red-600"><Trash2 size={12} /></button>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <img src={member.picture || DEFAULT_PICTURE} className="w-12 h-12 rounded-full object-cover shrink-0" alt="" />
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{member.name} {member.last_name}</div>
          <div className="text-xs text-gray-400 truncate">{member.role || 'No role'}</div>
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

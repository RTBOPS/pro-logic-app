'use client';

import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Phone, Mail, MapPin } from 'lucide-react';

const DEFAULT_PICTURE = 'https://img.freepik.com/free-photo/portrait-white-man-isolated_53876-40306.jpg';

const empty = {
  name: '', last_name: '', role: '', picture: DEFAULT_PICTURE,
  phone: '', email: '', address: '', dob: '',
};

export default function CrewPage() {
  const { data: crew, loading } = useData('crew');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);

  const openCreate = () => { setForm(empty); setModal('create'); };
  const openEdit = (c: any) => {
    setForm({
      name: c.name || '', last_name: c.last_name || '', role: c.role || '',
      picture: c.picture || DEFAULT_PICTURE, phone: c.phone || '',
      email: c.email || '', address: c.address || '', dob: c.dob || '',
    });
    setEditId(c.id);
    setModal('edit');
  };
  const close = () => { setModal(null); setEditId(null); };

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

  const field = (label: string, key: keyof typeof empty, placeholder?: string, type = 'text') => (
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crew</h1>
          <p className="text-gray-500 text-sm mt-1">{crew.length} members</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Add Member
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : crew.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          No crew members yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {crew.map((c: any) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group"
            >
              <div className="flex items-center gap-4 p-4">
                <img
                  src={c.picture || DEFAULT_PICTURE}
                  alt={c.name}
                  className="w-14 h-14 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{c.name} {c.last_name}</div>
                  <div className="text-xs text-gray-400">{c.role || 'No role'}</div>
                  {c.email && (
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Mail size={10} /> {c.email}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(c.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {(c.phone || c.address || c.dob) && (
                <div
                  className="px-4 pb-4 cursor-pointer"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  {expanded === c.id ? (
                    <div className="text-xs text-gray-500 space-y-1 border-t pt-3">
                      {c.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{c.phone}</div>}
                      {c.address && <div className="flex items-center gap-1.5"><MapPin size={11} />{c.address}</div>}
                      {c.dob && <div className="text-gray-400">DOB: {c.dob}</div>}
                    </div>
                  ) : (
                    <div className="text-xs text-blue-500 hover:underline border-t pt-2">Show details</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Add Crew Member' : 'Edit Crew Member'} onClose={close}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {field('First name *', 'name', 'First name')}
              {field('Last name *', 'last_name', 'Last name')}
            </div>
            {field('Role / Department', 'role', 'e.g. Director, Gaffer, DP…')}
            <div className="grid grid-cols-2 gap-3">
              {field('Phone', 'phone', '+1 555 000 0000', 'tel')}
              {field('Email', 'email', 'crew@email.com', 'email')}
            </div>
            {field('Address', 'address', 'Street, City, State')}
            {field('Date of birth', 'dob', '', 'date')}
            {field('Picture URL', 'picture', 'https://…')}
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button
              onClick={save}
              disabled={!form.name || !form.last_name}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {modal === 'create' ? 'Add member' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

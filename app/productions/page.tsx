'use client';

import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';

const STATUSES = ['new', 'active', 'completed', 'cancelled'];

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
};

const empty = { name: '', client: '', status: 'new', location_id: '' };

export default function ProductionsPage() {
  const { data: productions, loading } = useData('productions');
  const { data: locations } = useData('locations');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);

  const openCreate = () => { setForm(empty); setModal('create'); };
  const openEdit = (p: any) => {
    setForm({ name: p.name, client: p.client, status: p.status, location_id: p.location_id || '' });
    setEditId(p.id);
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
    <div className="p-8">
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
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : productions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          No productions yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Location</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {productions.map((p: any) => {
                const loc = locations.find((l: any) => l.id === p.location_id);
                return (
                  <tr key={p.id} className="hover:bg-gray-50 group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <Link href={`/productions/${p.id}`} className="flex items-center gap-1 hover:text-blue-600">
                        {p.name}
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.client}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{loc?.name || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-700 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={15} />
                        </button>
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Production name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.client}
                onChange={e => setForm({ ...form, client: e.target.value })}
                placeholder="Client name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.location_id}
                onChange={e => setForm({ ...form, location_id: e.target.value })}
              >
                <option value="">— None —</option>
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={save}
                disabled={!form.name || !form.client}
                className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-800 transition-colors"
              >
                {modal === 'create' ? 'Create' : 'Save changes'}
              </button>
              <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

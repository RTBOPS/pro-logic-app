'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Search, Database } from 'lucide-react';
import { EQUIPMENT_DB, EQUIPMENT_CATEGORIES, type EquipmentItem } from '@/lib/equipment-db';

const STATUSES = ['AVAILABLE', 'IN USE', 'MAINTENANCE', 'RETIRED'];
const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  'IN USE': 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700',
  RETIRED: 'bg-red-100 text-red-600',
};

const emptyForm = { name: '', brand: '', model: '', category: '', subcategory: '', status: 'AVAILABLE' };

export default function InventoryPage() {
  const { data: inventory, loading } = useData('inventory');
  const [modal, setModal] = useState<'create' | 'edit' | 'database' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  // Database search
  const [dbQuery, setDbQuery] = useState('');
  const [dbCategory, setDbCategory] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Inventory filter
  const [filterQuery, setFilterQuery] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const openCreate = () => { setForm(emptyForm); setModal('create'); };
  const openEdit = (i: any) => {
    setForm({ name: i.name, brand: i.brand || '', model: i.model || '',
      category: i.category || '', subcategory: i.subcategory || '', status: i.status || 'AVAILABLE' });
    setEditId(i.id);
    setModal('edit');
  };
  const close = () => { setModal(null); setEditId(null); setSelectedItems(new Set()); };

  const save = async () => {
    if (!form.name) return;
    if (modal === 'create') {
      await addDoc(collection(db, 'inventory'), form);
    } else if (editId) {
      await updateDoc(doc(db, 'inventory', editId), form);
    }
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this item?')) return;
    await deleteDoc(doc(db, 'inventory', id));
  };

  const dbResults = useMemo(() => {
    return EQUIPMENT_DB.filter(item => {
      const q = dbQuery.toLowerCase();
      const matchQuery = !q || item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) || item.model.toLowerCase().includes(q);
      const matchCat = !dbCategory || item.category === dbCategory;
      return matchQuery && matchCat;
    });
  }, [dbQuery, dbCategory]);

  const toggleSelect = (idx: number) => {
    const s = new Set(selectedItems);
    s.has(idx) ? s.delete(idx) : s.add(idx);
    setSelectedItems(s);
  };

  const importSelected = async () => {
    const items = Array.from(selectedItems).map(i => dbResults[i]);
    for (const item of items) {
      await addDoc(collection(db, 'inventory'), {
        name: item.name, brand: item.brand, model: item.model,
        category: item.category, subcategory: item.subcategory, status: 'AVAILABLE',
      });
    }
    close();
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((i: any) => {
      const q = filterQuery.toLowerCase();
      const matchQ = !q || i.name?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) || i.model?.toLowerCase().includes(q);
      const matchC = !filterCat || i.category === filterCat;
      return matchQ && matchC;
    });
  }, [inventory, filterQuery, filterCat]);

  const inventoryCategories = [...new Set(inventory.map((i: any) => i.category).filter(Boolean))];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">{inventory.length} items</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('database')}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            <Database size={16} /> Browse Database
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-green-700 transition-colors"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Search inventory…"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="">All categories</option>
          {inventoryCategories.map((c: any) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : filteredInventory.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          {inventory.length === 0 ? 'No equipment yet. Browse the database to import items.' : 'No items match your filter.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-3">Item</th>
                <th className="text-left px-6 py-3">Brand</th>
                <th className="text-left px-6 py-3">Model</th>
                <th className="text-left px-6 py-3">Category</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInventory.map((i: any) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{i.name}</td>
                  <td className="px-6 py-3 text-gray-600">{i.brand || '—'}</td>
                  <td className="px-6 py-3 text-gray-500">{i.model || '—'}</td>
                  <td className="px-6 py-3 text-gray-400 text-xs">{i.category || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[i.status] || 'bg-gray-100 text-gray-600'}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(i)} className="text-gray-400 hover:text-gray-700"><Pencil size={15} /></button>
                      <button onClick={() => remove(i.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Equipment Database Modal */}
      {modal === 'database' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && close()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h2 className="font-semibold text-lg">Equipment Database</h2>
              <div className="flex items-center gap-2">
                {selectedItems.size > 0 && (
                  <button
                    onClick={importSelected}
                    className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Import {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}
                  </button>
                )}
                <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-3 border-b shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Search cameras, lenses, audio…"
                  value={dbQuery}
                  onChange={e => setDbQuery(e.target.value)}
                />
              </div>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
                value={dbCategory}
                onChange={e => setDbCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="w-10 px-4 py-2" />
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-left px-4 py-2">Brand</th>
                    <th className="text-left px-4 py-2">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dbResults.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedItems.has(idx) ? 'bg-green-50' : ''}`}
                      onClick={() => toggleSelect(idx)}
                    >
                      <td className="px-4 py-2.5">
                        <input type="checkbox" readOnly checked={selectedItems.has(idx)} className="rounded" />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{item.brand}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{item.category} · {item.subcategory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dbResults.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No items match your search.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Equipment' : 'Edit Equipment'} onClose={close}>
          <div className="space-y-3">
            {(['name', 'brand', 'model'] as const).map(key => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{key}{key === 'name' ? ' *' : ''}</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                  autoFocus={key === 'name'}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">Select…</option>
                  {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button
              onClick={save}
              disabled={!form.name}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-green-700"
            >
              {modal === 'create' ? 'Add item' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

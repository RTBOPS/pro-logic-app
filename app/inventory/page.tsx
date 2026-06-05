'use client';

import { useState, useMemo, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import Modal from '@/components/Modal';
import {
  Plus, Pencil, Trash2, Search, Database, ExternalLink,
  ChevronDown, ChevronUp, Zap, Upload, ClipboardCheck, X, Copy,
} from 'lucide-react';
import { useNamespace } from '@/hooks/useNamespace';
import { loadEquipmentCatalog, CATALOG_CATEGORIES, CATALOG_STATUSES, CATALOG_CONDITIONS, type CatalogItem } from '@/lib/equipment-catalog';

const STATUS_COLOR: Record<string, string> = {
  Available:    'bg-green-100 text-green-700',
  Reserved:     'bg-blue-100 text-blue-700',
  'Checked Out':'bg-purple-100 text-purple-700',
  'In Repair':  'bg-yellow-100 text-yellow-700',
  Lost:         'bg-red-100 text-red-600',
  Retired:      'bg-gray-100 text-gray-500',
};

const STATUS_ROW_BG: Record<string, string> = {
  Available:    '',
  Reserved:     'bg-blue-50/50',
  'Checked Out':'bg-purple-50/60',
  'In Repair':  'bg-yellow-50/60',
  Lost:         'bg-red-50/60',
  Retired:      'bg-gray-100/80 opacity-70',
};

const UNAVAILABLE = new Set(['Reserved', 'Checked Out', 'In Repair', 'Lost', 'Retired']);

const CONDITION_COLOR: Record<string, string> = {
  Excellent:      'text-green-600',
  Good:           'text-blue-600',
  Fair:           'text-yellow-600',
  'Needs Service':'text-orange-600',
  Damaged:        'text-red-600',
};

const emptyForm = {
  item_id: '', name: '', brand: '', model: '', category: '', subcategory: '',
  description: '', production_use: '',
  replacement_value_usd: '', rental_day_rate_usd: '',
  voltage: '', wattage: '', amperage: '', power_connector: '', battery_type: '',
  weight_kg: '', dimensions: '',
  serial_number: '', barcode_qr: '',
  status: 'Available', condition: 'Good',
  warehouse_location: '', kit_name: '',
  insurance_required: false, maintenance_cycle_days: '',
  last_service_date: '', next_service_due: '', purchase_date: '',
  source_url: '', notes: '',
  images: [] as string[],
};

type FormState = typeof emptyForm;

const emptyInspection = {
  item_id: '', item_name: '',
  rental_company: '', rental_contact: '', rental_contact_phone: '',
  rental_start: '', rental_end: '',
  pre_condition: 'Good', pre_notes: '', pre_images: [] as string[],
  post_condition: 'Good', post_notes: '', post_images: [] as string[],
  damage_claim: false, claim_notes: '', claim_amount: '',
  inspector_name: '', inspector_signature: '',
};
type InspectionState = typeof emptyInspection;

export default function InventoryPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: inventory, loading } = useData('inventory');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [modal, setModal] = useState<'create' | 'edit' | 'database' | 'detail' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [formTab, setFormTab] = useState<'basic' | 'specs' | 'logistics'>('basic');

  // Database search
  const [dbQuery, setDbQuery] = useState('');
  const [dbCategory, setDbCategory] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Inventory filter
  const [filterQuery, setFilterQuery] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Image upload
  const imgRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Rental inspection
  const [inspection, setInspection] = useState<InspectionState>(emptyInspection);
  const [inspectionPhase, setInspectionPhase] = useState<'pre' | 'post'>('pre');
  const preImgRef = useRef<HTMLInputElement>(null);
  const postImgRef = useRef<HTMLInputElement>(null);
  const [inspUploading, setInspUploading] = useState(false);

  const openDatabase = async () => {
    if (catalog.length === 0) {
      setCatalogLoading(true);
      const data = await loadEquipmentCatalog();
      setCatalog(data);
      setCatalogLoading(false);
    }
    setModal('database');
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'form' | 'pre' | 'post'
  ) => {
    const files = e.target.files;
    if (!files?.length) return;
    target === 'form' ? setUploading(true) : setInspUploading(true);
    setUploadError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const path = `inventory/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const snap = await uploadBytes(storageRef(storage, path), file);
        urls.push(await getDownloadURL(snap.ref));
      }
      if (target === 'form') setForm(f => ({ ...f, images: [...f.images, ...urls] }));
      else if (target === 'pre') setInspection(i => ({ ...i, pre_images: [...i.pre_images, ...urls] }));
      else setInspection(i => ({ ...i, post_images: [...i.post_images, ...urls] }));
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      target === 'form' ? setUploading(false) : setInspUploading(false);
    }
  };

  const openInspection = (item: any) => {
    setInspection({ ...emptyInspection, item_id: item.item_id || item.id, item_name: item.name });
    setInspectionPhase('pre');
    setModal('inspection' as any);
  };

  const saveInspection = async () => {
    await addDoc(collection(db, 'users', getUid()!, 'equipment_inspections'), { ...inspection, created_at: new Date().toISOString() });
    if (inspection.damage_claim) {
      const itemDoc = inventory.find((i: any) => i.id === editId || i.item_id === inspection.item_id);
      if (itemDoc) await updateDoc(doc(db, 'users', getUid()!, 'inventory', itemDoc.id), { status: 'In Repair', notes: `Damage claim: ${inspection.claim_notes}` });
    }
    close();
  };

  const openCreate = () => { setForm(emptyForm); setFormTab('basic'); setModal('create'); };
  const openEdit = (i: any) => {
    setForm({
      item_id: i.item_id || '', name: i.name || '', brand: i.brand || '',
      model: i.model || '', category: i.category || '', subcategory: i.subcategory || '',
      description: i.description || '', production_use: i.production_use || '',
      replacement_value_usd: i.replacement_value_usd ?? '',
      rental_day_rate_usd: i.rental_day_rate_usd ?? '',
      voltage: i.voltage || '', wattage: i.wattage || '', amperage: i.amperage || '',
      power_connector: i.power_connector || '', battery_type: i.battery_type || '',
      weight_kg: i.weight_kg ?? '', dimensions: i.dimensions || '',
      serial_number: i.serial_number || '', barcode_qr: i.barcode_qr || '',
      status: i.status || 'Available', condition: i.condition || 'Good',
      warehouse_location: i.warehouse_location || '', kit_name: i.kit_name || '',
      insurance_required: i.insurance_required || false,
      maintenance_cycle_days: i.maintenance_cycle_days ?? '',
      last_service_date: i.last_service_date || '', next_service_due: i.next_service_due || '',
      purchase_date: i.purchase_date || '', source_url: i.source_url || '', notes: i.notes || '',
      images: i.images || [],
    });
    setEditId(i.id);
    setFormTab('basic');
    setModal('edit');
  };
  const close = () => { setModal(null); setEditId(null); setSelectedItems(new Set()); setDetailItem(null); };

  const formToDoc = (f: FormState) => ({
    ...f,
    replacement_value_usd: f.replacement_value_usd !== '' ? Number(f.replacement_value_usd) : null,
    rental_day_rate_usd: f.rental_day_rate_usd !== '' ? Number(f.rental_day_rate_usd) : null,
    weight_kg: f.weight_kg !== '' ? Number(f.weight_kg) : null,
    maintenance_cycle_days: f.maintenance_cycle_days !== '' ? Number(f.maintenance_cycle_days) : null,
  });

  const save = async () => {
    if (!form.name) return;
    const data = formToDoc(form);
    if (modal === 'create') {
      await addDoc(collection(db, 'users', getUid()!, 'inventory'), data);
    } else if (editId) {
      await updateDoc(doc(db, 'users', getUid()!, 'inventory', editId), data);
    }
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this item?')) return;
    await deleteDoc(doc(db, 'users', getUid()!, 'inventory', id));
  };

  const duplicate = async (item: any) => {
    const uid = getUid();
    if (!uid) return;
    // Strip the Firestore id, generate a new item_id, mark name as copy
    const { id: _id, ...rest } = item;
    const newItem = {
      ...rest,
      name: `${rest.name} (copy)`,
      item_id: `${rest.item_id || rest.name.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      status: 'Available',
      created_at: new Date().toISOString(),
    };
    await addDoc(collection(db, 'users', uid, 'inventory'), newItem);
  };

  const dbResults = useMemo(() => {
    return catalog.filter(item => {
      const q = dbQuery.toLowerCase();
      const matchQ = !q || item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) || item.model.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q);
      const matchC = !dbCategory || item.category === dbCategory;
      return matchQ && matchC;
    });
  }, [catalog, dbQuery, dbCategory]);

  const toggleSelect = (id: string) => {
    const s = new Set(selectedItems);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedItems(s);
  };

  const selectAll = () => {
    if (selectedItems.size === dbResults.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(dbResults.map(i => i.item_id)));
    }
  };

  const importSelected = async () => {
    const toImport = catalog.filter(i => selectedItems.has(i.item_id));
    for (const item of toImport) {
      const { data_confidence, ...rest } = item as any;
      await addDoc(collection(db, 'users', getUid()!, 'inventory'), { ...rest, status: 'Available' });
    }
    close();
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((i: any) => {
      const q = filterQuery.toLowerCase();
      const matchQ = !q || i.name?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) || i.model?.toLowerCase().includes(q) ||
        i.serial_number?.toLowerCase().includes(q);
      const matchC = !filterCat || i.category === filterCat;
      const matchS = !filterStatus || i.status === filterStatus;
      return matchQ && matchC && matchS;
    });
  }, [inventory, filterQuery, filterCat, filterStatus]);

  const inventoryCategories = [...new Set(inventory.map((i: any) => i.category).filter(Boolean))];

  const f = (key: keyof FormState, label: string, type = 'text', placeholder = '') => (
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

  const sel = (key: keyof FormState, label: string, options: string[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">{inventory.length} items · 90-item standard catalog available</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openDatabase}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-50"
          >
            <Database size={15} /> {catalogLoading ? 'Loading…' : 'Browse Catalog'}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-green-700"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none"
            placeholder="Search name, brand, model, serial…"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
          />
        </div>
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600"
          value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {inventoryCategories.map((c: any) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {CATALOG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-600 text-sm">Loading…</div>
      ) : filteredInventory.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
          {inventory.length === 0
            ? 'No equipment yet. Browse the catalog to import items or add manually.'
            : 'No items match your filter.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3">Item</th>
                <th className="text-left px-5 py-3">Brand / Model</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Condition</th>
                <th className="text-left px-5 py-3">Value / Day Rate</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInventory.map((i: any) => (
                <tr key={i.id}
                  className={`hover:brightness-95 cursor-pointer transition-colors ${STATUS_ROW_BG[i.status] || ''}`}
                  onClick={() => { setDetailItem(i); setModal('detail'); }}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{i.name}</div>
                    {i.serial_number && <div className="text-xs text-gray-600">S/N: {i.serial_number}</div>}
                    {i.kit_name && <div className="text-xs text-gray-600">{i.kit_name}</div>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    <div>{i.brand || '—'}</div>
                    <div className="text-xs text-gray-600">{i.model || ''}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    <div>{i.category || '—'}</div>
                    <div className="text-gray-600">{i.subcategory || ''}</div>
                  </td>
                  <td className={`px-5 py-3 text-xs font-medium ${CONDITION_COLOR[i.condition] || 'text-gray-500'}`}>
                    {i.condition || '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600">
                    {i.replacement_value_usd ? <div>${i.replacement_value_usd.toLocaleString()}</div> : <div className="text-gray-300">—</div>}
                    {i.rental_day_rate_usd ? <div className="text-gray-600">${i.rental_day_rate_usd}/day</div> : null}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[i.status] || 'bg-gray-100 text-gray-600'}`}>
                      {i.status || 'Available'}
                    </span>
                  </td>
                  <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openInspection(i)} title="Rental inspection" className="text-gray-600 hover:text-blue-600"><ClipboardCheck size={14} /></button>
                      <button onClick={() => duplicate(i)} title="Duplicate item" className="text-gray-400 hover:text-green-600"><Copy size={14} /></button>
                      <button onClick={() => openEdit(i)} title="Edit" className="text-gray-600 hover:text-gray-700"><Pencil size={14} /></button>
                      <button onClick={() => remove(i.id)} title="Delete" className="text-gray-600 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Catalog Browser Modal ── */}
      {modal === 'database' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => e.target === e.currentTarget && close()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h2 className="font-semibold text-lg">Production Equipment Catalog</h2>
                <p className="text-xs text-gray-600 mt-0.5">{catalog.length} industry-standard items · select to add to your inventory</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedItems.size > 0 && (
                  <button onClick={importSelected}
                    className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700">
                    Import {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}
                  </button>
                )}
                <button onClick={close} className="text-gray-600 hover:text-gray-700 text-xl leading-none">×</button>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-3 border-b shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input autoFocus
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Search cameras, lenses, audio, lighting…"
                  value={dbQuery}
                  onChange={e => setDbQuery(e.target.value)}
                />
              </div>
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
                value={dbCategory} onChange={e => setDbCategory(e.target.value)}>
                <option value="">All categories</option>
                {CATALOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="w-10 px-4 py-2">
                      <input type="checkbox" onChange={selectAll}
                        checked={selectedItems.size === dbResults.length && dbResults.length > 0}
                        className="rounded" />
                    </th>
                    <th className="text-left px-4 py-2">Item</th>
                    <th className="text-left px-4 py-2 hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-2 hidden lg:table-cell">Power</th>
                    <th className="text-left px-4 py-2 hidden lg:table-cell">Value / Day Rate</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dbResults.map((item) => (
                    <>
                      <tr key={item.item_id}
                        className={`hover:bg-gray-50 cursor-pointer ${selectedItems.has(item.item_id) ? 'bg-green-50' : ''}`}
                        onClick={() => toggleSelect(item.item_id)}>
                        <td className="px-4 py-2.5">
                          <input type="checkbox" readOnly checked={selectedItems.has(item.item_id)} className="rounded" />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-600">{item.brand} · {item.model}</div>
                          {item.description && <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">{item.description}</div>}
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <div className="text-xs text-gray-600">{item.category}</div>
                          <div className="text-xs text-gray-600">{item.subcategory}</div>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-gray-500">
                          {item.voltage && <div className="flex items-center gap-1"><Zap size={11} />{item.voltage}</div>}
                          {item.wattage && <div>{item.wattage}</div>}
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell text-xs">
                          {item.replacement_value_usd ? (
                            <div className="text-gray-700 font-medium">${item.replacement_value_usd.toLocaleString()}</div>
                          ) : null}
                          {item.rental_day_rate_usd ? (
                            <div className="text-gray-600">${item.rental_day_rate_usd}/day</div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setExpandedItem(expandedItem === item.item_id ? null : item.item_id)}
                            className="text-gray-300 hover:text-gray-600 p-1"
                          >
                            {expandedItem === item.item_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>
                      {expandedItem === item.item_id && (
                        <tr key={`${item.item_id}-exp`} className={selectedItems.has(item.item_id) ? 'bg-green-50' : 'bg-gray-50'}>
                          <td />
                          <td colSpan={5} className="px-4 pb-3 pt-1">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-gray-600">
                              {item.production_use && <div><span className="font-medium">Production use:</span> {item.production_use}</div>}
                              {item.weight_kg && <div><span className="font-medium">Weight:</span> {item.weight_kg} kg</div>}
                              {item.dimensions && <div><span className="font-medium">Dimensions:</span> {item.dimensions}</div>}
                              {item.power_connector && <div><span className="font-medium">Connector:</span> {item.power_connector}</div>}
                              {item.battery_type && <div><span className="font-medium">Battery:</span> {item.battery_type}</div>}
                              {item.warehouse_location && <div><span className="font-medium">Location:</span> {item.warehouse_location}</div>}
                              {item.kit_name && <div><span className="font-medium">Kit:</span> {item.kit_name}</div>}
                              {item.maintenance_cycle_days && <div><span className="font-medium">Service every:</span> {item.maintenance_cycle_days} days</div>}
                              {item.insurance_required && <div><span className="font-medium text-orange-600">Insurance required</span></div>}
                            </div>
                            {item.source_url && (
                              <a href={item.source_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-2"
                                onClick={e => e.stopPropagation()}>
                                <ExternalLink size={11} /> Manufacturer page
                              </a>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {dbResults.length === 0 && (
                <div className="text-center py-12 text-gray-600 text-sm">No items match your search.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Item Detail Modal ── */}
      {modal === 'detail' && detailItem && (
        <Modal title={detailItem.name} onClose={close}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Brand" value={detailItem.brand} />
              <InfoRow label="Model" value={detailItem.model} />
              <InfoRow label="Category" value={detailItem.category} />
              <InfoRow label="Subcategory" value={detailItem.subcategory} />
              <InfoRow label="Status" value={detailItem.status} />
              <InfoRow label="Condition" value={detailItem.condition} />
              <InfoRow label="Serial #" value={detailItem.serial_number} />
              <InfoRow label="Kit" value={detailItem.kit_name} />
              <InfoRow label="Location" value={detailItem.warehouse_location} />
              <InfoRow label="Replacement Value" value={detailItem.replacement_value_usd ? `$${detailItem.replacement_value_usd.toLocaleString()}` : null} />
              <InfoRow label="Day Rate" value={detailItem.rental_day_rate_usd ? `$${detailItem.rental_day_rate_usd}/day` : null} />
              <InfoRow label="Weight" value={detailItem.weight_kg ? `${detailItem.weight_kg} kg` : null} />
              <InfoRow label="Voltage" value={detailItem.voltage} />
              <InfoRow label="Wattage" value={detailItem.wattage} />
              <InfoRow label="Connector" value={detailItem.power_connector} />
              <InfoRow label="Battery" value={detailItem.battery_type} />
              <InfoRow label="Last Service" value={detailItem.last_service_date} />
              <InfoRow label="Next Service" value={detailItem.next_service_due} />
              <InfoRow label="Purchase Date" value={detailItem.purchase_date} />
              <InfoRow label="Insurance" value={detailItem.insurance_required ? 'Required' : null} />
            </div>
            {detailItem.description && (
              <div><p className="text-xs text-gray-500 font-medium mb-1">Description</p><p className="text-sm text-gray-700">{detailItem.description}</p></div>
            )}
            {detailItem.production_use && (
              <div><p className="text-xs text-gray-500 font-medium mb-1">Production use</p><p className="text-sm text-gray-700">{detailItem.production_use}</p></div>
            )}
            {detailItem.notes && (
              <div><p className="text-xs text-gray-500 font-medium mb-1">Notes</p><p className="text-sm text-gray-700">{detailItem.notes}</p></div>
            )}
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={() => { close(); openEdit(detailItem); }}
              className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Edit
            </button>
            <button onClick={() => { duplicate(detailItem); close(); }}
              className="flex items-center justify-center gap-1.5 flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-green-50 hover:border-green-200 hover:text-green-700">
              <Copy size={13} /> Duplicate
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500">Close</button>
          </div>
        </Modal>
      )}

      {/* ── Rental Inspection Modal ── */}
      {(modal as any) === 'inspection' && (
        <Modal title={`Rental Inspection — ${inspection.item_name}`} onClose={close}>
          <div className="flex gap-0 border-b mb-4 -mx-1">
            {(['pre', 'post'] as const).map(p => (
              <button key={p} onClick={() => setInspectionPhase(p)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${inspectionPhase === p ? 'border-black text-black font-medium' : 'border-transparent text-gray-600'}`}>
                {p === 'pre' ? 'Pre-Rental Inspection' : 'Post-Rental Inspection'}
              </button>
            ))}
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {inspectionPhase === 'pre' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rental Company</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={inspection.rental_company} onChange={e => setInspection(i => ({ ...i, rental_company: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={inspection.rental_contact} onChange={e => setInspection(i => ({ ...i, rental_contact: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rental Start</label>
                    <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={inspection.rental_start} onChange={e => setInspection(i => ({ ...i, rental_start: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rental End</label>
                    <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      value={inspection.rental_end} onChange={e => setInspection(i => ({ ...i, rental_end: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pre-rental Condition</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={inspection.pre_condition} onChange={e => setInspection(i => ({ ...i, pre_condition: e.target.value }))}>
                    {CATALOG_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pre-rental Notes</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
                    placeholder="Existing scratches, missing parts, accessories included…"
                    value={inspection.pre_notes} onChange={e => setInspection(i => ({ ...i, pre_notes: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Pre-rental Photos</label>
                  <input ref={preImgRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleImageUpload(e, 'pre')} />
                  <button type="button" onClick={() => preImgRef.current?.click()} disabled={inspUploading}
                    className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 w-full justify-center">
                    <Upload size={13} /> {inspUploading ? 'Uploading…' : 'Upload photos'}
                  </button>
                  {inspection.pre_images.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {inspection.pre_images.map(url => (
                        <div key={url} className="relative">
                          <img src={url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                          <button onClick={() => setInspection(i => ({ ...i, pre_images: i.pre_images.filter(u => u !== url) }))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"><X size={9} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Inspector Name</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={inspection.inspector_name} onChange={e => setInspection(i => ({ ...i, inspector_name: e.target.value }))} />
                </div>
                <button onClick={() => setInspectionPhase('post')}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Continue to Post-Rental →
                </button>
              </>
            )}

            {inspectionPhase === 'post' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Post-rental Condition</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={inspection.post_condition} onChange={e => setInspection(i => ({ ...i, post_condition: e.target.value }))}>
                    {CATALOG_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Post-rental Notes</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
                    placeholder="Describe any new damage, missing items, issues found…"
                    value={inspection.post_notes} onChange={e => setInspection(i => ({ ...i, post_notes: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Post-rental Photos</label>
                  <input ref={postImgRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleImageUpload(e, 'post')} />
                  <button type="button" onClick={() => postImgRef.current?.click()} disabled={inspUploading}
                    className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 w-full justify-center">
                    <Upload size={13} /> {inspUploading ? 'Uploading…' : 'Upload photos'}
                  </button>
                  {inspection.post_images.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {inspection.post_images.map(url => (
                        <div key={url} className="relative">
                          <img src={url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                          <button onClick={() => setInspection(i => ({ ...i, post_images: i.post_images.filter(u => u !== url) }))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"><X size={9} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border border-red-100 bg-red-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="claim" checked={inspection.damage_claim}
                      onChange={e => setInspection(i => ({ ...i, damage_claim: e.target.checked }))} className="rounded" />
                    <label htmlFor="claim" className="text-sm font-medium text-red-700">File damage claim</label>
                  </div>
                  {inspection.damage_claim && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Claim notes</label>
                        <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
                          value={inspection.claim_notes} onChange={e => setInspection(i => ({ ...i, claim_notes: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Estimated claim amount (USD)</label>
                        <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                          value={inspection.claim_amount} onChange={e => setInspection(i => ({ ...i, claim_amount: e.target.value }))} />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={saveInspection}
              className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">
              Save Inspection Report
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── Create / Edit Modal ── */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Add Equipment' : 'Edit Equipment'} onClose={close}>
          {/* Tabs */}
          <div className="flex gap-0 border-b mb-4 -mx-1">
            {(['basic', 'specs', 'logistics'] as const).map(tab => (
              <button key={tab} onClick={() => setFormTab(tab)}
                className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 ${formTab === tab ? 'border-black text-black font-medium' : 'border-transparent text-gray-600 hover:text-gray-600'}`}>
                {tab === 'basic' ? 'Basic Info' : tab === 'specs' ? 'Specs & Power' : 'Logistics'}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {formTab === 'basic' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {f('item_id', 'Item ID', 'text', 'CAM0001')}
                  {f('name', 'Name *', 'text', 'Equipment name')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {f('brand', 'Brand', 'text', 'ARRI, Sony…')}
                  {f('model', 'Model', 'text', 'Model number')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {sel('category', 'Category', CATALOG_CATEGORIES)}
                  {f('subcategory', 'Subcategory', 'text', '')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {sel('status', 'Status', CATALOG_STATUSES)}
                  {sel('condition', 'Condition', CATALOG_CONDITIONS)}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    rows={2} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Production use</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.production_use}
                    onChange={e => setForm({ ...form, production_use: e.target.value })}
                    placeholder="When / how this item is used" />
                </div>
                {/* Images */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Photos</label>
                  <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleImageUpload(e, 'form')} />
                  <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 w-full justify-center disabled:opacity-50">
                    <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload photos'}
                  </button>
                  {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
                  {form.images.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {form.images.map(url => (
                        <div key={url} className="relative">
                          <img src={url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                          <button onClick={() => setForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                            <X size={9} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {formTab === 'specs' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {f('replacement_value_usd', 'Replacement Value (USD)', 'number', '0')}
                  {f('rental_day_rate_usd', 'Day Rate (USD)', 'number', '0')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {f('voltage', 'Voltage', 'text', '12V DC')}
                  {f('wattage', 'Wattage', 'text', '90W')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {f('amperage', 'Amperage', 'text', '7.5A')}
                  {f('power_connector', 'Power Connector', 'text', 'LEMO 8-pin')}
                </div>
                {f('battery_type', 'Battery Type', 'text', 'V-Mount / Gold Mount')}
                <div className="grid grid-cols-2 gap-3">
                  {f('weight_kg', 'Weight (kg)', 'number', '2.9')}
                  {f('dimensions', 'Dimensions', 'text', 'Body varies')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {f('serial_number', 'Serial Number', 'text', '')}
                  {f('barcode_qr', 'Barcode / QR', 'text', '')}
                </div>
              </>
            )}

            {formTab === 'logistics' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {f('warehouse_location', 'Warehouse Location', 'text', 'Main Warehouse')}
                  {f('kit_name', 'Kit Name', 'text', 'Camera Bodies')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {f('maintenance_cycle_days', 'Service Cycle (days)', 'number', '180')}
                  {f('last_service_date', 'Last Serviced', 'date')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {f('next_service_due', 'Next Service Due', 'date')}
                  {f('purchase_date', 'Purchase Date', 'date')}
                </div>
                <div className="flex items-center gap-2 py-1">
                  <input type="checkbox" id="ins" checked={form.insurance_required}
                    onChange={e => setForm({ ...form, insurance_required: e.target.checked })}
                    className="rounded" />
                  <label htmlFor="ins" className="text-sm text-gray-700">Insurance required</label>
                </div>
                {f('source_url', 'Source / Manufacturer URL', 'url', 'https://…')}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    rows={3} value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={save} disabled={!form.name}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-green-700">
              {modal === 'create' ? 'Add item' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value}</p>
    </div>
  );
}

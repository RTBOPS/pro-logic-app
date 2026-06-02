'use client';

import { useState, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Phone, Mail, Image, MapPin } from 'lucide-react';

const empty = {
  name: '', address: '', city: '', notes: '',
  contact_name: '', contact_phone: '', contact_email: '',
  photos: [] as string[],
};

export default function LocationsPage() {
  const { data: locations, loading } = useData('locations');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setForm(empty); setModal('create'); };
  const openEdit = (l: any) => {
    setForm({
      name: l.name || '', address: l.address || '', city: l.city || '', notes: l.notes || '',
      contact_name: l.contact_name || '', contact_phone: l.contact_phone || '',
      contact_email: l.contact_email || '', photos: l.photos || [],
    });
    setEditId(l.id);
    setModal('edit');
  };
  const close = () => { setModal(null); setEditId(null); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `locations/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      urls.push(url);
    }
    setForm(f => ({ ...f, photos: [...f.photos, ...urls] }));
    setUploading(false);
  };

  const removePhoto = (url: string) => {
    setForm(f => ({ ...f, photos: f.photos.filter(p => p !== url) }));
  };

  const save = async () => {
    if (!form.name) return;
    if (modal === 'create') {
      await addDoc(collection(db, 'locations'), form);
    } else if (editId) {
      await updateDoc(doc(db, 'locations', editId), form);
    }
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    await deleteDoc(doc(db, 'locations', id));
  };

  const field = (label: string, key: keyof typeof empty, placeholder?: string, type = 'text') => (
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-500 text-sm mt-1">{locations.length} saved</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-orange-600 transition-colors"
        >
          <Plus size={16} /> Add Location
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          No locations saved yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations.map((l: any) => (
            <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
              {/* Photos */}
              {l.photos?.length > 0 && (
                <div className="relative h-36 overflow-hidden">
                  <img src={l.photos[0]} className="w-full h-full object-cover" alt={l.name} />
                  {l.photos.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                      +{l.photos.length - 1} more
                    </span>
                  )}
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{l.name}</div>
                    {l.address && (
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {l.address}{l.city ? `, ${l.city}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <button onClick={() => openEdit(l)} className="p-1.5 text-gray-400 hover:text-gray-700">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(l.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {(l.contact_name || l.contact_phone || l.contact_email) && (
                  <div className="mt-3 pt-3 border-t border-gray-50 space-y-1">
                    {l.contact_name && <div className="text-xs font-medium text-gray-700">{l.contact_name}</div>}
                    {l.contact_phone && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={10} /> {l.contact_phone}
                      </div>
                    )}
                    {l.contact_email && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail size={10} /> {l.contact_email}
                      </div>
                    )}
                  </div>
                )}

                {l.notes && (
                  <div className="mt-2 text-xs text-gray-400 italic line-clamp-2">{l.notes}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'create' ? 'Add Location' : 'Edit Location'} onClose={close}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {field('Location name *', 'name', 'Studio, warehouse, exterior…')}
            {field('Address', 'address', 'Street address')}
            {field('City', 'city', 'City')}

            <div className="pt-1 pb-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Local Contact</div>
              {field('Contact name', 'contact_name', 'Full name')}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {field('Phone', 'contact_phone', '+1 555…', 'tel')}
                {field('Email', 'contact_email', 'contact@…', 'email')}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Parking, access notes, restrictions…"
                rows={2}
              />
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Photos</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 w-full justify-center"
              >
                <Image size={14} />
                {uploading ? 'Uploading…' : 'Upload photos'}
              </button>
              {form.photos.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {form.photos.map(url => (
                    <div key={url} className="relative">
                      <img src={url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                      <button
                        onClick={() => removePhoto(url)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t mt-4">
            <button
              onClick={save}
              disabled={!form.name || uploading}
              className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-orange-600 transition-colors"
            >
              {modal === 'create' ? 'Add location' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

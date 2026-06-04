'use client';

import { useState, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Phone, Mail, MapPin, Upload, BookUser, X } from 'lucide-react';
import { useNamespace } from '@/hooks/useNamespace';

const empty = {
  name: '', address: '', city: '', state: '', zip: '', country: 'USA', notes: '',
  contact_name: '', contact_phone: '', contact_email: '',
  parking_info: '', nearest_hospital: '',
  photos: [] as string[],
};

declare global {
  interface Window { contacts?: any; ContactsManager?: any; }
}

export default function LocationsPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: locations, loading } = useData('locations');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => { setForm(empty); setUploadError(''); setModal('create'); };
  const openEdit = (l: any) => {
    setForm({
      name: l.name || '', address: l.address || '', city: l.city || '',
      state: l.state || '', zip: l.zip || '', country: l.country || 'USA',
      notes: l.notes || '', contact_name: l.contact_name || '',
      contact_phone: l.contact_phone || '', contact_email: l.contact_email || '',
      parking_info: l.parking_info || '', nearest_hospital: l.nearest_hospital || '',
      photos: l.photos || [],
    });
    setEditId(l.id); setUploadError(''); setModal('edit');
  };
  const close = () => { setModal(null); setEditId(null); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setUploadError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) { setUploadError('File too large (max 10MB)'); continue; }
        const path = `locations/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const snap = await uploadBytes(storageRef(storage, path), file);
        const url = await getDownloadURL(snap.ref);
        urls.push(url);
      }
      setForm(f => ({ ...f, photos: [...f.photos, ...urls] }));
    } catch (err: any) {
      setUploadError(err.message?.includes('storage/unauthorized')
        ? 'Storage permission denied — check Firebase Storage rules.'
        : `Upload failed: ${err.message || 'unknown error'}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pickContact = async () => {
    if (!('contacts' in navigator)) {
      alert('Contact Picker is not supported on this browser. Try Chrome on Android or Safari on iOS 15.4+.');
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'email', 'tel'], { multiple: false });
      if (contacts.length > 0) {
        const c = contacts[0];
        setForm(f => ({
          ...f,
          contact_name: c.name?.[0] || f.contact_name,
          contact_phone: c.tel?.[0] || f.contact_phone,
          contact_email: c.email?.[0] || f.contact_email,
        }));
      }
    } catch (err) {
      console.error('Contact picker error', err);
    }
  };

  const removePhoto = (url: string) => setForm(f => ({ ...f, photos: f.photos.filter(p => p !== url) }));

  const save = async () => {
    if (!form.name) return;
    if (modal === 'create') await addDoc(collection(db, 'users', namespace!, 'locations'), form);
    else if (editId) await updateDoc(doc(db, 'users', namespace!, 'locations', editId), form);
    close();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    await deleteDoc(doc(db, 'users', namespace!, 'locations', id));
  };

  const fld = (label: string, key: keyof typeof empty, placeholder?: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[key] as string} onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder} />
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-500 text-sm mt-1">{locations.length} saved</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-orange-600">
          <Plus size={16} /> Add Location
        </button>
      </div>

      {loading ? <div className="text-gray-600 text-sm">Loading…</div>
        : locations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
            No locations saved yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {locations.map((l: any) => (
              <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
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
                      {(l.address || l.city) && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} />
                          {[l.address, l.city, l.state, l.zip, l.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => openEdit(l)} className="p-1.5 text-gray-600 hover:text-gray-700"><Pencil size={13} /></button>
                      <button onClick={() => remove(l.id)} className="p-1.5 text-gray-600 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {(l.contact_name || l.contact_phone || l.contact_email) && (
                    <div className="mt-3 pt-3 border-t border-gray-50 space-y-1">
                      {l.contact_name && <div className="text-xs font-medium text-gray-700">{l.contact_name}</div>}
                      {l.contact_phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} /> {l.contact_phone}</div>}
                      {l.contact_email && <div className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10} /> {l.contact_email}</div>}
                    </div>
                  )}
                  {l.notes && <div className="mt-2 text-xs text-gray-600 italic line-clamp-2">{l.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && (
        <Modal title={modal === 'create' ? 'Add Location' : 'Edit Location'} onClose={close}>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">

            {fld('Location name *', 'name', 'Studio, warehouse, exterior…')}
            {fld('Street address', 'address', '123 Main St')}
            <div className="grid grid-cols-2 gap-3">
              {fld('City', 'city', 'Los Angeles')}
              {fld('State', 'state', 'CA')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fld('ZIP / Postal code', 'zip', '90001')}
              {fld('Country', 'country', 'USA')}
            </div>

            {/* Local Contact */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Local Contact</span>
                <button type="button" onClick={pickContact}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2 py-1">
                  <BookUser size={11} /> Import from Contacts
                </button>
              </div>
              {fld('Contact name', 'contact_name', 'Full name')}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {fld('Phone', 'contact_phone', '+1 555…', 'tel')}
                {fld('Email', 'contact_email', 'contact@…', 'email')}
              </div>
            </div>

            {fld('Parking info', 'parking_info', 'Lot B, street parking, structure…')}
            {fld('Nearest hospital', 'nearest_hospital', 'Hospital name & address')}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Access codes, restrictions, load-in notes…" rows={2} />
            </div>

            {/* Photo upload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Photos</label>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              <button type="button" onClick={() => { setUploadError(''); fileRef.current?.click(); }}
                disabled={uploading}
                className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 w-full justify-center disabled:opacity-50">
                <Upload size={14} />
                {uploading ? 'Uploading…' : 'Upload photos (tap to browse)'}
              </button>
              {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
              {form.photos.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {form.photos.map(url => (
                    <div key={url} className="relative group/photo">
                      <img src={url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                      <button onClick={() => removePhoto(url)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={save} disabled={!form.name || uploading}
              className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-orange-600">
              {modal === 'create' ? 'Add location' : 'Save changes'}
            </button>
            <button onClick={close} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

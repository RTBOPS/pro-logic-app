'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Upload, Building2, Save } from 'lucide-react';
import Image from 'next/image';

const empty = {
  name: '', tagline: '', address: '', city: '', state: '', zip: '', country: 'USA',
  phone: '', email: '', website: '',
  tax_id: '', business_type: '',
  primary_color: '#000000', secondary_color: '#ffffff',
  logo_url: '', watermark_url: '',
  contact_name: '', contact_title: '',
  bank_name: '', bank_routing: '', bank_account: '',
  notes: '',
};

export default function CompanyPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'watermark' | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const wmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'company', 'profile')).then(snap => {
      if (snap.exists()) setForm({ ...empty, ...snap.data() });
    });
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'watermark_url') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = field === 'logo_url' ? 'logo' : 'watermark';
    setUploading(key as any);
    try {
      const path = `company/${key}_${Date.now()}_${file.name}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setForm(f => ({ ...f, [field]: url }));
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setSaving(true);
    await setDoc(doc(db, 'company', 'profile'), form);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const fld = (label: string, k: keyof typeof empty, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 size={22} /> Company Information</h1>
          <p className="text-gray-500 text-sm mt-1">This info appears on all generated documents and ID cards</p>
        </div>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-zinc-800'}`}>
          <Save size={14} /> {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Logos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Logos</h2>
          <div className="grid grid-cols-2 gap-6">
            {(['logo_url', 'watermark_url'] as const).map(field => {
              const isLogo = field === 'logo_url';
              const ref = isLogo ? logoRef : wmRef;
              return (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-2">{isLogo ? 'Company Logo' : 'Watermark / Secondary Logo'}</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2">
                    {form[field] ? (
                      <img src={form[field]} className="h-16 object-contain" alt="" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300">
                        <Building2 size={24} />
                      </div>
                    )}
                    <input ref={ref} type="file" accept="image/*" className="hidden"
                      onChange={e => handleUpload(e, field)} />
                    <button onClick={() => ref.current?.click()} disabled={uploading !== null}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5">
                      <Upload size={11} /> {uploading === (isLogo ? 'logo' : 'watermark') ? 'Uploading…' : 'Upload'}
                    </button>
                    <input className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none mt-1"
                      value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder="Or paste URL" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Identity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Company Identity</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {fld('Company Name *', 'name', 'PRO-LOGIC Studio')}
              {fld('Tagline', 'tagline', 'Your production partner')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fld('Business Type', 'business_type', 'LLC, Corp, Sole Prop…')}
              {fld('Tax ID / EIN', 'tax_id', '12-3456789')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Primary Color</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer"
                    value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} />
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Secondary Color</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer"
                    value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} />
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Contact</h2>
          <div className="space-y-3">
            {fld('Street address', 'address', '123 Studio Blvd')}
            <div className="grid grid-cols-3 gap-3">
              {fld('City', 'city', 'Los Angeles')}
              {fld('State', 'state', 'CA')}
              {fld('ZIP', 'zip', '90001')}
            </div>
            {fld('Country', 'country', 'USA')}
            <div className="grid grid-cols-2 gap-3">
              {fld('Phone', 'phone', '+1 555 000 0000', 'tel')}
              {fld('Email', 'email', 'info@company.com', 'email')}
            </div>
            {fld('Website', 'website', 'https://www.company.com', 'url')}
            <div className="grid grid-cols-2 gap-3">
              {fld('Primary Contact Name', 'contact_name', 'Full name')}
              {fld('Title', 'contact_title', 'Executive Producer')}
            </div>
          </div>
        </div>

        {/* Banking */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Banking (for invoices)</h2>
          <div className="space-y-3">
            {fld('Bank Name', 'bank_name', 'Chase Bank')}
            <div className="grid grid-cols-2 gap-3">
              {fld('Routing Number', 'bank_routing', '021000021')}
              {fld('Account Number', 'bank_account', '****1234')}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={3}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
    </div>
  );
}

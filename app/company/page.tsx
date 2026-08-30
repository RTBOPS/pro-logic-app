'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaces } from '@/hooks/useNamespace';
import { Upload, Building2, Save, UserPlus, Trash2, Users, Share2, Lock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useData } from '@/hooks/useData';
import Image from 'next/image';
import { planAtLeast } from '@/lib/plans';
import { FeatureModal } from '@/components/UpgradeGate';

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

interface TeamMember { email: string; role: string; }

export default function CompanyPage() {
  const { user, profile } = useAuth();
  const { namespace: wsNamespace, ownUid: wsOwnUid } = useWorkspaces();
  // Fall back to user.uid if context hasn't resolved yet
  const namespace = wsNamespace || user?.uid || null;
  const ownUid = wsOwnUid || user?.uid || null;

  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'watermark' | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const wmRef = useRef<HTMLInputElement>(null);

  // Team members
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Editor');
  const [inviting, setInviting] = useState(false);
  const [teamGate, setTeamGate] = useState(false);
  const { data: crew } = useData('crew');

  const PLAN_LIMITS: Record<string, number> = { free: 5, producer: 50, pro: 100, broadcast: 100, studio: Infinity };
  const plan = (profile as any)?.plan || 'free';
  const crewLimit = PLAN_LIMITS[plan] ?? 5;
  const crewCount = crew?.length ?? 0;
  const atLimit = crewCount >= crewLimit && crewLimit !== Infinity;

  // isOwner: true when viewing own company namespace
  const isOwner = !!(namespace && ownUid && namespace === ownUid);

  useEffect(() => {
    if (!namespace) return;
    getDoc(doc(db, 'users', namespace, 'company', 'profile')).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setForm({ ...empty, ...data });
        setTeam(data.team_members || []);
      }
    });
  }, [namespace]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'watermark_url') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = field === 'logo_url' ? 'logo' : 'watermark';
    setUploading(key as any);
    try {
      const path = `company/${auth.currentUser?.uid}/${key}_${Date.now()}_${file.name}`;
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
    if (!namespace) return;
    setSaving(true);
    await setDoc(doc(db, 'users', namespace, 'company', 'profile'), { ...form, team_members: team });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addTeamMember = async () => {
    if (!planAtLeast(profile?.plan, 'studio')) { setTeamGate(true); return; }
    if (!inviteEmail.trim() || !namespace || !user) return;
    const email = inviteEmail.trim().toLowerCase();
    if (team.find(m => m.email === email)) { alert('Already invited'); return; }
    setInviting(true);
    try {
      const newTeam = [...team, { email, role: inviteRole }];
      setTeam(newTeam);
      setInviteEmail('');
      // Write invite record so this user sees the owner's namespace on login
      const encoded = email.replace(/[.@]/g, '_');
      await setDoc(doc(db, 'invites', encoded), { ownerUid: namespace, role: inviteRole, email, companyName: form.name || '', accepted: false });
      // Save to company profile too
      await setDoc(doc(db, 'users', namespace, 'company', 'profile'), { ...form, team_members: newTeam }, { merge: true });
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setInviting(false);
    }
  };

  const removeTeamMember = async (email: string) => {
    if (!namespace) return;
    const newTeam = team.filter(m => m.email !== email);
    setTeam(newTeam);
    const encoded = email.replace(/[.@]/g, '_');
    await deleteDoc(doc(db, 'invites', encoded));
    await setDoc(doc(db, 'users', namespace, 'company', 'profile'), { ...form, team_members: newTeam }, { merge: true });
  };

  const fld = (label: string, k: keyof typeof empty, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder}
         />
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      {teamGate && <FeatureModal feature="Team members" requires="studio" onClose={() => setTeamGate(false)} />}
      <PageHeader title="Company Information" subtitle="This info appears on all generated documents and ID cards">
        {(
          <button onClick={save} disabled={saving || !namespace}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-zinc-800'}`}>
            <Save size={14} /> {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        )}
      </PageHeader>

      {namespace && ownUid && !isOwner && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          You are viewing a shared workspace. Contact the account owner to change company settings.
        </div>
      )}

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
                    {(
                      <button onClick={() => ref.current?.click()} disabled={uploading !== null}
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5">
                        <Upload size={11} /> {uploading === (isLogo ? 'logo' : 'watermark') ? 'Uploading…' : 'Upload'}
                      </button>
                    )}
                    <input className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none mt-1"
                      value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder="Or paste URL"  />
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
                    value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}  />
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Secondary Color</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer"
                    value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}  />
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}  />
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
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}  />
        </div>

        {/* Team Access */}
        {namespace && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Users size={16} /> Team Access</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 capitalize">{plan} plan</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${atLimit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {crewCount} / {crewLimit === Infinity ? '∞' : crewLimit} crew
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-1">Users you add here can log in and access your company's data.</p>
            {plan === 'free' && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs text-amber-700">
                <Lock size={12} /> Free plan: 5 crew max. <a href="/pricing" className="underline font-medium ml-1">Upgrade to Producer (50), Broadcast (100) or Studio (unlimited)</a>
              </div>
            )}
            {(plan === 'producer' || plan === 'pro' || plan === 'broadcast') && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-4 text-xs text-blue-700">
                <Share2 size={12} /> Your plan includes up to {plan === 'producer' ? 50 : 100} crew members. <a href="/pricing" className="underline font-medium ml-1">Upgrade to Studio for unlimited</a>
              </div>
            )}
            {plan === 'studio' && (
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 mb-4 text-xs text-purple-700">
                <Share2 size={12} /> Studio plan: unlimited crew members.
              </div>
            )}

            {team.length > 0 && (
              <div className="mb-4 space-y-2">
                {team.map(m => (
                  <div key={m.email} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{m.email}</span>
                      <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">{m.role}</span>
                    </div>
                    <button onClick={() => removeTeamMember(m.email)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {atLimit ? (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                Crew limit reached for your plan. <a href="/pricing" className="underline font-medium">Upgrade</a> to add more.
              </div>
            ) : (
              <div className="space-y-2">
                {/* Pick from existing crew */}
                {crew.filter((c: any) => c.email && !team.find(t => t.email === c.email)).length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Pick from your crew</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      value=""
                      onChange={e => { if (e.target.value) setInviteEmail(e.target.value); }}
                    >
                      <option value="">— Select a crew member —</option>
                      {crew
                        .filter((c: any) => c.email && !team.find((t: any) => t.email === c.email))
                        .map((c: any) => (
                          <option key={c.id} value={c.email}>
                            {c.name} {c.last_name} — {c.email}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                {/* Manual email entry */}
                <div className="flex gap-2">
                  <input type="email"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="or type email manually…" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTeamMember()} />
                  <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                    <option>Editor</option>
                    <option>Viewer</option>
                  </select>
                  <button onClick={addTeamMember} disabled={inviting || !inviteEmail.trim()}
                    className="flex items-center gap-1.5 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition-colors">
                    <UserPlus size={14} /> {inviting ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">The invited person must have a PRO-LOGIC account with that email to access your workspace.</p>
          </div>
        )}
      </div>
    </div>
  );
}

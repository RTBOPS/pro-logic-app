'use client';

import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { useNamespace } from '@/hooks/useNamespace';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, UserCheck } from 'lucide-react';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Other', 'N/A'];
const AGES = ['Child (under 12)', 'Teen (13-17)', 'Young Adult (18-25)', 'Adult (26-40)', 'Middle-aged (41-60)', 'Senior (60+)', 'Any'];
const ETHNICITIES = ['Any', 'Caucasian', 'African American', 'Hispanic/Latino', 'Asian', 'Middle Eastern', 'South Asian', 'Mixed', 'Other'];
const STATUS = ['Open', 'In Consideration', 'Cast', 'Confirmed', 'Replaced'];

const empty = {
  production_id: '', character_name: '', actor_name: '', status: 'Open',
  gender: 'Any', age_range: 'Adult (26-40)', ethnicity: 'Any',
  physical_description: '', personality: '', background: '',
  scenes: '', costume_notes: '', special_requirements: '',
  rate_per_day: '', contract_type: 'Day Player', notes: '',
};

export default function CharacterBreakdownPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: characters, loading } = useData('characters');
  const { data: productions } = useData('productions');
  const { data: crew } = useData('crew');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterProd, setFilterProd] = useState('');

  const filtered = characters.filter((c: any) => !filterProd || c.production_id === filterProd);
  const cast = crew.filter((c: any) => c.department === 'cast' || c.classification === 'Cast');

  const open = (c?: any) => {
    if (c) { setForm(Object.fromEntries(Object.keys(empty).map(k => [k, c[k] ?? ''])) as typeof empty); setEditId(c.id); }
    else { setForm(empty); setEditId(null); }
    setModal(true);
  };

  const save = async () => {
    const uid = getUid();
    if (!form.character_name || !uid) return;
    try {
      if (editId) await updateDoc(doc(db, 'users', uid, 'characters', editId), form);
      else await addDoc(collection(db, 'users', uid, 'characters'), form);
      setModal(false);
    } catch (e: any) { alert('Save failed: ' + e.message); }
  };

  const remove = async (id: string) => {
    const uid = getUid();
    if (!confirm('Remove character?') || !uid) return;
    await deleteDoc(doc(db, 'users', uid, 'characters', id));
  };

  const STATUS_COLOR: Record<string, string> = {
    Open: 'bg-gray-100 text-gray-600',
    'In Consideration': 'bg-yellow-100 text-yellow-700',
    Cast: 'bg-blue-100 text-blue-700',
    Confirmed: 'bg-green-100 text-green-700',
    Replaced: 'bg-red-100 text-red-600',
  };

  const fld = (label: string, k: keyof typeof empty, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const sel = (label: string, k: keyof typeof empty, opts: string[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const ta = (label: string, k: keyof typeof empty, placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" rows={2}
        value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><UserCheck size={22} /> Character Breakdown</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} characters</p>
        </div>
        <div className="flex gap-2">
          <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600"
            value={filterProd} onChange={e => setFilterProd(e.target.value)}>
            <option value="">All productions</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => open()}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-orange-700">
            <Plus size={15} /> Add Character
          </button>
        </div>
      </div>

      {loading ? <div className="text-gray-600 text-sm">Loading…</div>
        : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-600">
            No characters yet. Add characters for your production.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c: any) => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-gray-900">"{c.character_name}"</div>
                    {c.actor_name && <div className="text-sm text-blue-600">→ {c.actor_name}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                    <button onClick={() => open(c)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-gray-700"><Pencil size={12}/></button>
                    <button onClick={() => remove(c.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-600"><Trash2 size={12}/></button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mb-2">
                  {c.gender && c.gender !== 'Any' && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.gender}</span>}
                  {c.age_range && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.age_range}</span>}
                  {c.ethnicity && c.ethnicity !== 'Any' && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.ethnicity}</span>}
                </div>
                {c.physical_description && <p className="text-xs text-gray-500 mb-1"><strong>Physical:</strong> {c.physical_description}</p>}
                {c.personality && <p className="text-xs text-gray-500 mb-1"><strong>Personality:</strong> {c.personality}</p>}
                {c.scenes && <p className="text-xs text-gray-600">Scenes: {c.scenes}</p>}
              </div>
            ))}
          </div>
        )}

      {modal && (
        <Modal title={editId ? 'Edit Character' : 'Add Character'} onClose={() => setModal(false)}>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {fld('Character Name *', 'character_name', '"Commander Elena"')}
              {sel('Status', 'status', STATUS)}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Actor / Cast Member</label>
              <input list="cast-list" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="Type name or select from crew…"
                value={form.actor_name} onChange={e => setForm(f => ({ ...f, actor_name: e.target.value }))} />
              <datalist id="cast-list">
                {crew.map((c: any) => <option key={c.id} value={`${c.name} ${c.last_name}`} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Production</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={form.production_id} onChange={e => setForm(f => ({ ...f, production_id: e.target.value }))}>
                <option value="">— None —</option>
                {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {sel('Gender', 'gender', GENDERS)}
              {sel('Age Range', 'age_range', AGES)}
              {sel('Ethnicity', 'ethnicity', ETHNICITIES)}
            </div>
            {ta('Physical Description', 'physical_description', 'Height, build, distinguishing features…')}
            {ta('Personality & Backstory', 'personality', 'Character traits, motivations, arc…')}
            {ta('Background / Story', 'background', 'Character history relevant to the story…')}
            {fld('Scenes', 'scenes', '1, 3, 5–8, 12')}
            {ta('Costume Notes', 'costume_notes', 'Wardrobe requirements…')}
            {ta('Special Requirements', 'special_requirements', 'Stunts, prosthetics, dialect coach…')}
            <div className="grid grid-cols-2 gap-3">
              {fld('Day Rate (USD)', 'rate_per_day', '2500', 'number')}
              {sel('Contract Type', 'contract_type', ['Day Player', 'Weekly', 'Run of Show', 'SAG', 'SAG-AFTRA', 'Non-Union'])}
            </div>
            {ta('Notes', 'notes', 'Additional casting notes…')}
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button onClick={save} disabled={!form.character_name}
              className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-orange-700">
              {editId ? 'Save' : 'Add Character'}
            </button>
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

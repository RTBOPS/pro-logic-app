'use client';

import { UpgradeGate } from '@/components/UpgradeGate';
import { useState, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, setDoc, collection, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { Trash2, Upload, Plus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

/* Creative docs: treatment text, mood board & look book images, colour palette.
   treatment/palette live in creative_docs keyed per production; images in
   creative_images {production_id, board, url, caption}. */
export default function CreativePage() {
  const namespace = useNamespace();
  const getUid = () => namespace ?? auth.currentUser?.uid ?? null;
  const { data: productions } = useData('productions');
  const { data: cdocs } = useData('creative_docs');
  const { data: images } = useData('creative_images');

  const [prodId, setProdId] = useState('');
  const [tab, setTab] = useState<'treatment' | 'mood' | 'look'>('treatment');
  const [draft, setDraft] = useState<string | null>(null);   // local treatment edits before save
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const treatment = cdocs.find((d: any) => d.kind === 'treatment' && d.production_id === prodId);
  const palette = cdocs.find((d: any) => d.kind === 'palette' && d.production_id === prodId);
  const colors: string[] = palette?.colors || [];
  const boardImgs = images.filter((i: any) => i.production_id === prodId && i.board === tab);

  const saveTreatment = async () => {
    const uid = getUid(); if (!uid || !prodId || draft === null) return;
    await setDoc(doc(db, 'users', uid, 'creative_docs', `treatment_${prodId}`), { kind: 'treatment', production_id: prodId, text: draft }, { merge: true });
    setDraft(null);
  };
  const savePalette = async (next: string[]) => {
    const uid = getUid(); if (!uid || !prodId) return;
    await setDoc(doc(db, 'users', uid, 'creative_docs', `palette_${prodId}`), { kind: 'palette', production_id: prodId, colors: next }, { merge: true });
  };
  const uploadImgs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files || [])];
    const uid = auth.currentUser?.uid; const ns = getUid();
    if (!files.length || !uid || !ns || !prodId) return;
    setUploading(true);
    try {
      for (const file of files) {
        const path = `creative/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const snap = await uploadBytes(storageRef(storage, path), file);
        const url = await getDownloadURL(snap.ref);
        await addDoc(collection(db, 'users', ns, 'creative_images'), { production_id: prodId, board: tab, url, caption: '' });
      }
    } catch (err: any) { alert('Upload failed: ' + err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const setCaption = async (id: string, caption: string) => { const uid = getUid(); if (uid) await updateDoc(doc(db, 'users', uid, 'creative_images', id), { caption }); };
  const delImg = async (id: string) => { const uid = getUid(); if (uid) await deleteDoc(doc(db, 'users', uid, 'creative_images', id)); };

  return (
    <UpgradeGate feature="Creative Docs" requires="pro">
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Creative" subtitle="Treatment, mood board, look book & colour palette">
        <select value={prodId} onChange={e => setProdId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">— pick a production —</option>
          {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </PageHeader>

      {!prodId ? (
        <p className="text-sm text-gray-400 text-center py-16">Pick a production to start its creative package.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {([['treatment', 'Treatment'], ['mood', 'Mood Board'], ['look', 'Look Book']] as const).map(([t, lab]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {lab}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mr-1">Palette</span>
              {colors.map((c, i) => (
                <span key={i} className="relative group">
                  <input type="color" value={c} onChange={e => { const n = [...colors]; n[i] = e.target.value; savePalette(n); }}
                    className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" />
                  <button onClick={() => savePalette(colors.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-4 h-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px]">✕</button>
                </span>
              ))}
              {colors.length < 8 && (
                <button onClick={() => savePalette([...colors, '#888888'])}
                  className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 flex items-center justify-center"><Plus size={13} /></button>
              )}
            </div>
          </div>

          {tab === 'treatment' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <textarea rows={18} value={draft ?? treatment?.text ?? ''}
                onChange={e => setDraft(e.target.value)}
                placeholder={'Logline…\n\nTone & visual approach…\n\nStory / structure…\n\nReferences…'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:border-gray-400" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Blank line = new paragraph · lines ending in ":" become section headings in the PDF</span>
                <button onClick={saveTreatment} disabled={draft === null}
                  className="bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-700 disabled:opacity-40">
                  {draft === null ? 'Saved' : 'Save treatment'}
                </button>
              </div>
            </div>
          )}

          {(tab === 'mood' || tab === 'look') && (
            <div className="space-y-4">
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-2xl py-6 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 disabled:opacity-50">
                <Upload size={16} /> {uploading ? 'Uploading…' : `Add images to the ${tab === 'mood' ? 'mood board' : 'look book'} (multi-select)`}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadImgs} />
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {boardImgs.map((img: any) => (
                  <div key={img.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group">
                    <div className="relative">
                      <img src={img.url} className="w-full h-40 object-cover" alt="" />
                      <button onClick={() => delImg(img.id)}
                        className="absolute top-1.5 right-1.5 hidden group-hover:flex bg-black/60 text-white rounded-lg p-1.5"><Trash2 size={13} /></button>
                    </div>
                    <input defaultValue={img.caption} onBlur={e => e.target.value !== img.caption && setCaption(img.id, e.target.value)}
                      placeholder="Caption…" className="w-full px-2.5 py-1.5 text-xs focus:outline-none" />
                  </div>
                ))}
                {boardImgs.length === 0 && <p className="col-span-full text-sm text-gray-400 text-center py-8">No images yet.</p>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </UpgradeGate>
  );
}

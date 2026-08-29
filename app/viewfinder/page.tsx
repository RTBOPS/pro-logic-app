'use client';

import { useEffect, useRef, useState } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, deleteDoc, collection, doc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { useNamespace } from '@/hooks/useNamespace';
import { Camera, Grid3x3, Crosshair, Trash2, Video, VideoOff } from 'lucide-react';

/* Director's viewfinder: simulates the field of view of real sensor + lens
   combos by digitally zooming the phone camera, with aspect mattes and
   framing guides. Captures scouting frames tagged with the setup. */

const SENSORS = [
  { id: 'ff', label: 'Full Frame', width: 36 },
  { id: 's35', label: 'Super 35', width: 24.9 },
  { id: 'mft', label: 'MFT', width: 17.3 },
  { id: 's16', label: 'Super 16', width: 12.5 },
];
const FOCALS = [18, 24, 35, 50, 85, 100, 135];
const MATTES = [
  { id: 'off', label: 'No matte', ratio: 0 },
  { id: '239', label: '2.39:1', ratio: 2.39 },
  { id: '185', label: '1.85:1', ratio: 1.85 },
  { id: '169', label: '16:9', ratio: 16 / 9 },
  { id: '43', label: '4:3', ratio: 4 / 3 },
  { id: '916', label: '9:16', ratio: 9 / 16 },
];

export default function ViewfinderPage() {
  const namespace = useNamespace();
  const getUid = () => namespace || auth.currentUser?.uid || null;
  const { data: productions } = useData('productions');
  const { data: shots } = useData('scouting_shots');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState('');
  const [sensor, setSensor] = useState('s35');
  const [focal, setFocal] = useState(35);
  const [matte, setMatte] = useState('239');
  const [grid, setGrid] = useState(true);
  const [center, setCenter] = useState(false);
  const [baseFocal, setBaseFocal] = useState(24); // phone main cam, FF-equivalent
  const [prodId, setProdId] = useState('');
  const [saving, setSaving] = useState(false);

  const sensorW = SENSORS.find(s => s.id === sensor)!.width;
  const ffEquiv = focal * (36 / sensorW);
  const zoom = Math.max(1, ffEquiv / baseFocal);
  const matteRatio = MATTES.find(m => m.id === matte)!.ratio;

  const start = async () => {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setLive(true);
    } catch (e: any) {
      setCamError('Camera unavailable — check browser permissions. On iPhone, use Safari.');
    }
  };
  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLive(false);
  };
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const capture = async () => {
    const uid = getUid();
    const video = videoRef.current;
    if (!uid || !video || !live) return;
    setSaving(true);
    try {
      // Draw only the zoomed (visible) region, centered.
      const vw = video.videoWidth, vh = video.videoHeight;
      const cw = vw / zoom, ch = vh / zoom;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cw); canvas.height = Math.round(ch);
      canvas.getContext('2d')!.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.9));
      const path = `scouting/${uid}/${Date.now()}.jpg`;
      const snap = await uploadBytes(storageRef(storage, path), blob);
      const url = await getDownloadURL(snap.ref);
      await addDoc(collection(db, 'users', uid, 'scouting_shots'), {
        production_id: prodId || null,
        url,
        sensor: SENSORS.find(s => s.id === sensor)!.label,
        focal: `${focal}mm`,
        matte: MATTES.find(m => m.id === matte)!.label,
        created: serverTimestamp(),
      });
    } catch (e: any) {
      alert(`Could not save the frame: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    const uid = getUid();
    if (!uid || !confirm('Delete this frame?')) return;
    await deleteDoc(doc(db, 'users', uid, 'scouting_shots', id));
  };

  const prodShots = shots
    .filter((s: any) => !prodId || s.production_id === prodId)
    .sort((a: any, b: any) => (b.created?.seconds || 0) - (a.created?.seconds || 0));

  // Matte bars relative to the 16:9 stage
  const stageRatio = 16 / 9;
  let barX = 0, barY = 0; // percentages
  if (matteRatio > 0) {
    if (matteRatio >= stageRatio) barY = (1 - stageRatio / matteRatio) / 2 * 100;
    else barX = (1 - matteRatio / stageRatio) / 2 * 100;
  }

  const chip = (active: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Director's Viewfinder</h1>
        <p className="text-gray-500 text-sm">Preview real sensor + lens fields of view with your phone camera, and capture scouting frames.</p>
      </div>

      <div className="bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800">
        {/* Stage */}
        <div className="relative w-full aspect-video overflow-hidden bg-black">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: `scale(${zoom})` }} />
          {matteRatio > 0 && (
            <>
              <div className="absolute left-0 right-0 top-0 bg-black/80" style={{ height: `${barY}%` }} />
              <div className="absolute left-0 right-0 bottom-0 bg-black/80" style={{ height: `${barY}%` }} />
              <div className="absolute top-0 bottom-0 left-0 bg-black/80" style={{ width: `${barX}%` }} />
              <div className="absolute top-0 bottom-0 right-0 bg-black/80" style={{ width: `${barX}%` }} />
            </>
          )}
          {grid && (
            <div className="absolute pointer-events-none" style={{ inset: `${barY}% ${barX}%` }}>
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            </div>
          )}
          {center && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-6 h-px bg-amber-400" /><div className="h-6 w-px bg-amber-400 mx-auto -mt-3" />
            </div>
          )}
          <div className="absolute top-2 left-3 text-[11px] font-mono text-amber-300 bg-black/50 px-2 py-0.5 rounded">
            {SENSORS.find(s => s.id === sensor)!.label} · {focal}mm{matteRatio > 0 ? ` · ${MATTES.find(m => m.id === matte)!.label}` : ''} · {ffEquiv.toFixed(0)}mm FF eq
          </div>
          {!live && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Camera size={34} />
              <button onClick={start} className="bg-amber-400 text-black px-5 py-2 rounded-xl text-sm font-semibold hover:bg-amber-300">Start camera</button>
              {camError && <div className="text-xs text-red-400 max-w-xs text-center">{camError}</div>}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-14">Sensor</span>
            {SENSORS.map(s => <button key={s.id} onClick={() => setSensor(s.id)} className={chip(sensor === s.id)}>{s.label}</button>)}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-14">Lens</span>
            {FOCALS.map(f => <button key={f} onClick={() => setFocal(f)} className={chip(focal === f)}>{f}mm</button>)}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-14">Matte</span>
            {MATTES.map(m => <button key={m.id} onClick={() => setMatte(m.id)} className={chip(matte === m.id)}>{m.label}</button>)}
            <button onClick={() => setGrid(!grid)} className={`${chip(grid)} ml-2 flex items-center gap-1`}><Grid3x3 size={12} /> Thirds</button>
            <button onClick={() => setCenter(!center)} className={`${chip(center)} flex items-center gap-1`}><Crosshair size={12} /> Center</button>
          </div>
          <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-zinc-800">
            <select value={prodId} onChange={e => setProdId(e.target.value)} className="bg-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs">
              <option value="">No production tag</option>
              {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              Phone cam (FF eq)
              <input type="number" value={baseFocal} min={13} max={35} onChange={e => setBaseFocal(Number(e.target.value) || 24)} className="w-14 bg-zinc-800 text-zinc-200 rounded-lg px-2 py-1 text-xs" />
              mm
            </label>
            <div className="flex-1" />
            {live && (
              <button onClick={stop} className="flex items-center gap-1.5 text-zinc-400 text-xs px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700"><VideoOff size={13} /> Stop</button>
            )}
            <button onClick={capture} disabled={!live || saving} className="flex items-center gap-1.5 bg-amber-400 text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-300 disabled:opacity-40">
              <Video size={15} /> {saving ? 'Saving…' : 'Capture frame'}
            </button>
          </div>
        </div>
      </div>

      {/* Captured frames */}
      {prodShots.length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-semibold text-gray-900 mb-2">Scouting frames {prodId ? 'for this production' : ''}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {prodShots.map((s: any) => (
              <div key={s.id} className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden">
                <img src={s.url} alt="" className="w-full aspect-video object-cover" />
                <div className="px-2 py-1.5 text-[11px] text-gray-600">{s.sensor} · {s.focal}{s.matte && s.matte !== 'No matte' ? ` · ${s.matte}` : ''}</div>
                <button onClick={() => remove(s.id)} className="absolute top-1.5 right-1.5 bg-black/60 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

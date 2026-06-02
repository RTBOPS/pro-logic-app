'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useData } from '@/hooks/useData';
import { addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, Trash2, Pencil, Printer, GripVertical, Eraser, Minus } from 'lucide-react';
import Modal from '@/components/Modal';

interface Panel {
  id: string;
  drawing: string; // base64 data URL
  description: string;
  action: string;
  dialogue: string;
  shot: string; // shot type: WS, MS, CU, etc.
  order: number;
}

const SHOT_TYPES = ['WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'OTS', 'POV', 'DRONE', 'TILT', 'PAN'];

function DrawingCanvas({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penSize, setPenSize] = useState(2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#111111';
    ctx.lineWidth = tool === 'eraser' ? penSize * 6 : penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL());
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL());
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTool('pen')}
          className={`p-1.5 rounded ${tool === 'pen' ? 'bg-black text-white' : 'bg-gray-100'}`}
          title="Pen"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-black text-white' : 'bg-gray-100'}`}
          title="Eraser"
        >
          <Eraser size={14} />
        </button>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setPenSize(s => Math.max(1, s - 1))} className="p-1 bg-gray-100 rounded"><Minus size={10} /></button>
          <span className="text-xs w-4 text-center">{penSize}</span>
          <button onClick={() => setPenSize(s => Math.min(10, s + 1))} className="p-1 bg-gray-100 rounded"><Plus size={10} /></button>
        </div>
        <button onClick={clearCanvas} className="ml-auto text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded bg-red-50">Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={225}
        className="border border-gray-200 rounded-lg w-full cursor-crosshair touch-none"
        style={{ aspectRatio: '16/9' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
    </div>
  );
}

export default function StoryboardPage() {
  const { data: productions } = useData('productions');
  const [selectedProduction, setSelectedProduction] = useState('');
  const [panels, setPanels] = useState<Panel[]>([]);
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [editDrawing, setEditDrawing] = useState('');
  const [saving, setSaving] = useState(false);

  const collPath = selectedProduction ? `productions/${selectedProduction}/storyboard` : null;
  const { data: savedPanels, loading } = useData(collPath || 'storyboard_placeholder');

  useEffect(() => {
    if (savedPanels && collPath) {
      setPanels(savedPanels.sort((a: any, b: any) => a.order - b.order));
    }
  }, [savedPanels]);

  const addPanel = async () => {
    if (!collPath) return;
    const newPanel = {
      drawing: '', description: '', action: '', dialogue: '', shot: 'MS',
      order: panels.length,
    };
    const ref = await addDoc(collection(db, collPath), newPanel);
    setEditingPanel({ ...newPanel, id: ref.id });
    setEditDrawing('');
  };

  const openEdit = (p: Panel) => {
    setEditingPanel({ ...p });
    setEditDrawing(p.drawing);
  };

  const savePanel = async () => {
    if (!editingPanel || !collPath) return;
    setSaving(true);
    await updateDoc(doc(db, collPath, editingPanel.id), {
      ...editingPanel,
      drawing: editDrawing,
    });
    setSaving(false);
    setEditingPanel(null);
  };

  const removePanel = async (id: string) => {
    if (!collPath || !confirm('Delete this panel?')) return;
    await deleteDoc(doc(db, collPath, id));
  };

  const printStoryboard = () => window.print();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storyboard</h1>
          <p className="text-gray-500 text-sm mt-1">Visual planning for your productions</p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none"
            value={selectedProduction}
            onChange={e => setSelectedProduction(e.target.value)}
          >
            <option value="">Select production…</option>
            {productions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedProduction && (
            <>
              <button
                onClick={printStoryboard}
                className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-50"
              >
                <Printer size={15} /> Print
              </button>
              <button
                onClick={addPanel}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm hover:bg-zinc-800"
              >
                <Plus size={16} /> Add Panel
              </button>
            </>
          )}
        </div>
      </div>

      {!selectedProduction ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center text-gray-400">
          Select a production to start your storyboard.
        </div>
      ) : loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : panels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center text-gray-400">
          No panels yet. Click "Add Panel" to start drawing.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print-grid" id="storyboard-print">
          {panels.map((panel, idx) => (
            <div key={panel.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
              {/* Panel number */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                <span className="text-xs font-semibold text-gray-500">Panel {idx + 1}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">{panel.shot}</span>
                  <button onClick={() => openEdit(panel)} className="p-1 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => removePanel(panel.id)} className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Drawing area */}
              <div
                className="bg-gray-50 cursor-pointer"
                style={{ aspectRatio: '16/9' }}
                onClick={() => openEdit(panel)}
              >
                {panel.drawing ? (
                  <img src={panel.drawing} className="w-full h-full object-contain" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                    Click to draw
                  </div>
                )}
              </div>

              {/* Text content */}
              <div className="p-3 space-y-1">
                {panel.description && (
                  <p className="text-xs font-medium text-gray-700 line-clamp-2">{panel.description}</p>
                )}
                {panel.action && (
                  <p className="text-xs text-gray-500 line-clamp-2 italic">{panel.action}</p>
                )}
                {panel.dialogue && (
                  <p className="text-xs text-gray-500 line-clamp-2 border-l-2 border-gray-200 pl-2">"{panel.dialogue}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Panel Modal */}
      {editingPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && setEditingPanel(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">Edit Panel</h2>
              <button onClick={() => setEditingPanel(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <DrawingCanvas value={editDrawing} onChange={setEditDrawing} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Shot Type</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={editingPanel.shot}
                    onChange={e => setEditingPanel({ ...editingPanel, shot: e.target.value })}
                  >
                    {SHOT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Scene Description</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  rows={2}
                  value={editingPanel.description}
                  onChange={e => setEditingPanel({ ...editingPanel, description: e.target.value })}
                  placeholder="What's happening in this shot…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Action / Camera Movement</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  rows={2}
                  value={editingPanel.action}
                  onChange={e => setEditingPanel({ ...editingPanel, action: e.target.value })}
                  placeholder="Pan left, dolly in, character walks to…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dialogue</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  rows={2}
                  value={editingPanel.dialogue}
                  onChange={e => setEditingPanel({ ...editingPanel, dialogue: e.target.value })}
                  placeholder="Character dialogue for this frame…"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3">
              <button
                onClick={savePanel}
                disabled={saving}
                className="flex-1 bg-black text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-zinc-800"
              >
                {saving ? 'Saving…' : 'Save panel'}
              </button>
              <button onClick={() => setEditingPanel(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body > * { display: none; }
          #storyboard-print { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          #storyboard-print > * { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Image as KonvaImage, Transformer, Line } from 'react-konva';
import { Trash2, Download, Printer, ZoomIn, ZoomOut, Grid, RotateCcw } from 'lucide-react';

export interface BlueprintItem {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  category: string;
}

const EQUIPMENT_PALETTE = [
  // Cameras
  { type: 'camera', label: 'Camera A', color: '#1d4ed8', category: 'Camera', emoji: '📷', w: 50, h: 35 },
  { type: 'camera_b', label: 'Camera B', color: '#1d4ed8', category: 'Camera', emoji: '📷', w: 50, h: 35 },
  { type: 'drone', label: 'Drone', color: '#0369a1', category: 'Camera', emoji: '🚁', w: 40, h: 40 },
  // Lighting
  { type: 'light_key', label: 'Key Light', color: '#d97706', category: 'Lighting', emoji: '💡', w: 35, h: 35 },
  { type: 'light_fill', label: 'Fill Light', color: '#d97706', category: 'Lighting', emoji: '💡', w: 35, h: 35 },
  { type: 'light_back', label: 'Back Light', color: '#d97706', category: 'Lighting', emoji: '💡', w: 35, h: 35 },
  { type: 'led_wall', label: 'LED Wall', color: '#7c3aed', category: 'Lighting', emoji: '📺', w: 100, h: 20 },
  { type: 'backdrop', label: 'Backdrop', color: '#4b5563', category: 'Lighting', emoji: '🎭', w: 100, h: 15 },
  // Audio
  { type: 'speaker', label: 'Speaker', color: '#0d9488', category: 'Audio', emoji: '🔊', w: 30, h: 30 },
  { type: 'mic_stand', label: 'Mic Stand', color: '#0d9488', category: 'Audio', emoji: '🎙️', w: 20, h: 20 },
  { type: 'mixer', label: 'Mixer', color: '#0d9488', category: 'Audio', emoji: '🎛️', w: 50, h: 35 },
  // Furniture
  { type: 'chair', label: 'Chair', color: '#78716c', category: 'Furniture', emoji: '🪑', w: 30, h: 30 },
  { type: 'table', label: 'Table', color: '#78716c', category: 'Furniture', emoji: '🪣', w: 80, h: 40 },
  { type: 'desk', label: 'Desk', color: '#78716c', category: 'Furniture', emoji: '🗄️', w: 70, h: 35 },
  { type: 'sofa', label: 'Sofa', color: '#78716c', category: 'Furniture', emoji: '🛋️', w: 90, h: 40 },
  // Tech
  { type: 'monitor', label: 'Monitor', color: '#374151', category: 'Tech', emoji: '🖥️', w: 50, h: 35 },
  { type: 'laptop', label: 'Laptop', color: '#374151', category: 'Tech', emoji: '💻', w: 40, h: 28 },
  { type: 'projector', label: 'Projector', color: '#374151', category: 'Tech', emoji: '📽️', w: 40, h: 30 },
  // Structure
  { type: 'wall_h', label: 'Wall (H)', color: '#9ca3af', category: 'Structure', emoji: '▬', w: 120, h: 10 },
  { type: 'wall_v', label: 'Wall (V)', color: '#9ca3af', category: 'Structure', emoji: '▮', w: 10, h: 120 },
  { type: 'door', label: 'Door', color: '#6b7280', category: 'Structure', emoji: '🚪', w: 30, h: 10 },
  { type: 'window', label: 'Window', color: '#93c5fd', category: 'Structure', emoji: '🪟', w: 50, h: 8 },
  // Crew marks
  { type: 'talent', label: 'Talent', color: '#b45309', category: 'Crew', emoji: '🎬', w: 28, h: 28 },
  { type: 'crew_mark', label: 'Crew Pos.', color: '#6b7280', category: 'Crew', emoji: '👤', w: 24, h: 24 },
  { type: 'c_stand', label: 'C-Stand', color: '#6b7280', category: 'Grip', emoji: '🔱', w: 20, h: 20 },
];

const PALETTE_CATEGORIES = ['Camera', 'Lighting', 'Audio', 'Furniture', 'Tech', 'Structure', 'Crew', 'Grip'];

function ItemShape({ item, isSelected, onSelect, onChange }: {
  item: BlueprintItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<BlueprintItem>) => void;
}) {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  const def = EQUIPMENT_PALETTE.find(p => p.type === item.type);
  const fillColor = item.color + '33';

  return (
    <Group
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
    >
      <Rect
        ref={shapeRef}
        width={item.width}
        height={item.height}
        fill={fillColor}
        stroke={isSelected ? '#000' : item.color}
        strokeWidth={isSelected ? 2 : 1.5}
        cornerRadius={3}
      />
      <Text
        text={def?.emoji || '?'}
        fontSize={Math.min(item.width, item.height) * 0.5}
        x={item.width / 2 - Math.min(item.width, item.height) * 0.25}
        y={item.height / 2 - Math.min(item.width, item.height) * 0.3}
        listening={false}
      />
      <Text
        text={item.label}
        fontSize={9}
        x={0}
        y={item.height + 2}
        width={item.width}
        align="center"
        fill="#374151"
        listening={false}
      />
    </Group>
  );
}

export default function BlueprintCanvas({ items, onChange }: {
  items: BlueprintItem[];
  onChange: (items: BlueprintItem[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Camera');
  const stageRef = useRef<any>(null);

  const CANVAS_W = 800;
  const CANVAS_H = 560;
  const GRID = 20;

  const addItem = (def: typeof EQUIPMENT_PALETTE[0]) => {
    const newItem: BlueprintItem = {
      id: crypto.randomUUID(),
      type: def.type,
      label: def.label,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
      width: def.w,
      height: def.h,
      rotation: 0,
      color: def.color,
      category: def.category,
    };
    onChange([...items, newItem]);
    setSelected(newItem.id);
  };

  const updateItem = (id: string, updates: Partial<BlueprintItem>) => {
    onChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const deleteSelected = () => {
    if (!selected) return;
    onChange(items.filter(i => i.id !== selected));
    setSelected(null);
  };

  const rotateSelected = () => {
    if (!selected) return;
    const item = items.find(i => i.id === selected);
    if (item) updateItem(selected, { rotation: (item.rotation + 45) % 360 });
  };

  const exportPDF = () => {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri) return;
    const link = document.createElement('a');
    link.download = 'blueprint.png';
    link.href = uri;
    link.click();
  };

  const gridLines: React.ReactElement[] = [];
  if (showGrid) {
    for (let x = 0; x <= CANVAS_W; x += GRID) {
      gridLines.push(<Line key={`v${x}`} points={[x, 0, x, CANVAS_H]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />);
    }
    for (let y = 0; y <= CANVAS_H; y += GRID) {
      gridLines.push(<Line key={`h${y}`} points={[0, y, CANVAS_W, y]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />);
    }
  }

  const paletteCurrent = EQUIPMENT_PALETTE.filter(p => p.category === activeCategory);
  const selectedItem = items.find(i => i.id === selected);

  return (
    <div className="flex gap-4 h-full">
      {/* Palette sidebar */}
      <div className="w-44 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Equipment</div>
        </div>
        <div className="flex flex-wrap gap-1 px-2 py-2 border-b">
          {PALETTE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${activeCategory === cat ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {paletteCurrent.map(def => (
            <button
              key={def.type}
              onClick={() => addItem(def)}
              className="w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-base">{def.emoji}</span>
              <span className="text-gray-700">{def.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col gap-2">
        {/* Toolbar */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2">
          <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-1.5 rounded hover:bg-gray-100"><ZoomIn size={14} /></button>
          <span className="text-xs text-gray-500 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="p-1.5 rounded hover:bg-gray-100"><ZoomOut size={14} /></button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button onClick={() => setShowGrid(g => !g)} className={`p-1.5 rounded ${showGrid ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Toggle grid"><Grid size={14} /></button>
          {selected && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button onClick={rotateSelected} className="p-1.5 rounded hover:bg-gray-100" title="Rotate 45°"><RotateCcw size={14} /></button>
              <button onClick={deleteSelected} className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
              {selectedItem && (
                <input
                  className="text-xs border border-gray-200 rounded px-2 py-1 ml-1 w-32"
                  value={selectedItem.label}
                  onChange={e => updateItem(selected, { label: e.target.value })}
                  placeholder="Label"
                />
              )}
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={exportPDF} className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black">
              <Download size={12} /> Export PNG
            </button>
          </div>
        </div>

        {/* Stage */}
        <div className="overflow-auto border border-gray-200 rounded-xl bg-white shadow-sm">
          <Stage
            ref={stageRef}
            width={CANVAS_W * scale}
            height={CANVAS_H * scale}
            scaleX={scale}
            scaleY={scale}
            onClick={e => { if (e.target === e.target.getStage()) setSelected(null); }}
          >
            <Layer>
              {/* Grid */}
              <Rect width={CANVAS_W} height={CANVAS_H} fill="#fafafa" />
              {gridLines}
              {/* Items */}
              {items.map(item => (
                <ItemShape
                  key={item.id}
                  item={item}
                  isSelected={item.id === selected}
                  onSelect={() => setSelected(item.id)}
                  onChange={updates => updateItem(item.id, updates)}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}

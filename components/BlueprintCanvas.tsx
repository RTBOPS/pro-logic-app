'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Text, Group, Image as KonvaImage, Transformer } from 'react-konva';
import {
  Trash2, Download, ZoomIn, ZoomOut, Grid, RotateCcw,
  Square, Circle as CircleIcon, Minus, PenLine, MousePointer,
  ImagePlus, Type, Bold, Italic,
} from 'lucide-react';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface BlueprintItem {
  id: string;
  kind: 'equipment' | 'rect' | 'circle' | 'line' | 'freehand' | 'text';
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  category: string;
  // For line / freehand
  points?: number[];
  strokeWidth?: number;
  // For text
  fontSize?: number;
  fontStyle?: string;
}

// ─── SVG icon data URLs ───────────────────────────────────────────────────────
function svgUrl(svg: string) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const ICONS: Record<string, string> = {
  camera: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="12" width="40" height="28" rx="4" fill="#1d4ed8" opacity=".15" stroke="#1d4ed8" stroke-width="2.5"/>
    <circle cx="24" cy="26" r="8" fill="#1d4ed8" opacity=".25" stroke="#1d4ed8" stroke-width="2"/>
    <circle cx="24" cy="26" r="4" fill="#1d4ed8"/>
    <rect x="16" y="8" width="10" height="6" rx="2" fill="#1d4ed8"/>
    <rect x="36" y="17" width="5" height="4" rx="1.5" fill="#1d4ed8"/>
  </svg>`),

  camera_b: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="12" width="40" height="28" rx="4" fill="#3b82f6" opacity=".15" stroke="#3b82f6" stroke-width="2.5"/>
    <circle cx="24" cy="26" r="8" fill="#3b82f6" opacity=".25" stroke="#3b82f6" stroke-width="2"/>
    <circle cx="24" cy="26" r="4" fill="#3b82f6"/>
    <rect x="16" y="8" width="10" height="6" rx="2" fill="#3b82f6"/>
    <text x="8" y="46" font-size="7" fill="#1d4ed8" font-family="sans-serif">B</text>
  </svg>`),

  drone: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <ellipse cx="12" cy="12" rx="8" ry="4" fill="#0369a1" opacity=".3" stroke="#0369a1" stroke-width="1.5"/>
    <ellipse cx="36" cy="12" rx="8" ry="4" fill="#0369a1" opacity=".3" stroke="#0369a1" stroke-width="1.5"/>
    <ellipse cx="12" cy="36" rx="8" ry="4" fill="#0369a1" opacity=".3" stroke="#0369a1" stroke-width="1.5"/>
    <ellipse cx="36" cy="36" rx="8" ry="4" fill="#0369a1" opacity=".3" stroke="#0369a1" stroke-width="1.5"/>
    <rect x="10" y="22" width="28" height="4" rx="2" fill="#0369a1" opacity=".4"/>
    <rect x="22" y="10" width="4" height="28" rx="2" fill="#0369a1" opacity=".4"/>
    <circle cx="24" cy="24" r="5" fill="#0369a1" stroke="white" stroke-width="1.5"/>
  </svg>`),

  light_key: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="14" y="6" width="20" height="18" rx="3" fill="#d97706" opacity=".2" stroke="#d97706" stroke-width="2"/>
    <line x1="24" y1="24" x2="24" y2="42" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="42" x2="32" y2="42" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="24" y1="6" x2="24" y2="2" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="9" x2="11" y2="6" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
    <line x1="34" y1="9" x2="37" y2="6" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="24" cy="15" rx="5" ry="5" fill="#fbbf24" opacity=".7"/>
  </svg>`),

  light_fill: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="14" y="6" width="20" height="18" rx="3" fill="#f59e0b" opacity=".2" stroke="#f59e0b" stroke-width="2"/>
    <line x1="24" y1="24" x2="24" y2="42" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="42" x2="32" y2="42" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="24" cy="15" rx="5" ry="5" fill="#fcd34d" opacity=".7"/>
    <text x="18" y="20" font-size="8" fill="#d97706" font-family="sans-serif" font-weight="bold">F</text>
  </svg>`),

  light_back: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="14" y="6" width="20" height="18" rx="3" fill="#b45309" opacity=".2" stroke="#b45309" stroke-width="2"/>
    <line x1="24" y1="24" x2="24" y2="42" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="42" x2="32" y2="42" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="24" cy="15" rx="5" ry="5" fill="#fbbf24" opacity=".5"/>
    <text x="18" y="20" font-size="8" fill="#b45309" font-family="sans-serif" font-weight="bold">B</text>
  </svg>`),

  led_wall: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="2" y="12" width="44" height="24" rx="2" fill="#7c3aed" opacity=".15" stroke="#7c3aed" stroke-width="2"/>
    <rect x="6" y="16" width="8" height="8" rx="1" fill="#a78bfa" opacity=".6"/>
    <rect x="16" y="16" width="8" height="8" rx="1" fill="#818cf8" opacity=".6"/>
    <rect x="26" y="16" width="8" height="8" rx="1" fill="#a78bfa" opacity=".6"/>
    <rect x="36" y="16" width="6" height="8" rx="1" fill="#818cf8" opacity=".6"/>
    <rect x="6" y="26" width="8" height="6" rx="1" fill="#818cf8" opacity=".4"/>
    <rect x="16" y="26" width="8" height="6" rx="1" fill="#a78bfa" opacity=".4"/>
    <rect x="26" y="26" width="8" height="6" rx="1" fill="#818cf8" opacity=".4"/>
    <rect x="36" y="26" width="6" height="6" rx="1" fill="#a78bfa" opacity=".4"/>
  </svg>`),

  speaker: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="10" y="6" width="28" height="36" rx="4" fill="#0d9488" opacity=".15" stroke="#0d9488" stroke-width="2"/>
    <circle cx="24" cy="22" r="7" fill="#0d9488" opacity=".2" stroke="#0d9488" stroke-width="1.5"/>
    <circle cx="24" cy="22" r="3" fill="#0d9488"/>
    <circle cx="24" cy="36" r="3" fill="#0d9488" opacity=".4" stroke="#0d9488" stroke-width="1"/>
  </svg>`),

  mic_stand: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <ellipse cx="24" cy="10" rx="7" ry="9" fill="#0d9488" opacity=".2" stroke="#0d9488" stroke-width="2"/>
    <circle cx="24" cy="10" r="3" fill="#0d9488"/>
    <line x1="24" y1="19" x2="24" y2="38" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="14" y1="44" x2="34" y2="44" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="24" y1="38" x2="14" y2="44" stroke="#0d9488" stroke-width="1.5"/>
    <line x1="24" y1="38" x2="34" y2="44" stroke="#0d9488" stroke-width="1.5"/>
  </svg>`),

  mixer: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="10" width="40" height="28" rx="3" fill="#0d9488" opacity=".15" stroke="#0d9488" stroke-width="2"/>
    <rect x="10" y="16" width="4" height="14" rx="2" fill="#0d9488" opacity=".3"/>
    <rect x="18" y="18" width="4" height="12" rx="2" fill="#0d9488" opacity=".3"/>
    <rect x="26" y="14" width="4" height="16" rx="2" fill="#0d9488" opacity=".3"/>
    <rect x="34" y="20" width="4" height="10" rx="2" fill="#0d9488" opacity=".3"/>
    <circle cx="12" cy="21" r="3" fill="#14b8a6"/>
    <circle cx="20" cy="24" r="3" fill="#14b8a6"/>
    <circle cx="28" cy="19" r="3" fill="#14b8a6"/>
    <circle cx="36" cy="26" r="3" fill="#14b8a6"/>
  </svg>`),

  chair: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="10" y="6" width="28" height="16" rx="4" fill="#78716c" opacity=".3" stroke="#78716c" stroke-width="2"/>
    <rect x="10" y="24" width="28" height="6" rx="2" fill="#78716c" opacity=".4" stroke="#78716c" stroke-width="2"/>
    <line x1="14" y1="30" x2="10" y2="44" stroke="#78716c" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="34" y1="30" x2="38" y2="44" stroke="#78716c" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`),

  table: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="2" y="18" width="44" height="8" rx="3" fill="#78716c" opacity=".3" stroke="#78716c" stroke-width="2"/>
    <line x1="10" y1="26" x2="10" y2="44" stroke="#78716c" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="38" y1="26" x2="38" y2="44" stroke="#78716c" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`),

  sofa: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="20" width="40" height="16" rx="4" fill="#78716c" opacity=".25" stroke="#78716c" stroke-width="2"/>
    <rect x="4" y="14" width="8" height="22" rx="4" fill="#78716c" opacity=".35" stroke="#78716c" stroke-width="1.5"/>
    <rect x="36" y="14" width="8" height="22" rx="4" fill="#78716c" opacity=".35" stroke="#78716c" stroke-width="1.5"/>
    <rect x="10" y="24" width="28" height="10" rx="3" fill="#78716c" opacity=".2"/>
    <line x1="12" y1="36" x2="12" y2="44" stroke="#78716c" stroke-width="2" stroke-linecap="round"/>
    <line x1="36" y1="36" x2="36" y2="44" stroke="#78716c" stroke-width="2" stroke-linecap="round"/>
  </svg>`),

  monitor: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="6" width="40" height="28" rx="3" fill="#374151" opacity=".15" stroke="#374151" stroke-width="2"/>
    <rect x="8" y="10" width="32" height="20" rx="1" fill="#6b7280" opacity=".2"/>
    <line x1="24" y1="34" x2="24" y2="42" stroke="#374151" stroke-width="2.5"/>
    <line x1="16" y1="42" x2="32" y2="42" stroke="#374151" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`),

  projector: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="6" y="16" width="30" height="16" rx="4" fill="#374151" opacity=".2" stroke="#374151" stroke-width="2"/>
    <circle cx="28" cy="24" r="6" fill="#374151" opacity=".3" stroke="#374151" stroke-width="1.5"/>
    <circle cx="28" cy="24" r="3" fill="#374151"/>
    <polygon points="36,22 46,12 46,36" fill="#fbbf24" opacity=".3" stroke="#d97706" stroke-width="1"/>
    <circle cx="12" cy="20" r="2" fill="#6b7280"/>
  </svg>`),

  wall_h: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="2" y="20" width="44" height="8" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="12" y1="20" x2="12" y2="28" stroke="#6b7280" stroke-width="1" opacity=".5"/>
    <line x1="24" y1="20" x2="24" y2="28" stroke="#6b7280" stroke-width="1" opacity=".5"/>
    <line x1="36" y1="20" x2="36" y2="28" stroke="#6b7280" stroke-width="1" opacity=".5"/>
  </svg>`),

  wall_v: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="20" y="2" width="8" height="44" rx="1" fill="#9ca3af" stroke="#6b7280" stroke-width="1.5"/>
    <line x1="20" y1="12" x2="28" y2="12" stroke="#6b7280" stroke-width="1" opacity=".5"/>
    <line x1="20" y1="24" x2="28" y2="24" stroke="#6b7280" stroke-width="1" opacity=".5"/>
    <line x1="20" y1="36" x2="28" y2="36" stroke="#6b7280" stroke-width="1" opacity=".5"/>
  </svg>`),

  door: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="6" y="4" width="24" height="40" rx="2" fill="#6b7280" opacity=".15" stroke="#6b7280" stroke-width="2"/>
    <circle cx="26" cy="24" r="2" fill="#6b7280"/>
    <path d="M30 44 Q44 44 44 30" stroke="#9ca3af" stroke-width="1.5" fill="none" stroke-dasharray="3,2"/>
  </svg>`),

  window: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="16" width="40" height="16" rx="2" fill="#93c5fd" opacity=".3" stroke="#3b82f6" stroke-width="2"/>
    <line x1="24" y1="16" x2="24" y2="32" stroke="#3b82f6" stroke-width="1.5"/>
    <line x1="4" y1="24" x2="44" y2="24" stroke="#3b82f6" stroke-width="1.5"/>
  </svg>`),

  talent: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="12" r="8" fill="#b45309" opacity=".25" stroke="#b45309" stroke-width="2"/>
    <path d="M8 44 C8 32 40 32 40 44" fill="#b45309" opacity=".2" stroke="#b45309" stroke-width="2"/>
    <circle cx="24" cy="12" r="4" fill="#b45309"/>
    <text x="14" y="46" font-size="8" fill="#b45309" font-family="sans-serif" font-weight="bold">★</text>
  </svg>`),

  crew_mark: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="12" r="8" fill="#6b7280" opacity=".25" stroke="#6b7280" stroke-width="2"/>
    <path d="M10 44 C10 32 38 32 38 44" fill="#6b7280" opacity=".2" stroke="#6b7280" stroke-width="2"/>
    <circle cx="24" cy="12" r="4" fill="#6b7280"/>
  </svg>`),

  c_stand: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <line x1="24" y1="4" x2="24" y2="44" stroke="#6b7280" stroke-width="3" stroke-linecap="round"/>
    <line x1="10" y1="20" x2="38" y2="20" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="14" y1="44" x2="34" y2="44" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="24" cy="12" r="3" fill="#6b7280"/>
  </svg>`),

  backdrop: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <line x1="4" y1="8" x2="44" y2="8" stroke="#374151" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="4" y="8" width="40" height="32" rx="1" fill="#4b5563" opacity=".15" stroke="#4b5563" stroke-width="1.5"/>
    <line x1="10" y1="4" x2="10" y2="8" stroke="#374151" stroke-width="2"/>
    <line x1="38" y1="4" x2="38" y2="8" stroke="#374151" stroke-width="2"/>
  </svg>`),
};

const EQUIPMENT_PALETTE = [
  { type: 'camera', label: 'Camera A', color: '#1d4ed8', category: 'Camera', w: 50, h: 50 },
  { type: 'camera_b', label: 'Camera B', color: '#3b82f6', category: 'Camera', w: 50, h: 50 },
  { type: 'drone', label: 'Drone', color: '#0369a1', category: 'Camera', w: 50, h: 50 },
  { type: 'light_key', label: 'Key Light', color: '#d97706', category: 'Lighting', w: 40, h: 50 },
  { type: 'light_fill', label: 'Fill Light', color: '#f59e0b', category: 'Lighting', w: 40, h: 50 },
  { type: 'light_back', label: 'Back Light', color: '#b45309', category: 'Lighting', w: 40, h: 50 },
  { type: 'led_wall', label: 'LED Wall', color: '#7c3aed', category: 'Lighting', w: 90, h: 40 },
  { type: 'backdrop', label: 'Backdrop', color: '#4b5563', category: 'Lighting', w: 90, h: 40 },
  { type: 'speaker', label: 'Speaker', color: '#0d9488', category: 'Audio', w: 40, h: 50 },
  { type: 'mic_stand', label: 'Mic Stand', color: '#0d9488', category: 'Audio', w: 35, h: 50 },
  { type: 'mixer', label: 'Mixer', color: '#0d9488', category: 'Audio', w: 60, h: 40 },
  { type: 'chair', label: 'Chair', color: '#78716c', category: 'Furniture', w: 40, h: 50 },
  { type: 'table', label: 'Table', color: '#78716c', category: 'Furniture', w: 80, h: 40 },
  { type: 'sofa', label: 'Sofa', color: '#78716c', category: 'Furniture', w: 90, h: 50 },
  { type: 'monitor', label: 'Monitor', color: '#374151', category: 'Tech', w: 50, h: 45 },
  { type: 'projector', label: 'Projector', color: '#374151', category: 'Tech', w: 50, h: 45 },
  { type: 'wall_h', label: 'Wall (H)', color: '#6b7280', category: 'Structure', w: 120, h: 20 },
  { type: 'wall_v', label: 'Wall (V)', color: '#6b7280', category: 'Structure', w: 20, h: 120 },
  { type: 'door', label: 'Door', color: '#6b7280', category: 'Structure', w: 45, h: 50 },
  { type: 'window', label: 'Window', color: '#3b82f6', category: 'Structure', w: 55, h: 35 },
  { type: 'talent', label: 'Talent', color: '#b45309', category: 'Crew', w: 40, h: 50 },
  { type: 'crew_mark', label: 'Crew Pos.', color: '#6b7280', category: 'Crew', w: 35, h: 50 },
  { type: 'c_stand', label: 'C-Stand', color: '#6b7280', category: 'Grip', w: 35, h: 50 },
];

const PALETTE_CATEGORIES = ['Camera', 'Lighting', 'Audio', 'Furniture', 'Tech', 'Structure', 'Crew', 'Grip'];

type DrawTool = 'select' | 'rect' | 'circle' | 'line' | 'freehand' | 'text';

const DRAW_COLORS = ['#374151', '#1d4ed8', '#d97706', '#dc2626', '#16a34a', '#7c3aed', '#0d9488'];

// Preload images so Konva can render them
function useEquipmentImages() {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    const loaded: Record<string, HTMLImageElement> = {};
    let pending = Object.keys(ICONS).length;
    Object.entries(ICONS).forEach(([key, src]) => {
      const img = new window.Image();
      img.onload = () => {
        loaded[key] = img;
        pending--;
        if (pending === 0) setImages({ ...loaded });
      };
      img.onerror = () => { pending--; if (pending === 0) setImages({ ...loaded }); };
      img.src = src;
    });
  }, []);
  return images;
}

function EquipmentShape({ item, isSelected, onSelect, onChange, imgEl }: {
  item: BlueprintItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (u: Partial<BlueprintItem>) => void;
  imgEl?: HTMLImageElement;
}) {
  const groupRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Group
        ref={groupRef}
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
        {imgEl ? (
          <KonvaImage image={imgEl} width={item.width} height={item.height} />
        ) : (
          <Rect
            width={item.width}
            height={item.height}
            fill={item.color + '22'}
            stroke={item.color}
            strokeWidth={1.5}
            cornerRadius={3}
          />
        )}
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
        {isSelected && (
          <Rect
            width={item.width}
            height={item.height}
            stroke="#000"
            strokeWidth={2}
            dash={[4, 3]}
            fill="transparent"
            listening={false}
          />
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={['top-left','top-right','bottom-left','bottom-right']}
          onTransformEnd={() => {
            const node = groupRef.current;
            if (!node) return;
            onChange({
              x: node.x(), y: node.y(),
              width: node.width() * node.scaleX(),
              height: node.height() * node.scaleY(),
              rotation: node.rotation(),
            });
            node.scaleX(1); node.scaleY(1);
          }}
        />
      )}
    </>
  );
}

function DrawShape({ item, isSelected, onSelect, onChange, onDblClick }: {
  item: BlueprintItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (u: Partial<BlueprintItem>) => void;
  onDblClick?: () => void;
}) {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const strokeColor = item.color;
  const fillColor = item.color + '22';

  // Attach transformer to resizable shapes when selected
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const transformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    if (item.kind === 'circle') {
      onChange({
        x: node.x() - node.radiusX() * node.scaleX(),
        y: node.y() - node.radiusY() * node.scaleY(),
        width: node.radiusX() * node.scaleX() * 2,
        height: node.radiusY() * node.scaleY() * 2,
        rotation: node.rotation(),
      });
    } else {
      onChange({
        x: node.x(), y: node.y(),
        width: Math.max(node.width() * node.scaleX(), 10),
        height: Math.max(node.height() * node.scaleY(), 10),
        rotation: node.rotation(),
      });
    }
    node.scaleX(1); node.scaleY(1);
  };

  const transformer = isSelected ? (
    <Transformer
      ref={trRef}
      rotateEnabled
      keepRatio={item.kind === 'circle'}
      enabledAnchors={['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center']}
      onTransformEnd={transformEnd}
    />
  ) : null;

  if (item.kind === 'freehand' || item.kind === 'line') {
    return (
      <Line
        ref={shapeRef}
        points={item.points || []}
        stroke={strokeColor}
        strokeWidth={item.strokeWidth || 2}
        tension={item.kind === 'freehand' ? 0.5 : 0}
        lineCap="round"
        lineJoin="round"
        onClick={onSelect}
        onTap={onSelect}
        draggable
        dash={isSelected ? [6, 3] : undefined}
        onDragEnd={e => {
          const pts = item.points || [];
          const dx = e.target.x();
          const dy = e.target.y();
          const moved = pts.map((v, i) => i % 2 === 0 ? v + dx : v + dy);
          e.target.x(0); e.target.y(0);
          onChange({ points: moved });
        }}
      />
    );
  }

  if (item.kind === 'text') {
    const fs = item.fontSize || 16;
    return (
      <>
        <Text
          ref={shapeRef}
          x={item.x} y={item.y}
          text={item.label || 'Text'}
          fontSize={fs}
          fontStyle={item.fontStyle || 'normal'}
          fill={strokeColor}
          rotation={item.rotation}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDblClick={onDblClick}
          onDblTap={onDblClick}
          onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
          onTransformEnd={transformEnd}
        />
        {transformer}
      </>
    );
  }

  if (item.kind === 'circle') {
    const rx = Math.max(Math.abs(item.width) / 2, 1);
    const ry = Math.max(Math.abs(item.height) / 2, 1);
    const cx = item.x + (item.width >= 0 ? rx : -rx);
    const cy = item.y + (item.height >= 0 ? ry : -ry);
    return (
      <>
        <Ellipse
          ref={shapeRef}
          x={cx} y={cy}
          radiusX={rx} radiusY={ry}
          rotation={item.rotation}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={isSelected ? 2.5 : 1.5}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={e => onChange({ x: e.target.x() - rx, y: e.target.y() - ry })}
          onTransformEnd={transformEnd}
        />
        {transformer}
      </>
    );
  }

  // rect — normalize negative dimensions
  const nx = item.width < 0 ? item.x + item.width : item.x;
  const ny = item.height < 0 ? item.y + item.height : item.y;
  return (
    <>
      <Rect
        ref={shapeRef}
        x={nx} y={ny}
        width={Math.max(Math.abs(item.width), 1)}
        height={Math.max(Math.abs(item.height), 1)}
        rotation={item.rotation}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSelected ? 2.5 : 1.5}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={transformEnd}
      />
      {transformer}
    </>
  );
}

export default function BlueprintCanvas({
  items,
  onChange,
  productionId,
}: {
  items: BlueprintItem[];
  onChange: (items: BlueprintItem[]) => void;
  productionId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Camera');
  const [tool, setTool] = useState<DrawTool>('select');
  const [drawColor, setDrawColor] = useState('#374151');
  const [drawFontSize, setDrawFontSize] = useState(18);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const stageRef = useRef<any>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const images = useEquipmentImages();

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const GRID = 20;

  const getPointer = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    return { x: pos.x / scale, y: pos.y / scale };
  };

  const addEquipment = (def: typeof EQUIPMENT_PALETTE[0]) => {
    const newItem: BlueprintItem = {
      id: crypto.randomUUID(),
      kind: 'equipment',
      type: def.type,
      label: def.label,
      x: 80 + Math.random() * 300,
      y: 60 + Math.random() * 200,
      width: def.w,
      height: def.h,
      rotation: 0,
      color: def.color,
      category: def.category,
    };
    onChange([...items, newItem]);
    setSelected(newItem.id);
    setTool('select');
  };

  const updateItem = (id: string, updates: Partial<BlueprintItem>) => {
    onChange(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const deleteSelected = () => {
    if (!selected) return;
    onChange(items.filter(i => i.id !== selected));
    setSelected(null);
  };

  const rotateSelected = () => {
    if (!selected) return;
    const item = items.find(i => i.id === selected);
    if (item) updateItem(selected, { rotation: (item.rotation || 0) + 45 });
  };

  const startTextEdit = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !stageRef.current) return;
    setEditingTextId(id);
    // Position a native textarea over the Konva text node
    const stage = stageRef.current;
    const container = stage.container().getBoundingClientRect();
    const textX = item.x * scale + container.left;
    const textY = item.y * scale + container.top;
    setTimeout(() => textareaRef.current?.focus(), 10);
    void textX; void textY; // coords used in JSX below
  }, [items, scale]);

  const handleStageMouseDown = (e: any) => {
    if (editingTextId) {
      setEditingTextId(null);
      return;
    }
    if (tool === 'select') {
      if (e.target === e.target.getStage()) setSelected(null);
      return;
    }
    const { x, y } = getPointer();
    const id = crypto.randomUUID();

    if (tool === 'text') {
      const newItem: BlueprintItem = {
        id, kind: 'text', type: 'text', label: 'Text',
        x, y, width: 120, height: drawFontSize + 4,
        rotation: 0, color: drawColor, category: 'Text',
        fontSize: drawFontSize,
      };
      onChange([...items, newItem]);
      setSelected(id);
      setTool('select');
      setTimeout(() => startTextEdit(id), 50);
      return;
    }

    setDrawingId(id);
    setIsDrawing(true);

    if (tool === 'freehand') {
      onChange([...items, {
        id, kind: 'freehand', type: 'freehand', label: '', x: 0, y: 0,
        width: 0, height: 0, rotation: 0, color: drawColor, category: 'Draw',
        points: [x, y], strokeWidth: 2,
      }]);
    } else if (tool === 'line') {
      onChange([...items, {
        id, kind: 'line', type: 'line', label: '', x: 0, y: 0,
        width: 0, height: 0, rotation: 0, color: drawColor, category: 'Draw',
        points: [x, y, x, y], strokeWidth: 2,
      }]);
    } else if (tool === 'rect') {
      onChange([...items, {
        id, kind: 'rect', type: 'rect', label: '', x, y,
        width: 0, height: 0, rotation: 0, color: drawColor, category: 'Draw',
      }]);
    } else if (tool === 'circle') {
      onChange([...items, {
        id, kind: 'circle', type: 'circle', label: '', x, y,
        width: 0, height: 0, rotation: 0, color: drawColor, category: 'Draw',
      }]);
    }
  };

  const handleStageMouseMove = (e: any) => {
    if (!isDrawing || !drawingId) return;
    const { x, y } = getPointer();
    const item = items.find(i => i.id === drawingId);
    if (!item) return;

    if (tool === 'freehand') {
      updateItem(drawingId, { points: [...(item.points || []), x, y] });
    } else if (tool === 'line') {
      const pts = item.points || [];
      updateItem(drawingId, { points: [pts[0], pts[1], x, y] });
    } else if (tool === 'rect' || tool === 'circle') {
      updateItem(drawingId, {
        width: x - item.x,
        height: y - item.y,
      });
    }
  };

  const handleStageMouseUp = () => {
    if (isDrawing && drawingId) {
      setSelected(drawingId);
    }
    setIsDrawing(false);
    setDrawingId(null);
    if (tool !== 'freehand') setTool('select');
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUploading(true);
    try {
      // Load locally first for immediate preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new window.Image();
        img.onload = () => setBgImage(img);
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);

      // Upload to Firebase Storage if productionId provided
      if (productionId && storage) {
        const ref = storageRef(storage, `blueprints/${productionId}/background`);
        await uploadBytes(ref, file);
      }
    } finally {
      setBgUploading(false);
    }
  };

  const exportPNG = () => {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri) return;
    const a = document.createElement('a');
    a.download = 'blueprint.png';
    a.href = uri;
    a.click();
  };

  // Grid lines
  const gridLines: React.ReactElement[] = [];
  if (showGrid) {
    for (let x = 0; x <= CANVAS_W; x += GRID)
      gridLines.push(<Line key={`v${x}`} points={[x, 0, x, CANVAS_H]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />);
    for (let y = 0; y <= CANVAS_H; y += GRID)
      gridLines.push(<Line key={`h${y}`} points={[0, y, CANVAS_W, y]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />);
  }

  const selectedItem = items.find(i => i.id === selected);
  const paletteCurrent = EQUIPMENT_PALETTE.filter(p => p.category === activeCategory);

  const cursorStyle = tool === 'select' ? 'default'
    : tool === 'freehand' ? 'crosshair'
    : 'crosshair';

  return (
    <div className="flex gap-4 h-full">
      {/* Left palette */}
      <div className="w-44 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Equipment</div>
        </div>
        <div className="flex flex-wrap gap-1 px-2 py-2 border-b">
          {PALETTE_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${activeCategory === cat ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
          {paletteCurrent.map(def => (
            <button key={def.type} onClick={() => addEquipment(def)}
              className="w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              {/* SVG preview */}
              {ICONS[def.type] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ICONS[def.type]} alt={def.label} className="w-6 h-6 shrink-0" />
              ) : (
                <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-gray-500 text-xs">?</span>
              )}
              <span className="text-gray-700 truncate">{def.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 flex-wrap">
          {/* Tools */}
          {([
            { id: 'select', Icon: MousePointer, title: 'Select' },
            { id: 'rect', Icon: Square, title: 'Rectangle' },
            { id: 'circle', Icon: CircleIcon, title: 'Circle' },
            { id: 'line', Icon: Minus, title: 'Line' },
            { id: 'freehand', Icon: PenLine, title: 'Freehand' },
            { id: 'text', Icon: Type, title: 'Text' },
          ] as { id: DrawTool; Icon: any; title: string }[]).map(({ id, Icon, title }) => (
            <button key={id} onClick={() => setTool(id)} title={title}
              className={`p-1.5 rounded transition-colors ${tool === id ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
              <Icon size={14} />
            </button>
          ))}

          {/* Draw colors + font size (shown when not select tool) */}
          {tool !== 'select' && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              {DRAW_COLORS.map(c => (
                <button key={c} onClick={() => setDrawColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${drawColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
              {tool === 'text' && (
                <>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <select
                    className="text-xs border border-gray-200 rounded px-1.5 py-1"
                    value={drawFontSize}
                    onChange={e => setDrawFontSize(Number(e.target.value))}
                  >
                    {[10,12,14,16,18,22,28,36,48].map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}

          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button onClick={() => setScale(s => Math.min(2, +(s + 0.1).toFixed(1)))} className="p-1.5 rounded hover:bg-gray-100"><ZoomIn size={14} /></button>
          <span className="text-xs text-gray-500 w-9 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.3, +(s - 0.1).toFixed(1)))} className="p-1.5 rounded hover:bg-gray-100"><ZoomOut size={14} /></button>
          <button onClick={() => setShowGrid(g => !g)} className={`p-1.5 rounded ${showGrid ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Toggle grid"><Grid size={14} /></button>

          {/* Background upload */}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button onClick={() => bgInputRef.current?.click()} title="Upload background image"
            className={`p-1.5 rounded hover:bg-gray-100 ${bgUploading ? 'opacity-50' : ''} ${bgImage ? 'text-blue-600' : 'text-gray-600'}`}>
            <ImagePlus size={14} />
          </button>
          {bgImage && (
            <button onClick={() => setBgImage(null)} className="text-xs text-gray-600 hover:text-red-500 px-1">✕ BG</button>
          )}
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />

          {selected && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button onClick={rotateSelected} className="p-1.5 rounded hover:bg-gray-100" title="Rotate 45°"><RotateCcw size={14} /></button>
              <button onClick={deleteSelected} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Delete"><Trash2 size={14} /></button>
              {selectedItem && (selectedItem.kind === 'equipment' || selectedItem.kind === 'text') && (
                <input
                  className="text-xs border border-gray-200 rounded px-2 py-1 w-32"
                  value={selectedItem.label}
                  onChange={e => updateItem(selected, { label: e.target.value })}
                  placeholder={selectedItem.kind === 'text' ? 'Text content' : 'Label'}
                />
              )}
              {selectedItem?.kind === 'text' && (
                <>
                  <select
                    className="text-xs border border-gray-200 rounded px-1.5 py-1"
                    value={selectedItem.fontSize || 16}
                    onChange={e => updateItem(selected, { fontSize: Number(e.target.value) })}
                  >
                    {[10,12,14,16,18,22,28,36,48].map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                  <button
                    onClick={() => updateItem(selected, { fontStyle: selectedItem.fontStyle === 'bold' ? 'normal' : 'bold' })}
                    title="Bold"
                    className={`p-1.5 rounded transition-colors ${selectedItem.fontStyle === 'bold' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                  ><Bold size={13} /></button>
                  <button
                    onClick={() => updateItem(selected, { fontStyle: selectedItem.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    title="Italic"
                    className={`p-1.5 rounded transition-colors ${selectedItem.fontStyle === 'italic' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                  ><Italic size={13} /></button>
                </>
              )}
            </>
          )}

          <div className="ml-auto">
            <button onClick={exportPNG}
              className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black">
              <Download size={12} /> Export PNG
            </button>
          </div>
        </div>

        {/* Stage */}
        <div className="relative overflow-auto border border-gray-200 rounded-xl bg-white shadow-sm"
          style={{ cursor: cursorStyle }}>
          <Stage
            ref={stageRef}
            width={CANVAS_W * scale}
            height={CANVAS_H * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchStart={handleStageMouseDown}
            onTouchMove={handleStageMouseMove}
            onTouchEnd={handleStageMouseUp}
          >
            <Layer>
              {/* Background */}
              <Rect width={CANVAS_W} height={CANVAS_H} fill="#fafafa" listening={false} />
              {bgImage && (
                <KonvaImage
                  image={bgImage}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  opacity={0.4}
                  listening={false}
                />
              )}
              {gridLines}
            </Layer>
            <Layer>
              {/* Draw shapes first (bottom) */}
              {items.filter(i => i.kind !== 'equipment').map(item => (
                <DrawShape
                  key={item.id}
                  item={item}
                  isSelected={item.id === selected}
                  onSelect={() => tool === 'select' && setSelected(item.id)}
                  onChange={u => updateItem(item.id, u)}
                  onDblClick={item.kind === 'text' ? () => startTextEdit(item.id) : undefined}
                />
              ))}
              {/* Equipment icons on top */}
              {items.filter(i => i.kind === 'equipment').map(item => (
                <EquipmentShape
                  key={item.id}
                  item={item}
                  isSelected={item.id === selected}
                  onSelect={() => tool === 'select' && setSelected(item.id)}
                  onChange={u => updateItem(item.id, u)}
                  imgEl={images[item.type]}
                />
              ))}
            </Layer>
          </Stage>

          {/* Floating textarea for inline text editing */}
          {editingTextId && (() => {
            const textItem = items.find(i => i.id === editingTextId);
            if (!textItem) return null;
            const fs = (textItem.fontSize || 16) * scale;
            return (
              <textarea
                ref={textareaRef}
                autoFocus
                className="absolute z-50 bg-white border-2 border-blue-500 rounded px-1 resize-none outline-none shadow-lg"
                style={{
                  left: textItem.x * scale,
                  top: textItem.y * scale,
                  fontSize: fs,
                  color: textItem.color,
                  fontStyle: textItem.fontStyle === 'italic' ? 'italic' : 'normal',
                  fontWeight: textItem.fontStyle === 'bold' ? 'bold' : 'normal',
                  minWidth: 80,
                  minHeight: fs + 8,
                }}
                value={textItem.label}
                onChange={e => updateItem(editingTextId, { label: e.target.value })}
                onBlur={() => setEditingTextId(null)}
                onKeyDown={e => {
                  if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                    e.preventDefault();
                    setEditingTextId(null);
                  }
                }}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}

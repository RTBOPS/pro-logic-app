'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  label: string;
  value: string; // base64 data URL or ''
  onChange: (dataUrl: string) => void;
}

export default function SignaturePad({ label, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Restore saved signature on mount
  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0);
        }
      };
      img.src = value;
    }
  }, []);

  const getPos = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    const ctx = canvas.getContext('2d')!;
    const { clientX, clientY } = 'touches' in e ? e.touches[0] : e;
    const pos = getPos(clientX, clientY, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    const { clientX, clientY } = 'touches' in e ? e.touches[0] : e;
    const pos = getPos(clientX, clientY, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setIsEmpty(false);
  }, []);

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL());
  }, [onChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        {!isEmpty && (
          <button onClick={clear} type="button" className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
            <RotateCcw size={11} /> Clear
          </button>
        )}
      </div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden"
        style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full block cursor-crosshair"
          style={{ height: '100px' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-gray-400 select-none">Sign here</span>
          </div>
        )}
      </div>
    </div>
  );
}

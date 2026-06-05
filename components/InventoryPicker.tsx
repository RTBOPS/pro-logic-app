'use client';

import { useState } from 'react';
import { X, Search, PackagePlus } from 'lucide-react';

interface InventoryItem {
  id: string;
  item_id?: string;
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  serial_number?: string;
  condition?: string;
}

interface Props {
  inventory: InventoryItem[];
  onSelect: (item: InventoryItem) => void;
  onClose: () => void;
}

export default function InventoryPicker({ inventory, onSelect, onClose }: Props) {
  const [q, setQ] = useState('');

  const filtered = inventory.filter(item => {
    if (!q) return true;
    const lq = q.toLowerCase();
    return (
      item.name?.toLowerCase().includes(lq) ||
      item.brand?.toLowerCase().includes(lq) ||
      item.model?.toLowerCase().includes(lq) ||
      item.serial_number?.toLowerCase().includes(lq) ||
      item.category?.toLowerCase().includes(lq) ||
      item.item_id?.toLowerCase().includes(lq)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <PackagePlus size={16} /> Add from Inventory
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search name, brand, model, serial…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No items found</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(item => (
                <button key={item.id} onClick={() => { onSelect(item); onClose(); }}
                  className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[item.brand, item.model].filter(Boolean).join(' · ')}
                        {item.serial_number && <span className="ml-2 font-mono">S/N: {item.serial_number}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {item.category && <div className="text-xs text-gray-500">{item.category}</div>}
                      {item.item_id && <div className="text-xs font-mono text-gray-400">{item.item_id}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

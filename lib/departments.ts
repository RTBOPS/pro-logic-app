export const DEPARTMENTS = [
  { id: 'production', label: 'Production', color: '#7c3aed' },
  { id: 'direction', label: 'Direction', color: '#1d4ed8' },
  { id: 'camera', label: 'Camera / DP', color: '#0369a1' },
  { id: 'electric', label: 'Electric / Lighting', color: '#d97706' },
  { id: 'grip', label: 'Grip', color: '#78716c' },
  { id: 'audio', label: 'Audio / Sound', color: '#0d9488' },
  { id: 'art', label: 'Art Department', color: '#db2777' },
  { id: 'wardrobe', label: 'Wardrobe / Makeup', color: '#7c2d12' },
  { id: 'vfx', label: 'VFX / Post', color: '#065f46' },
  { id: 'cast', label: 'Cast', color: '#b45309' },
  { id: 'transportation', label: 'Transportation', color: '#374151' },
  { id: 'catering', label: 'Catering / Craft', color: '#166534' },
  { id: 'other', label: 'Other', color: '#6b7280' },
] as const;

export type DepartmentId = typeof DEPARTMENTS[number]['id'];

export function deptColor(id: string): string {
  return DEPARTMENTS.find(d => d.id === id)?.color ?? '#6b7280';
}

export function deptLabel(id: string): string {
  return DEPARTMENTS.find(d => d.id === id)?.label ?? id;
}

export const CONFIRMATION_STATUSES = [
  { id: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'confirmed', label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  { id: 'declined', label: 'Declined', color: 'bg-red-100 text-red-600' },
  { id: 'tentative', label: 'Tentative', color: 'bg-blue-100 text-blue-700' },
  { id: 'no_response', label: 'No Response', color: 'bg-gray-100 text-gray-500' },
] as const;

export function statusStyle(id: string): string {
  return CONFIRMATION_STATUSES.find(s => s.id === id)?.color ?? 'bg-gray-100 text-gray-500';
}

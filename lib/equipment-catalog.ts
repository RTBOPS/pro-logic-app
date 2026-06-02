export interface CatalogItem {
  item_id: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  model: string;
  description?: string;
  production_use?: string;
  replacement_value_usd?: number;
  rental_day_rate_usd?: number;
  voltage?: string;
  wattage?: string;
  amperage?: string;
  power_connector?: string;
  battery_type?: string;
  weight_kg?: number;
  dimensions?: string;
  status?: string;
  condition?: string;
  warehouse_location?: string;
  kit_name?: string;
  insurance_required?: boolean;
  maintenance_cycle_days?: number;
  source_url?: string;
  notes?: string;
  data_confidence?: string;
}

// Data lives in /public/equipment-catalog.json — loaded at runtime so it
// doesn't inflate the TypeScript compilation unit and stall the dev server.
let _catalog: CatalogItem[] | null = null;

export async function loadEquipmentCatalog(): Promise<CatalogItem[]> {
  if (_catalog) return _catalog;
  const res = await fetch('/equipment-catalog.json');
  _catalog = await res.json();
  return _catalog!;
}

export const CATALOG_CATEGORIES = [
  'Camera', 'Lens', 'Lighting', 'Audio', 'Monitoring',
  'Video Transmission', 'DIT / Capture', 'DIT / Computer', 'DIT / Switching',
  'Drone', 'Grip', 'Power', 'Accessories', 'Communications',
];

export const CATALOG_STATUSES = ['Available', 'Reserved', 'Checked Out', 'In Repair', 'Lost', 'Retired'];
export const CATALOG_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Needs Service', 'Damaged'];

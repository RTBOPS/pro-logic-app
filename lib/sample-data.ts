import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* Sample data seeded into every new account so the app demonstrates itself
 * on first login. Every doc lives at a deterministic path listed in
 * SAMPLE_DOCS, so removal is surgical — user-created data is never touched. */

const PROD = 'sample_prod';

const SAMPLE_DOCS: [string, any][] = [
  [`productions/${PROD}`, {
    sample: true,
    name: 'Sample — Music Video Shoot', status: 'Pre-Production',
    client: 'Aurora Records', type: 'Music Video',
    start_date: '2026-09-20', end_date: '2026-09-21',
    city: 'Austin', country: 'USA',
    primary_location: 'Eastside Warehouse Studio',
    call_time: '08:00', wrap_time: '20:00',
    crew_call_location: 'Stage door', parking_location: 'Rear lot',
    hospital_nearest: 'Dell Seton Medical Center',
  }],
  ['crew/sample_crew_0', { sample: true, name: 'Alex Rivera', role: 'Director', department: 'production', rate: '650.00', phone: '(512) 555-0101', email: 'alex@example.com' }],
  ['crew/sample_crew_1', { sample: true, name: 'Maya Chen', role: 'Director of Photography', department: 'camera', rate: '600.00', phone: '(512) 555-0102', email: 'maya@example.com' }],
  ['crew/sample_crew_2', { sample: true, name: 'Jordan Blake', role: 'Gaffer', department: 'lighting', rate: '450.00', phone: '(512) 555-0103', email: 'jordan@example.com' }],
  ['crew/sample_crew_3', { sample: true, name: 'Sam Ortiz', role: 'Sound Mixer', department: 'audio', rate: '475.00', phone: '(512) 555-0104', email: 'sam@example.com', dietary: 'Vegetarian' }],
  ['locations/sample_loc', {
    sample: true, name: 'Eastside Warehouse Studio', address: '1200 E 5th St',
    city: 'Austin', state: 'TX', zip: '78702', country: 'USA',
    contact_name: 'Studio Manager', contact_phone: '(512) 555-0100',
    parking_info: 'Rear lot, load-in via dock 2', nearest_hospital: 'Dell Seton Medical Center',
  }],
  ['inventory/sample_inv_0', { sample: true, name: 'Sony FX6 — A Cam', category: 'Camera', serial_number: 'SMP-FX6-001', status: 'Available' }],
  ['inventory/sample_inv_1', { sample: true, name: 'Aputure 600d', category: 'Lighting', serial_number: 'SMP-AP-002', status: 'Available' }],
  ['inventory/sample_inv_2', { sample: true, name: 'Sennheiser MKH 416', category: 'Audio', serial_number: 'SMP-SN-003', status: 'Available' }],
  ['inventory/sample_inv_3', { sample: true, name: 'DJI RS 4 Pro Gimbal', category: 'Grip', serial_number: 'SMP-DJ-004', status: 'Available' }],
  ['clients/sample_client', {
    sample: true, name: 'Riley Park', company: 'Aurora Records', email: 'riley@example.com',
    phone: '(512) 555-0177', notes: 'Label contact for the music video', created: new Date().toISOString(),
  }],
  ['proposals/sample_proposal', {
    sample: true, number: 'PRO-000', title: 'Music video — full production package',
    client_id: 'sample_client', production_id: PROD, status: 'Draft', valid_until: '2026-09-15',
    items: [
      { desc: 'Two-day shoot (director, DP, G&E, sound)', qty: 2, rate: 4800 },
      { desc: 'Edit + color grade', qty: 1, rate: 2500 },
      { desc: 'Location & permits', qty: 1, rate: 900 },
    ],
    terms: '50% deposit to lock the dates. Balance due on final delivery.',
    created: new Date(),
  }],
  ['budget_lines/sample_budget_0', { sample: true, category: 'Camera', description: 'FX6 kit + lenses', qty: 2, rate: 450, actual: 0, production_id: PROD }],
  ['budget_lines/sample_budget_1', { sample: true, category: 'Lighting & Grip', description: 'G&E package', qty: 2, rate: 600, actual: 0, production_id: PROD }],
  ['budget_lines/sample_budget_2', { sample: true, category: 'Crew - Technical', description: 'Day rates (4 crew)', qty: 2, rate: 2175, actual: 0, production_id: PROD }],
  ['budget_lines/sample_budget_3', { sample: true, category: 'Locations', description: 'Warehouse studio rental', qty: 2, rate: 450, actual: 900, production_id: PROD }],
  ['stripboard/sample_scene_0', { sample: true, scene_number: '1', title: 'Performance — wide stage', int_ext: 'INT.', day_night: 'DAY', location: 'Eastside Warehouse Studio', set_name: 'Main stage', pages: '2/8', estimated_hours: '2', production_id: PROD }],
  ['stripboard/sample_scene_1', { sample: true, scene_number: '2', title: 'Artist close-ups', int_ext: 'INT.', day_night: 'DAY', location: 'Eastside Warehouse Studio', set_name: 'Main stage', pages: '3/8', estimated_hours: '2.5', production_id: PROD }],
  ['stripboard/sample_scene_2', { sample: true, scene_number: '3', title: 'Narrative — hallway walk', int_ext: 'INT.', day_night: 'NIGHT', location: 'Eastside Warehouse Studio', set_name: 'Back hallway', pages: '2/8', estimated_hours: '1.5', production_id: PROD }],
  ['stripboard/sample_scene_3', { sample: true, scene_number: '4', title: 'Rooftop sunset finale', int_ext: 'EXT.', day_night: 'DUSK', location: 'Eastside Warehouse Studio', set_name: 'Rooftop', pages: '3/8', estimated_hours: '2', production_id: PROD }],
  ['compliance_docs/sample_comp', {
    sample: true, name: 'General Liability (sample)', kind: 'insurance', production_id: PROD,
    expires: '2026-12-31', notes: 'Replace with your real certificate', added: new Date().toISOString(),
    url: '', filename: '',
  }],
  [`creative_docs/treatment_${PROD}`, {
    sample: true, kind: 'treatment', production_id: PROD,
    text: 'The Look:\nNeon against concrete. One continuous mood from the first frame — the artist alone in a vast dark space that slowly fills with light and dancers.\n\nReferences:\nHigh-contrast practicals, haze, 2.39 framing. Camera always moving, never nervous.',
  }],
  [`creative_docs/palette_${PROD}`, {
    sample: true, kind: 'palette', production_id: PROD,
    colors: ['#0f172a', '#e11d48', '#f5f5f4', '#f59e0b'],
  }],
];

export async function seedSampleData(uid: string) {
  await Promise.all(
    SAMPLE_DOCS.map(([path, data]) =>
      setDoc(doc(db, 'users', uid, ...path.split('/') as [string, string]), data).catch(() => {})
    )
  );
}

export async function removeSampleData(uid: string) {
  await Promise.all(
    SAMPLE_DOCS.map(([path]) =>
      deleteDoc(doc(db, 'users', uid, ...path.split('/') as [string, string])).catch(() => {})
    )
  );
  await updateDoc(doc(db, 'users', uid), { hasSampleData: false }).catch(() => {});
}

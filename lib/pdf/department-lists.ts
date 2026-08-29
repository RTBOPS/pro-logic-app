import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';
import { DEPARTMENTS } from '@/lib/departments';

/* Department lists — one section per department: its crew roster and its
   equipment (inventory categories mapped to departments). Creative
   departments (art, wardrobe/HMU, catering) get ruled blank lines so the
   sheet works as a hand-fill checklist on set. */
const CATEGORY_DEPT: Record<string, string> = {
  'Camera': 'camera', 'Lens': 'camera', 'Monitoring': 'camera', 'Video Transmission': 'camera', 'Drone': 'camera',
  'DIT / Capture': 'camera', 'DIT / Computer': 'camera', 'DIT / Switching': 'camera',
  'Lighting': 'electric', 'Power': 'electric',
  'Grip': 'grip',
  'Audio': 'audio', 'Communications': 'audio',
  'Accessories': 'other',
};
const BLANK_DEPTS = new Set(['art', 'wardrobe', 'catering']);

export async function generateDepartmentLists({ production, crew, inventory, company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  let first = true;

  for (const dept of DEPARTMENTS) {
    const members = crew.filter((c: any) => (c.department || 'other') === dept.id);
    const items = inventory.filter((i: any) => CATEGORY_DEPT[i.category || ''] === dept.id);
    const blank = BLANK_DEPTS.has(dept.id);
    if (members.length === 0 && items.length === 0 && !blank) continue;

    if (!first) doc.addPage();
    first = false;
    header(doc, 'Department Lists', production, company);
    let y = 28;

    const r = parseInt(dept.color.slice(1, 3), 16), g = parseInt(dept.color.slice(3, 5), 16), b = parseInt(dept.color.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
    doc.rect(10, y - 5, pageW - 20, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(dept.label.toUpperCase(), 13, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 12;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`CREW (${members.length})`, 12, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (members.length === 0) { doc.setTextColor(140, 140, 140); doc.text('— none assigned —', 12, y); doc.setTextColor(0, 0, 0); y += 6; }
    for (const m of members) {
      if (y > 262) { doc.addPage(); header(doc, 'Department Lists', production, company); y = 28; }
      doc.setFont('helvetica', 'bold');
      doc.text(`${m.name || ''} ${m.last_name || ''}`.trim().slice(0, 34), 12, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(m.role || '').slice(0, 28), 78, y);
      doc.text([m.phone, m.email].filter(Boolean).join('  ·  ').slice(0, 46), 130, y);
      y += 5.5;
    }
    y += 4;

    if (blank && items.length === 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('ITEMS / NOTES', 12, y); y += 6;
      doc.setDrawColor(190, 190, 190);
      for (let i = 0; i < 16; i++) {
        if (y > 262) break;
        doc.line(12, y, pageW - 12, y);
        y += 8;
      }
    } else if (items.length > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`EQUIPMENT (${items.length})`, 12, y); y += 5;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('ITEM', 12, y); doc.text('BRAND / MODEL', 80, y); doc.text('SERIAL', 140, y); doc.text('STATUS', 172, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      for (const it of items) {
        if (y > 262) { doc.addPage(); header(doc, 'Department Lists', production, company); y = 28; }
        doc.text(String(it.name || '').slice(0, 36), 12, y);
        doc.text(`${it.brand || ''} ${it.model || ''}`.trim().slice(0, 30), 80, y);
        doc.text(String(it.serial_number || '').slice(0, 16), 140, y);
        doc.text(it.status || '', 172, y);
        y += 5.5;
      }
    }
  }

  if (first) {
    header(doc, 'Department Lists', production, company);
    doc.setFontSize(10);
    doc.text('No crew or inventory yet — add crew members and equipment first.', 14, 40);
  }

  footer(doc);
  return save(doc, `department-lists-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

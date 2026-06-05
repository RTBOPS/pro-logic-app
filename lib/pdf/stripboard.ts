import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  action:    [255, 255, 200],
  dialogue:  [200, 230, 255],
  montage:   [220, 255, 220],
  transition:[255, 220, 180],
  vfx:       [240, 200, 255],
  insert:    [255, 240, 200],
  default:   [245, 245, 245],
};

const DN_COLORS: Record<string, [number, number, number]> = {
  DAY:   [255, 255, 200],
  NIGHT: [200, 220, 255],
  DAWN:  [255, 220, 180],
  DUSK:  [255, 200, 220],
};

export async function generateStripboard({ production, locations, crew, stripboardScenes = [], preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'l' });
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Stripboard', production);
  let y = 26;

  if (stripboardScenes.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('No scenes added yet. Add scenes in the Stripboard section before generating this PDF.', 14, y + 10);
    return save(doc, `stripboard-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
  }

  // Sort by shoot_day then scene_number
  const scenes = [...stripboardScenes].sort((a, b) => {
    const dayDiff = (Number(a.shoot_day) || 0) - (Number(b.shoot_day) || 0);
    if (dayDiff !== 0) return dayDiff;
    return String(a.scene_number).localeCompare(String(b.scene_number));
  });

  // Legend
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  doc.text('COLOR KEY:', 10, y);
  let lx = 35;
  Object.entries(DN_COLORS).slice(0,4).forEach(([label, color]) => {
    doc.setFillColor(...color);
    doc.rect(lx, y - 4, 5, 5, 'F');
    doc.setDrawColor(180, 180, 180); doc.rect(lx, y - 4, 5, 5);
    doc.setFont('helvetica', 'normal'); doc.text(label, lx + 6, y);
    lx += 28;
  });
  doc.setDrawColor(0); y += 8;

  // Column headers
  const cols = ['SCENE', 'INT/EXT', 'D/N', 'PAGES', 'SET / LOCATION', 'CAST', 'DESCRIPTION', 'DAY', 'STATUS', 'NOTES'];
  const colW = [16, 14, 12, 13, 42, 38, 55, 12, 20, pageW - 10 - 16 - 14 - 12 - 13 - 42 - 38 - 55 - 12 - 20];

  doc.setFillColor(30, 30, 30);
  doc.rect(10, y - 5, colW.reduce((a, b) => a + b, 0), 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  let hx = 12;
  cols.forEach((col, i) => { doc.text(col, hx, y); hx += colW[i]; });
  doc.setTextColor(0, 0, 0); y += 4;

  let currentDay = '';
  let totalPages = 0;

  scenes.forEach(scene => {
    if (y > 185) { doc.addPage(); y = 20; }

    if (scene.shoot_day && scene.shoot_day !== currentDay) {
      currentDay = scene.shoot_day;
      doc.setFillColor(50, 50, 50);
      doc.rect(10, y, colW.reduce((a, b) => a + b, 0), 5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(`SHOOT DAY ${scene.shoot_day}`, 12, y + 3.5);
      doc.setTextColor(0, 0, 0); y += 5;
    }

    const dn = (scene.day_night || 'DAY').toUpperCase();
    const color: [number, number, number] = DN_COLORS[dn] || CATEGORY_COLORS[scene.category] || CATEGORY_COLORS.default;
    const stripH = 6;

    doc.setFillColor(...color);
    doc.rect(10, y, colW.reduce((a, b) => a + b, 0), stripH, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, y, colW.reduce((a, b) => a + b, 0), stripH);

    const locName = locations.find((l: any) => l.id === scene.location)?.name || scene.set_name || scene.location || '';
    const vals = [
      scene.scene_number || '',
      scene.int_ext || '',
      dn,
      scene.pages || '',
      locName,
      scene.cast_ids || '',
      scene.description || '',
      scene.shoot_day || '',
      scene.status || '',
      scene.notes || '',
    ];

    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    let sx = 12;
    vals.forEach((val, vi) => {
      const maxW = colW[vi] - 3;
      const truncated = doc.splitTextToSize(String(val), maxW)[0] || '';
      doc.text(truncated, sx, y + 4);
      sx += colW[vi];
    });

    const p = parseFloat(scene.pages) || 0;
    totalPages += p;
    y += stripH;
    if (y > 185) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  const days = [...new Set(scenes.map(s => s.shoot_day).filter(Boolean))].length;
  doc.text(`Total Scenes: ${scenes.length}  |  Shoot Days: ${days || '—'}  |  Total Pages: ${totalPages.toFixed(1)}  |  Production: ${production.name}`, 10, y);

  return save(doc, `stripboard-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

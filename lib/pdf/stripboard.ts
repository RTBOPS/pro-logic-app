import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

const STRIP_COLORS: Record<string, [number, number, number]> = {
  day: [255, 255, 200],
  night: [200, 220, 255],
  dawn: [255, 220, 180],
  dusk: [255, 200, 220],
  int: [240, 255, 240],
  ext: [220, 240, 255],
};

export async function generateStripboard({ production, locations, crew }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'l' });
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Stripboard', production);
  let y = 26;

  // Legend
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('LEGEND:', 10, y);
  const legend = [
    ['DAY / EXT', STRIP_COLORS.day],
    ['NIGHT / INT', STRIP_COLORS.night],
    ['DAWN/DUSK', STRIP_COLORS.dawn],
    ['INT', STRIP_COLORS.int],
  ] as [string, [number, number, number]][];
  let lx = 35;
  legend.forEach(([label, color]) => {
    doc.setFillColor(...color);
    doc.rect(lx, y - 4, 5, 5, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.rect(lx, y - 4, 5, 5);
    doc.setFont('helvetica', 'normal');
    doc.text(label, lx + 6, y);
    lx += 35;
  });
  y += 8;

  // Column headers
  const cols = ['SCENE', 'INT/EXT', 'D/N', 'PAGES', 'SET / LOCATION', 'CHARACTERS', 'BRIEF DESCRIPTION', 'SHOOT DAY', 'NOTES'];
  const colW = [18, 15, 12, 14, 45, 40, 60, 18, pageW - 10 - 18 - 15 - 12 - 14 - 45 - 40 - 60 - 18];

  doc.setFillColor(30, 30, 30);
  doc.rect(10, y - 5, colW.reduce((a, b) => a + b, 0), 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  let hx = 12;
  cols.forEach((col, i) => {
    doc.text(col, hx, y);
    hx += colW[i];
  });
  doc.setTextColor(0, 0, 0);
  y += 4;

  // Sample scene strips
  const scenes = [
    { scene: '1', ie: 'EXT', dn: 'DAY', pages: '1', set: locations[0]?.name || 'Location TBD', chars: crew.slice(0, 2).map((c: any) => c.name).join(', ') || 'TBD', desc: 'Opening establishing shot', day: '1', notes: '', color: STRIP_COLORS.day },
    { scene: '2', ie: 'INT', dn: 'DAY', pages: '2/8', set: 'Studio A', chars: crew.slice(0, 3).map((c: any) => c.name).join(', ') || 'TBD', desc: 'Main dialogue scene', day: '1', notes: 'Coverage needed', color: STRIP_COLORS.int },
    { scene: '3', ie: 'EXT', dn: 'NIGHT', pages: '1', set: locations[0]?.name || 'Location TBD', chars: crew.slice(1, 3).map((c: any) => c.name).join(', ') || 'TBD', desc: 'Night exterior', day: '2', notes: '', color: STRIP_COLORS.night },
    { scene: '4', ie: 'INT', dn: 'NIGHT', pages: '3/8', set: 'Interior set', chars: crew.slice(0, 4).map((c: any) => c.name).join(', ') || 'TBD', desc: 'Night scene interior', day: '2', notes: 'Low key lighting', color: STRIP_COLORS.night },
    { scene: '5', ie: 'EXT', dn: 'DAY', pages: '1 2/8', set: locations[1]?.name || 'Location 2 TBD', chars: crew.slice(0, 2).map((c: any) => c.name).join(', ') || 'TBD', desc: 'B-roll package', day: '3', notes: 'Drone shots', color: STRIP_COLORS.day },
    { scene: '6', ie: 'INT', dn: 'DAY', pages: '2', set: 'Interview setup', chars: crew.slice(0, 1).map((c: any) => c.name).join(', ') || 'TBD', desc: 'Interview / testimonial', day: '3', notes: 'Lavalier + boom', color: STRIP_COLORS.int },
    { scene: '7', ie: 'EXT', dn: 'DUSK', pages: '4/8', set: locations[0]?.name || 'Location TBD', chars: crew.slice(0, 3).map((c: any) => c.name).join(', ') || 'TBD', desc: 'Golden hour shots', day: '4', notes: 'Weather dependent', color: STRIP_COLORS.dawn },
    { scene: '8', ie: 'INT', dn: 'DAY', pages: '1', set: 'Studio B', chars: 'All', desc: 'Group scene', day: '4', notes: 'Full cast', color: STRIP_COLORS.int },
  ];

  // Day break tracker
  let currentDay = '';
  scenes.forEach((scene, i) => {
    if (scene.day !== currentDay) {
      currentDay = scene.day;
      doc.setFillColor(50, 50, 50);
      doc.rect(10, y, colW.reduce((a, b) => a + b, 0), 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`SHOOT DAY ${scene.day}`, 12, y + 3.5);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    doc.setFillColor(...scene.color);
    const stripH = 6;
    doc.rect(10, y, colW.reduce((a, b) => a + b, 0), stripH, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, y, colW.reduce((a, b) => a + b, 0), stripH);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const vals = [scene.scene, scene.ie, scene.dn, scene.pages, scene.set, scene.chars, scene.desc, scene.day, scene.notes];
    let sx = 12;
    vals.forEach((val, vi) => {
      const maxW = colW[vi] - 3;
      const truncated = doc.splitTextToSize(val, maxW)[0] || '';
      doc.text(truncated, sx, y + 4);
      sx += colW[vi];
    });
    y += stripH;
    if (y > 185) { doc.addPage(); y = 20; }
  });

  // Summary
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Scenes: ${scenes.length}  |  Total Shoot Days: 4  |  Production: ${production.name}`, 10, y);

  save(doc, `stripboard-${production.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

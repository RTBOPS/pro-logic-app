import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

export async function generateShotList({ production, crew, locations, stripboardScenes = [], preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'l' });
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Shot List', production);
  let y = 26;

  const dp = crew.find((c: any) => /dp|director of photography/i.test(c.role || ''));
  const director = crew.find((c: any) => /^director$/i.test(c.role || ''));
  const loc = locations.find((l: any) => l.id === production.location_id) || locations[0];

  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(
    `Location: ${loc?.name || 'TBD'}  |  DP: ${dp ? `${dp.name} ${dp.last_name}` : 'TBD'}  |  Director: ${director ? `${director.name} ${director.last_name}` : production.director || 'TBD'}  |  Date: ${production.start_date || '—'}`,
    10, y
  );
  y += 10;

  const cols = ['#', 'Scene', 'Shot', 'Size', 'Angle', 'Movement', 'Lens', 'Description', 'Audio', 'Est.', 'Notes'];
  const colW =   [8,   14,     14,     14,     14,      20,          14,     55,              16,      16,    pageW - 10 - 8 - 14*5 - 20 - 55 - 16 - 16];

  // Header row
  doc.setFillColor(30, 30, 30);
  doc.rect(10, y - 5, colW.reduce((a, b) => a + b, 0), 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  let hx = 12;
  cols.forEach((c, i) => { doc.text(c, hx, y); hx += colW[i]; });
  doc.setTextColor(0, 0, 0); y += 4;

  const scenes = [...stripboardScenes].sort((a, b) => {
    const d = (Number(a.shoot_day) || 0) - (Number(b.shoot_day) || 0);
    return d !== 0 ? d : String(a.scene_number).localeCompare(String(b.scene_number));
  });

  if (scenes.length === 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('No scenes in stripboard yet. Add scenes to the Stripboard to populate this Shot List.', 14, y + 8);
    return save(doc, `shot-list-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
  }

  let rowNum = 1;
  let currentDay = '';

  scenes.forEach(scene => {
    if (y > 185) { doc.addPage(); y = 20; }

    // Day break header
    if (scene.shoot_day && scene.shoot_day !== currentDay) {
      currentDay = scene.shoot_day;
      doc.setFillColor(50, 50, 50);
      doc.rect(10, y, colW.reduce((a, b) => a + b, 0), 5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.text(`SHOOT DAY ${scene.shoot_day}`, 12, y + 3.5);
      doc.setTextColor(0, 0, 0); y += 5;
    }

    const rowH = 6;
    if (rowNum % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(10, y, colW.reduce((a, b) => a + b, 0), rowH, 'F'); }
    doc.setDrawColor(220, 220, 220); doc.rect(10, y, colW.reduce((a, b) => a + b, 0), rowH);
    doc.setDrawColor(0);

    const vals = [
      String(rowNum),
      scene.scene_number || '',
      'A',
      scene.int_ext?.includes('EXT') ? 'WS' : 'MS',
      'EYE',
      'STATIC',
      '—',
      scene.description || '',
      'SYNC',
      scene.estimated_hours ? `${scene.estimated_hours}h` : '—',
      scene.notes || '',
    ];

    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    let sx = 12;
    vals.forEach((val, vi) => {
      const truncated = doc.splitTextToSize(String(val), colW[vi] - 2)[0] || '';
      doc.text(truncated, sx, y + 4);
      sx += colW[vi];
    });

    rowNum++;
    y += rowH;
    if (y > 185) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text(`Total Shots: ${rowNum - 1}  |  Scenes: ${scenes.length}  |  Production: ${production.name}`, 10, y);

  return save(doc, `shot-list-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

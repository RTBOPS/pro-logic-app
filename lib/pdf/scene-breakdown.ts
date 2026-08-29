import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Script breakdown — one classic breakdown sheet per scene, pre-filled from
   the stripboard (number, INT/EXT, D/N, set, cast, pages) with the standard
   element boxes to complete during the breakdown pass. */
const ELEMENTS: [string, string][] = [
  ['PROPS', 'art'], ['SET DRESSING', 'art'], ['WARDROBE', 'wardrobe'], ['MAKEUP / HAIR', 'wardrobe'],
  ['VEHICLES / ANIMALS', 'transport'], ['SPECIAL EQUIPMENT', 'camera'], ['SFX / VFX', 'vfx'], ['SOUND / MUSIC', 'audio'],
];

export async function generateSceneBreakdown({ production, stripboardScenes = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  if (stripboardScenes.length === 0) {
    header(doc, 'Scene Breakdown', production, company);
    doc.setFontSize(10);
    doc.text('No scenes yet — add scenes in the Stripboard first.', 14, 40);
    return save(doc, 'scene-breakdown.pdf', preview);
  }

  const scenes = [...stripboardScenes].sort((a: any, b: any) => String(a.scene_number).localeCompare(String(b.scene_number), undefined, { numeric: true }));
  scenes.forEach((s: any, i: number) => {
    if (i > 0) doc.addPage();
    header(doc, 'Scene Breakdown', production, company);
    let y = 28;

    doc.setFillColor(20, 20, 20); doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 5, pageW - 20, 10, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`SCENE ${s.scene_number || '—'}`, 13, y + 1);
    doc.text(`${s.int_ext || ''} · ${s.day_night || ''}${s.pages ? ' · ' + s.pages + ' pg' : ''}${s.shoot_day ? ' · DAY ' + s.shoot_day : ''}`, pageW - 13, y + 1, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 12;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('SET / LOCATION:', 13, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(s.set_name || s.location || '—').slice(0, 60), 48, y); y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('SYNOPSIS:', 13, y);
    doc.setFont('helvetica', 'normal');
    const syn = doc.splitTextToSize(String(s.title || s.description || '—'), pageW - 62);
    doc.text(syn, 48, y);
    y += Math.max(syn.length * 4.5, 5) + 4;
    doc.setFont('helvetica', 'bold');
    doc.text('CAST:', 13, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(s.cast_ids || '—').slice(0, 80), 48, y);
    y += 9;

    const colW = (pageW - 20 - 6) / 2;
    const boxH = 44;
    ELEMENTS.forEach(([label], idx) => {
      const col = idx % 2, row = Math.floor(idx / 2);
      const x = 10 + col * (colW + 6);
      const by = y + row * (boxH + 5);
      doc.setDrawColor(170, 170, 170);
      doc.roundedRect(x, by, colW, boxH, 2, 2);
      doc.setFillColor(240, 240, 240);
      doc.rect(x, by, colW, 7, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(label, x + 3, by + 5);
      doc.setDrawColor(215, 215, 215);
      for (let ln = 1; ln <= 4; ln++) doc.line(x + 3, by + 7 + ln * 8, x + colW - 3, by + 7 + ln * 8);
    });
  });

  footer(doc);
  return save(doc, `scene-breakdown-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

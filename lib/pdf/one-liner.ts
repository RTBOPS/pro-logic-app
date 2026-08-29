import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* One-liner schedule — every scene on a single line, grouped by shoot day. */
export async function generateOneLiner({ production, stripboardScenes = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'One-Liner Schedule', production, company);

  if (stripboardScenes.length === 0) {
    doc.setFontSize(10);
    doc.text('No scenes yet. Add scenes in the Stripboard first.', 14, 40);
    return save(doc, 'one-liner.pdf', preview);
  }

  const scenes = [...stripboardScenes].sort((a: any, b: any) => {
    const d = (Number(a.shoot_day) || 0) - (Number(b.shoot_day) || 0);
    return d !== 0 ? d : String(a.scene_number).localeCompare(String(b.scene_number), undefined, { numeric: true });
  });

  let y = 28;
  let currentDay: number | null = null;
  const line = (s: any) => {
    if (y > 262) { doc.addPage(); header(doc, 'One-Liner Schedule', production, company); y = 28; currentDay = null; }
    const day = Number(s.shoot_day) || 0;
    if (day !== currentDay) {
      currentDay = day;
      y += 3;
      doc.setFillColor(20, 20, 20); doc.setTextColor(255, 255, 255);
      doc.rect(10, y - 5, pageW - 20, 7, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      const dayScenes = scenes.filter((x: any) => (Number(x.shoot_day) || 0) === day);
      const pg = dayScenes.reduce((sum: number, x: any) => sum + (parseFloat(x.pages) || 0), 0);
      doc.text(day ? `SHOOT DAY ${day}` : 'UNSCHEDULED', 13, y);
      doc.text(`${dayScenes.length} scenes · ${pg.toFixed(1)} pages`, pageW - 13, y, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 8;
    }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(String(s.scene_number || '—'), 12, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${s.int_ext || ''} ${s.day_night || ''}`.trim(), 26, y);
    const set = s.set_name || s.location || '';
    doc.text(set.slice(0, 26), 52, y);
    const desc = (s.title || s.description || '').replace(/\s+/g, ' ');
    doc.text(desc.slice(0, 52) + (desc.length > 52 ? '…' : ''), 108, y);
    if (s.pages) doc.text(`${s.pages} pg`, pageW - 26, y, { align: 'right' });
    if (s.cast_ids) { doc.setTextColor(90, 90, 200); doc.text(String(s.cast_ids).slice(0, 14), pageW - 12, y, { align: 'right' }); doc.setTextColor(0, 0, 0); }
    y += 6;
  };
  scenes.forEach(line);

  footer(doc);
  return save(doc, `one-liner-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

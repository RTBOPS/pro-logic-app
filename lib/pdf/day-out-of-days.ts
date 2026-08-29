import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Day out of Days — the cast × shoot-day matrix with standard codes:
   SW start-work · W work · H hold (idle between start and finish) ·
   WF work-finish · SWF single day. Built from stripboard scenes (shoot_day +
   cast_ids); cast tokens map to crew names when they match. */
export async function generateDayOutOfDays({ production, crew, stripboardScenes = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'l' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Day out of Days', production, company);

  const scenes = stripboardScenes.filter((s: any) => s.cast_ids);
  if (scenes.length === 0) {
    doc.setFontSize(10);
    doc.text('No scenes with cast assigned yet. Add shoot days and cast to scenes in the Stripboard first.', 14, 40);
    return save(doc, 'day-out-of-days.pdf', preview);
  }

  const label = (token: string): string => {
    const t = token.trim();
    const hit = crew.find((c: any) => c.id === t || `${c.name || ''} ${c.last_name || ''}`.trim().toLowerCase() === t.toLowerCase() || (c.name || '').toLowerCase() === t.toLowerCase());
    return hit ? `${hit.name || ''} ${hit.last_name || ''}`.trim() : t;
  };

  const byCast = new Map<string, Set<number>>();
  const daySet = new Set<number>();
  for (const s of scenes) {
    const day = Number(s.shoot_day) || 1;
    daySet.add(day);
    for (const tok of String(s.cast_ids).split(',')) {
      const name = label(tok);
      if (!name) continue;
      if (!byCast.has(name)) byCast.set(name, new Set());
      byCast.get(name)!.add(day);
    }
  }
  const days = [...daySet].sort((a, b) => a - b);
  const cast = [...byCast.keys()].sort();

  const code = (name: string, day: number): string => {
    const wd = byCast.get(name)!;
    const first = Math.min(...wd), last = Math.max(...wd);
    if (!wd.has(day)) return day > first && day < last ? 'H' : '';
    if (first === last) return 'SWF';
    if (day === first) return 'SW';
    if (day === last) return 'WF';
    return 'W';
  };

  const nameW = 52;
  const perPage = Math.max(1, Math.floor((pageW - 14 - nameW - 26) / 13));
  for (let start = 0; start < days.length; start += perPage) {
    if (start > 0) { doc.addPage(); header(doc, 'Day out of Days', production, company); }
    const chunk = days.slice(start, start + perPage);
    let y = 30;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setFillColor(20, 20, 20); doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 5, nameW, 8, 'F');
    doc.text('CAST', 12, y);
    chunk.forEach((d, i) => {
      const x = 10 + nameW + i * 13;
      doc.rect(x, y - 5, 13, 8, 'F');
      doc.text(`D${d}`, x + 6.5, y, { align: 'center' });
    });
    const tx = 10 + nameW + chunk.length * 13;
    doc.rect(tx, y - 5, 24, 8, 'F');
    doc.text('TOTAL', tx + 12, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 8;
    cast.forEach((name, r) => {
      if (y > 190) { doc.addPage(); header(doc, 'Day out of Days', production, company); y = 30; }
      if (r % 2 === 0) { doc.setFillColor(246, 246, 246); doc.rect(10, y - 5, nameW + chunk.length * 13 + 24, 7.5, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(name.slice(0, 30), 12, y);
      doc.setFont('helvetica', 'normal');
      chunk.forEach((d, i) => {
        const c = code(name, d);
        if (c) {
          const x = 10 + nameW + i * 13;
          if (c === 'H') doc.setTextColor(150, 150, 150);
          doc.text(c, x + 6.5, y, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        }
      });
      doc.setFont('helvetica', 'bold');
      doc.text(String(byCast.get(name)!.size), tx + 12, y, { align: 'center' });
      y += 7.5;
    });
    y += 4;
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110);
    doc.text('SW start-work · W work · H hold · WF work-finish · SWF start-work-finish (single day) · TOTAL = working days', 10, y);
    doc.setTextColor(0, 0, 0);
  }

  footer(doc);
  return save(doc, `day-out-of-days-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

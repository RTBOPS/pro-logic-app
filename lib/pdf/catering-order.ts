import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Catering / craft order — headcount and dietary counts from crew profiles,
   per-person restrictions list, and a blank order section for the vendor. */
export async function generateCateringOrder({ production, crew, company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Catering / Craft Order', production, company);
  let y = 30;

  const diet = (c: any) => String(c.dietary || c.dietary_notes || c.diet || '').trim();
  const withDiet = crew.filter((c: any) => diet(c));
  const counts = new Map<string, number>();
  for (const c of withDiet) {
    for (const tag of diet(c).split(/[,;/]+/)) {
      const t = tag.trim().toLowerCase();
      if (t) counts.set(t, (counts.get(t) || 0) + 1);
    }
  }

  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('CATERING / CRAFT SERVICES ORDER', pageW / 2, y, { align: 'center' }); y += 10;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(10, y - 2, pageW - 20, 22, 2, 2, 'F');
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL HEADCOUNT: ${crew.length}`, 14, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Shoot date(s): ${production.start_date || '____________'}${production.end_date ? ' – ' + production.end_date : ''}   ·   Meal: [ ] Breakfast  [ ] Lunch  [ ] Dinner  [ ] Craft table`, 14, y + 14);
  y += 30;

  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('DIETARY COUNTS', 14, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  if (counts.size === 0) {
    doc.setTextColor(140, 140, 140);
    doc.text('No dietary restrictions recorded in crew profiles.', 14, y);
    doc.setTextColor(0, 0, 0); y += 7;
  } else {
    for (const [tag, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      doc.text(`• ${tag.charAt(0).toUpperCase() + tag.slice(1)}: ${n}`, 16, y); y += 5.5;
      if (y > 250) { doc.addPage(); header(doc, 'Catering / Craft Order', production, company); y = 30; }
    }
  }
  const std = crew.length - withDiet.length;
  doc.setFont('helvetica', 'bold');
  doc.text(`• No restriction (standard): ${std}`, 16, y); y += 10;

  if (withDiet.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('BY PERSON', 14, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const c of withDiet) {
      if (y > 250) { doc.addPage(); header(doc, 'Catering / Craft Order', production, company); y = 30; }
      doc.text(`${c.name || ''} ${c.last_name || ''}`.trim().slice(0, 34), 16, y);
      doc.text(diet(c).slice(0, 60), 90, y);
      y += 5.5;
    }
    y += 6;
  }

  if (y > 200) { doc.addPage(); header(doc, 'Catering / Craft Order', production, company); y = 30; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('ORDER (vendor fills)', 14, y); y += 7;
  doc.setDrawColor(190, 190, 190);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('ITEM', 14, y); doc.text('QTY', 130, y); doc.text('$ EACH', 152, y); doc.text('TOTAL', 182, y);
  doc.setTextColor(0, 0, 0); y += 4;
  for (let i = 0; i < 10 && y < 250; i++) { doc.line(14, y + 4, pageW - 14, y + 4); y += 9; }
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Vendor: ______________________   Contact: ______________________   Delivery time: ___________', 14, y);

  footer(doc);
  return save(doc, `catering-order-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

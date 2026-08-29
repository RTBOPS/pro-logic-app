import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Final deliverables — spec sheet + delivery checklist the client signs off. */
export async function generateDeliverables({ production, company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Final Deliverables', production, company);
  let y = 30;

  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('FINAL DELIVERABLES', pageW / 2, y, { align: 'center' }); y += 7;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Production: ${production.name}${production.client ? '   ·   Client: ' + production.client : ''}`, pageW / 2, y, { align: 'center' });
  y += 12;

  const section = (title: string, rows: string[][]) => {
    if (y > 235) { doc.addPage(); header(doc, 'Final Deliverables', production, company); y = 30; }
    doc.setFillColor(20, 20, 20); doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 4.5, pageW - 20, 7, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(title, 13, y); doc.setTextColor(0, 0, 0); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const [label, value] of rows) {
      if (y > 262) { doc.addPage(); header(doc, 'Final Deliverables', production, company); y = 30; }
      doc.text('[ ]', 13, y);
      doc.setFont('helvetica', 'bold'); doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal'); doc.text(value, 86, y);
      y += 6.5;
    }
    y += 3;
  };

  section('MASTER FILES', [
    ['Primary master', 'Res: ________  Codec: ____________  Frame rate: ______'],
    ['Clean master (no graphics)', 'Same spec as primary  ·  Required: [ ] yes [ ] no'],
    ['Textless version', 'Required: [ ] yes [ ] no'],
    ['Audio stems', '[ ] Full mix  [ ] M&E  [ ] Dialogue  [ ] Music  [ ] SFX'],
  ]);
  section('SOCIAL / CUTDOWNS', [
    ['Vertical 9:16', 'Durations: ______________  Platform: ______________'],
    ['Square 1:1', 'Durations: ______________'],
    ['Cutdowns 16:9', '[ ] :60  [ ] :30  [ ] :15  [ ] :06'],
    ['Captions / subtitles', 'Languages: ____________________  Format: [ ] SRT [ ] burned'],
  ]);
  section('SUPPORT MATERIALS', [
    ['Project files', '[ ] Edit project  [ ] Graphics project  [ ] Fonts licensed'],
    ['Raw footage', '[ ] Full  [ ] Selects only  ·  Drive: ____________________'],
    ['Stills / BTS', 'Count: ________  Format: ____________'],
    ['Music licenses', '[ ] Attached  ·  Cue sheet: [ ] yes [ ] no'],
    ['Release forms', '[ ] Talent  [ ] Locations (from PRO-LOGIC Documents)'],
  ]);
  section('DELIVERY', [
    ['Method', '[ ] Drive link  [ ] Aspera/MASV  [ ] Physical drive  ·  Address/URL: ______________'],
    ['Delivery date', '____________   ·   Revisions included: ______'],
    ['Archive retention', 'Producer keeps masters for: ________ months'],
  ]);

  y += 6;
  if (y > 240) { doc.addPage(); header(doc, 'Final Deliverables', production, company); y = 40; }
  const half = (pageW - 30) / 2;
  doc.setDrawColor(120, 120, 120);
  doc.line(15, y + 12, 15 + half - 8, y + 12);
  doc.line(15 + half + 8, y + 12, pageW - 15, y + 12);
  doc.setFontSize(8.5);
  doc.text('DELIVERED BY (Producer)  ·  Date', 15, y + 17);
  doc.text('ACCEPTED BY (Client)  ·  Date', 15 + half + 8, y + 17);

  footer(doc);
  return save(doc, `deliverables-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

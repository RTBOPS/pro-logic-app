import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Treatment — the written pitch, typeset: blank-line paragraphs, lines that
   end in ":" become section headings. */
export async function generateTreatment({ production, creativeDocs = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const t = creativeDocs.find((d: any) => d.kind === 'treatment' && d.production_id === production.id);

  header(doc, 'Treatment', production, company);
  let y = 40;
  doc.setFontSize(24); doc.setFont('helvetica', 'bold');
  doc.text(String(production.name || '').toUpperCase(), pageW / 2, y, { align: 'center' }); y += 9;
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`A treatment${production.client ? ' for ' + production.client : ''}`, pageW / 2, y, { align: 'center' });
  y += 16;

  if (!t?.text) {
    doc.setFontSize(10);
    doc.text('No treatment written yet — draft it in Creative → Treatment.', 14, y + 10);
    return save(doc, 'treatment.pdf', preview);
  }

  for (const block of String(t.text).split(/\n\s*\n/)) {
    const chunk = block.trim();
    if (!chunk) continue;
    const isHeading = /:$/.test(chunk) && chunk.length < 60 && !chunk.includes('\n');
    if (y > 250) { doc.addPage(); header(doc, 'Treatment', production, company); y = 30; }
    if (isHeading) {
      y += 3;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(chunk.replace(/:$/, '').toUpperCase(), 20, y);
      y += 8;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(chunk.replace(/\n/g, ' '), pageW - 44);
      for (const ln of lines) {
        if (y > 258) { doc.addPage(); header(doc, 'Treatment', production, company); y = 30; }
        doc.text(ln, 22, y);
        y += 5.6;
      }
      y += 4;
    }
  }

  footer(doc);
  return save(doc, `treatment-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

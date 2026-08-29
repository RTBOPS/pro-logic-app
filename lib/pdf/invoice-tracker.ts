import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Invoice tracker — every received invoice with status, plus totals by status. */
export async function generateInvoiceTracker({ production, financeDocs = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Invoice Tracker', production, company);

  const inv = financeDocs
    .filter((d: any) => d.kind === 'invoice' && (!d.production_id || d.production_id === production.id))
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  let y = 30;
  if (inv.length === 0) {
    doc.setFontSize(10);
    doc.text('No invoices tracked yet — add them in Budget → POs & Invoices.', 14, 40);
    return save(doc, 'invoice-tracker.pdf', preview);
  }

  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text('#', 12, y); doc.text('DATE', 34, y); doc.text('VENDOR', 58, y); doc.text('DESCRIPTION', 104, y); doc.text('AMOUNT', 176, y, { align: 'right' }); doc.text('STATUS', 200, y, { align: 'right' });
  doc.setTextColor(0, 0, 0); y += 5;
  doc.setFontSize(8.5);
  let total = 0, paid = 0;
  for (const d of inv) {
    if (y > 262) { doc.addPage(); header(doc, 'Invoice Tracker', production, company); y = 30; }
    const amt = parseFloat(d.amount) || 0;
    total += amt; if (d.status === 'Paid') paid += amt;
    doc.setFont('helvetica', 'bold'); doc.text(String(d.number || ''), 12, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(d.date || ''), 34, y);
    doc.text(String(d.vendor || '').slice(0, 24), 58, y);
    doc.text(String(d.description || '').slice(0, 38), 104, y);
    doc.text(money(amt), 176, y, { align: 'right' });
    if (d.status === 'Paid') doc.setTextColor(20, 130, 60); else doc.setTextColor(180, 120, 0);
    doc.setFont('helvetica', 'bold'); doc.text(String(d.status || ''), 200, y, { align: 'right' });
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
    y += 6;
  }
  y += 3; doc.line(12, y - 4, 200, y - 4);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.text(`TOTAL ${money(total)}   ·   PAID ${money(paid)}   ·   OUTSTANDING ${money(total - paid)}`, 200, y + 1, { align: 'right' });

  footer(doc);
  return save(doc, `invoice-tracker-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

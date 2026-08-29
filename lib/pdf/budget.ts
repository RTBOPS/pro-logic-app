import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

const CATS = [
  'Above the Line', 'Production', 'Camera', 'Lighting & Grip', 'Sound',
  'Art / Set', 'Wardrobe & HMU', 'Locations', 'Travel & Transport',
  'Post-Production', 'Insurance & Legal', 'Contingency', 'Other',
];
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Production budget — topsheet (per-category totals + variance) followed by
   the detailed lines, from the Budget module. */
export async function generateBudget({ production, budgetLines = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Production Budget', production, company);

  const lines = budgetLines.filter((l: any) => !l.production_id || l.production_id === production.id);
  if (lines.length === 0) {
    doc.setFontSize(10);
    doc.text('No budget lines yet — add them in the Budget section first.', 14, 40);
    return save(doc, 'budget.pdf', preview);
  }
  const est = (l: any) => (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0);
  const act = (l: any) => parseFloat(l.actual) || 0;

  // ── Topsheet
  let y = 30;
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('BUDGET TOPSHEET', pageW / 2, y, { align: 'center' }); y += 10;
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text('CATEGORY', 14, y); doc.text('ESTIMATED', 130, y, { align: 'right' }); doc.text('ACTUAL', 165, y, { align: 'right' }); doc.text('VARIANCE', 200, y, { align: 'right' });
  doc.setTextColor(0, 0, 0); y += 5;
  let tE = 0, tA = 0;
  for (const cat of CATS) {
    const rows = lines.filter((l: any) => l.category === cat);
    if (rows.length === 0) continue;
    const ce = rows.reduce((s: number, l: any) => s + est(l), 0);
    const ca = rows.reduce((s: number, l: any) => s + act(l), 0);
    tE += ce; tA += ca;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(cat, 14, y);
    doc.text(money(ce), 130, y, { align: 'right' });
    doc.text(ca ? money(ca) : '—', 165, y, { align: 'right' });
    const v = ce - ca;
    if (ca) { if (v < 0) doc.setTextColor(200, 30, 30); doc.text(money(v), 200, y, { align: 'right' }); doc.setTextColor(0, 0, 0); }
    y += 6;
  }
  y += 2;
  doc.setDrawColor(0, 0, 0); doc.line(14, y - 4, 200, y - 4);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TOTAL', 14, y + 1);
  doc.text(money(tE), 130, y + 1, { align: 'right' });
  doc.text(tA ? money(tA) : '—', 165, y + 1, { align: 'right' });
  if (tA) { if (tE - tA < 0) doc.setTextColor(200, 30, 30); doc.text(money(tE - tA), 200, y + 1, { align: 'right' }); doc.setTextColor(0, 0, 0); }

  // ── Detail
  doc.addPage();
  header(doc, 'Production Budget — Detail', production, company);
  y = 28;
  for (const cat of CATS) {
    const rows = lines.filter((l: any) => l.category === cat);
    if (rows.length === 0) continue;
    if (y > 245) { doc.addPage(); header(doc, 'Production Budget — Detail', production, company); y = 28; }
    doc.setFillColor(20, 20, 20); doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 4.5, pageW - 20, 7, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(cat.toUpperCase(), 13, y); doc.setTextColor(0, 0, 0);
    y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const l of rows) {
      if (y > 262) { doc.addPage(); header(doc, 'Production Budget — Detail', production, company); y = 28; }
      doc.text(String(l.item || '').slice(0, 52), 13, y);
      doc.text(`${l.qty} × ${money(parseFloat(l.rate) || 0)}`, 132, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(money(est(l)), 168, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(l.actual ? money(act(l)) : '—', 200, y, { align: 'right' });
      if (l.notes) { y += 4; doc.setTextColor(140, 140, 140); doc.setFontSize(7.5); doc.text(String(l.notes).slice(0, 90), 16, y); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0); }
      y += 5.5;
    }
    y += 3;
  }
  footer(doc);
  return save(doc, `budget-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

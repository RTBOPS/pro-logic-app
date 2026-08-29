import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Purchase orders — one printable PO per record from the Budget module. */
export async function generatePurchaseOrders({ production, financeDocs = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pos = financeDocs.filter((d: any) => d.kind === 'po' && (!d.production_id || d.production_id === production.id));

  if (pos.length === 0) {
    header(doc, 'Purchase Orders', production, company);
    doc.setFontSize(10);
    doc.text('No purchase orders yet — create them in Budget → POs & Invoices.', 14, 40);
    return save(doc, 'purchase-orders.pdf', preview);
  }

  pos.forEach((po: any, i: number) => {
    if (i > 0) doc.addPage();
    header(doc, 'Purchase Order', production, company);
    let y = 34;
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('PURCHASE ORDER', 14, y);
    doc.setFontSize(13);
    doc.text(String(po.number || ''), pageW - 14, y, { align: 'right' });
    y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${po.date || ''}   ·   Status: ${po.status || 'Draft'}`, 14, y);
    y += 10;

    doc.setFillColor(248, 248, 248);
    doc.roundedRect(10, y - 2, pageW - 20, 24, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.text('VENDOR:', 14, y + 5);
    doc.setFont('helvetica', 'normal'); doc.text(String(po.vendor || ''), 45, y + 5);
    doc.setFont('helvetica', 'bold'); doc.text('BILL TO:', 14, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${company?.name || 'PRODUCTION COMPANY'}${company?.address ? '  ·  ' + company.address : ''}`, 45, y + 12);
    doc.setFont('helvetica', 'bold'); doc.text('PRODUCTION:', 14, y + 19);
    doc.setFont('helvetica', 'normal'); doc.text(production.name, 45, y + 19);
    y += 32;

    doc.setFillColor(20, 20, 20); doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 5, pageW - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', 14, y); doc.text('AMOUNT', pageW - 14, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 9;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(po.description || ''), pageW - 60);
    doc.text(lines, 14, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(money(parseFloat(po.amount) || 0), pageW - 14, y, { align: 'right' });
    y += Math.max(lines.length * 5, 10) + 8;
    doc.setDrawColor(0, 0, 0); doc.line(pageW - 80, y, pageW - 14, y);
    doc.setFontSize(10);
    doc.text('TOTAL', pageW - 80, y + 6);
    doc.text(money(parseFloat(po.amount) || 0), pageW - 14, y + 6, { align: 'right' });

    y += 40;
    const half = (pageW - 30) / 2;
    doc.setDrawColor(120, 120, 120);
    doc.line(15, y, 15 + half - 8, y);
    doc.line(15 + half + 8, y, pageW - 15, y);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.text('AUTHORIZED BY  ·  Date', 15, y + 5);
    doc.text('VENDOR ACCEPTANCE  ·  Date', 15 + half + 8, y + 5);
  });

  return save(doc, `purchase-orders-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

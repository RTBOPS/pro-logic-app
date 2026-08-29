import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Client proposal / quote — items table, totals, terms and signature line. */
export async function generateProposal(ctx: PDFContext) {
  const { production, company, preview } = ctx;
  const proposal: any = (ctx as any).proposal || {};
  const client: any = (ctx as any).client || {};
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, `Proposal ${String(proposal.number || '')}`, production, company);
  let y = 34;
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text(String(proposal.title || production?.name || 'Proposal').slice(0, 60), 14, y); y += 9;
  doc.setFontSize(9);

  const left = [
    ['Prepared for', [client.name, client.company].filter(Boolean).join(' — ') || '—'],
    ['Email', String(client.email || '—')],
    ['Phone', String(client.phone || '—')],
  ];
  const right = [
    ['Date', String(proposal.date || new Date().toLocaleDateString('en-US'))],
    ['Valid until', String(proposal.valid_until || '—')],
    ['Production', String(production?.name || '—')],
  ];
  left.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold'); doc.text(`${k}:`, 14, y + i * 5);
    doc.setFont('helvetica', 'normal'); doc.text(String(v).slice(0, 55), 40, y + i * 5);
  });
  right.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold'); doc.text(`${k}:`, pageW / 2 + 6, y + i * 5);
    doc.setFont('helvetica', 'normal'); doc.text(String(v).slice(0, 45), pageW / 2 + 30, y + i * 5);
  });
  y += 20;

  const items: any[] = proposal.items || [];
  const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);

  // Items table
  const colX = { desc: 16, qty: 132, rate: 152, amt: pageW - 16 };
  const headRow = () => {
    doc.setFillColor(24, 24, 27);
    doc.rect(14, y, pageW - 28, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', colX.desc, y + 4.7);
    doc.text('QTY', colX.qty, y + 4.7, { align: 'right' });
    doc.text('RATE', colX.rate + 14, y + 4.7, { align: 'right' });
    doc.text('AMOUNT', colX.amt, y + 4.7, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 9;
  };
  headRow();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  for (const it of items) {
    if (y > 245) { doc.addPage(); header(doc, `Proposal ${String(proposal.number || '')}`, production, company); y = 30; headRow(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
    const descLines = doc.splitTextToSize(String(it.desc || ''), 108);
    doc.text(descLines, colX.desc, y);
    doc.text(String(it.qty || ''), colX.qty, y, { align: 'right' });
    doc.text(money(Number(it.rate) || 0), colX.rate + 14, y, { align: 'right' });
    doc.text(money((Number(it.qty) || 0) * (Number(it.rate) || 0)), colX.amt, y, { align: 'right' });
    y += descLines.length * 4 + 2;
    doc.setDrawColor(230, 230, 230);
    doc.line(14, y - 1.5, pageW - 14, y - 1.5);
  }
  y += 2;
  doc.setFillColor(245, 245, 244);
  doc.rect(pageW / 2, y, pageW / 2 - 14, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TOTAL', pageW / 2 + 4, y + 5.5);
  doc.text(money(total), colX.amt, y + 5.5, { align: 'right' });
  y += 16;

  if (proposal.terms) {
    if (y > 230) { doc.addPage(); y = 30; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('TERMS', 14, y); y += 5;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(proposal.terms), pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 8;
  }

  if (y > 235) { doc.addPage(); y = 30; }
  doc.setDrawColor(120, 120, 120);
  doc.line(14, y + 14, 90, y + 14);
  doc.line(pageW - 90, y + 14, pageW - 14, y + 14);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Client signature / date', 14, y + 19);
  doc.text(`${String(company?.name || 'Company').slice(0, 40)} / date`, pageW - 90, y + 19);

  footer(doc);
  return save(doc, `proposal-${String(proposal.number || 'draft').toLowerCase()}.pdf`, preview);
}

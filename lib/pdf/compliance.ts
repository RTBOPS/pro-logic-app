import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Compliance status — every tracked certificate/permit with its expiry state. */
export async function generateComplianceStatus({ production, complianceDocs = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Permits & Insurance Status', production, company);
  let y = 30;

  const list = complianceDocs
    .filter((d: any) => !d.production_id || d.production_id === production.id)
    .sort((a: any, b: any) => String(a.expires || '9999').localeCompare(String(b.expires || '9999')));
  if (list.length === 0) {
    doc.setFontSize(10);
    doc.text('Nothing tracked yet — add certificates and permits in Permits & Insurance.', 14, 40);
    return save(doc, 'compliance-status.pdf', preview);
  }

  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text('DOCUMENT', 12, y); doc.text('TYPE', 92, y); doc.text('EXPIRES', 132, y); doc.text('STATUS', 162, y);
  doc.setTextColor(0, 0, 0); y += 5;
  doc.setFontSize(8.5);
  for (const d of list) {
    if (y > 258) { doc.addPage(); header(doc, 'Permits & Insurance Status', production, company); y = 30; }
    const days = d.expires ? Math.ceil((new Date(d.expires + 'T23:59:59').getTime() - Date.now()) / 86400000) : null;
    const st = days == null ? 'NO EXPIRY' : days < 0 ? 'EXPIRED' : days <= 30 ? `EXPIRES IN ${days}d` : 'ACTIVE';
    doc.setFont('helvetica', 'bold');
    doc.text(String(d.name || '').slice(0, 42), 12, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(d.kind || ''), 92, y);
    doc.text(String(d.expires || '—'), 132, y);
    if (st === 'EXPIRED') doc.setTextColor(200, 30, 30);
    else if (st.startsWith('EXPIRES')) doc.setTextColor(180, 120, 0);
    else doc.setTextColor(20, 130, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(st, 162, y);
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
    if (d.notes) { y += 4; doc.setFontSize(7.5); doc.setTextColor(140, 140, 140); doc.text(String(d.notes).slice(0, 100), 14, y); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0); }
    y += 6.5;
  }

  footer(doc);
  return save(doc, `compliance-status-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

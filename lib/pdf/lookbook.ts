import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

/* Look book — cover, colour palette swatches, then mood-board and look-book
   image grids (4 per page) with captions. Images are embedded. */
export async function generateLookBook({ production, creativeDocs = [], creativeImages = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'l' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const palette = creativeDocs.find((d: any) => d.kind === 'palette' && d.production_id === production.id);
  const colors: string[] = palette?.colors || [];
  const boards: ['mood' | 'look', string][] = [['mood', 'MOOD BOARD'], ['look', 'LOOK BOOK']];

  // ── Cover
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setTextColor(250, 204, 21);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text((company?.name || 'PRO-LOGIC STUDIO').toUpperCase(), pageW / 2, pageH / 2 - 26, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(34);
  doc.text(String(production.name || '').toUpperCase(), pageW / 2, pageH / 2 - 6, { align: 'center' });
  doc.setFontSize(13); doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 170);
  doc.text(`Look book${production.client ? '  ·  ' + production.client : ''}`, pageW / 2, pageH / 2 + 8, { align: 'center' });
  if (colors.length) {
    const sw = 18, gap = 6;
    const total = colors.length * sw + (colors.length - 1) * gap;
    let x = (pageW - total) / 2;
    for (const c of colors) {
      const r = parseInt(c.slice(1, 3), 16) || 0, g = parseInt(c.slice(3, 5), 16) || 0, b = parseInt(c.slice(5, 7), 16) || 0;
      doc.setFillColor(r, g, b);
      doc.roundedRect(x, pageH / 2 + 22, sw, sw, 3, 3, 'F');
      doc.setTextColor(140, 140, 150); doc.setFontSize(6.5);
      doc.text(c.toUpperCase(), x + sw / 2, pageH / 2 + 22 + sw + 5, { align: 'center' });
      x += sw + gap;
    }
  }
  doc.setTextColor(0, 0, 0);

  // ── Boards
  for (const [board, title] of boards) {
    const imgs = creativeImages.filter((i: any) => i.production_id === production.id && i.board === board);
    if (imgs.length === 0) continue;
    for (let i = 0; i < imgs.length; i += 4) {
      doc.addPage();
      header(doc, title, production, company);
      const chunk = imgs.slice(i, i + 4);
      const cw = (pageW - 30) / 2, ch = (pageH - 46) / 2;
      for (let j = 0; j < chunk.length; j++) {
        const col = j % 2, row = Math.floor(j / 2);
        const x = 10 + col * (cw + 10), y = 24 + row * (ch + 6);
        const data = await toDataUrl(chunk[j].url);
        if (data) {
          try {
            const fmt = data.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(data, fmt, x, y, cw, ch - 8, undefined, 'FAST');
          } catch {
            doc.setDrawColor(200, 200, 200);
            doc.rect(x, y, cw, ch - 8);
          }
        } else {
          doc.setDrawColor(200, 200, 200);
          doc.rect(x, y, cw, ch - 8);
        }
        if (chunk[j].caption) {
          doc.setFontSize(8); doc.setTextColor(90, 90, 90);
          doc.text(String(chunk[j].caption).slice(0, 70), x + 1, y + ch - 2);
          doc.setTextColor(0, 0, 0);
        }
      }
    }
  }

  footer(doc);
  return save(doc, `lookbook-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Travel & accommodation grid — the whole crew pre-listed with columns for
   arrival, departure, hotel, room and notes; the coordinator fills as booked. */
export async function generateTravelAccommodation({ production, crew, company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'l' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Travel & Accommodation', production, company);
  let y = 28;

  if (crew.length === 0) {
    doc.setFontSize(10);
    doc.text('No crew yet — add crew members first.', 14, 40);
    return save(doc, 'travel-accommodation.pdf', preview);
  }

  const head = () => {
    doc.setFillColor(20, 20, 20); doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 5, pageW - 20, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('NAME', 13, y); doc.text('DEPT / ROLE', 68, y); doc.text('ARRIVES', 118, y); doc.text('DEPARTS', 146, y); doc.text('HOTEL', 174, y); doc.text('ROOM', 216, y); doc.text('NOTES', 236, y);
    doc.setTextColor(0, 0, 0); y += 8;
  };
  head();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const sorted = [...crew].sort((a: any, b: any) => String(a.department || '').localeCompare(String(b.department || '')));
  sorted.forEach((c: any, i: number) => {
    if (y > 192) { doc.addPage(); header(doc, 'Travel & Accommodation', production, company); y = 28; head(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
    if (i % 2 === 0) { doc.setFillColor(246, 246, 246); doc.rect(10, y - 4.5, pageW - 20, 7.5, 'F'); }
    doc.text(`${c.name || ''} ${c.last_name || ''}`.trim().slice(0, 30), 13, y);
    doc.text(`${c.department || ''}${c.role ? ' · ' + c.role : ''}`.slice(0, 28), 68, y);
    doc.setDrawColor(200, 200, 200);
    doc.line(118, y + 1, 142, y + 1);
    doc.line(146, y + 1, 170, y + 1);
    doc.line(174, y + 1, 212, y + 1);
    doc.line(216, y + 1, 232, y + 1);
    doc.line(236, y + 1, pageW - 12, y + 1);
    y += 7.5;
  });

  footer(doc);
  return save(doc, `travel-accommodation-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

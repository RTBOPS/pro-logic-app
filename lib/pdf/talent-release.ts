import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

/* Talent / appearance release — one page per performer. Performers are crew
   members in a talent-like department; with none flagged, a single blank
   template prints so the producer can hand-fill on set. */
export async function generateTalentRelease({ production, crew, company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const companyName = company?.name || 'PRODUCTION COMPANY';

  const talent = crew.filter((c: any) => /talent|cast|actor|performer|host|extra/i.test(`${c.department || ''} ${c.role || ''}`));
  const people: any[] = talent.length > 0 ? talent : [null];

  for (let i = 0; i < people.length; i++) {
    if (i > 0) doc.addPage();
    const p = people[i];
    const pName = p ? `${p.name || ''} ${p.last_name || ''}`.trim() : '';

    header(doc, 'Talent Release', production, company);
    let y = 30;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('TALENT / APPEARANCE RELEASE', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${today}  |  Production: ${production.name}${production.client ? '  |  Client: ' + production.client : ''}`, pageW / 2, y, { align: 'center' });
    y += 12;

    doc.setFillColor(248, 248, 248);
    doc.roundedRect(10, y - 2, pageW - 20, 26, 2, 2, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('PERFORMER:', 14, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(pName || '________________________________', 78, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.text('ROLE / APPEARANCE:', 14, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(p?.role || '________________________________', 78, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTION COMPANY:', 14, y + 19);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName, 78, y + 19);
    y += 32;

    const para = (title: string, text: string): void => {
      if (y > 235) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(title, 15, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const lines = doc.splitTextToSize(text, pageW - 30);
      doc.text(lines, 15, y);
      y += lines.length * 4.5 + 5;
    };

    para('1. GRANT OF RIGHTS',
      `For good and valuable consideration, receipt of which is hereby acknowledged, the undersigned Performer grants to ${companyName} ("Producer") and its licensees, successors and assigns the irrevocable right to record, photograph and film Performer's name, image, likeness, voice and performance in connection with the production titled "${production.name}" (the "Production"), and to use, reproduce, edit, distribute and exhibit the same in all media now known or hereafter devised, throughout the universe, in perpetuity.`);
    para('2. COMPENSATION',
      `Performer shall receive: $_____________ / [ ] deferred / [ ] credit only / [ ] other: _______________________. Performer acknowledges this as full and complete consideration.`);
    para('3. NO OBLIGATION',
      `Producer is under no obligation to use the recorded material or to produce, distribute or exhibit the Production.`);
    para('4. NAME & LIKENESS / PROMOTION',
      `Producer may use Performer's name, likeness, photograph and biographical material for advertising, publicity and promotion of the Production and of Producer's services.`);
    para('5. RELEASE',
      `Performer releases Producer from any and all claims arising out of the use of the material described above, including without limitation claims for invasion of privacy, defamation or right of publicity. Performer represents being 18 years of age or older, or that a parent/guardian signature is provided below.`);
    para('6. GOVERNING LAW',
      `This release shall be governed by the laws of the State of _______________. It constitutes the entire agreement between the parties regarding its subject matter.`);

    if (y > 215) { doc.addPage(); y = 30; }
    y += 8;
    const half = (pageW - 30) / 2;
    doc.setDrawColor(120, 120, 120);
    doc.line(15, y + 14, 15 + half - 8, y + 14);
    doc.line(15 + half + 8, y + 14, pageW - 15, y + 14);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.text(`PERFORMER${pName ? ': ' + pName : ''}  ·  Date`, 15, y + 19);
    doc.text(`FOR ${companyName.toUpperCase()}  ·  Date`, 15 + half + 8, y + 19);
    y += 30;
    doc.line(15, y + 14, 15 + half - 8, y + 14);
    doc.text('PARENT / GUARDIAN (if performer is a minor)  ·  Date', 15, y + 19);
  }

  return save(doc, `talent-release-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

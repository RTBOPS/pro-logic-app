import { jsPDF } from 'jspdf';
import { PDFContext, header, sectionTitle, save } from './base';

export async function generateCrewDeal({ production, crew, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  for (let ci = 0; ci < Math.max(crew.length, 1); ci++) {
    if (ci > 0) doc.addPage();
    const member = crew[ci] || { name: '', last_name: '', role: '', email: '', phone: '' };

    header(doc, 'Crew Deal Memo & Contract', production);
    let y = 30;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CREW DEAL MEMO & CONTRACT', pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Production: ${production.name}  |  Client: ${production.client}  |  Date: ${today}`, pageW / 2, y, { align: 'center' });
    y += 10;

    // Crew info
    y = sectionTitle(doc, 'Crew Member Information', y);
    const fields = [
      ['Full Name:', `${member.name} ${member.last_name}`],
      ['Position / Role:', member.role || '___________'],
      ['Phone:', member.phone || '___________'],
      ['Email:', member.email || '___________'],
      ['Address:', member.address || '___________'],
    ];
    doc.setFontSize(9);
    fields.forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(val, 60, y);
      y += 6;
    });
    y += 4;

    // Deal terms
    y = sectionTitle(doc, 'Deal Terms', y);
    const terms = [
      ['Rate Type:', '[ ] Flat  [ ] Daily  [ ] Weekly  [ ] Hourly'],
      ['Agreed Rate:', '$_____________'],
      ['Rate Period:', '___________'],
      ['Start Date:', '___________'],
      ['End Date / Wrap:', '___________'],
      ['Overtime Rate:', '$_____________ (after _____ hours)'],
      ['Payment Due:', '[ ] Net 15  [ ] Net 30  [ ] On wrap'],
      ['Payment Method:', '[ ] Check  [ ] ACH  [ ] Paypal  [ ] Other'],
      ['Kit Rental:', '$_____________ per ___________'],
      ['Per Diem:', '$_____________ per day  [ ] N/A'],
      ['Travel:', '[ ] Included  [ ] Reimbursed  [ ] N/A'],
      ['Meal/Catering:', '[ ] Provided  [ ] Per diem  [ ] N/A'],
    ];
    doc.setFontSize(9);
    terms.forEach(([label, val], i) => {
      if (i % 2 === 0) doc.setFillColor(250, 250, 250);
      else doc.setFillColor(255, 255, 255);
      doc.rect(10, y - 4, pageW - 20, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(val, 65, y);
      y += 6;
    });
    y += 4;

    // Credit
    y = sectionTitle(doc, 'Credit & Rights', y);
    const creditLines = [
      'Screen Credit: [ ] Yes — Credit as: _________________________________  [ ] No',
      'Work-for-Hire: [ ] All work produced shall be considered work-for-hire owned by the production.',
      'Exclusivity:    [ ] Exclusive during production  [ ] Non-exclusive',
    ];
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    creditLines.forEach(line => {
      doc.text(line, 14, y);
      y += 6;
    });
    y += 4;

    // Terms
    y = sectionTitle(doc, 'General Terms', y);
    const genText = `Crew member agrees to maintain confidentiality of all production materials. All deliverables remain the property of ${production.client} / PRO-LOGIC STUDIO. This agreement constitutes the entire agreement between the parties regarding compensation and terms of engagement for the above-named production.`;
    doc.setFontSize(8);
    const gLines = doc.splitTextToSize(genText, pageW - 28);
    doc.text(gLines, 14, y);
    y += gLines.length * 4 + 8;

    // Signatures
    const sigW = (pageW - 40) / 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTION / EMPLOYER', 15, y);
    doc.text('CREW MEMBER', 15 + sigW + 10, y);
    y += 12;
    doc.setDrawColor(0);
    ['Signature', 'Printed Name', 'Date'].forEach(label => {
      doc.line(15, y, 15 + sigW, y);
      doc.line(15 + sigW + 10, y, 15 + sigW * 2 + 10, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.text(label, 15, y);
      doc.text(label, 15 + sigW + 10, y);
      y += 8;
    });
  }

  return save(doc, `crew-deal-${production.name.replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

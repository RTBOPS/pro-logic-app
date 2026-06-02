import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

export async function generateLocationRelease({ production, locations, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const locs = locations.length > 0 ? locations : [{ name: '___________', address: '', city: '', contact_name: '', contact_phone: '' }];

  for (let li = 0; li < locs.length; li++) {
    if (li > 0) doc.addPage();
    const loc = locs[li];

    header(doc, 'Location Release Agreement', production);
    let y = 30;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('LOCATION RELEASE AGREEMENT', pageW / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${today}`, pageW / 2, y, { align: 'center' });
    y += 12;

    const para = (title: string, text: string): void => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, 15, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(text, pageW - 30);
      doc.text(lines, 15, y);
      y += lines.length * 4.5 + 5;
    };

    // Parties box
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(10, y, pageW - 20, 24, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY OWNER / LICENSOR:', 14, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(loc.contact_name || '___________', 85, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text('LOCATION:', 14, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${loc.name}${loc.address ? ', ' + loc.address : ''}${loc.city ? ', ' + loc.city : ''}`, 85, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTION COMPANY:', 14, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.text('PRO-LOGIC STUDIO', 85, y + 18);
    y += 30;

    para('1. GRANT OF LICENSE', `In consideration of the sum of $_____________, receipt of which is hereby acknowledged, the undersigned Property Owner ("Licensor") hereby grants to PRO-LOGIC STUDIO ("Licensee") and its agents, employees, licensees, and successors the right and permission to enter and use the property located at "${loc.name}" (the "Location") for the production titled "${production.name}" (the "Production").`);

    para('2. FILMING DATES', `Filming is authorized for the following dates: From _______________ to _______________. Hours of access: _______________ AM/PM to _______________ AM/PM. Additional dates or hours shall require written consent.`);

    para('3. PERMITTED USE', `Licensee may photograph, film, videotape, and record the Location and all elements therein for use in the Production and in all media, whether now known or hereafter devised, throughout the universe in perpetuity. Licensee may use the name and likeness of the Location in connection with the Production.`);

    para('4. ALTERATIONS', `Licensee agrees to restore the Location to its original condition upon completion of filming, reasonable wear and tear excepted. Licensee shall not make permanent alterations without prior written consent.`);

    para('5. INSURANCE', `Licensee agrees to carry comprehensive general liability insurance naming the Licensor as additional insured, with minimum coverage of $1,000,000 per occurrence, during all filming dates.`);

    para('6. INDEMNIFICATION', `Each party shall indemnify and hold harmless the other from any claims, damages, or liabilities arising from their own negligence or misconduct.`);

    para('7. ENTIRE AGREEMENT', `This Agreement constitutes the entire agreement between the parties regarding use of the Location and supersedes all prior negotiations or agreements.`);

    y += 6;
    const sigW = (pageW - 40) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PROPERTY OWNER / LICENSOR', 15, y);
    doc.text('PRODUCTION COMPANY', 15 + sigW + 10, y);
    y += 10;
    ['Signature', 'Printed Name', 'Date', 'Phone'].forEach(label => {
      doc.line(15, y, 15 + sigW, y);
      doc.line(15 + sigW + 10, y, 15 + sigW * 2 + 10, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.text(label, 15, y);
      doc.text(label, 15 + sigW + 10, y);
      y += 8;
    });
  }

  return save(doc, `location-release-${production.name.replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

export async function generateLocationRelease({ production, locations, company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const companyName = company?.name || 'PRODUCTION COMPANY';
  const companyAddress = [company?.address, company?.city, company?.state].filter(Boolean).join(', ');

  // Use only the location assigned to this production, fall back to all locations
  const assignedLoc = locations.find((l: any) => l.id === production.location_id);
  const locs = assignedLoc ? [assignedLoc] : locations.length > 0 ? locations : [null];

  for (let li = 0; li < locs.length; li++) {
    if (li > 0) doc.addPage();
    const loc = locs[li];

    header(doc, 'Location Release Agreement', production, company);
    let y = 30;

    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('LOCATION RELEASE AGREEMENT', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${today}  |  Production: ${production.name}${production.client ? '  |  Client: ' + production.client : ''}`, pageW / 2, y, { align: 'center' });
    y += 12;

    // Parties box
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(10, y - 2, pageW - 20, 30, 2, 2, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');

    doc.text('PROPERTY OWNER / LICENSOR:', 14, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(loc?.contact_name || '________________________________', 78, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('LOCATION:', 14, y + 12);
    doc.setFont('helvetica', 'normal');
    const locStr = loc
      ? `${loc.name}${loc.address ? ', ' + loc.address : ''}${loc.city ? ', ' + loc.city : ''}${loc.state ? ', ' + loc.state : ''}`
      : '________________________________';
    doc.text(locStr, 78, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTION COMPANY / LICENSEE:', 14, y + 19);
    doc.setFont('helvetica', 'normal');
    doc.text(`${companyName}${companyAddress ? '  ·  ' + companyAddress : ''}`, 78, y + 19);

    if (company?.phone || company?.email) {
      doc.text(`${company?.phone || ''}${company?.phone && company?.email ? '  ·  ' : ''}${company?.email || ''}`, 78, y + 25);
    }
    y += 36;

    const para = (title: string, text: string): void => {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(title, 15, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const lines = doc.splitTextToSize(text, pageW - 30);
      doc.text(lines, 15, y);
      y += lines.length * 4.5 + 5;
    };

    const locName = loc?.name || '[LOCATION NAME]';
    const filmDates = production.start_date
      ? `${production.start_date}${production.end_date ? ' to ' + production.end_date : ''}`
      : '_______________ to _______________';

    para('1. GRANT OF LICENSE',
      `In consideration of the sum of $_____________, the undersigned Property Owner ("Licensor") hereby grants to ${companyName} ("Licensee") and its agents, employees, and successors the right and permission to enter and use the property located at "${locName}" (the "Location") for the production titled "${production.name}" (the "Production").`);

    para('2. FILMING DATES',
      `Filming is authorized for the following dates: ${filmDates}. Hours of access: _______________ AM/PM to _______________ AM/PM. Additional dates or hours shall require written consent from Licensor.`);

    para('3. PERMITTED USE',
      `Licensee may photograph, film, videotape, and record the Location and all elements therein for use in the Production and in all media throughout the universe in perpetuity. Licensee may use the name and likeness of the Location in connection with the Production.`);

    para('4. ALTERATIONS',
      `Licensee agrees to restore the Location to its original condition upon completion of filming, reasonable wear and tear excepted. Licensee shall not make permanent alterations without prior written consent.`);

    para('5. INSURANCE',
      `Licensee agrees to carry comprehensive general liability insurance naming the Licensor as additional insured, with minimum coverage of $1,000,000 per occurrence during all filming dates.`);

    para('6. INDEMNIFICATION',
      `Each party shall indemnify and hold harmless the other from any claims, damages, or liabilities arising from their own negligence or misconduct in connection with this Agreement.`);

    para('7. ENTIRE AGREEMENT',
      `This Agreement constitutes the entire agreement between the parties regarding use of the Location and supersedes all prior negotiations or agreements.`);

    y += 4;
    if (y > 245) { doc.addPage(); y = 20; }
    const sigW = (pageW - 40) / 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('PROPERTY OWNER / LICENSOR', 15, y);
    doc.text(`PRODUCTION COMPANY — ${companyName.toUpperCase()}`, 15 + sigW + 10, y);
    y += 4;

    ['Signature', 'Printed Name', 'Title', 'Date', 'Phone'].forEach((label, i) => {
      y += 9;
      doc.line(15, y, 15 + sigW - 2, y);
      doc.line(15 + sigW + 10, y, pageW - 15, y);
      y += 3;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text(label, 15, y);
      doc.text(label, 15 + sigW + 10, y);
      // Pre-fill company info on the right side
      const prefill: Record<string, string> = {
        'Printed Name': company?.contact_name || '',
        'Title': company?.contact_title || '',
        'Phone': company?.phone || '',
      };
      if (prefill[label]) {
        doc.setFont('helvetica', 'bold');
        doc.text(prefill[label], 15 + sigW + 10, y - 4);
        doc.setFont('helvetica', 'normal');
      }
    });
  }

  return save(doc, `location-release-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

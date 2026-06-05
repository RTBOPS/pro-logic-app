import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

function addNDAPage(doc: jsPDF, production: any, company: any, crewMember: any | null, pageW: number) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const companyName = company?.name || 'PRODUCTION COMPANY';
  const memberName = crewMember ? `${crewMember.name} ${crewMember.last_name}` : '______________________';
  const memberRole = crewMember?.role || '______________________';

  header(doc, 'Non-Disclosure Agreement', production);
  let y = 30;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('NON-DISCLOSURE AGREEMENT', pageW / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Effective Date: ${today}  |  Production: ${production.name}  |  Client: ${production.client || '—'}`, pageW / 2, y, { align: 'center' });
  y += 10;

  // Parties box
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(14, y - 3, pageW - 28, 16, 2, 2, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('DISCLOSING PARTY (Company):', 16, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.text(`${companyName}${company?.address ? ' · ' + [company.address, company.city, company.state].filter(Boolean).join(', ') : ''}`, 80, y + 3);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEIVING PARTY (Crew Member):', 16, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${memberName}  ·  Role: ${memberRole}`, 80, y + 9);
  y += 20;

  const para = (title: string, text: string): void => {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(title, 15, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(text, pageW - 30);
    doc.text(lines, 15, y);
    y += lines.length * 4.2 + 4;
  };

  para('1. PARTIES', `This Non-Disclosure Agreement ("Agreement") is entered into as of ${today} between ${companyName} ("Disclosing Party"), in connection with the production titled "${production.name}"${production.client ? ` for client "${production.client}"` : ''} (the "Production"), and ${memberName} ("Receiving Party").`);
  para('2. CONFIDENTIAL INFORMATION', `"Confidential Information" includes all information related to the Production: scripts, story concepts, production plans, talent and financial information, technical data, creative content, casting decisions, distribution strategies, and any other non-public information disclosed in connection with the Production.`);
  para('3. OBLIGATIONS', `The Receiving Party agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose to any third party without prior written consent; (c) use solely for purposes of their involvement in the Production; (d) take reasonable precautions to protect against unauthorized disclosure.`);
  para('4. EXCLUSIONS', `This Agreement does not apply to information that: (a) is or becomes publicly available without breach; (b) was already in Receiving Party's possession before disclosure; (c) is independently developed by Receiving Party; (d) is required to be disclosed by law or court order.`);
  para('5. TERM', `This Agreement shall remain in effect for three (3) years from the Effective Date and shall survive the completion or termination of Receiving Party's involvement in the Production.`);
  para('6. REMEDIES', `Receiving Party acknowledges that breach would cause irreparable harm. Disclosing Party shall be entitled to seek equitable relief in addition to all other remedies available at law.`);
  para('7. GOVERNING LAW', `This Agreement shall be governed by applicable laws. Any disputes shall be resolved in courts of competent jurisdiction.`);

  y += 6;
  if (y > 240) { doc.addPage(); y = 20; }
  const sigW = (pageW - 40) / 2;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('DISCLOSING PARTY — ' + companyName.toUpperCase(), 15, y);
  doc.text('RECEIVING PARTY — ' + memberName.toUpperCase(), 15 + sigW + 10, y);
  y += 2;
  const fields = ['Signature', 'Printed Name', 'Title / Role', 'Date'];
  const prefill = crewMember ? ['', memberName, memberRole, ''] : ['', '', '', ''];
  fields.forEach((label, fi) => {
    y += 10;
    doc.line(15, y, 15 + sigW, y);
    doc.line(15 + sigW + 10, y, pageW - 15, y);
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(label, 15, y);
    doc.text(label, 15 + sigW + 10, y);
    if (prefill[fi]) { doc.setFont('helvetica', 'bold'); doc.text(prefill[fi], 15 + sigW + 10, y - 5); doc.setFont('helvetica', 'normal'); }
  });
}

export async function generateNDA({ production, crew, company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  if (crew.length > 0) {
    // One NDA page per crew member
    crew.forEach((member, i) => {
      if (i > 0) doc.addPage();
      addNDAPage(doc, production, company, member, pageW);
    });
  } else {
    // Blank template
    addNDAPage(doc, production, company, null, pageW);
  }

  return save(doc, `nda-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

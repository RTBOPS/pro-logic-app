import { jsPDF } from 'jspdf';
import { PDFContext, header, save } from './base';

export async function generateNDA({ production, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  header(doc, 'Non-Disclosure Agreement', production);
  let y = 30;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('NON-DISCLOSURE AGREEMENT', pageW / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Effective Date: ${today}`, pageW / 2, y, { align: 'center' });
  y += 12;

  const para = (title: string, text: string, yPos: number): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, 15, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, pageW - 30);
    doc.text(lines, 15, yPos);
    return yPos + lines.length * 4.5 + 4;
  };

  y = para('1. PARTIES', `This Non-Disclosure Agreement ("Agreement") is entered into as of ${today} between PRO-LOGIC STUDIO ("Disclosing Party") in connection with the production titled "${production.name}" for client "${production.client}" (the "Production"), and the undersigned individual or entity ("Receiving Party").`, y);

  y = para('2. CONFIDENTIAL INFORMATION', `For purposes of this Agreement, "Confidential Information" means any and all information or data that has or could have commercial value or other utility in the business in which the Disclosing Party is engaged, including but not limited to: scripts, screenplays, story concepts, production plans, talent information, financial information, technical data, creative content, casting decisions, distribution strategies, and any other information related to the Production.`, y);

  y = para('3. OBLIGATIONS OF RECEIVING PARTY', `The Receiving Party agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third parties without prior written consent; (c) use the Confidential Information solely for purposes of their involvement in the Production; (d) take reasonable security precautions to protect the Confidential Information.`, y);

  y = para('4. EXCLUSIONS', `This Agreement does not apply to information that: (a) is or becomes generally available to the public without breach of this Agreement; (b) was already in the Receiving Party's possession prior to disclosure; (c) is independently developed by the Receiving Party; (d) is required to be disclosed by law or court order.`, y);

  y = para('5. TERM', `This Agreement shall remain in effect for a period of three (3) years from the Effective Date, and shall survive the completion or termination of the Receiving Party's involvement in the Production.`, y);

  y = para('6. REMEDIES', `The Receiving Party acknowledges that breach of this Agreement would cause irreparable harm to the Disclosing Party, for which monetary damages would be inadequate. The Disclosing Party shall be entitled to seek equitable relief, including injunction and specific performance, in addition to all other remedies available at law.`, y);

  y = para('7. GOVERNING LAW', `This Agreement shall be governed by and construed in accordance with applicable laws. Any disputes arising under this Agreement shall be resolved in the courts of competent jurisdiction.`, y);

  y += 10;
  // Signature blocks
  const sigW = (pageW - 40) / 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DISCLOSING PARTY', 15, y);
  doc.text('RECEIVING PARTY', 15 + sigW + 10, y);
  y += 12;
  doc.setDrawColor(0);
  doc.line(15, y, 15 + sigW, y);
  doc.line(15 + sigW + 10, y, 15 + sigW * 2 + 10, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text('Signature', 15, y);
  doc.text('Signature', 15 + sigW + 10, y);
  y += 8;
  doc.line(15, y, 15 + sigW, y);
  doc.line(15 + sigW + 10, y, 15 + sigW * 2 + 10, y);
  y += 4;
  doc.text('Printed Name', 15, y);
  doc.text('Printed Name', 15 + sigW + 10, y);
  y += 8;
  doc.line(15, y, 15 + sigW, y);
  doc.line(15 + sigW + 10, y, 15 + sigW * 2 + 10, y);
  y += 4;
  doc.text('Date', 15, y);
  doc.text('Date', 15 + sigW + 10, y);
  y += 8;
  doc.line(15, y, 15 + sigW, y);
  doc.line(15 + sigW + 10, y, 15 + sigW * 2 + 10, y);
  y += 4;
  doc.text('Title / Role', 15, y);
  doc.text('Title / Role', 15 + sigW + 10, y);

  return save(doc, `nda-${production.name.replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

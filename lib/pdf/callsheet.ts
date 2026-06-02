import { jsPDF } from 'jspdf';
import { PDFContext, header, sectionTitle, tableRow, save } from './base';

export async function generateCallSheet({ production, crew, locations, inventory }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  header(doc, 'Call Sheet', production);
  let y = 26;

  // Production info box
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(10, y, pageW - 20, 28, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUCTION:', 14, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(production.name, 50, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT:', 14, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(production.client, 50, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text('DATE:', 14, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(today, 50, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS:', 14, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(production.status?.toUpperCase() || 'ACTIVE', 50, y + 24);

  if (locations.length > 0) {
    const loc = locations[0];
    doc.setFont('helvetica', 'bold');
    doc.text('LOCATION:', pageW / 2, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(loc.name || '', pageW / 2 + 28, y + 6);
    doc.text(loc.address || '', pageW / 2 + 28, y + 12);
    doc.text(loc.city || '', pageW / 2 + 28, y + 18);
    if (loc.contact_name) {
      doc.setFont('helvetica', 'bold');
      doc.text('CONTACT:', pageW / 2, y + 24);
      doc.setFont('helvetica', 'normal');
      doc.text(`${loc.contact_name}  ${loc.contact_phone || ''}`, pageW / 2 + 28, y + 24);
    }
  }

  y += 36;

  // Schedule
  y = sectionTitle(doc, 'Daily Schedule', y);
  const schedCols = ['Time', 'Scene / Activity', 'Location', 'Notes'];
  const schedW = [25, 70, 60, pageW - 10 - 25 - 70 - 60];
  y = tableRow(doc, schedCols, schedW, y, 10, true);
  const schedule = [
    ['6:00 AM', 'Crew call / Setup', 'Base camp', ''],
    ['7:00 AM', 'Camera & lighting setup', production.name, ''],
    ['8:00 AM', 'First shot', production.name, 'Scene 1'],
    ['12:00 PM', 'Lunch break', 'Catering', '1 hour'],
    ['1:00 PM', 'Resume filming', production.name, ''],
    ['6:00 PM', 'Wrap', '', 'Strike equipment'],
  ];
  schedule.forEach((row, i) => { y = tableRow(doc, row, schedW, y, 10, false, i % 2 === 1); });

  y += 6;

  // Crew
  y = sectionTitle(doc, 'Crew Call Sheet', y);
  const crewCols = ['Name', 'Role', 'Call Time', 'Phone', 'Email'];
  const crewW = [40, 35, 22, 35, pageW - 10 - 40 - 35 - 22 - 35];
  y = tableRow(doc, crewCols, crewW, y, 10, true);
  crew.forEach((c, i) => {
    y = tableRow(doc, [
      `${c.name} ${c.last_name}`, c.role || '—', '7:00 AM',
      c.phone || '—', c.email || '—',
    ], crewW, y, 10, false, i % 2 === 1);
    if (y > 240) { doc.addPage(); y = 20; }
  });

  y += 6;

  // Equipment
  y = sectionTitle(doc, 'Equipment Needed', y);
  const eqCols = ['Item', 'Brand / Model', 'Status'];
  const eqW = [80, 80, pageW - 10 - 80 - 80];
  y = tableRow(doc, eqCols, eqW, y, 10, true);
  inventory.slice(0, 20).forEach((item, i) => {
    y = tableRow(doc, [item.name, `${item.brand || ''} ${item.model || ''}`.trim() || '—', item.status], eqW, y, 10, false, i % 2 === 1);
    if (y > 240) { doc.addPage(); y = 20; }
  });

  save(doc, `call-sheet-${production.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

import { jsPDF } from 'jspdf';
import { PDFContext, header, sectionTitle, tableRow, save } from './base';

export async function generateShotList({ production, crew, locations, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'l' });
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Shot List', production);
  let y = 26;

  // Info bar
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const loc = locations[0];
  doc.text(`Location: ${loc?.name || 'TBD'}  |  DP: ${crew.find((c: any) => c.role?.toLowerCase().includes('dp') || c.role?.toLowerCase().includes('director of photography'))?.name || 'TBD'}  |  Director: ${crew.find((c: any) => c.role?.toLowerCase().includes('director'))?.name || 'TBD'}`, 10, y);
  y += 8;

  y = sectionTitle(doc, 'Shot List', y);

  const cols = ['#', 'Scene', 'Shot', 'Size', 'Angle', 'Movement', 'Lens', 'Description', 'Audio', 'VFX', 'Est. Time', 'Notes'];
  const widths = [8, 15, 15, 15, 15, 20, 15, 55, 18, 12, 18, pageW - 10 - 8 - 15 - 15 - 15 - 15 - 20 - 15 - 55 - 18 - 12 - 18];

  y = tableRow(doc, cols, widths, y, 10, true);

  // Sample rows (in production, these would come from a shots collection)
  const sampleShots = [
    ['1', '1', 'A', 'WS', 'EYE', 'STATIC', '24mm', 'Establishing shot of location', 'NAT', '—', '0:30', ''],
    ['2', '1', 'B', 'MS', 'EYE', 'DOLLY IN', '50mm', 'Character enters frame', 'SYNC', '—', '0:45', 'Steady'],
    ['3', '1', 'C', 'CU', 'LOW', 'STATIC', '85mm', 'Reaction shot', 'SYNC', '—', '0:20', ''],
    ['4', '2', 'A', 'WS', 'HIGH', 'CRANE UP', '24mm', 'Scene overview', 'NAT', 'YES', '1:00', 'VFX sky'],
    ['5', '2', 'B', 'OTS', 'EYE', 'STATIC', '50mm', 'Over the shoulder dialog', 'SYNC', '—', '1:30', 'Alt takes'],
    ['6', '2', 'C', 'ECU', 'EYE', 'PUSH IN', '100mm', 'Extreme close-up detail', 'NAT', '—', '0:25', ''],
    ['7', '3', 'A', 'MS', 'EYE', 'TRACK', '35mm', 'Walking shot', 'SYNC', '—', '0:50', 'Gimbal'],
    ['8', '3', 'B', 'CU', 'EYE', 'STATIC', '85mm', 'Dialog close-up', 'SYNC', '—', '2:00', 'Coverage'],
    ['9', '3', 'C', 'POV', 'EYE', 'HANDHELD', '35mm', 'Character POV', 'SYNC', '—', '0:40', ''],
    ['10', '4', 'A', 'DRONE', 'HIGH', 'FLY-IN', 'DRONE', 'Aerial establishing', 'NAT', '—', '1:00', 'FAA permit'],
    ['11', '4', 'B', 'WS', 'EYE', 'STATIC', '24mm', 'Wide coverage', 'NAT', '—', '0:30', ''],
    ['12', '5', 'A', 'MS', 'EYE', 'STATIC', '50mm', 'Interview setup', 'LAVALIER', '—', '5:00', 'B-roll needed'],
  ];

  sampleShots.forEach((row, i) => {
    y = tableRow(doc, row, widths, y, 10, false, i % 2 === 1);
    if (y > 185) { doc.addPage(); y = 20; }
  });

  // Add blank rows for manual entry
  for (let i = 0; i < 8; i++) {
    y = tableRow(doc, Array(cols.length).fill(''), widths, y, 10, false, false);
    if (y > 185) { doc.addPage(); y = 20; }
  }

  return save(doc, `shot-list-${production.name.replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

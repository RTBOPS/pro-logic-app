import { jsPDF } from 'jspdf';
import { PDFContext, header, sectionTitle, save } from './base';

export async function generateCharacterBreakdown({ production, crew }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Character Profile Breakdown', production);
  let y = 30;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CHARACTER PROFILE BREAKDOWN', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Production: ${production.name}  |  Client: ${production.client}`, pageW / 2, y, { align: 'center' });
  y += 12;

  // Sample characters (in production, these would come from a characters collection)
  const characters = crew.length > 0
    ? crew.slice(0, 6).map((c: any, i: number) => ({
        name: `Character ${i + 1}`,
        actor: `${c.name} ${c.last_name}`,
        role: c.role || 'Supporting',
        age: '25-35',
        gender: '—',
        appearance: 'To be determined',
        personality: 'To be determined',
        motivation: 'To be determined',
        arc: 'To be determined',
        scenes: `${Math.floor(Math.random() * 5) + 1}`,
        notes: '',
      }))
    : Array.from({ length: 3 }, (_, i) => ({
        name: `Character ${i + 1}`,
        actor: '(Cast TBD)',
        role: i === 0 ? 'Lead' : 'Supporting',
        age: '___',
        gender: '___',
        appearance: '',
        personality: '',
        motivation: '',
        arc: '',
        scenes: '___',
        notes: '',
      }));

  characters.forEach((char, ci) => {
    if (y > 220) { doc.addPage(); y = 20; }

    doc.setFillColor(240, 240, 255);
    doc.rect(10, y - 4, pageW - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${char.name}  ·  ${char.role}`, 14, y + 0.5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Actor: ${char.actor}`, pageW - 14, y + 0.5, { align: 'right' });
    y += 10;

    const row = (label: string, val: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(label, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(val || '_______________________________________________', 55, y);
      y += 5.5;
    };

    row('Age:', char.age);
    row('Gender:', char.gender);
    row('Appearance:', char.appearance);
    row('Personality:', char.personality);
    row('Motivation / Goal:', char.motivation);
    row('Character Arc:', char.arc);
    row('# of Scenes:', char.scenes);
    row('Special Notes:', char.notes);

    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(10, y, pageW - 10, y);
    y += 6;
  });

  save(doc, `character-breakdown-${production.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

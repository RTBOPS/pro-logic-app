import { createDoc, header, sectionTitle, tableRow, save } from './base';

/* Daily Production Report — the classic end-of-day film document:
   what was shot, by whom, and how the day went. */

export function generateDailyReportPDF(
  production: any,
  company: any,
  reportDate: string,               // YYYY-MM-DD
  takes: any[],                     // takes logged that day
  crewCount: number,
  location: any | null,
  preview = false
): string | void {
  const doc = createDoc('p');
  const pageH = doc.internal.pageSize.getHeight();

  header(doc, 'Daily Production Report', production, company);
  let y = 26;

  const ensureRoom = (needed: number, title?: string) => {
    if (y + needed > pageH - 16) {
      doc.addPage();
      header(doc, 'Daily Production Report (cont.)', production, company);
      y = 26;
      if (title) y = sectionTitle(doc, title, y);
    }
  };

  /* Day X of Y */
  let dayInfo = '';
  if (production.start_date) {
    const start = new Date(production.start_date + 'T12:00:00');
    const current = new Date(reportDate + 'T12:00:00');
    const dayNum = Math.round((current.getTime() - start.getTime()) / 86400000) + 1;
    if (production.end_date) {
      const end = new Date(production.end_date + 'T12:00:00');
      const total = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      dayInfo = dayNum >= 1 && dayNum <= total ? `Shoot day ${dayNum} of ${total}` : '';
    } else if (dayNum >= 1) {
      dayInfo = `Shoot day ${dayNum}`;
    }
  }

  y = sectionTitle(doc, 'Day Information', y);
  doc.setFontSize(8);
  const info = (label: string, value: string, x: number) => {
    doc.setFont('helvetica', 'bold'); doc.text(label + ':', x, y);
    doc.setFont('helvetica', 'normal'); doc.text((value || '—').slice(0, 60), x + 28, y);
  };
  info('Report date', new Date(reportDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), 10);
  y += 5;
  info('Day', dayInfo || '—', 10);
  info('Call time', production.call_time || '—', 105);
  y += 5;
  info('Location', location?.name || '—', 10);
  info('Crew on set', String(crewCount || '—'), 105);
  y += 8;

  /* Scene summary */
  const scenes = [...new Set(takes.map((t: any) => t.scene))].sort();
  const selected = takes.filter((t: any) => t.selected);
  y = sectionTitle(doc, 'Production Summary', y);
  doc.setFontSize(8);
  info('Scenes covered', scenes.length ? scenes.join(', ').slice(0, 80) : 'None logged', 10);
  y += 5;
  info('Total takes', String(takes.length), 10);
  info('Circled (selected)', String(selected.length), 105);
  y += 8;

  /* Takes table */
  if (takes.length > 0) {
    y = sectionTitle(doc, `Takes Logged — ${takes.length}`, y);
    const widths = [16, 14, 14, 56, 18, 16, 16, 16, 30];
    y = tableRow(doc, ['SCENE', 'SHOT', 'TAKE', 'DESCRIPTION', 'LENS', 'FPS', 'ISO', 'SEL', 'NOTES'], widths, y, 10, true);
    const sorted = [...takes].sort((a, b) =>
      (a.scene || '').localeCompare(b.scene || '') || (a.shot || '').localeCompare(b.shot || '') || (a.take || 0) - (b.take || 0));
    sorted.forEach((t: any, i: number) => {
      ensureRoom(8, 'Takes Logged (cont.)');
      y = tableRow(doc, [
        (t.scene || '').slice(0, 8),
        (t.shot || '').slice(0, 6),
        String(t.take || ''),
        (t.description || '').slice(0, 40),
        (t.lens || '').slice(0, 10),
        (t.fps || '').slice(0, 8),
        (t.iso || '').slice(0, 8),
        t.selected ? '●' : '',
        (t.notes || '').slice(0, 20),
      ], widths, y, 10, false, i % 2 === 1);
    });
    y += 4;
  }

  /* Sign-off */
  ensureRoom(34);
  y += 2;
  y = sectionTitle(doc, 'Sign-off', y);
  doc.setFontSize(8);
  const col = (x: number, label: string) => {
    doc.text(label, x, y);
    doc.line(x, y + 12, x + 55, y + 12);
    doc.text('Name / signature', x, y + 16);
  };
  col(10, 'Script supervisor');
  col(78, '1st AD');
  col(146, 'Production manager');
  y += 20;

  return save(doc, `daily-report-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}-${reportDate}.pdf`, preview);
}

import { createDoc, header, sectionTitle, tableRow, save } from './base';

/* Run of Show PDF — the show-caller's master timing document. */

export function generateRundownPDF(
  production: any,
  company: any,
  rundown: { showStart: string; items: any[]; notes?: string },
  clockTimes: string[],
  totalRuntime: string,
  preview = false
): string | void {
  const doc = createDoc('l');
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Run of Show', production, company);
  let y = 26;

  const ensureRoom = (needed: number, title?: string) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      header(doc, 'Run of Show (cont.)', production, company);
      y = 26;
      if (title) y = sectionTitle(doc, title, y);
    }
  };

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Show start: ${rundown.showStart}   ·   Total runtime: ${totalRuntime}   ·   ${rundown.items.length} items`,
    10, y
  );
  doc.setTextColor(0, 0, 0);
  y += 6;

  y = sectionTitle(doc, 'Rundown', y);
  const widths = [10, 18, 14, 14, 54, 38, 38, 34, 30, 32];
  y = tableRow(doc, ['#', 'TIME', 'DUR', 'TYPE', 'SEGMENT / CUE', 'AUDIO', 'VIDEO / LED', 'LIGHTING', 'SFX / PYRO', 'NOTES'], widths, y, 10, true);
  rundown.items.forEach((item: any, i: number) => {
    ensureRoom(8, 'Rundown (cont.)');
    y = tableRow(doc, [
      String(i + 1),
      clockTimes[i] || '',
      (item.dur || '').slice(0, 8),
      (item.type || 'segment').slice(0, 3).toUpperCase(),
      (item.title || '').slice(0, 36),
      (item.audio || '').slice(0, 26),
      (item.video || '').slice(0, 26),
      (item.lx || '').slice(0, 22),
      (item.sfx || '').slice(0, 20),
      (item.notes || '').slice(0, 22),
    ], widths, y, 10, false, i % 2 === 1);
  });

  if (rundown.notes) {
    ensureRoom(20);
    y += 4;
    y = sectionTitle(doc, 'Notes', y);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(rundown.notes, pageW - 20);
    lines.forEach((line: string) => { ensureRoom(6); doc.text(line, 10, y); y += 4; });
  }

  const date = production.start_date || new Date().toISOString().slice(0, 10);
  return save(doc, `run-of-show-${(production.name || 'show').replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`, preview);
}

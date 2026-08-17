import { createDoc, header, sectionTitle, tableRow, save } from './base';

/* Audio Planner PDF: input/patch list, RF worksheet, monitor mixes and
   the tech summary a live audio director hands to the whole crew. */

export function generateInputListPDF(
  production: any,
  company: any,
  plan: {
    channels: any[];
    wireless: any[];
    monitors: any[];
    notes?: string;
  },
  stats: {
    console: string;
    total: number; phantom: number; dis: number;
    wireless: number; iems: number; mixes: number;
  },
  preview = false
): string | void {
  const doc = createDoc('l'); // landscape fits the channel table
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Audio Input List', production, company);
  let y = 26;

  const ensureRoom = (needed: number, title?: string) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      header(doc, 'Audio Input List (cont.)', production, company);
      y = 26;
      if (title) y = sectionTitle(doc, title, y);
    }
  };

  /* ── Summary strip ── */
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Inputs: ${stats.total}   ·   Phantom +48V: ${stats.phantom}   ·   DI boxes: ${stats.dis}   ·   Wireless mics: ${stats.wireless}   ·   IEMs: ${stats.iems}   ·   Monitor mixes: ${stats.mixes}`,
    10, y
  );
  y += 4;
  doc.text(`Console: ${stats.console}`, 10, y);
  doc.setTextColor(0, 0, 0);
  y += 7;

  /* ── Input list ── */
  y = sectionTitle(doc, `Input / Patch List — ${stats.total} channels`, y);
  const widths = [12, 52, 50, 14, 12, 32, 24, 18, 48];
  y = tableRow(doc, ['CH', 'SOURCE', 'MIC / DI', 'TYPE', '+48V', 'STAND', 'GAIN', 'HPF', 'NOTES'], widths, y, 10, true);
  plan.channels.forEach((c: any, i: number) => {
    ensureRoom(8, 'Input / Patch List (cont.)');
    y = tableRow(doc, [
      String(i + 1),
      (c.source || '').slice(0, 34),
      (c.mic || '').slice(0, 32),
      (c.type || 'mic').toUpperCase(),
      c.phantom ? 'YES' : '—',
      (c.stand || '').slice(0, 20),
      (c.gain || '').slice(0, 14),
      (c.hpf || '').slice(0, 10),
      (c.notes || '').slice(0, 32),
    ], widths, y, 10, false, i % 2 === 1);
  });
  y += 4;

  /* ── Wireless / RF ── */
  if (plan.wireless.length > 0) {
    ensureRoom(24);
    y = sectionTitle(doc, `Wireless / RF Coordination — ${plan.wireless.length} units`, y);
    const wWidths = [12, 60, 18, 60, 44, 28, 40];
    y = tableRow(doc, ['#', 'USE', 'KIND', 'MODEL', 'BAND', 'FREQ MHz', 'NOTES'], wWidths, y, 10, true);
    plan.wireless.forEach((w: any, i: number) => {
      ensureRoom(8, 'Wireless / RF (cont.)');
      y = tableRow(doc, [
        String(i + 1),
        (w.use || '').slice(0, 38),
        w.kind === 'iem' ? 'IEM' : 'MIC',
        (w.model || '').slice(0, 38),
        (w.band || '').slice(0, 28),
        (w.freq || '').slice(0, 12),
        (w.notes || '').slice(0, 26),
      ], wWidths, y, 10, false, i % 2 === 1);
    });
    y += 4;
  }

  /* ── Monitor mixes ── */
  if (plan.monitors.length > 0) {
    ensureRoom(24);
    y = sectionTitle(doc, `Monitor Mixes — ${plan.monitors.length}`, y);
    const mWidths = [14, 60, 26, 70, 92];
    y = tableRow(doc, ['MIX', 'NAME', 'TYPE', 'WHO', 'NEEDS'], mWidths, y, 10, true);
    plan.monitors.forEach((m: any, i: number) => {
      ensureRoom(8, 'Monitor Mixes (cont.)');
      y = tableRow(doc, [
        `M${i + 1}`,
        (m.name || '').slice(0, 38),
        (m.type || '').toUpperCase(),
        (m.members || '').slice(0, 46),
        (m.notes || '').slice(0, 62),
      ], mWidths, y, 10, false, i % 2 === 1);
    });
    y += 4;
  }

  /* ── Show notes ── */
  if (plan.notes) {
    ensureRoom(30);
    y = sectionTitle(doc, 'Show Notes', y);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(plan.notes, pageW - 20);
    lines.forEach((line: string) => {
      ensureRoom(6);
      doc.text(line, 10, y);
      y += 4;
    });
  }

  const date = production.start_date || new Date().toISOString().slice(0, 10);
  return save(doc, `input-list-${(production.name || 'show').replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`, preview);
}

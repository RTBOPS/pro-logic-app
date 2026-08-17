import { createDoc, header, sectionTitle, tableRow, save } from './base';

/* Broadcast Plan PDF — camera plan, replay, graphics package and network
   transmission circuits for a live multi-camera show. */

export function generateBroadcastPDF(
  production: any,
  company: any,
  plan: {
    cameras: any[]; replay: any[]; graphics: any[]; feeds: any[];
    network?: string; truck?: string; notes?: string;
  },
  preview = false
): string | void {
  const doc = createDoc('l');
  const pageH = doc.internal.pageSize.getHeight();

  header(doc, 'Broadcast Plan', production, company);
  let y = 26;

  const ensureRoom = (needed: number, title?: string) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      header(doc, 'Broadcast Plan (cont.)', production, company);
      y = 26;
      if (title) y = sectionTitle(doc, title, y);
    }
  };

  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Network: ${plan.network || '—'}   ·   OB unit: ${plan.truck || '—'}   ·   ${plan.cameras.length} cameras · ${plan.replay.length} replay units · ${plan.graphics.length} graphics · ${plan.feeds.length} circuits`,
    10, y
  );
  doc.setTextColor(0, 0, 0);
  y += 6;

  /* Cameras */
  if (plan.cameras.length > 0) {
    y = sectionTitle(doc, `Camera Plan — ${plan.cameras.length}`, y);
    const w = [18, 66, 24, 26, 44, 22, 62];
    y = tableRow(doc, ['CAM', 'POSITION', 'TYPE', 'LENS', 'OPERATOR', 'FEED', 'NOTES'], w, y, 10, true);
    plan.cameras.forEach((c: any, i: number) => {
      ensureRoom(8, 'Camera Plan (cont.)');
      y = tableRow(doc, [
        (c.cam || '').slice(0, 10),
        (c.position || '').slice(0, 44),
        (c.type || '').slice(0, 12),
        (c.lens || '').slice(0, 14),
        (c.operator || '').slice(0, 28),
        (c.feed || '').slice(0, 12),
        (c.notes || '').slice(0, 40),
      ], w, y, 10, false, i % 2 === 1);
    });
    y += 4;
  }

  /* Replay */
  if (plan.replay.length > 0) {
    ensureRoom(24);
    y = sectionTitle(doc, `Replay — ${plan.replay.length} units`, y);
    const w = [28, 48, 66, 50, 70];
    y = tableRow(doc, ['MACHINE', 'CHANNELS', 'CAMERAS RECORDED', 'OPERATOR', 'NOTES'], w, y, 10, true);
    plan.replay.forEach((r: any, i: number) => {
      ensureRoom(8, 'Replay (cont.)');
      y = tableRow(doc, [
        (r.machine || '').slice(0, 16),
        (r.channels || '').slice(0, 30),
        (r.cameras || '').slice(0, 44),
        (r.operator || '').slice(0, 32),
        (r.notes || '').slice(0, 46),
      ], w, y, 10, false, i % 2 === 1);
    });
    y += 4;
  }

  /* Graphics */
  if (plan.graphics.length > 0) {
    ensureRoom(24);
    y = sectionTitle(doc, `Graphics Package — ${plan.graphics.length}`, y);
    const w = [44, 72, 26, 26, 40, 22, 32];
    y = tableRow(doc, ['TRIGGER / EVENT', 'GRAPHIC', 'TYPE', 'SOURCE', 'OPERATOR', 'STATUS', 'NOTES'], w, y, 10, true);
    plan.graphics.forEach((g: any, i: number) => {
      ensureRoom(8, 'Graphics Package (cont.)');
      y = tableRow(doc, [
        (g.trigger || '').slice(0, 30),
        (g.name || '').slice(0, 50),
        (g.type || '').slice(0, 14),
        (g.source || '').slice(0, 14),
        (g.operator || '').slice(0, 26),
        (g.status || '').toUpperCase().slice(0, 10),
        (g.notes || '').slice(0, 20),
      ], w, y, 10, false, i % 2 === 1);
    });
    y += 4;
  }

  /* Feeds */
  if (plan.feeds.length > 0) {
    ensureRoom(24);
    y = sectionTitle(doc, `Transmission & Network Circuits — ${plan.feeds.length}`, y);
    const w = [46, 14, 42, 70, 22, 68];
    y = tableRow(doc, ['CIRCUIT', 'DIR', 'PATH', 'ENDPOINT / CONTACT', 'TESTED', 'NOTES'], w, y, 10, true);
    plan.feeds.forEach((f: any, i: number) => {
      ensureRoom(8, 'Circuits (cont.)');
      y = tableRow(doc, [
        (f.circuit || '').slice(0, 30),
        (f.direction || '').toUpperCase().slice(0, 4),
        (f.path || '').slice(0, 28),
        (f.endpoint || '').slice(0, 48),
        f.tested ? 'YES' : 'NO',
        (f.notes || '').slice(0, 44),
      ], w, y, 10, false, i % 2 === 1);
    });
    y += 4;
  }

  const date = production.start_date || new Date().toISOString().slice(0, 10);
  return save(doc, `broadcast-plan-${(production.name || 'show').replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`, preview);
}

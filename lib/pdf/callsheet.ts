import { jsPDF } from 'jspdf';
import { PDFContext, save } from './base';
import { DEPARTMENTS } from '../departments';

/* ── helpers ─────────────────────────────────────── */
function bold(doc: jsPDF) { doc.setFont('helvetica', 'bold'); }
function normal(doc: jsPDF) { doc.setFont('helvetica', 'normal'); }
function section(doc: jsPDF, title: string, y: number, pageW: number): number {
  doc.setFillColor(30, 30, 30);
  doc.rect(10, y, pageW - 20, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  bold(doc);
  doc.text(title.toUpperCase(), 13, y + 4.2);
  doc.setTextColor(0, 0, 0);
  normal(doc);
  return y + 6;
}
function hdrRow(doc: jsPDF, cols: string[], xs: number[], y: number) {
  doc.setFillColor(235, 235, 235);
  doc.rect(10, y, xs[xs.length - 1] + 20 - 10, 5.5, 'F');
  doc.setFontSize(7);
  bold(doc);
  doc.setTextColor(60, 60, 60);
  cols.forEach((c, i) => doc.text(c.toUpperCase(), xs[i], y + 3.8));
  doc.setTextColor(0, 0, 0);
  normal(doc);
  return y + 5.5;
}
function dataRow(doc: jsPDF, cols: string[], xs: number[], y: number, shade: boolean): number {
  if (shade) { doc.setFillColor(250, 250, 250); doc.rect(10, y, xs[xs.length - 1] + 20 - 10, 5.5, 'F'); }
  doc.setFontSize(7.5);
  cols.forEach((c, i) => doc.text(c || '—', xs[i], y + 3.8));
  return y + 5.5;
}
function maybeNewPage(doc: jsPDF, y: number, margin = 260): number {
  if (y > margin) { doc.addPage(); return 18; }
  return y;
}
/* ─────────────────────────────────────────────────── */

export async function generateCallSheet({ production, crew, locations, inventory, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* ── TOP HEADER BAR ── */
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  bold(doc);
  doc.text('PRO-LOGIC STUDIO', 10, 8);
  doc.setFontSize(8);
  normal(doc);
  doc.text('Call Sheet  ·  CONFIDENTIAL', pageW / 2, 8, { align: 'center' });
  doc.text(production.name || '', pageW - 10, 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  let y = 16;

  /* ── THREE-COLUMN INFO BLOCK ── */
  const colW = (pageW - 20) / 3;

  // Left: production details
  doc.setFillColor(248, 248, 248);
  doc.rect(10, y, colW - 2, 52, 'F');
  doc.setFontSize(8);
  const leftX = 13;
  let ly = y + 5;
  const infoLine = (label: string, val: string) => {
    bold(doc); doc.text(label + ':', leftX, ly); normal(doc);
    const wrapped = doc.splitTextToSize(val || '—', colW - 14);
    doc.text(wrapped[0] || '—', leftX + 22, ly);
    ly += 5.5;
  };
  infoLine('Production', production.name || '');
  infoLine('Client', production.client || '');
  infoLine('Agency', production.agency || '');
  infoLine('Director', production.director || '');
  infoLine('Producer', production.producer || '');
  infoLine('Line Prod.', production.line_producer || '');
  infoLine('Prod. Mgr', production.production_manager || '');
  infoLine('Status', production.status || '');

  // Center: call time + date
  const cx = 10 + colW + 1;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx, y, colW - 2, 52, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.rect(cx, y, colW - 2, 52);
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(8);
  bold(doc);
  doc.text('GENERAL CALL TIME', cx + (colW - 2) / 2, y + 8, { align: 'center' });
  doc.setFontSize(28);
  doc.text(production.call_time || '7:00 AM', cx + (colW - 2) / 2, y + 26, { align: 'center' });
  doc.setFontSize(8);
  normal(doc);
  doc.text(dateStr, cx + (colW - 2) / 2, y + 34, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const safety = 'Safety first. All crew must follow set safety protocols.';
  doc.text(safety, cx + (colW - 2) / 2, y + 42, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Right: call times table
  const rx = 10 + colW * 2 + 2;
  doc.setFillColor(248, 248, 248);
  doc.rect(rx, y, colW - 2, 52, 'F');
  doc.setFontSize(8.5);
  bold(doc);
  doc.text('CALL TIMES', rx + (colW - 2) / 2, y + 6, { align: 'center' });
  normal(doc);
  const callTimes = [
    ['Crew Call', production.call_time || '7:00 AM'],
    ['Talent Call', production.call_time ? addMinutes(production.call_time, 60) : '8:00 AM'],
    ['Shooting Call', production.call_time ? addMinutes(production.call_time, 120) : '9:00 AM'],
    ['Lunch', '12:00 PM'],
    ['Est. Wrap', production.wrap_time || '6:00 PM'],
  ];
  let ry = y + 12;
  doc.setFontSize(8);
  callTimes.forEach(([label, time], idx) => {
    if (idx % 2 === 0) { doc.setFillColor(240, 240, 240); doc.rect(rx, ry - 3.5, colW - 2, 5.5, 'F'); }
    bold(doc); doc.text(label + ':', rx + 3, ry); normal(doc);
    doc.text(time, rx + colW - 5, ry, { align: 'right' });
    ry += 7;
  });

  y += 56;

  /* ── LOCATIONS ── */
  y = section(doc, 'Locations', y, pageW);
  const locAssigned = production.location_id
    ? locations.filter((l: any) => l.id === production.location_id)
    : locations.slice(0, 3);

  if (locAssigned.length > 0) {
    const lxs = [13, 13 + 58, 13 + 116, 13 + 162];
    y = hdrRow(doc, ['#', 'Set Location', 'Parking', 'Nearest Hospital'], lxs, y);
    locAssigned.forEach((loc: any, idx: number) => {
      y = maybeNewPage(doc, y);
      if (idx % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(10, y, pageW - 20, 8, 'F'); }
      doc.setFontSize(7.5);
      bold(doc); doc.text(String(idx + 1), lxs[0], y + 5); normal(doc);
      doc.setTextColor(0, 80, 180);
      doc.text(loc.name || '', lxs[1], y + 3); doc.setTextColor(80, 80, 80);
      doc.text([loc.address || '', [loc.city, loc.state].filter(Boolean).join(', ')].filter(Boolean).join('\n'), lxs[1], y + 6.5, { maxWidth: 54 });
      doc.setTextColor(0, 0, 0);
      doc.text(loc.parking_info || '—', lxs[2], y + 5, { maxWidth: 44 });
      doc.text(loc.nearest_hospital || '—', lxs[3], y + 5, { maxWidth: 40 });
      y += 10;
    });
  } else {
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(production.primary_location || 'See production notes for location details', 13, y + 5);
    doc.setTextColor(0, 0, 0); y += 10;
  }
  y += 3;

  /* ── CAST ── */
  const cast = crew.filter((c: any) => c.department === 'cast' || c.classification === 'Cast');
  if (cast.length > 0) {
    y = maybeNewPage(doc, y);
    y = section(doc, `Cast — ${cast.length} Total`, y, pageW);
    const cxs = [13, 33, 73, 113, 133, 153, 168, 183, 197];
    y = hdrRow(doc, ['ID', 'Name', 'Role', 'Status', 'Pickup', 'Call', 'H/MU', 'On Set', 'Wrap'], cxs, y);
    cast.forEach((c: any, idx: number) => {
      y = maybeNewPage(doc, y);
      y = dataRow(doc, [
        String(idx + 1),
        `${c.name} ${c.last_name}`,
        c.role || '—',
        c.status || '—',
        '—', production.call_time || '—',
        production.call_time ? addMinutes(production.call_time, -30) : '—',
        production.call_time || '—',
        production.wrap_time || '—',
      ], cxs, y, idx % 2 === 1);
    });
    y += 4;
  }

  /* ── CREW BY DEPARTMENT ── */
  y = maybeNewPage(doc, y);
  const crewCols = (pageW - 20) / 2;
  const crewByDept = DEPARTMENTS.map((d: any) => ({
    ...d,
    members: crew.filter((c: any) => (c.department || 'other') === d.id && c.classification !== 'Cast'),
  })).filter((d: any) => d.members.length > 0);

  if (crewByDept.length > 0) {
    y = section(doc, `Crew — ${crew.filter((c: any) => c.classification !== 'Cast').length} Total`, y, pageW);
    let col = 0;
    for (const dept of crewByDept) {
      y = maybeNewPage(doc, y);
      const dx = col === 0 ? 10 : 10 + crewCols + 2;
      const dw = crewCols - 1;
      doc.setFillColor(40, 40, 40);
      doc.rect(dx, y, dw, 5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); bold(doc);
      doc.text(dept.label.toUpperCase(), dx + 2, y + 3.5);
      doc.setTextColor(0, 0, 0); normal(doc);
      let dy = y + 5;
      dept.members.forEach((c: any, idx: number) => {
        if (idx % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(dx, dy, dw, 5, 'F'); }
        doc.setFontSize(7.5);
        doc.text(`${c.name} ${c.last_name}`, dx + 2, dy + 3.5);
        doc.setTextColor(100, 100, 100); doc.setFontSize(6.5);
        doc.text(c.role || '', dx + 2, dy + 7); doc.setTextColor(0, 0, 0);
        doc.setFontSize(7.5);
        doc.text(production.call_time || '—', dx + dw - 2, dy + 3.5, { align: 'right' });
        dy += 9;
      });
      if (col === 0) { col = 1; } else { col = 0; y = dy + 2; }
    }
    if (col === 1) y += 20;
  }

  y += 4;

  /* ── NOTES ── */
  if (production.notes) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Production Notes', y, pageW);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(production.notes, pageW - 22);
    doc.text(lines, 13, y + 4);
    y += lines.length * 4.5 + 4;
  }

  return save(doc, `call-sheet-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

function addMinutes(timeStr: string, mins: number): string {
  try {
    const [h, mRaw] = timeStr.split(':');
    const ampm = mRaw?.slice(-2).toLowerCase();
    const m = parseInt(mRaw);
    let hour = parseInt(h) + (ampm === 'pm' && parseInt(h) !== 12 ? 12 : 0) + (ampm === 'am' && parseInt(h) === 12 ? -12 : 0);
    const total = hour * 60 + (isNaN(m) ? 0 : m % 60) + mins;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    const suffix = nh >= 12 ? 'PM' : 'AM';
    const displayH = nh % 12 || 12;
    return `${displayH}:${String(nm).padStart(2, '0')} ${suffix}`;
  } catch { return timeStr; }
}

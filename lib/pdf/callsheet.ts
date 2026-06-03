import { jsPDF } from 'jspdf';
import { PDFContext, save } from './base';
import { DEPARTMENTS } from '../departments';
import QRCode from 'qrcode';

/* ── Image loader ───────────────────────────────── */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/* ── Map image via our proxy (avoids CORS) ── */
async function fetchMapDataUrl(address: string): Promise<string | null> {
  try {
    return await toDataUrl(`/api/map?address=${encodeURIComponent(address)}`);
  } catch { return null; }
}

/* ── Weather icon helper ─────────────────────────── */
function weatherIcon(description: string): string {
  const d = description.toLowerCase();
  if (d.includes('thunder')) return '⛈';
  if (d.includes('snow') || d.includes('blizzard')) return '❄️';
  if (d.includes('heavy rain') || d.includes('heavy shower')) return '🌧';
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌦';
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return '🌫';
  if (d.includes('overcast') || d.includes('cloudy')) return '☁️';
  if (d.includes('partly') || d.includes('mainly clear')) return '⛅';
  if (d.includes('wind')) return '💨';
  return '☀️';
}

/* ── PDF helpers ────────────────────────────────── */
function bold(doc: jsPDF) { doc.setFont('helvetica', 'bold'); }
function normal(doc: jsPDF) { doc.setFont('helvetica', 'normal'); }

function section(doc: jsPDF, title: string, count: string, y: number, pageW: number): number {
  doc.setFillColor(20, 20, 20);
  doc.rect(10, y, pageW - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  bold(doc);
  doc.text(title.toUpperCase(), 13, y + 5);
  doc.setFontSize(7.5);
  normal(doc);
  doc.text(count, pageW - 12, y + 5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  return y + 7;
}

function hdrRow(doc: jsPDF, cols: string[], xs: number[], y: number, endX: number) {
  doc.setFillColor(230, 230, 230);
  doc.rect(10, y, endX - 10, 5.5, 'F');
  doc.setFontSize(6.5); bold(doc);
  doc.setTextColor(50, 50, 50);
  cols.forEach((c, i) => doc.text(c.toUpperCase(), xs[i], y + 3.8));
  doc.setTextColor(0, 0, 0); normal(doc);
  return y + 5.5;
}

function dataRow(doc: jsPDF, cols: string[], xs: number[], maxWidths: number[], y: number, shade: boolean, endX: number): number {
  if (shade) { doc.setFillColor(248, 248, 248); doc.rect(10, y, endX - 10, 5.5, 'F'); }
  doc.setFontSize(7.5);
  cols.forEach((c, i) => {
    const text = doc.splitTextToSize(c || '—', maxWidths[i]);
    doc.text(text[0], xs[i], y + 3.8);
  });
  return y + 5.5;
}

function maybeNewPage(doc: jsPDF, y: number, margin = 258): number {
  if (y > margin) { doc.addPage(); return 16; }
  return y;
}

/* ── MAIN GENERATOR ─────────────────────────────── */
export async function generateCallSheet({ production, crew, locations, inventory, preview, weather, company }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  const shootDate = production.start_date
    ? new Date(production.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* ── PRE-FETCH IMAGES ── */
  const [proLogicLogo, companyLogo] = await Promise.all([
    toDataUrl('/logo.png'),
    company?.logo_url ? toDataUrl(company.logo_url) : Promise.resolve(null),
  ]);

  // Fetch crew avatars (limit to 20 for performance)
  const crewWithPhotos = await Promise.all(
    crew.slice(0, 20).map(async (c: any) => ({
      ...c,
      photoData: c.picture ? await toDataUrl(c.picture) : null,
    }))
  );

  // Fetch map for primary location
  const locAssigned = production.location_id
    ? locations.filter((l: any) => l.id === production.location_id)
    : locations.slice(0, 3);
  const primaryLoc = locAssigned[0];
  const mapAddr = primaryLoc
    ? [primaryLoc.address, primaryLoc.city, primaryLoc.state, primaryLoc.country].filter(Boolean).join(', ')
    : production.city || production.primary_location || '';
  const mapDataUrl = mapAddr ? await fetchMapDataUrl(mapAddr) : null;

  // QR Code with production info
  const qrText = JSON.stringify({
    production: production.name,
    client: production.client,
    date: production.start_date,
    callTime: production.call_time,
    location: mapAddr,
    director: production.director,
    producer: production.producer,
  });
  const qrDataUrl = await QRCode.toDataURL(qrText, { width: 128, margin: 1 });

  /* ── PAGE 1: HEADER ── */
  let y = 0;

  // Dark header bar
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageW, 18, 'F');

  // Company logo (left)
  if (companyLogo) {
    doc.addImage(companyLogo, 'PNG', 10, 2, 35, 14, undefined, 'FAST');
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12); bold(doc);
    doc.text(company?.name || 'PRODUCTION CO.', 12, 8);
    doc.setFontSize(8); normal(doc);
    doc.text(company?.tagline || 'Studio Management', 12, 14);
  }

  // Pro-Logic logo (right)
  if (proLogicLogo) {
    doc.addImage(proLogicLogo, 'PNG', pageW - 48, 2, 38, 14, undefined, 'FAST');
  } else {
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); bold(doc);
    doc.text('PRO-LOGIC', pageW - 12, 10, { align: 'right' });
  }

  // Center: CALL SHEET label
  doc.setTextColor(200, 200, 200); doc.setFontSize(8); normal(doc);
  doc.text('CALL SHEET  ·  CONFIDENTIAL', pageW / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y = 22;

  /* ── THREE-COLUMN BLOCK ── */
  const colW = (pageW - 20) / 3;
  const blockH = weather ? 66 : 56;

  // Left: production + studio info
  doc.setFillColor(248, 248, 248);
  doc.rect(10, y, colW - 2, blockH, 'F');
  doc.setFontSize(7.5); let ly = y + 5;
  const inf = (label: string, val: string) => {
    if (!val) return;
    bold(doc); doc.text(`${label}:`, 12, ly);
    normal(doc);
    const w = doc.splitTextToSize(val, colW - 26);
    doc.text(w[0], 12 + 22, ly);
    ly += 5;
  };
  inf('Production', production.name || '');
  inf('Client', production.client || '');
  inf('Agency', production.agency || '');
  if (company?.name) { inf('Studio', company.name); }
  if (company?.address) { inf('Address', [company.address, company.city, company.state].filter(Boolean).join(', ')); }
  if (company?.phone) { inf('Phone', company.phone); }
  inf('Director', production.director || '');
  inf('Producer', production.producer || '');
  inf('Line Prod.', production.line_producer || '');
  inf('Prod. Mgr', production.production_manager || '');

  // Center: call time + date + weather
  const cx = 10 + colW + 1;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx, y, colW - 2, blockH, 'F');
  doc.setDrawColor(210, 210, 210);
  doc.rect(cx, y, colW - 2, blockH);
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(30, 30, 30); bold(doc);
  doc.setFontSize(7.5);
  doc.text('GENERAL CALL TIME', cx + (colW - 2) / 2, y + 8, { align: 'center' });
  doc.setFontSize(26);
  doc.text(production.call_time || '7:00 AM', cx + (colW - 2) / 2, y + 24, { align: 'center' });
  doc.setFontSize(7.5); normal(doc);
  doc.text(shootDate, cx + (colW - 2) / 2, y + 32, { align: 'center' });
  doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
  doc.text('Safety first. Follow all on-set safety protocols.', cx + (colW - 2) / 2, y + 40, { align: 'center' });
  // Weather with icons
  if (weather) {
    const wIcon = weatherIcon(weather.description);
    doc.setFontSize(11);
    doc.text(wIcon, cx + 4, y + 50);
    doc.setFontSize(8); bold(doc); doc.setTextColor(30, 70, 180);
    doc.text(`${weather.temp_high}° / ${weather.temp_low}°F`, cx + 12, y + 50);
    doc.setFontSize(6.5); normal(doc); doc.setTextColor(80, 80, 80);
    doc.text(weather.description, cx + 12, y + 54.5);
    doc.setFontSize(6); doc.setTextColor(0, 120, 200);
    doc.text(`💧 ${weather.precipitation}% · 💨 ${weather.wind_speed || '—'} mph`, cx + 12, y + 59);
  }
  doc.setTextColor(0, 0, 0);

  // Right: call times only (no QR here)
  const rx = 10 + colW * 2 + 2;
  doc.setFillColor(248, 248, 248);
  doc.rect(rx, y, colW - 2, blockH, 'F');
  bold(doc); doc.setFontSize(7.5);
  doc.text('CALL TIMES', rx + (colW - 2) / 2, y + 6, { align: 'center' });
  normal(doc);
  const callTimes: [string, string][] = [
    ['Crew Call', production.call_time || '7:00 AM'],
    ['Talent Call', production.call_time ? addMins(production.call_time, 60) : '8:00 AM'],
    ['Shooting', production.call_time ? addMins(production.call_time, 120) : '9:00 AM'],
    ['Lunch', '12:00 PM'],
    ['Est. Wrap', production.wrap_time || '6:00 PM'],
  ];
  let ry = y + 11;
  doc.setFontSize(7);
  callTimes.forEach(([label, time], i) => {
    if (i % 2 === 0) { doc.setFillColor(238, 238, 238); doc.rect(rx, ry - 3.5, colW - 2, 5.5, 'F'); }
    bold(doc); doc.text(label + ':', rx + 2, ry);
    normal(doc); doc.text(time, rx + colW - 4, ry, { align: 'right' });
    ry += 6;
  });

  y += blockH + 4;

  /* ── MAP + LOCATIONS ── */
  const locCount = locAssigned.length;
  const mapW = 60;
  const mapH = 40;

  // Map image on the right side
  if (mapDataUrl) {
    try {
      doc.addImage(mapDataUrl, 'PNG', pageW - 10 - mapW, y, mapW, mapH, undefined, 'FAST');
      doc.setDrawColor(200, 200, 200);
      doc.rect(pageW - 10 - mapW, y, mapW, mapH);
      doc.setDrawColor(0, 0, 0);
    } catch {}
  }

  y = section(doc, 'Locations', `${locCount} Total`, y, mapDataUrl ? pageW - mapW - 14 : pageW);
  const lxs = [13, 30, 88, 145];
  const lEndX = mapDataUrl ? pageW - mapW - 14 : pageW - 10;
  y = hdrRow(doc, ['#', 'Set Location', 'Parking', 'Nearest Hospital'], lxs, y, lEndX);
  locAssigned.forEach((loc: any, idx: number) => {
    y = maybeNewPage(doc, y);
    if (idx % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(10, y, lEndX - 10, 10, 'F'); }
    doc.setFontSize(7.5);
    bold(doc); doc.text(String(idx + 1), lxs[0], y + 4); normal(doc);
    doc.setTextColor(0, 80, 180);
    doc.text(loc.name || '', lxs[1], y + 3.5);
    doc.setTextColor(80, 80, 80); doc.setFontSize(6.5);
    const locAddr = [loc.address, [loc.city, loc.state].filter(Boolean).join(', ')].filter(Boolean).join('\n');
    doc.text(locAddr, lxs[1], y + 7, { maxWidth: 54 });
    doc.setTextColor(0, 0, 0); doc.setFontSize(7);
    doc.text(loc.parking_info || '—', lxs[2], y + 5, { maxWidth: 50 });
    doc.text(loc.nearest_hospital || '—', lxs[3], y + 5, { maxWidth: 50 });
    y += 11;
  });

  if (mapDataUrl) y = Math.max(y, section.length > 0 ? y : 0);
  y += 4;

  /* ── CAST ── */
  const cast = crewWithPhotos.filter((c: any) => c.department === 'cast' || c.classification === 'Cast');
  if (cast.length > 0) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Cast', `${cast.length} Total Cast`, y, pageW);
    const cxs = [13, 25, 62, 99, 117, 133, 149, 163, 178, 193];
    y = hdrRow(doc, ['', 'Name', 'Role', 'Status', 'Pickup', 'Call', 'H/MU', 'On Set', 'Wrap'], cxs.slice(0,9), y, pageW - 10);
    cast.forEach((c: any, idx: number) => {
      y = maybeNewPage(doc, y);
      const rowH = 10;
      if (idx % 2 === 1) { doc.setFillColor(248, 248, 248); doc.rect(10, y, pageW - 20, rowH, 'F'); }
      // Avatar
      if (c.photoData) {
        try { doc.addImage(c.photoData, 'JPEG', cxs[0], y + 0.5, 9, 9, undefined, 'FAST'); } catch {}
      } else {
        doc.setFillColor(200, 200, 200); doc.circle(cxs[0] + 4.5, y + 5, 4.5, 'F');
      }
      doc.setFontSize(7.5); normal(doc);
      doc.text(`${c.name} ${c.last_name}`, cxs[1], y + 5);
      doc.text(c.role || '—', cxs[2], y + 5);
      doc.text(c.status || '—', cxs[3], y + 5);
      doc.text('—', cxs[4], y + 5);
      doc.text(production.call_time || '—', cxs[5], y + 5);
      doc.text(production.call_time ? addMins(production.call_time, -30) : '—', cxs[6], y + 5);
      doc.text(production.call_time || '—', cxs[7], y + 5);
      doc.text(production.wrap_time || '—', cxs[8], y + 5);
      y += rowH;
    });
    y += 4;
  }

  /* ── CREW BY DEPARTMENT ── */
  const crewOnly = crewWithPhotos.filter((c: any) => c.classification !== 'Cast' && c.department !== 'cast');
  if (crewOnly.length > 0) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Crew', `${crewOnly.length} Total Crew`, y, pageW);
    const halfW = (pageW - 22) / 2;

    const crewByDept = DEPARTMENTS.map((d: any) => ({
      ...d,
      members: crewOnly.filter((c: any) => (c.department || 'other') === d.id),
    })).filter((d: any) => d.members.length > 0);

    let col = 0;
    let colY = [y, y];

    for (const dept of crewByDept) {
      const dx = col === 0 ? 10 : 12 + halfW;
      y = maybeNewPage(doc, colY[col]);

      // Department header
      doc.setFillColor(30, 30, 30);
      doc.rect(dx, colY[col], halfW, 5.5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); bold(doc);
      doc.text(dept.label.toUpperCase(), dx + 2, colY[col] + 4);
      doc.setTextColor(0, 0, 0); normal(doc);
      colY[col] += 5.5;

      for (const c of dept.members) {
        colY[col] = maybeNewPage(doc, colY[col]);
        const rowH = 11;
        const isEven = dept.members.indexOf(c) % 2 === 0;
        if (isEven) { doc.setFillColor(248, 248, 248); doc.rect(dx, colY[col], halfW, rowH, 'F'); }

        // Avatar
        if (c.photoData) {
          try { doc.addImage(c.photoData, 'JPEG', dx + 1, colY[col] + 1, 8, 8, undefined, 'FAST'); } catch {}
        } else {
          doc.setFillColor(180, 180, 180); doc.circle(dx + 5, colY[col] + 5.5, 4, 'F');
        }

        doc.setFontSize(7.5); bold(doc);
        doc.text(`${c.name} ${c.last_name}`, dx + 11, colY[col] + 4.5);
        doc.setFontSize(6.5); normal(doc); doc.setTextColor(100, 100, 100);
        doc.text(c.role || '', dx + 11, colY[col] + 8.5);
        doc.setTextColor(0, 0, 0);
        bold(doc); doc.setFontSize(7.5);
        doc.text(production.call_time || '—', dx + halfW - 2, colY[col] + 4.5, { align: 'right' });
        normal(doc);
        colY[col] += rowH;
      }
      colY[col] += 2;
      col = col === 0 ? 1 : 0;
    }
    y = Math.max(colY[0], colY[1]) + 4;
  }

  /* ── FOOTER: QR reminder ── */
  y = maybeNewPage(doc, y);
  doc.setFillColor(240, 240, 240); doc.rect(10, y, pageW - 20, 14, 'F');
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 13, y + 1, 12, 12);
    doc.setFontSize(7); bold(doc);
    doc.text('Scan QR to import production info to your device', 28, y + 6);
    normal(doc); doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
    doc.text(`Production: ${production.name}  ·  Call: ${production.call_time || '—'}  ·  ${shootDate}`, 28, y + 10);
    doc.setTextColor(0, 0, 0);
  }

  return save(doc, `call-sheet-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

function addMins(timeStr: string, mins: number): string {
  try {
    const upper = timeStr.toUpperCase();
    const ampm = upper.includes('PM') ? 'PM' : upper.includes('AM') ? 'AM' : '';
    const [h, mRaw] = timeStr.replace(/[APMapm]/gi, '').trim().split(':');
    let hour = parseInt(h);
    const m = parseInt(mRaw) || 0;
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const total = hour * 60 + m + mins;
    const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
    const nm = ((total % 60) + 60) % 60;
    const suf = nh >= 12 ? 'PM' : 'AM';
    const dh = nh % 12 || 12;
    return `${dh}:${String(nm).padStart(2, '0')} ${suf}`;
  } catch { return timeStr; }
}

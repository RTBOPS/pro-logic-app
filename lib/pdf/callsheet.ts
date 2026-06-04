import { jsPDF } from 'jspdf';
import { PDFContext, save } from './base';
import { DEPARTMENTS } from '../departments';
import QRCode from 'qrcode';

/* ── Image loader (Firebase Storage + own origin only) ── */
async function toDataUrl(url: string): Promise<string | null> {
  const safe = url.startsWith('/') ||
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('storage.googleapis.com');
  if (!safe) return null;
  try {
    const res = await fetch(url);
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

/* ── Map image via proxy ── */
async function fetchMapDataUrl(address: string): Promise<string | null> {
  try { return await toDataUrl(`/api/map?address=${encodeURIComponent(address)}`); }
  catch { return null; }
}

/* ── Draw initials avatar (when no photo) ── */
function drawInitialsAvatar(doc: jsPDF, x: number, y: number, size: number, name: string, color: string) {
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const r = parseInt(color.slice(1, 3), 16) || 100;
  const g = parseInt(color.slice(3, 5), 16) || 100;
  const b = parseInt(color.slice(5, 7), 16) || 100;
  doc.setFillColor(r, g, b);
  doc.circle(x + size / 2, y + size / 2, size / 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(size * 0.38);
  doc.setFont('helvetica', 'bold');
  doc.text(initials || '?', x + size / 2, y + size / 2 + size * 0.14, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
}

/* ── Draw weather icon using only valid jsPDF primitives ── */
function drawWeatherIcon(doc: jsPDF, x: number, y: number, description: string, size: number = 10) {
  const d = description.toLowerCase();
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;

  doc.setLineWidth(0.4);

  if (d.includes('thunder') || d.includes('storm')) {
    // Dark cloud
    doc.setFillColor(80, 90, 110); doc.ellipse(cx - 1, cy - 1, r * 0.8, r * 0.45, 'F');
    doc.setFillColor(60, 70, 90); doc.ellipse(cx + 1.5, cy - 2.5, r * 0.55, r * 0.4, 'F');
    // Lightning bolt using lines
    doc.setDrawColor(255, 200, 0); doc.setLineWidth(1.2);
    doc.line(cx - 0.5, cy, cx - 2, cy + 3.5);
    doc.line(cx - 2, cy + 3.5, cx + 0.5, cy + 3.5);
    doc.line(cx + 0.5, cy + 3.5, cx - 0.5, cy + size - 1);
    doc.setLineWidth(0.4);
  } else if (d.includes('snow') || d.includes('blizzard')) {
    // Cloud + snow dots
    doc.setFillColor(160, 180, 210); doc.ellipse(cx, cy - 1.5, r * 0.85, r * 0.5, 'F');
    doc.setFillColor(180, 210, 240);
    for (let i = 0; i < 3; i++) {
      doc.circle(cx - 2.5 + i * 2.5, cy + 3.5, 0.8, 'F');
      doc.circle(cx - 1.25 + i * 2.5, cy + 5.5, 0.8, 'F');
    }
  } else if (d.includes('heavy rain') || d.includes('heavy shower') || d.includes('drizzle') || d.includes('rain') || d.includes('shower')) {
    // Cloud + rain lines
    doc.setFillColor(120, 150, 190); doc.ellipse(cx, cy - 1, r * 0.85, r * 0.5, 'F');
    doc.setDrawColor(60, 120, 200); doc.setLineWidth(0.8);
    for (let i = 0; i < 4; i++) {
      const rx = cx - 3.5 + i * 2.2;
      doc.line(rx, cy + 2, rx - 0.8, cy + 5);
    }
    doc.setLineWidth(0.4);
  } else if (d.includes('fog') || d.includes('mist') || d.includes('haze')) {
    // Horizontal fog lines
    doc.setDrawColor(150, 155, 165); doc.setLineWidth(1.2);
    doc.line(x + 0.5, y + 2.5, x + size - 0.5, y + 2.5);
    doc.line(x + 1.5, y + 5, x + size - 1.5, y + 5);
    doc.line(x + 0.5, y + 7.5, x + size - 0.5, y + 7.5);
    doc.setLineWidth(0.4);
  } else if (d.includes('overcast') || (d.includes('cloud') && !d.includes('partly'))) {
    // Double overlapping clouds
    doc.setFillColor(160, 165, 175); doc.ellipse(cx - 1.5, cy + 0.5, r * 0.8, r * 0.5, 'F');
    doc.setFillColor(185, 190, 200); doc.ellipse(cx + 1.5, cy - 1.5, r * 0.65, r * 0.45, 'F');
  } else if (d.includes('partly') || d.includes('mainly clear')) {
    // Sun + cloud
    doc.setFillColor(255, 190, 0); doc.circle(cx - 2, cy - 2, r * 0.4, 'F');
    doc.setDrawColor(255, 160, 0); doc.setLineWidth(0.7);
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 20) * Math.PI / 180;
      doc.line(cx - 2 + Math.cos(angle) * r * 0.52, cy - 2 + Math.sin(angle) * r * 0.52,
               cx - 2 + Math.cos(angle) * r * 0.82, cy - 2 + Math.sin(angle) * r * 0.82);
    }
    doc.setLineWidth(0.4);
    doc.setFillColor(200, 205, 215); doc.ellipse(cx + 1.5, cy + 1.5, r * 0.72, r * 0.46, 'F');
  } else {
    // Clear / sunny: circle with 8 rays
    doc.setFillColor(255, 195, 0); doc.circle(cx, cy, r * 0.42, 'F');
    doc.setDrawColor(255, 165, 0); doc.setLineWidth(0.7);
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45) * Math.PI / 180;
      doc.line(cx + Math.cos(angle) * r * 0.55, cy + Math.sin(angle) * r * 0.55,
               cx + Math.cos(angle) * r * 0.9, cy + Math.sin(angle) * r * 0.9);
    }
    doc.setLineWidth(0.4);
  }
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
}

/* ── PDF helpers ────────────────────────────────── */
function bold(doc: jsPDF) { doc.setFont('helvetica', 'bold'); }
function normal(doc: jsPDF) { doc.setFont('helvetica', 'normal'); }

function section(doc: jsPDF, title: string, count: string, y: number, pageW: number): number {
  doc.setFillColor(20, 20, 20);
  doc.rect(10, y, pageW - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5); bold(doc);
  doc.text(title.toUpperCase(), 13, y + 5);
  doc.setFontSize(7.5); normal(doc);
  doc.text(count, pageW - 12, y + 5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  return y + 7;
}

function hdrRow(doc: jsPDF, cols: string[], xs: number[], y: number, endX: number) {
  doc.setFillColor(230, 230, 230);
  doc.rect(10, y, endX - 10, 5.5, 'F');
  doc.setFontSize(6.5); bold(doc); doc.setTextColor(50, 50, 50);
  cols.forEach((c, i) => doc.text(c.toUpperCase(), xs[i], y + 3.8));
  doc.setTextColor(0, 0, 0); normal(doc);
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
  const pageH = doc.internal.pageSize.getHeight();

  const shootDate = production.start_date
    ? new Date(production.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* ── PRE-FETCH IMAGES ── */
  const [proLogicLogo, companyLogo, productionImage] = await Promise.all([
    toDataUrl('/logo.png'),
    company?.logo_url ? toDataUrl(company.logo_url) : Promise.resolve(null),
    production.image_url ? toDataUrl(production.image_url) : Promise.resolve(null),
  ]);

  // Crew avatars — only Firebase Storage
  const crewWithPhotos = await Promise.all(
    crew.slice(0, 30).map(async (c: any) => ({
      ...c,
      photoData: c.picture?.includes('firebasestorage') ? await toDataUrl(c.picture) : null,
    }))
  );

  // Single assigned location only
  const primaryLoc = production.location_id
    ? locations.find((l: any) => l.id === production.location_id) || null
    : null;

  // QR Code = Google Calendar link
  const calStart = production.start_date
    ? production.start_date.replace(/-/g, '') + 'T' + (production.call_time || '07:00').replace(/[: APMapm]/g, '').padEnd(6, '0')
    : '';
  const calEnd = production.end_date
    ? production.end_date.replace(/-/g, '') + 'T' + (production.wrap_time || '18:00').replace(/[: APMapm]/g, '').padEnd(6, '0')
    : calStart;
  const calDetails = `${production.name} | Client: ${production.client} | Director: ${production.director || '--'} | Call: ${production.call_time || '--'}`;
  const qrUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(production.name || 'Production')}` +
    (calStart ? `&dates=${calStart}/${calEnd}` : '') +
    `&details=${encodeURIComponent(calDetails)}` +
    (primaryLoc ? `&location=${encodeURIComponent([primaryLoc.address, primaryLoc.city, primaryLoc.state].filter(Boolean).join(', '))}` : '');
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });

  /* ═══════════════════════════════════════════
     HEADER: Company logo | Prod image + title | Call times
  ═══════════════════════════════════════════ */
  let y = 0;

  // Dark header strip
  const headerH = 16;
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Company logo — LEFT
  if (companyLogo) {
    doc.addImage(companyLogo, 'PNG', 10, 2, 40, 12, undefined, 'FAST');
  } else if (company?.name) {
    doc.setTextColor(255, 255, 255); bold(doc); doc.setFontSize(10);
    doc.text(company.name, 12, 10);
  }

  // Center label
  doc.setTextColor(180, 180, 180); normal(doc); doc.setFontSize(7.5);
  doc.text('CALL SHEET  ·  CONFIDENTIAL', pageW / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y = headerH + 3;

  /* ── THREE-COLUMN INFO BLOCK ── */
  const colW = (pageW - 20) / 3;
  const blockH = weather ? 68 : 58;

  // ── LEFT: Production + Studio info ──
  doc.setFillColor(248, 248, 248);
  doc.rect(10, y, colW - 2, blockH, 'F');
  let ly = y + 5; doc.setFontSize(7.5);
  const inf = (label: string, val: string) => {
    if (!val) return;
    bold(doc); doc.text(label + ':', 12, ly); normal(doc);
    doc.text(doc.splitTextToSize(val, colW - 26)[0], 12 + 22, ly);
    ly += 5;
  };
  inf('Production', production.name || '');
  inf('Client', production.client || '');
  if (production.agency) inf('Agency', production.agency);
  if (company?.name) inf('Studio', company.name);
  if (company?.address) inf('Address', [company.address, company.city, company.state].filter(Boolean).join(', '));
  if (company?.phone) inf('Phone', company.phone);
  inf('Director', production.director || '');
  inf('Producer', production.producer || '');
  if (production.line_producer) inf('Line Prod.', production.line_producer);

  // ── CENTER: Production image or title + call time + weather ──
  const cx = 10 + colW + 1;
  const cw = colW - 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx, y, cw, blockH, 'F');
  doc.setDrawColor(210, 210, 210);
  doc.rect(cx, y, cw, blockH);
  doc.setDrawColor(0, 0, 0);

  if (productionImage) {
    // Show production image in top half of center column
    try {
      doc.addImage(productionImage, 'JPEG', cx + 1, y + 1, cw - 2, blockH * 0.42, undefined, 'FAST');
    } catch {}
    // Production name below image
    doc.setFontSize(8); bold(doc); doc.setTextColor(20, 20, 20);
    doc.text(production.name || '', cx + cw / 2, y + blockH * 0.42 + 6, { align: 'center' });
    normal(doc);
  } else {
    // Title only
    doc.setFontSize(7.5); bold(doc); doc.setTextColor(80, 80, 80);
    doc.text('GENERAL CALL TIME', cx + cw / 2, y + 8, { align: 'center' });
    doc.setFontSize(22); doc.setTextColor(10, 10, 10);
    doc.text(production.call_time || '7:00 AM', cx + cw / 2, y + 26, { align: 'center' });
    normal(doc);
  }

  // Date + safety
  doc.setFontSize(7.5); normal(doc); doc.setTextColor(60, 60, 60);
  const callY = productionImage ? y + blockH * 0.42 + 13 : y + 34;
  doc.text(shootDate, cx + cw / 2, callY, { align: 'center' });
  doc.setFontSize(6.5); doc.setTextColor(120, 120, 120);
  doc.text('Safety first. All crew follow on-set protocols.', cx + cw / 2, callY + 6, { align: 'center' });

  // Weather
  if (weather) {
    const wy = callY + 12;
    const iconSize = 11;
    drawWeatherIcon(doc, cx + 3, wy - 2, weather.description, iconSize);
    doc.setFontSize(9); bold(doc); doc.setTextColor(20, 60, 170);
    doc.text(`${weather.temp_high}deg / ${weather.temp_low}deg F`, cx + iconSize + 5, wy + 4);
    doc.setFontSize(7); normal(doc); doc.setTextColor(60, 60, 60);
    doc.text(weather.description, cx + iconSize + 5, wy + 9);
    doc.setFontSize(6.5); doc.setTextColor(0, 100, 180);
    doc.text(`Rain: ${weather.precipitation}%   Wind: ${weather.wind_speed || '--'} mph`, cx + 3, wy + 15);
  }
  doc.setTextColor(0, 0, 0);

  // ── RIGHT: Call times ──
  const rx = 10 + colW * 2 + 2;
  const rw = colW - 2;
  doc.setFillColor(248, 248, 248);
  doc.rect(rx, y, rw, blockH, 'F');
  bold(doc); doc.setFontSize(8);
  doc.text('CALL TIMES', rx + rw / 2, y + 6, { align: 'center' });
  normal(doc);
  const callTimes: [string, string][] = [
    ['Crew Call', production.call_time || '7:00 AM'],
    ['Talent Call', production.call_time ? addMins(production.call_time, 60) : '8:00 AM'],
    ['Shooting', production.call_time ? addMins(production.call_time, 120) : '9:00 AM'],
    ['Lunch', '12:00 PM'],
    ['Est. Wrap', production.wrap_time || '6:00 PM'],
  ];
  let ry2 = y + 12;
  doc.setFontSize(7.5);
  callTimes.forEach(([label, time], i) => {
    if (i % 2 === 0) { doc.setFillColor(238, 238, 238); doc.rect(rx, ry2 - 3.5, rw, 6, 'F'); }
    bold(doc); doc.text(label + ':', rx + 2, ry2);
    normal(doc); doc.text(time, rx + rw - 3, ry2, { align: 'right' });
    ry2 += 7;
  });

  y += blockH + 8;

  /* ═══════════════════════════════════════════
     LOCATION (single — assigned to production)
  ═══════════════════════════════════════════ */
  if (primaryLoc) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Location', '1 Location', y, pageW);
    doc.setFontSize(7.5);
    const lxs = [13, 55, 110, 158];

    // Header row
    doc.setFillColor(230, 230, 230);
    doc.rect(10, y, pageW - 20, 5.5, 'F');
    bold(doc); doc.setTextColor(50, 50, 50); doc.setFontSize(6.5);
    ['SET LOCATION', 'PARKING', 'NEAREST HOSPITAL', 'NOTES'].forEach((h, i) => doc.text(h, lxs[i], y + 3.8));
    doc.setTextColor(0, 0, 0); normal(doc);
    y += 5.5;

    doc.setFontSize(7.5);
    doc.setTextColor(0, 80, 180); bold(doc);
    doc.text(primaryLoc.name || '', lxs[0], y + 4);
    doc.setTextColor(70, 70, 70); normal(doc);
    const addr = [primaryLoc.address, [primaryLoc.city, primaryLoc.state].filter(Boolean).join(', ')].filter(Boolean).join('\n');
    doc.text(addr, lxs[0], y + 8.5, { maxWidth: 40 });
    doc.text(primaryLoc.parking_info || '—', lxs[1], y + 4, { maxWidth: 50 });
    doc.text(primaryLoc.nearest_hospital || '—', lxs[2], y + 4, { maxWidth: 44 });
    doc.text(primaryLoc.notes || '—', lxs[3], y + 4, { maxWidth: 38 });
    y += 18;
  }

  y += 4;

  /* ═══════════════════════════════════════════
     CAST
  ═══════════════════════════════════════════ */
  const cast = crewWithPhotos.filter((c: any) => c.department === 'cast' || c.classification === 'Cast');
  if (cast.length > 0) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Cast', `${cast.length} Total Cast`, y, pageW);
    const cxs = [13, 26, 64, 100, 118, 135, 151, 165, 180, 194];
    y = hdrRow(doc, ['', 'Name', 'Role', 'Status', 'Pickup', 'Call', 'H/MU', 'On Set', 'Wrap'], cxs, y, pageW - 10);
    cast.forEach((c: any, idx: number) => {
      y = maybeNewPage(doc, y);
      const rowH = 11;
      if (idx % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(10, y, pageW - 20, rowH, 'F'); }
      // Avatar
      if (c.photoData) {
        try { doc.addImage(c.photoData, 'JPEG', cxs[0], y + 0.5, 9, 9, undefined, 'FAST'); }
        catch { drawInitialsAvatar(doc, cxs[0], y + 0.5, 9, `${c.name} ${c.last_name}`, '#7c3aed'); }
      } else {
        drawInitialsAvatar(doc, cxs[0], y + 0.5, 9, `${c.name} ${c.last_name}`, '#7c3aed');
      }
      doc.setFontSize(7.5); normal(doc); doc.setTextColor(0, 0, 0);
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

  /* ═══════════════════════════════════════════
     CREW BY DEPARTMENT
  ═══════════════════════════════════════════ */
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
      colY[col] = maybeNewPage(doc, colY[col]);
      // Dept header
      doc.setFillColor(30, 30, 30);
      doc.rect(dx, colY[col], halfW, 5.5, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); bold(doc);
      doc.text(dept.label.toUpperCase(), dx + 2, colY[col] + 4);
      doc.setTextColor(0, 0, 0); normal(doc);
      colY[col] += 5.5;
      for (const c of dept.members) {
        colY[col] = maybeNewPage(doc, colY[col]);
        const rowH = 11;
        if (dept.members.indexOf(c) % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(dx, colY[col], halfW, rowH, 'F'); }
        // Avatar
        if (c.photoData) {
          try { doc.addImage(c.photoData, 'JPEG', dx + 1, colY[col] + 1, 8, 8, undefined, 'FAST'); }
          catch { drawInitialsAvatar(doc, dx + 1, colY[col] + 1.5, 8, `${c.name} ${c.last_name}`, dept.color || '#6b7280'); }
        } else {
          drawInitialsAvatar(doc, dx + 1, colY[col] + 1.5, 8, `${c.name} ${c.last_name}`, dept.color || '#6b7280');
        }
        doc.setFontSize(7.5); bold(doc); doc.setTextColor(20, 20, 20);
        doc.text(`${c.name} ${c.last_name}`, dx + 11, colY[col] + 5);
        doc.setFontSize(6.5); normal(doc); doc.setTextColor(80, 80, 80);
        doc.text(c.role || '', dx + 11, colY[col] + 8.5);
        doc.setTextColor(0, 0, 0);
        bold(doc); doc.setFontSize(7.5);
        doc.text(production.call_time || '—', dx + halfW - 2, colY[col] + 5, { align: 'right' });
        normal(doc);
        colY[col] += rowH;
      }
      colY[col] += 2;
      col = col === 0 ? 1 : 0;
    }
    y = Math.max(colY[0], colY[1]) + 6;
  }

  /* ═══════════════════════════════════════════
     FOOTER: QR (Google Calendar) + PRO-LOGIC
  ═══════════════════════════════════════════ */
  y = maybeNewPage(doc, y, 220);
  const qrSize = 28;
  const footerH = qrSize + 8;
  doc.setFillColor(20, 20, 20);
  doc.rect(10, y, pageW - 20, footerH, 'F');

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 13, y + 4, qrSize, qrSize);
    doc.setFontSize(8); bold(doc); doc.setTextColor(255, 255, 255);
    doc.text('Add to Calendar', 13 + qrSize + 5, y + 12);
    normal(doc); doc.setFontSize(7); doc.setTextColor(180, 180, 180);
    doc.text('Scan with your camera to add this shoot to your calendar.', 13 + qrSize + 5, y + 18);
    doc.setFontSize(7); doc.setTextColor(120, 180, 255);
    doc.text(`${production.name}  |  ${shootDate}  |  Call: ${production.call_time || '--'}`, 13 + qrSize + 5, y + 24);
  }

  // PRO-LOGIC logo bottom right of footer
  if (proLogicLogo) {
    doc.addImage(proLogicLogo, 'PNG', pageW - 50, y + (footerH - 12) / 2, 38, 12, undefined, 'FAST');
  } else {
    doc.setTextColor(150, 150, 150); doc.setFontSize(8); bold(doc);
    doc.text('PRO-LOGIC', pageW - 12, y + footerH / 2 + 2, { align: 'right' });
  }

  doc.setTextColor(0, 0, 0); normal(doc);

  return save(doc, `call-sheet-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

function addMins(timeStr: string, mins: number): string {
  try {
    const upper = timeStr.toUpperCase();
    const ampm = upper.includes('PM') ? 'PM' : upper.includes('AM') ? 'AM' : '';
    const clean = timeStr.replace(/[APMapm\s]/g, '');
    const [h, m] = clean.split(':').map(Number);
    let hour = h;
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const total = hour * 60 + (isNaN(m) ? 0 : m) + mins;
    const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
    const nm = ((total % 60) + 60) % 60;
    const suf = nh >= 12 ? 'PM' : 'AM';
    const dh = nh % 12 || 12;
    return `${dh}:${String(nm).padStart(2, '0')} ${suf}`;
  } catch { return timeStr; }
}

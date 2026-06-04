import { jsPDF } from 'jspdf';
import { PDFContext, save } from './base';
import { DEPARTMENTS } from '../departments';
import QRCode from 'qrcode';

/* ── Image loader ── */
async function toDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    // All URLs (local and external) go through the proxy so the server
    // fetches them without browser CORS restrictions.
    const fetchUrl = url.startsWith('data:') ? null : url.startsWith('/') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
    if (!fetchUrl) return url; // already a data URL
    const res = await fetch(fetchUrl);
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

/* ── Invert image to white for dark backgrounds ── */
async function toWhite(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
  try {
    return await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.filter = 'invert(1) brightness(2)';
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch { return null; }
}

/* ── Draw initials avatar fallback ── */
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

/* ── PDF helpers ── */
function bold(doc: jsPDF) { doc.setFont('helvetica', 'bold'); }
function normal(doc: jsPDF) { doc.setFont('helvetica', 'normal'); }

let _brandR = 20, _brandG = 20, _brandB = 20;
function setBrand(r: number, g: number, b: number) { _brandR = r; _brandG = g; _brandB = b; }

function section(doc: jsPDF, title: string, count: string, y: number, pageW: number): number {
  doc.setFillColor(_brandR, _brandG, _brandB);
  doc.rect(10, y, pageW - 20, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5); bold(doc);
  doc.text(title.toUpperCase(), 13, y + 5);
  doc.setFontSize(7.5); normal(doc);
  doc.text(count, pageW - 12, y + 5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  return y + 7;
}

function deptHeader(doc: jsPDF, label: string, y: number, pageW: number): number {
  doc.setFillColor(40, 40, 40);
  doc.rect(10, y, pageW - 20, 5.5, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); bold(doc);
  doc.text(label.toUpperCase(), 13, y + 4);
  doc.setTextColor(0, 0, 0); normal(doc);
  return y + 5.5;
}

function hdrRow(doc: jsPDF, cols: string[], xs: number[], y: number, pageW: number) {
  doc.setFillColor(230, 230, 230);
  doc.rect(10, y, pageW - 20, 5.5, 'F');
  doc.setFontSize(6.5); bold(doc); doc.setTextColor(50, 50, 50);
  cols.forEach((c, i) => doc.text(c.toUpperCase(), xs[i], y + 3.8));
  doc.setTextColor(0, 0, 0); normal(doc);
  return y + 5.5;
}

function maybeNewPage(doc: jsPDF, y: number, margin = 258): number {
  if (y > margin) { doc.addPage(); return 16; }
  return y;
}

/* ── Shared member row renderer (cast + crew) ── */
function drawMemberRow(
  doc: jsPDF, c: any, y: number, pageW: number, xs: number[],
  wrapTime: string, prodCallTime: string, avatarColor: string, idx: number
) {
  const rowH = 11;
  if (idx % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(10, y, pageW - 20, rowH, 'F'); }
  // Avatar
  if (c.photoData) {
    try { doc.addImage(c.photoData, 'JPEG', xs[0], y + 1, 9, 9, undefined, 'FAST'); }
    catch { drawInitialsAvatar(doc, xs[0], y + 1, 9, `${c.name} ${c.last_name}`, avatarColor); }
  } else {
    drawInitialsAvatar(doc, xs[0], y + 1, 9, `${c.name} ${c.last_name}`, avatarColor);
  }
  const memberCall = c.call_time || prodCallTime || '—';
  doc.setFontSize(7.5); normal(doc); doc.setTextColor(0, 0, 0);
  doc.text(`${c.name} ${c.last_name}`, xs[1], y + 5.5);
  doc.text(c.role || '—', xs[2], y + 5.5);
  doc.text(c.status || c.confirmation_status || '—', xs[3], y + 5.5);
  doc.text(c.pickup || '—', xs[4], y + 5.5);
  bold(doc); doc.setTextColor(20, 60, 160);
  doc.text(memberCall, xs[5], y + 5.5);
  normal(doc); doc.setTextColor(0, 0, 0);
  doc.text(memberCall !== '—' ? addMins(memberCall, -30) : '—', xs[6], y + 5.5);
  doc.text(memberCall, xs[7], y + 5.5);
  doc.text(wrapTime || '—', xs[8], y + 5.5);
  return y + rowH;
}

/* ── MAIN GENERATOR ── */
export async function generateCallSheet({ production, crew, locations, inventory, preview, weather, forecast, company }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  const shootDate = production.start_date
    ? new Date(production.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* ── PRE-FETCH IMAGES ── */
  // Try white SVG logo first; fall back to inverting the black PNG
  const proLogicLogoWhite = await toDataUrl('/logo-white.svg') || await toWhite(await toDataUrl('/logo.png'));
  const [companyLogo, productionImage] = await Promise.all([
    company?.logo_url ? toDataUrl(company.logo_url) : Promise.resolve(null),
    production.image_url ? toDataUrl(production.image_url) : Promise.resolve(null),
  ]);
  const companyLogoWhite = await toWhite(companyLogo);

  // Brand color
  const brandHex = company?.primary_color || '#141414';
  const brandR = parseInt(brandHex.slice(1, 3), 16) || 20;
  const brandG = parseInt(brandHex.slice(3, 5), 16) || 20;
  const brandB = parseInt(brandHex.slice(5, 7), 16) || 20;
  setBrand(brandR, brandG, brandB);

  // Crew photos — load all non-null pictures via proxy
  const crewWithPhotos = await Promise.all(
    crew.slice(0, 40).map(async (c: any) => ({
      ...c,
      photoData: c.picture ? await toDataUrl(c.picture) : null,
    }))
  );

  const primaryLoc = production.location_id
    ? locations.find((l: any) => l.id === production.location_id) || null
    : null;

  // QR
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
     HEADER BAR
  ═══════════════════════════════════════════ */
  let y = 0;
  const headerH = 16;
  doc.setFillColor(brandR, brandG, brandB);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Company logo left
  if (companyLogoWhite) {
    doc.addImage(companyLogoWhite, 'PNG', 8, 2, 40, 12, undefined, 'FAST');
  } else if (companyLogo) {
    doc.addImage(companyLogo, 'PNG', 8, 2, 40, 12, undefined, 'FAST');
  } else if (company?.name) {
    doc.setTextColor(255, 255, 255); bold(doc); doc.setFontSize(10);
    doc.text(company.name, 10, 10);
  }

  // Center label
  doc.setTextColor(200, 200, 200); normal(doc); doc.setFontSize(7.5);
  doc.text('CALL SHEET  ·  CONFIDENTIAL', pageW / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y = headerH + 3;

  /* ═══════════════════════════════════════════
     THREE-COLUMN INFO BLOCK
  ═══════════════════════════════════════════ */
  const colW = (pageW - 20) / 3;
  const blockH = weather ? 68 : 58;

  // LEFT: Production info
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

  // CENTER: Call time + weather
  const cx = 10 + colW + 1;
  const cw = colW - 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx, y, cw, blockH, 'F');
  doc.setDrawColor(210, 210, 210);
  doc.rect(cx, y, cw, blockH);
  doc.setDrawColor(0, 0, 0);

  if (productionImage) {
    try { doc.addImage(productionImage, 'JPEG', cx + 1, y + 1, cw - 2, blockH * 0.42, undefined, 'FAST'); } catch {}
    doc.setFontSize(8); bold(doc); doc.setTextColor(20, 20, 20);
    doc.text(production.name || '', cx + cw / 2, y + blockH * 0.42 + 6, { align: 'center' });
    normal(doc);
  } else {
    doc.setFontSize(7.5); bold(doc); doc.setTextColor(80, 80, 80);
    doc.text('GENERAL CALL TIME', cx + cw / 2, y + 8, { align: 'center' });
    doc.setFontSize(22); doc.setTextColor(10, 10, 10);
    doc.text(production.call_time || '7:00 AM', cx + cw / 2, y + 26, { align: 'center' });
    normal(doc);
  }

  const callY = productionImage ? y + blockH * 0.42 + 13 : y + 34;
  doc.setFontSize(7.5); normal(doc); doc.setTextColor(60, 60, 60);
  doc.text(shootDate, cx + cw / 2, callY, { align: 'center' });
  doc.setFontSize(6.5); doc.setTextColor(120, 120, 120);
  doc.text('Safety first. All crew follow on-set protocols.', cx + cw / 2, callY + 6, { align: 'center' });

  if (weather) {
    const wy = callY + 12;
    const iconSize = 11;
    const iconUrl = weather.icon ? await toDataUrl(`https://openweathermap.org/img/wn/${weather.icon}@2x.png`) : null;
    if (iconUrl) {
      try { doc.addImage(iconUrl, 'PNG', cx + 3, wy - 2, iconSize, iconSize, undefined, 'FAST'); } catch {}
    }
    doc.setFontSize(9); bold(doc); doc.setTextColor(20, 60, 170);
    doc.text(`${weather.temp_high}° / ${weather.temp_low}° F`, cx + iconSize + 6, wy + 4);
    doc.setFontSize(7); normal(doc); doc.setTextColor(60, 60, 60);
    doc.text(weather.description, cx + iconSize + 6, wy + 9);
    doc.setFontSize(6.5); doc.setTextColor(0, 100, 180);
    doc.text(`Rain: ${weather.precipitation}%   Wind: ${weather.wind_speed || '--'} mph`, cx + 3, wy + 15);
  }
  doc.setTextColor(0, 0, 0);

  // RIGHT: Call times
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

  y += blockH + 4;

  /* ═══════════════════════════════════════════
     7-DAY FORECAST STRIP
  ═══════════════════════════════════════════ */
  if (forecast && forecast.length > 0) {
    y = maybeNewPage(doc, y);
    const days = forecast.slice(0, 7);
    const iconUrls = await Promise.all(
      days.map((d: any) => d.icon ? toDataUrl(`https://openweathermap.org/img/wn/${d.icon}@2x.png`) : Promise.resolve(null))
    );
    const stripW = pageW - 20;
    const cellW = stripW / days.length;
    const stripH = 22;

    doc.setFillColor(248, 250, 252);
    doc.rect(10, y, stripW, stripH, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.rect(10, y, stripW, stripH);

    days.forEach((day: any, i: number) => {
      const cx2 = 10 + i * cellW;
      if (i > 0) { doc.line(cx2, y, cx2, y + stripH); }
      const label = new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
      doc.setFontSize(5.5); normal(doc); doc.setTextColor(100, 100, 100);
      doc.text(label, cx2 + cellW / 2, y + 3.5, { align: 'center' });
      const iconSize = 7;
      if (iconUrls[i]) {
        try { doc.addImage(iconUrls[i]!, 'PNG', cx2 + cellW / 2 - iconSize / 2, y + 4.5, iconSize, iconSize, undefined, 'FAST'); } catch {}
      }
      doc.setFontSize(6); bold(doc); doc.setTextColor(20, 20, 20);
      doc.text(`${day.temp_high}°/${day.temp_low}°F`, cx2 + cellW / 2, y + 14, { align: 'center' });
      doc.setFontSize(5.5); normal(doc); doc.setTextColor(0, 100, 180);
      doc.text(`${day.precipitation}%`, cx2 + cellW / 2, y + 17.5, { align: 'center' });
      doc.setFontSize(5); doc.setTextColor(80, 80, 80);
      const desc = day.description.length > 12 ? day.description.slice(0, 12) + '…' : day.description;
      doc.text(desc, cx2 + cellW / 2, y + 20.5, { align: 'center' });
    });
    doc.setDrawColor(0, 0, 0); doc.setTextColor(0, 0, 0);
    y += stripH + 6;
  } else {
    y += 4;
  }

  /* ═══════════════════════════════════════════
     LOCATION
  ═══════════════════════════════════════════ */
  if (primaryLoc) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Location', '1 Location', y, pageW);
    const lxs = [13, 55, 110, 158];
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

  /* Shared column positions — all 9 cols fit within 10→206mm (196mm usable)
     [avatar, Name, Role, Status, Pickup, Call, H/MU, OnSet, Wrap] */
  const rowXs = [11, 23, 60, 95, 113, 130, 148, 163, 178];

  /* ═══════════════════════════════════════════
     CAST
  ═══════════════════════════════════════════ */
  const cast = crewWithPhotos.filter((c: any) => c.department === 'cast' || c.classification === 'Cast');
  if (cast.length > 0) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Cast', `${cast.length} Total Cast`, y, pageW);
    y = hdrRow(doc, ['', 'Name', 'Role', 'Status', 'Pickup', 'Call', 'H/MU', 'On Set', 'Wrap'], rowXs, y, pageW);
    cast.forEach((c: any, idx: number) => {
      y = maybeNewPage(doc, y);
      y = drawMemberRow(doc, c, y, pageW, rowXs, production.wrap_time || '—', production.call_time || '—', '#7c3aed', idx);
    });
    y += 4;
  }

  /* ═══════════════════════════════════════════
     CREW BY DEPARTMENT — same table layout as cast
  ═══════════════════════════════════════════ */
  const crewOnly = crewWithPhotos.filter((c: any) => c.classification !== 'Cast' && c.department !== 'cast');
  if (crewOnly.length > 0) {
    y = maybeNewPage(doc, y);
    y = section(doc, 'Crew', `${crewOnly.length} Total Crew`, y, pageW);

    const crewByDept = DEPARTMENTS.map((d: any) => ({
      ...d,
      members: crewOnly.filter((c: any) => (c.department || 'other') === d.id),
    })).filter((d: any) => d.members.length > 0);

    for (const dept of crewByDept) {
      y = maybeNewPage(doc, y);
      y = deptHeader(doc, dept.label, y, pageW);
      y = hdrRow(doc, ['', 'Name', 'Role', 'Status', 'Pickup', 'Call', 'H/MU', 'On Set', 'Wrap'], rowXs, y, pageW);
      dept.members.forEach((c: any, idx: number) => {
        y = maybeNewPage(doc, y);
        y = drawMemberRow(doc, c, y, pageW, rowXs, production.wrap_time || '—', production.call_time || '—', dept.color || '#6b7280', idx);
      });
      y += 3;
    }
    y += 4;
  }

  /* ═══════════════════════════════════════════
     FOOTER: QR + PRO-LOGIC logo (white, small)
  ═══════════════════════════════════════════ */
  y = maybeNewPage(doc, y, 220);
  const qrSize = 25;
  const footerH = qrSize + 8;
  doc.setFillColor(20, 20, 20);
  doc.rect(10, y, pageW - 20, footerH, 'F');

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 13, y + 4, qrSize, qrSize);
    doc.setFontSize(8); bold(doc); doc.setTextColor(255, 255, 255);
    doc.text('Add to Calendar', 13 + qrSize + 5, y + 11);
    normal(doc); doc.setFontSize(6.5); doc.setTextColor(170, 170, 170);
    doc.text('Scan with your camera to add this shoot to your calendar.', 13 + qrSize + 5, y + 17);
    doc.setFontSize(6.5); doc.setTextColor(100, 160, 255);
    doc.text(`${production.name}  |  ${shootDate}  |  Call: ${production.call_time || '--'}`, 13 + qrSize + 5, y + 23);
  }

  // Pro-Logic logo — white, small, right-aligned in footer
  const logoW = 26; const logoH = 9;
  const logoX = pageW - 12 - logoW;
  const logoY = y + (footerH - logoH) / 2;
  if (proLogicLogoWhite) {
    const fmt = proLogicLogoWhite.includes('image/svg') ? 'SVG' : 'PNG';
    try { doc.addImage(proLogicLogoWhite, fmt as any, logoX, logoY, logoW, logoH, undefined, 'FAST'); } catch {
      doc.setTextColor(200, 200, 200); doc.setFontSize(7); bold(doc);
      doc.text('PRO-LOGIC', pageW - 12, logoY + 5, { align: 'right' });
    }
  } else {
    doc.setTextColor(200, 200, 200); doc.setFontSize(7); bold(doc);
    doc.text('PRO-LOGIC', pageW - 12, logoY + 5, { align: 'right' });
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

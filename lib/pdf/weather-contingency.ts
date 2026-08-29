import { jsPDF } from 'jspdf';
import { PDFContext, header, footer, save } from './base';

/* Weather contingency — the 7-day forecast for the location plus a cover-set
   plan and the call-it protocol, ready to fill and circulate. */
export async function generateWeatherContingency({ production, locations, forecast = [], company, preview }: PDFContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  header(doc, 'Weather Contingency Plan', production, company);
  let y = 30;

  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('WEATHER CONTINGENCY PLAN', pageW / 2, y, { align: 'center' }); y += 10;

  const loc = locations.find((l: any) => l.id === production.location_id) || locations[0];
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Location: ${loc ? `${loc.name}${loc.city ? ', ' + loc.city : ''}` : '____________________'}   ·   Dates: ${production.start_date || '________'}${production.end_date ? ' – ' + production.end_date : ''}`, pageW / 2, y, { align: 'center' });
  y += 12;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('7-DAY FORECAST', 14, y); y += 6;
  if (forecast.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(140, 140, 140);
    doc.text('Forecast unavailable (set a location with coordinates or city on the production).', 14, y);
    doc.setTextColor(0, 0, 0); y += 8;
  } else {
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text('DATE', 14, y); doc.text('CONDITIONS', 48, y); doc.text('HIGH', 116, y); doc.text('LOW', 134, y); doc.text('PRECIP %', 156, y); doc.text('RISK', 186, y);
    doc.setTextColor(0, 0, 0); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const d of forecast.slice(0, 7)) {
      const risk = d.precipitation >= 60 ? 'HIGH' : d.precipitation >= 30 ? 'MED' : 'LOW';
      doc.text(String(d.date), 14, y);
      doc.text(String(d.description).slice(0, 30), 48, y);
      doc.text(`${d.temp_high}°`, 116, y);
      doc.text(`${d.temp_low}°`, 134, y);
      doc.text(`${d.precipitation ?? 0}%`, 156, y);
      if (risk === 'HIGH') doc.setTextColor(200, 30, 30); else if (risk === 'MED') doc.setTextColor(180, 120, 0); else doc.setTextColor(20, 130, 60);
      doc.setFont('helvetica', 'bold'); doc.text(risk, 186, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
      y += 5.5;
    }
    y += 5;
  }

  const box = (title: string, lines: string[], blanks: number) => {
    if (y > 230) { doc.addPage(); header(doc, 'Weather Contingency Plan', production, company); y = 30; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(title, 14, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const l of lines) { doc.text(l, 16, y); y += 5.5; }
    doc.setDrawColor(190, 190, 190);
    for (let i = 0; i < blanks; i++) { doc.line(16, y + 3, pageW - 14, y + 3); y += 8; }
    y += 4;
  };

  box('COVER SET (interior alternative if weather turns)', [
    'Location / set: ____________________________________________   Ready by: ___________',
    'Scenes that can move indoors:',
  ], 2);
  box('THE CALL (who decides, and when)', [
    'Weather call made by: ______________________ no later than: _________ (day before / morning of)',
    'Notify chain: 1st AD → department heads → full crew via: ______________________',
  ], 1);
  box('PROTECTION ON STANDBY', [
    '[ ] EZ-ups / tents   [ ] Rain covers for camera & lenses   [ ] Tarps for gear staging',
    '[ ] Generator fuel topped   [ ] Towels / ponchos   [ ] Heaters / cooling as season requires',
  ], 2);

  footer(doc);
  return save(doc, `weather-contingency-${(production.name || 'production').replace(/\s+/g, '-').toLowerCase()}.pdf`, preview);
}

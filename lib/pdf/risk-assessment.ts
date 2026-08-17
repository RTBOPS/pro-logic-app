import { createDoc, header, sectionTitle, tableRow, save } from './base';

/* Risk Assessment PDF — hazard matrix + emergency plan with sign-off lines. */

export function generateRiskAssessmentPDF(
  production: any,
  company: any,
  plan: {
    hazards: any[];
    medics?: string; hospital?: string; muster?: string;
    fireSafety?: string; preparedBy?: string; notes?: string;
  },
  preview = false
): string | void {
  const doc = createDoc('l');
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();

  header(doc, 'Safety & Risk Assessment', production, company);
  let y = 26;

  const ensureRoom = (needed: number, title?: string) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      header(doc, 'Risk Assessment (cont.)', production, company);
      y = 26;
      if (title) y = sectionTitle(doc, title, y);
    }
  };

  const high = plan.hazards.filter((h: any) => h.severity * h.likelihood >= 15).length;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `${plan.hazards.length} hazards assessed · ${high} HIGH risk · Risk score = Severity (1–5) × Likelihood (1–5): 1–7 LOW · 8–14 MEDIUM · 15–25 HIGH`,
    10, y
  );
  doc.setTextColor(0, 0, 0);
  y += 6;

  y = sectionTitle(doc, 'Hazard Matrix', y);
  const widths = [10, 44, 52, 12, 12, 16, 84, 32];
  y = tableRow(doc, ['#', 'ACTIVITY', 'HAZARD', 'SEV', 'LIK', 'RISK', 'MITIGATION / CONTROLS', 'RESPONSIBLE'], widths, y, 10, true);
  plan.hazards.forEach((h: any, i: number) => {
    const score = (h.severity || 0) * (h.likelihood || 0);
    const label = score >= 15 ? `${score} HIGH` : score >= 8 ? `${score} MED` : `${score} LOW`;
    ensureRoom(8, 'Hazard Matrix (cont.)');
    y = tableRow(doc, [
      String(i + 1),
      (h.activity || '').slice(0, 30),
      (h.hazard || '').slice(0, 36),
      String(h.severity || ''),
      String(h.likelihood || ''),
      label,
      (h.mitigation || '').slice(0, 62),
      (h.responsible || '').slice(0, 22),
    ], widths, y, 10, false, i % 2 === 1);
  });
  y += 4;

  ensureRoom(46);
  y = sectionTitle(doc, 'Emergency Plan', y);
  doc.setFontSize(8);
  const line = (label: string, value: string) => {
    ensureRoom(6);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', 10, y);
    doc.setFont('helvetica', 'normal');
    doc.text((value || '—').slice(0, 150), 55, y);
    y += 5;
  };
  line('Medical coverage', plan.medics || '');
  line('Nearest hospital', plan.hospital || '');
  line('Muster point', plan.muster || '');
  line('Fire safety', plan.fireSafety || '');
  if (plan.notes) line('Notes', plan.notes);
  y += 4;

  ensureRoom(30);
  y = sectionTitle(doc, 'Sign-off', y);
  doc.setFontSize(8);
  const col = (x: number, label: string, name = '') => {
    doc.text(label, x, y);
    doc.line(x, y + 12, x + 70, y + 12);
    if (name) doc.text(name, x, y + 16);
    else doc.text('Name / signature / date', x, y + 16);
  };
  col(10, 'Prepared by (Safety officer / PM)', plan.preparedBy || '');
  col(100, 'Production / Show director');
  col(190, 'Stunt / SFX / Rigging lead');
  y += 20;

  const date = production.start_date || new Date().toISOString().slice(0, 10);
  return save(doc, `risk-assessment-${(production.name || 'show').replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`, preview);
}

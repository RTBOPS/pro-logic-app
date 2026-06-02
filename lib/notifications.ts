export async function sendConfirmationEmail(opts: {
  to: string;
  crewName: string;
  role: string;
  productionName: string;
  client: string;
  token: string;
  shootDates?: string;
  location?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const confirmUrl = `${appUrl}/confirm/${opts.token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f9fafb;">
      <div style="background:#141414;border-radius:12px;padding:24px 28px;margin-bottom:24px;">
        <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">PRO-LOGIC</div>
        <div style="color:#a1a1aa;font-size:13px;margin-top:2px;">Studio Management Platform</div>
      </div>
      <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111;">You've been invited!</h2>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Hi ${opts.crewName}, you've been added to the following production:</p>

        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px;">
          <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:4px;">${opts.productionName}</div>
          <div style="color:#6b7280;font-size:13px;">Client: ${opts.client}</div>
          <div style="color:#6b7280;font-size:13px;margin-top:2px;">Your role: <strong>${opts.role}</strong></div>
          ${opts.shootDates ? `<div style="color:#6b7280;font-size:13px;margin-top:2px;">Dates: ${opts.shootDates}</div>` : ''}
          ${opts.location ? `<div style="color:#6b7280;font-size:13px;margin-top:2px;">Location: ${opts.location}</div>` : ''}
        </div>

        <p style="color:#374151;font-size:14px;margin:0 0 20px;">Please confirm your availability by clicking below:</p>

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${confirmUrl}" style="background:#16a34a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Confirm Attendance</a>
        </div>

        <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
          Or copy this link: <a href="${confirmUrl}" style="color:#2563eb;">${confirmUrl}</a>
        </p>
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">Sent by PRO-LOGIC Studio Management</p>
    </body>
    </html>
  `;

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: opts.to,
      subject: `[PRO-LOGIC] You're invited: ${opts.productionName}`,
      html,
    }),
  });

  return res.ok;
}

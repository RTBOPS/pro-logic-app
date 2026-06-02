import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

export async function POST(req: NextRequest) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || key === 'your_sendgrid_api_key_here') {
    return NextResponse.json({ error: 'SENDGRID_API_KEY not configured' }, { status: 503 });
  }

  sgMail.setApiKey(key);

  try {
    const body = await req.json();
    const { to, subject, html, type } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const from = process.env.SENDGRID_FROM_EMAIL || 'noreply@prologicstudio.com';
    await sgMail.send({ to, from, subject, html });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('SendGrid error:', e.response?.body || e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

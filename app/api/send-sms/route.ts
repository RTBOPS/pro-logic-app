import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { to, message } = await req.json();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio credentials not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to environment variables.' }, { status: 503 });
  }

  const cleaned = to.replace(/\D/g, '');
  const e164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;

  const body = new URLSearchParams({ To: e164, From: fromNumber, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.message || 'SMS failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

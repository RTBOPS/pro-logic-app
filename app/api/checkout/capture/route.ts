import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/* PayPal redirects the buyer here after approving an Event Pass order.
 * We capture the order server-side; the uid comes from the order's own
 * custom_id (set at creation), never from the query string. */
function adminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'prologicstudio-4a6f5',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

const EVENT_PASS_HOURS = 96; // 4 days: covers a full event weekend

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pro-logic.studio';
  const orderId = req.nextUrl.searchParams.get('token');
  if (!orderId || !/^[A-Z0-9]{5,30}$/i.test(orderId)) {
    return NextResponse.redirect(`${appUrl}/pricing?eventpass=error`);
  }
  try {
    const base = process.env.PAYPAL_SANDBOX === 'true'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const { access_token } = await tokenRes.json();

    const capRes = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
    });
    const cap = await capRes.json();
    const completed = cap.status === 'COMPLETED';
    const uid = cap.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id
      || cap.purchase_units?.[0]?.custom_id;

    if (!completed || !uid) {
      console.error('Event pass capture failed:', JSON.stringify(cap).slice(0, 500));
      return NextResponse.redirect(`${appUrl}/pricing?eventpass=error`);
    }

    const until = new Date(Date.now() + EVENT_PASS_HOURS * 3600 * 1000).toISOString();
    await adminDb().doc(`users/${uid}`).set({
      event_pass_until: until,
      event_pass_order: orderId,
      event_pass_purchased_at: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.redirect(`${appUrl}/live-graphics?eventpass=active`);
  } catch (e: any) {
    console.error('Event pass capture error:', e?.message || e);
    return NextResponse.redirect(`${appUrl}/pricing?eventpass=error`);
  }
}

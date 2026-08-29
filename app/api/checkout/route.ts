import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/* Identity comes from a verified Firebase ID token — the request body is
 * never trusted for uid/email (that let anyone subscribe on any account). */
function adminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'prologicstudio-4a6f5',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getAuth();
}

const PLANS: Record<string, { planId: string; name: string }> = {
  producer: { planId: process.env.PAYPAL_PRODUCER_PLAN_ID || '', name: 'Producer' },
  producer_annual: { planId: process.env.PAYPAL_PRODUCER_ANNUAL_PLAN_ID || '', name: 'Producer (annual)' },
  broadcast: { planId: process.env.PAYPAL_BROADCAST_PLAN_ID || '', name: 'Broadcast' },
  broadcast_annual: { planId: process.env.PAYPAL_BROADCAST_ANNUAL_PLAN_ID || '', name: 'Broadcast (annual)' },
  studio: { planId: process.env.PAYPAL_STUDIO_PLAN_ID || '', name: 'Studio' },
  studio_annual: { planId: process.env.PAYPAL_STUDIO_ANNUAL_PLAN_ID || '', name: 'Studio (annual)' },
};

const EVENT_PASS_PRICE = '79.00';

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const base = process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal token error: ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || '';
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!idToken) return NextResponse.json({ error: 'Sign in to subscribe.' }, { status: 401 });
    let uid: string, email: string | undefined;
    try {
      const decoded = await adminAuth().verifyIdToken(idToken);
      uid = decoded.uid; email = decoded.email;
    } catch {
      return NextResponse.json({ error: 'Session expired. Sign in again.' }, { status: 401 });
    }
    const { plan } = await req.json();

    if (!plan || (plan !== 'event' && !PLANS[plan])) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Event Pass: one-time order, captured by /api/checkout/capture on return.
    if (plan === 'event') {
      const appUrl0 = process.env.NEXT_PUBLIC_APP_URL || 'https://pro-logic.studio';
      const base0 = process.env.PAYPAL_SANDBOX === 'true'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
      const token0 = await getPayPalAccessToken();
      const order = await fetch(`${base0}/v2/checkout/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token0}` },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            custom_id: uid,
            description: 'Pro-Logic Event Pass — 4 days of Broadcast access',
            amount: { currency_code: 'USD', value: EVENT_PASS_PRICE },
          }],
          application_context: {
            brand_name: 'PRO-LOGIC Studio',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: `${appUrl0}/api/checkout/capture`,
            cancel_url: `${appUrl0}/pricing?canceled=true`,
          },
        }),
      });
      if (!order.ok) {
        console.error('PayPal create order error:', await order.text());
        return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 });
      }
      const orderData = await order.json();
      const approve = (orderData.links as { rel: string; href: string }[])?.find(l => l.rel === 'approve')?.href;
      if (!approve) return NextResponse.json({ error: 'No PayPal approval URL returned' }, { status: 500 });
      return NextResponse.json({ url: approve });
    }

    const planConfig = PLANS[plan];
    if (!planConfig.planId) {
      return NextResponse.json(
        { error: `PayPal plan ID for "${plan}" is not configured. Set PAYPAL_${plan.toUpperCase()}_PLAN_ID.` },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pro-logic.studio';
    const base = process.env.PAYPAL_SANDBOX === 'true'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    const accessToken = await getPayPalAccessToken();

    const subscription = await fetch(`${base}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: planConfig.planId,
        custom_id: uid,
        subscriber: email ? { email_address: email } : undefined,
        application_context: {
          brand_name: 'PRO-LOGIC Studio',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: { payer_selected: 'PAYPAL', payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED' },
          return_url: `${appUrl}/dashboard?subscribed=${plan}`,
          cancel_url: `${appUrl}/pricing?canceled=true`,
        },
      }),
    });

    if (!subscription.ok) {
      const err = await subscription.text();
      console.error('PayPal create subscription error:', err);
      return NextResponse.json({ error: 'Subscription creation failed. Please try again.' }, { status: 500 });
    }

    const subData = await subscription.json();
    const approvalLink = (subData.links as { rel: string; href: string }[])?.find(l => l.rel === 'approve')?.href;

    if (!approvalLink) {
      return NextResponse.json({ error: 'No PayPal approval URL returned' }, { status: 500 });
    }

    return NextResponse.json({ url: approvalLink });
  } catch (err: any) {
    console.error('PayPal checkout error:', err?.message || err);
    return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 });
  }
}

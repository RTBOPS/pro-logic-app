import { NextRequest, NextResponse } from 'next/server';

const PLANS: Record<string, { planId: string; name: string }> = {
  pro: {
    planId: process.env.PAYPAL_PRO_PLAN_ID || '',
    name: 'Pro',
  },
  studio: {
    planId: process.env.PAYPAL_STUDIO_PLAN_ID || '',
    name: 'Studio',
  },
};

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
    const { plan, uid, email } = await req.json();

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
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
        ...(uid ? { custom_id: uid } : {}),
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
      return NextResponse.json({ error: `PayPal error: ${err}` }, { status: 500 });
    }

    const subData = await subscription.json();
    const approvalLink = (subData.links as { rel: string; href: string }[])?.find(l => l.rel === 'approve')?.href;

    if (!approvalLink) {
      return NextResponse.json({ error: 'No PayPal approval URL returned' }, { status: 500 });
    }

    return NextResponse.json({ url: approvalLink });
  } catch (err: any) {
    console.error('PayPal checkout error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Checkout failed' }, { status: 500 });
  }
}

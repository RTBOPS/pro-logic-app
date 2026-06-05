import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const PLANS: Record<string, { name: string; amount: number; description: string }> = {
  pro: {
    name: 'PRO-LOGIC Studio — Pro Plan',
    amount: 2900,
    description: 'Unlimited productions, crew, inventory, all PDF documents, storyboard, blueprint, equipment forms & ID cards.',
  },
  studio: {
    name: 'PRO-LOGIC Studio — Studio Plan',
    amount: 7900,
    description: 'Everything in Pro plus team workspaces, multi-user access, custom branding, and dedicated support.',
  },
};

export async function POST(req: NextRequest) {
  // Initialize Stripe inside handler so env var is always available at runtime
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set');
    return NextResponse.json({ error: 'Payment not configured. Please contact support.' }, { status: 503 });
  }

  const stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });

  try {
    const { plan, uid, email } = await req.json();

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const planConfig = PLANS[plan];
    // Always redirect to production domain, never Vercel preview URLs
    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pro-logic.studio'}/dashboard?subscribed=${plan}`;
    const cancelUrl  = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pro-logic.studio'}/?canceled=true`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: planConfig.name, description: planConfig.description },
          unit_amount: planConfig.amount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      metadata: { firebaseUid: uid || '', plan },
      subscription_data: { metadata: { firebaseUid: uid || '', plan } },
      success_url: successUrl,
      cancel_url:  cancelUrl,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Checkout failed' }, { status: 500 });
  }
}

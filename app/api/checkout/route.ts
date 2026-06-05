import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });

const PLANS: Record<string, { name: string; amount: number; interval: 'month' | 'year'; description: string }> = {
  pro: {
    name: 'PRO-LOGIC Studio — Pro Plan',
    amount: 2900, // $29.00 in cents
    interval: 'month',
    description: 'Unlimited productions, crew, inventory, all PDF documents, storyboard, blueprint, equipment forms & ID cards.',
  },
  studio: {
    name: 'PRO-LOGIC Studio — Studio Plan',
    amount: 7900, // $79.00 in cents
    interval: 'month',
    description: 'Everything in Pro plus team workspaces, multi-user access, custom branding, and dedicated support.',
  },
};

export async function POST(req: NextRequest) {
  try {
    const { plan, uid, email } = await req.json();

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const planConfig = PLANS[plan];
    const origin = req.headers.get('origin') || 'https://www.pro-logic.studio';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planConfig.name,
              description: planConfig.description,
            },
            unit_amount: planConfig.amount,
            recurring: { interval: planConfig.interval },
          },
          quantity: 1,
        },
      ],
      metadata: {
        firebaseUid: uid || '',
        plan,
      },
      subscription_data: {
        metadata: {
          firebaseUid: uid || '',
          plan,
        },
      },
      success_url: `${origin}/dashboard?subscribed=${plan}`,
      cancel_url: `${origin}/?canceled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

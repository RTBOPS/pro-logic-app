import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
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

// Lookup which plan corresponds to a PayPal plan ID
function planFromPayPalPlanId(paypalPlanId: string): string {
  if (paypalPlanId === process.env.PAYPAL_STUDIO_PLAN_ID) return 'studio';
  if (paypalPlanId === process.env.PAYPAL_PRO_PLAN_ID) return 'pro';
  return 'pro';
}

async function verifyWebhookSignature(req: NextRequest, body: string): Promise<boolean> {
  // PayPal webhook verification via their API
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!clientId || !clientSecret || !webhookId) return false;

  const base = process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  // Get access token
  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) return false;
  const { access_token } = await tokenRes.json();

  const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      auth_algo: req.headers.get('paypal-auth-algo'),
      cert_url: req.headers.get('paypal-cert-url'),
      transmission_id: req.headers.get('paypal-transmission-id'),
      transmission_sig: req.headers.get('paypal-transmission-sig'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
  });

  if (!verifyRes.ok) return false;
  const { verification_status } = await verifyRes.json();
  return verification_status === 'SUCCESS';
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Skip verification in development
  if (process.env.NODE_ENV === 'production') {
    const valid = await verifyWebhookSignature(req, body);
    if (!valid) {
      console.error('PayPal webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const resource = event.resource || {};

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        // custom_id holds the Firebase UID set at subscription creation
        const uid = resource.custom_id;
        const planId = resource.plan_id;
        const subscriptionId = resource.id;
        if (uid) {
          const plan = planFromPayPalPlanId(planId);
          await db.doc(`users/${uid}`).set(
            {
              plan,
              paypalSubscriptionId: subscriptionId,
              paypalPlanId: planId,
              planActivatedAt: new Date().toISOString(),
              planStatus: 'active',
            },
            { merge: true }
          );
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        const uid = resource.custom_id;
        const planId = resource.plan_id;
        if (uid) {
          const plan = planFromPayPalPlanId(planId);
          await db.doc(`users/${uid}`).set(
            {
              plan,
              paypalPlanId: planId,
              planStatus: resource.status?.toLowerCase() || 'active',
              planUpdatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const uid = resource.custom_id;
        if (uid) {
          await db.doc(`users/${uid}`).set(
            {
              plan: 'free',
              planStatus: 'canceled',
              planCanceledAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('PayPal webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/* Admin endpoints for the affiliate program: list partners with their
 * commission totals, and mark a partner's pending commissions as paid.
 * Only the platform owner (ADMIN_EMAILS) may call these. */

function admin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'prologicstudio-4a6f5',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return { auth: getAuth(), db: getFirestore() };
}

async function requireAdmin(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!idToken) return null;
  try {
    const decoded = await admin().auth.verifyIdToken(idToken);
    const admins = (process.env.ADMIN_EMAILS || 'marketing@pro-logic.studio')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return decoded.email && admins.includes(decoded.email.toLowerCase()) ? decoded : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { db } = admin();
  const affs = await db.collection('affiliates').get();
  const out = [];
  for (const a of affs.docs) {
    const coms = await a.ref.collection('commissions').orderBy('created', 'desc').limit(200).get();
    const refs = await a.ref.collection('referrals').get();
    let pending = 0, paid = 0;
    const commissions = coms.docs.map(c => {
      const d = c.data();
      if (d.status === 'pending') pending += d.commission || 0;
      if (d.status === 'paid') paid += d.commission || 0;
      return { id: c.id, ...d };
    });
    out.push({
      code: a.id, name: a.data().name || '', email: a.data().email || '',
      paypal_email: a.data().paypal_email || '',
      active: a.data().active !== false,
      signups: refs.size, pending: Math.round(pending * 100) / 100,
      paid: Math.round(paid * 100) / 100, commissions,
    });
  }
  return NextResponse.json({ affiliates: out });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { db } = admin();
  const body = await req.json();
  if (body.action === 'mark_paid' && typeof body.code === 'string' && /^[a-z0-9-]{3,24}$/.test(body.code)) {
    const coms = await db.collection(`affiliates/${body.code}/commissions`)
      .where('status', '==', 'pending').get();
    const batch = db.batch();
    coms.docs.forEach(c => batch.update(c.ref, { status: 'paid', paid_at: new Date().toISOString() }));
    await batch.commit();
    return NextResponse.json({ ok: true, marked: coms.size });
  }
  return NextResponse.json({ error: 'invalid action' }, { status: 400 });
}

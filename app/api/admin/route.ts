import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/* Owner-only operations dashboard: accounts, revenue, event passes,
 * affiliate liability and storage consumption. */

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'prologicstudio-4a6f5.firebasestorage.app';

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
  return { auth: getAuth(), db: getFirestore(), storage: getStorage() };
}

async function requireAdmin(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!idToken) return null;
  try {
    const decoded = await admin().auth.verifyIdToken(idToken);
    const admins = (process.env.ADMIN_EMAILS || 'marketing@pro-logic.studio,rtbops@gmail.com')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return decoded.email && admins.includes(decoded.email.toLowerCase()) ? decoded : null;
  } catch { return null; }
}

// Monthly value of each PayPal plan id (annual plans prorated to MRR)
function planMonthly(paypalPlanId?: string): number {
  const map: [string | undefined, number][] = [
    [process.env.PAYPAL_PRODUCER_PLAN_ID, 39],
    [process.env.PAYPAL_PRODUCER_ANNUAL_PLAN_ID, 29],
    [process.env.PAYPAL_BROADCAST_PLAN_ID, 99],
    [process.env.PAYPAL_BROADCAST_ANNUAL_PLAN_ID, 79],
    [process.env.PAYPAL_STUDIO_PLAN_ID, 199],
    [process.env.PAYPAL_STUDIO_ANNUAL_PLAN_ID, 159],
    [process.env.PAYPAL_PRO_PLAN_ID, 29],
  ];
  return map.find(([id]) => id && id === paypalPlanId)?.[1] || 0;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { db, storage } = admin();

  // ── Accounts ──
  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map(d => {
    const u = d.data();
    return {
      uid: d.id,
      email: u.email || '',
      name: u.displayName || '',
      plan: u.plan || 'free',
      planStatus: u.planStatus || '',
      paypalPlanId: u.paypalPlanId || '',
      mrr: u.planStatus === 'active' ? planMonthly(u.paypalPlanId) : 0,
      createdAt: u.createdAt || '',
      referredBy: u.referredBy || '',
      eventPassUntil: u.event_pass_until || '',
      eventPassAt: u.event_pass_purchased_at || '',
      hasSampleData: !!u.hasSampleData,
      storageBytes: 0,
    };
  });

  const planCounts: Record<string, number> = {};
  let mrr = 0;
  for (const u of users) {
    planCounts[u.plan] = (planCounts[u.plan] || 0) + 1;
    mrr += u.mrr;
  }
  const now = Date.now();
  const passes = users.filter(u => u.eventPassAt);
  const passes30d = passes.filter(u => now - new Date(u.eventPassAt).getTime() < 30 * 86400000).length;
  const signups30d = users.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() < 30 * 86400000).length;

  // ── Affiliate liability ──
  let pendingCommissions = 0, paidCommissions = 0;
  const affs = await db.collection('affiliates').get();
  for (const a of affs.docs) {
    const coms = await a.ref.collection('commissions').get();
    coms.docs.forEach(c => {
      const d = c.data();
      if (d.status === 'pending') pendingCommissions += d.commission || 0;
      if (d.status === 'paid') paidCommissions += d.commission || 0;
    });
  }

  // ── Storage consumption (cost control) ──
  let storageTotal = 0;
  const byFolder: Record<string, number> = {};
  const byUid: Record<string, number> = {};
  let storageError = '';
  try {
    const [files] = await storage.bucket(BUCKET).getFiles({ maxResults: 20000 });
    for (const f of files) {
      const size = parseInt(String(f.metadata.size || 0), 10) || 0;
      storageTotal += size;
      const parts = f.name.split('/');
      byFolder[parts[0] || 'root'] = (byFolder[parts[0] || 'root'] || 0) + size;
      // most paths are folder/{uid}/... — attribute to the uid when it looks like one
      if (parts[1] && parts[1].length >= 20) byUid[parts[1]] = (byUid[parts[1]] || 0) + size;
    }
    for (const u of users) u.storageBytes = byUid[u.uid] || 0;
  } catch (e: any) {
    storageError = e?.message || 'storage listing failed';
  }

  users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return NextResponse.json({
    summary: {
      totalUsers: users.length,
      signups30d,
      planCounts,
      mrr: Math.round(mrr * 100) / 100,
      eventPassesTotal: passes.length,
      eventPasses30d: passes30d,
      eventPassRevenue: passes.length * 79,
      pendingCommissions: Math.round(pendingCommissions * 100) / 100,
      paidCommissions: Math.round(paidCommissions * 100) / 100,
      storageTotal,
      storageByFolder: byFolder,
      storageError,
    },
    users,
  });
}

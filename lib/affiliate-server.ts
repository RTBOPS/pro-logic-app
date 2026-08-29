/* Server-side commission recording (Admin SDK). Called from the PayPal
 * webhook (subscription payments) and the Event Pass capture route.
 * 10% of every payment during the referred customer's first 12 months. */

const WINDOW_MS = 366 * 24 * 3600 * 1000;
const RATE = 0.10;

export async function recordCommission(
  db: FirebaseFirestore.Firestore,
  uid: string,
  amount: number,
  source: 'subscription' | 'event_pass',
  txnId: string,
  planLabel: string,
) {
  try {
    if (!uid || !amount || !txnId) return;
    const userRef = db.doc(`users/${uid}`);
    const user = (await userRef.get()).data() || {};
    const code = String(user.referredBy || '').toLowerCase();
    if (!code || !/^[a-z0-9-]{3,24}$/.test(code)) return;

    const aff = await db.doc(`affiliates/${code}`).get();
    if (!aff.exists || aff.data()?.active === false) return;

    // 12-month window starts at the buyer's first commissioned payment.
    let start = user.referralWindowStart as string | undefined;
    if (!start) {
      start = new Date().toISOString();
      await userRef.set({ referralWindowStart: start }, { merge: true });
    }
    if (Date.now() - new Date(start).getTime() > WINDOW_MS) return;

    // Idempotent per transaction — PayPal retries webhooks.
    const comRef = db.doc(`affiliates/${code}/commissions/${txnId.replace(/[^A-Za-z0-9_-]/g, '')}`);
    if ((await comRef.get()).exists) return;

    const email = String(user.email || '');
    await comRef.set({
      buyer_uid: uid,
      buyer_label: email ? email.replace(/^(.).*(@.*)$/, '$1***$2') : 'customer',
      plan: planLabel,
      amount,
      commission: Math.round(amount * RATE * 100) / 100,
      status: 'pending',
      source,
      created: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('recordCommission failed:', e?.message || e);
  }
}

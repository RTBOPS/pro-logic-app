#!/usr/bin/env node
/* Creates the PRO-LOGIC product + 6 subscription plans in PayPal and prints
 * the env lines to paste into Vercel / .env.local.
 *
 * Usage:  node scripts/create-paypal-plans.js
 * Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_SANDBOX from
 * .env.local in the project root.
 */
const fs = require('fs');
const path = require('path');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const BASE = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

const PLANS = [
  { env: 'PAYPAL_PRODUCER_PLAN_ID',         name: 'Producer Monthly',  price: '39',   unit: 'MONTH' },
  { env: 'PAYPAL_PRODUCER_ANNUAL_PLAN_ID',  name: 'Producer Annual',   price: '348',  unit: 'YEAR' },
  { env: 'PAYPAL_BROADCAST_PLAN_ID',        name: 'Broadcast Monthly', price: '99',   unit: 'MONTH' },
  { env: 'PAYPAL_BROADCAST_ANNUAL_PLAN_ID', name: 'Broadcast Annual',  price: '948',  unit: 'YEAR' },
  { env: 'PAYPAL_STUDIO_PLAN_ID',           name: 'Studio Monthly',    price: '199',  unit: 'MONTH' },
  { env: 'PAYPAL_STUDIO_ANNUAL_PLAN_ID',    name: 'Studio Annual',     price: '1908', unit: 'YEAR' },
];

async function main() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const tok = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  }).then(r => r.json());
  if (!tok.access_token) throw new Error('PayPal auth failed: ' + JSON.stringify(tok));
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${tok.access_token}` };

  const product = await fetch(`${BASE}/v1/catalogs/products`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      name: 'PRO-LOGIC Studio',
      description: 'Production management + live broadcast graphics platform',
      type: 'SERVICE', category: 'SOFTWARE',
    }),
  }).then(r => r.json());
  if (!product.id) throw new Error('Product creation failed: ' + JSON.stringify(product));
  console.log(`Product: ${product.id}\n`);

  const out = [];
  for (const p of PLANS) {
    const plan = await fetch(`${BASE}/v1/billing/plans`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        product_id: product.id,
        name: `PRO-LOGIC ${p.name}`,
        billing_cycles: [{
          frequency: { interval_unit: p.unit, interval_count: 1 },
          tenure_type: 'REGULAR', sequence: 1, total_cycles: 0,
          pricing_scheme: { fixed_price: { value: p.price, currency_code: 'USD' } },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 2,
          setup_fee_failure_action: 'CANCEL',
        },
      }),
    }).then(r => r.json());
    if (!plan.id) throw new Error(`Plan "${p.name}" failed: ` + JSON.stringify(plan));
    console.log(`${p.name.padEnd(18)} $${p.price}/${p.unit.toLowerCase()}  →  ${plan.id}`);
    out.push(`${p.env}=${plan.id}`);
  }
  console.log('\nPaste into .env.local AND Vercel env vars:\n');
  console.log(out.join('\n'));
}

main().catch(e => { console.error(e.message || e); process.exit(1); });

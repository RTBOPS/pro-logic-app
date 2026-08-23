#!/usr/bin/env node
/* NBA Game Distribution API (Genius Sports NGSS) → Pro-Logic CG agent.
 *
 * For the arena mirror: the venue's Arena deployment exposes the in-progress
 * game over a WebSocket. We authenticate with the apikey NBA/Genius grants,
 * subscribe to scoreboard (+ automatic clockstate ticks), and write the exact
 * clock to live_graphics/<token>.nbaClock — the field the output overlay
 * already prefers over ESPN — plus team fouls / bonus for the arena bug.
 * Zero changes to the graphics.
 *
 * Usage:
 *   NGSS_URL="wss://<arena-host>/<path>" NGSS_APIKEY="..." \
 *     node scripts/ngss-clock-agent.js <token> [gameId]
 *
 * Docs: https://developer.geniussports.com/nbangss/stream/
 *   - auth within 5s of connect: { "type": "authentication", "apikey": "..." }
 *   - query params: gameId (10 chars), format=json, types=sc,cl
 *   - clockstate (category "state", sent on every clock tick):
 *       { type, gameId, periodType, periodNumber, period,
 *         clock: "PTmmMss.ccS", shotClock: "PTss.ccS"|null, clockRunning: 0|1 }
 *   - scoreboard (aggregated): status, period, clock, clockRunning,
 *       homeTeam/awayTeam { teamId, score, fouls, foulsToGive, inBonus,
 *       timeoutsRemaining, periods[{periodNumber, score}] }
 */
const fs = require('node:fs');
const path = require('node:path');

const [, , token, gameId] = process.argv;
const URL_BASE = process.env.NGSS_URL || '';
const APIKEY = process.env.NGSS_APIKEY || '';
if (!token || !URL_BASE || !APIKEY) {
  console.error('usage: NGSS_URL=wss://… NGSS_APIKEY=… node scripts/ngss-clock-agent.js <token> [gameId]');
  process.exit(1);
}

/* firebase-admin with the app's local credentials */
const admin = require('firebase-admin');
const envFile = path.join(__dirname, '..', '.env.local');
const env = { ...process.env };
if (fs.existsSync(envFile)) for (const l of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) { let v = l.slice(i + 1).trim(); if (v.startsWith('"')) v = v.slice(1, -1); env[l.slice(0, i).trim()] ||= v; }
}
admin.initializeApp({ credential: admin.credential.cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const doc = admin.firestore().doc(`live_graphics/${token}`);

/* "PT11M23.4S" → seconds (683.4). Returns null when unparsable. */
function isoClockSec(c) {
  const m = /^PT(?:(\d+)M)?(\d+(?:\.\d+)?)S$/.exec(String(c || '').trim());
  return m ? (parseInt(m[1] || '0', 10) * 60 + parseFloat(m[2])) : null;
}
const fmt = sec => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(Math.ceil(sec) % 60).padStart(2, '0')}` : sec.toFixed(1));

const qs = new URLSearchParams({ format: 'json', types: 'sc,cl' });
if (gameId) qs.set('gameId', gameId);
const url = `${URL_BASE}${URL_BASE.includes('?') ? '&' : '?'}${qs}`;

let lastClock = '';
let lastBoard = '';
let status = 'in';

function writeClock(m) {
  const sec = isoClockSec(m.clock);
  if (sec == null) return;
  const running = String(m.clockRunning) === '1';
  const period = m.period ?? m.periodNumber ?? 0;
  const key = `${sec.toFixed(1)}|${period}|${running}`;
  if (key === lastClock) return;   // ticks repeat; only write on change
  lastClock = key;
  doc.set({ nbaClock: { sec, clock: fmt(sec), period, running, status, ts: Date.now() } }, { merge: true })
    .catch(e => console.error('clock write failed:', e.message));
  console.log(`clock → ${fmt(sec)} P${period} ${running ? '▶' : '⏸'}`);
}

function writeBoard(m) {
  status = m.status === 'inprogress' ? 'in' : (m.status || status);
  const h = m.homeTeam || {}, a = m.awayTeam || {};
  const patch = {
    homeFouls: h.fouls != null ? String(h.fouls) : undefined,
    awayFouls: a.fouls != null ? String(a.fouls) : undefined,
    homeBonus: String(h.inBonus) === '1' || undefined,
    awayBonus: String(a.inBonus) === '1' || undefined,
  };
  Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
  const key = JSON.stringify(patch);
  if (!Object.keys(patch).length || key === lastBoard) { writeClock(m); return; }
  lastBoard = key;
  doc.set(patch, { merge: true }).catch(e => console.error('board write failed:', e.message));
  console.log(`board → fouls ${patch.awayFouls ?? '·'}-${patch.homeFouls ?? '·'} bonus ${patch.awayBonus ? 'A' : ''}${patch.homeBonus ? 'H' : ''}`);
  writeClock(m);   // scoreboard also carries clock/period
}

function connect(attempt = 0) {
  const ws = new WebSocket(url);   // Node 22+ global WebSocket
  ws.onopen = () => {
    console.log('NGSS connected — authenticating');
    ws.send(JSON.stringify({ type: 'authentication', apikey: APIKEY }));
    attempt = 0;
  };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    const t = String(m.type || '').toLowerCase();
    if (t === 'clockstate') writeClock(m);
    else if (t === 'scoreboard') writeBoard(m);
    else if (t === 'authentication' || t === 'connection') console.log(`NGSS ${t}:`, JSON.stringify(m).slice(0, 200));
  };
  ws.onclose = () => {
    const wait = Math.min(15000, 500 * 2 ** attempt);
    console.log(`NGSS closed — reconnecting in ${wait}ms`);
    setTimeout(() => connect(attempt + 1), wait);
  };
  ws.onerror = e => console.error('NGSS error:', e.message || e.type);
}
connect();

#!/usr/bin/env node
/*
 * PRO-LOGIC — NBA/WNBA local clock agent
 * -------------------------------------------------------------
 * Reads the game clock from the NBA's own per-game liveData boxscore
 * (cdn.wnba.com / cdn.nba.com — the same fresh feed Courtside uses) and
 * writes it to your live_graphics doc every second, interpolated smoothly
 * so the overlay ticks per-second and matches the arena/Courtside clock.
 * Runs on your machine (residential IP), which can reach the feed.
 *
 * Usage:
 *   node scripts/nba-clock-agent.js <token> [wnba|nba] [TEAM]
 *   token = the id at the end of your Output URL (…/graphics-out/<token>)
 *   TEAM  = optional tricode (e.g. TOR) if several games are live
 * Stop with Ctrl+C.
 */
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch { /* env may already be set */ }

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

const token = process.argv[2];
const league = (process.argv[3] || 'wnba').toLowerCase();
const teamFilter = (process.argv[4] || '').toUpperCase();
if (!token) { console.error('Usage: node scripts/nba-clock-agent.js <token> [wnba|nba] [TEAM]'); process.exit(1); }
const lid = league === 'nba' ? '00' : '10';
const host = league === 'nba' ? 'cdn.nba.com' : 'cdn.wnba.com';
const H = { headers: { 'User-Agent': 'Mozilla/5.0', Referer: `https://www.${league}.com/`, Accept: 'application/json' } };
const scoreboardUrl = `https://${host}/static/json/liveData/scoreboard/todaysScoreboard_${lid}.json`;
const boxUrl = id => `https://${host}/static/json/liveData/boxscore/boxscore_${id}.json`;

function parsePT(s) {
  const m = /PT(\d+)M([\d.]+)S/.exec(s || '');
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
}

let gameId = null, gameTag = '', lastGidCheck = 0;
async function resolveGame() {
  const r = await fetch(scoreboardUrl, H);
  const d = await r.json();
  const games = d.scoreboard?.games || [];
  let g = games.find(x => x.gameStatus === 2 && (!teamFilter || x.awayTeam.teamTricode === teamFilter || x.homeTeam.teamTricode === teamFilter));
  if (!g && teamFilter) g = games.find(x => x.awayTeam.teamTricode === teamFilter || x.homeTeam.teamTricode === teamFilter);
  if (!g) g = games.find(x => x.gameStatus === 2);
  if (g) { gameId = g.gameId; gameTag = `${g.awayTeam.teamTricode} @ ${g.homeTeam.teamTricode}`; }
}

// interpolation state
let anchorSec = null, anchorAt = 0, lastFeedSec = null, lastChangeAt = 0;

async function tick() {
  try {
    const now = Date.now();
    if (!gameId || now - lastGidCheck > 30000) { await resolveGame(); lastGidCheck = now; }
    if (!gameId) { process.stdout.write('\rNo live game…            '); return; }
    const r = await fetch(boxUrl(gameId), H);
    if (!r.ok) { process.stdout.write(`\rboxscore HTTP ${r.status}      `); return; }
    const d = await r.json();
    const g = d.game || {};
    const feedSec = parsePT(g.gameClock);
    const period = g.period || 0;
    const status = g.gameStatusText || '';

    if (feedSec != null) {
      if (lastFeedSec === null || Math.abs(feedSec - lastFeedSec) > 0.05) {
        // clock value changed → re-anchor to the fresh value
        anchorSec = feedSec; anchorAt = now; lastChangeAt = now;
      }
      lastFeedSec = feedSec;
    }

    // running if the value changed within the last few seconds (else the clock is stopped)
    const running = anchorSec != null && (now - lastChangeAt) < 3500 && anchorSec > 0;
    let outSec = anchorSec == null ? (feedSec || 0) : anchorSec;
    if (running) outSec = Math.max(0, anchorSec - (now - anchorAt) / 1000);

    await db.doc(`live_graphics/${token}`).set({
      nbaClock: { sec: outSec, clock: '', period, status, running, ts: now },
    }, { merge: true });

    const mm = Math.floor(Math.ceil(outSec) / 60), ss = Math.ceil(outSec) % 60;
    process.stdout.write(`\r${gameTag}  ${status}  → ${outSec >= 60 ? `${mm}:${String(ss).padStart(2, '0')}` : outSec.toFixed(1)}  ${running ? '▶' : '⏸'}     `);
  } catch (e) { process.stdout.write(`\rerror: ${e.message}            `); }
}

console.log(`\nPRO-LOGIC clock agent (boxscore feed)`);
console.log(`  feed:  ${host} (${league.toUpperCase()})  |  team: ${teamFilter || 'first live'}`);
console.log(`  doc:   live_graphics/${token}`);
console.log(`  writing the smooth arena clock every second… (Ctrl+C to stop)\n`);
tick();
setInterval(tick, 1000);

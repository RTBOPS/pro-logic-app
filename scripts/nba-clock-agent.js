#!/usr/bin/env node
/*
 * PRO-LOGIC — NBA/WNBA local clock agent
 * -------------------------------------------------------------
 * Reads the game clock from the NBA's own public liveData feed
 * (cdn.wnba.com / cdn.nba.com — the same source Courtside uses)
 * and writes it to your live_graphics doc ~every second. The output
 * overlay then shows THAT clock, matching the arena/Courtside exactly.
 * Runs on your machine (residential IP), which can reach the feed.
 *
 * Usage:
 *   node scripts/nba-clock-agent.js <token> [wnba|nba] [TEAM]
 *   token = the id at the end of your Output URL (…/graphics-out/<token>)
 *   TEAM  = optional tricode (e.g. TOR) if several games are live
 *
 * Stop with Ctrl+C.
 */
const fs = require('fs');
const path = require('path');

// Load Firebase Admin creds from .env.local
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
if (!token) {
  console.error('Usage: node scripts/nba-clock-agent.js <token> [wnba|nba] [TEAM]');
  process.exit(1);
}
const lid = league === 'nba' ? '00' : '10';
const host = league === 'nba' ? 'cdn.nba.com' : 'cdn.wnba.com';
const url = `https://${host}/static/json/liveData/scoreboard/todaysScoreboard_${lid}.json`;
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Referer: `https://www.${league}.com/`, Accept: 'application/json' };

function parsePT(s) {
  const m = /PT(\d+)M([\d.]+)S/.exec(s || '');
  if (!m) return null;
  const mm = parseInt(m[1], 10);
  const ss = parseFloat(m[2]);
  const sec = mm * 60 + ss;
  const display = sec >= 60 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : sec.toFixed(1);
  return { display, sec };
}

let last = '';
async function tick() {
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) { process.stdout.write(`\rfeed HTTP ${r.status}            `); return; }
    const j = await r.json();
    const games = j.scoreboard?.games || [];
    let g = games.find(x => x.gameStatus === 2 && (!teamFilter || x.awayTeam.teamTricode === teamFilter || x.homeTeam.teamTricode === teamFilter));
    if (!g && teamFilter) g = games.find(x => x.awayTeam.teamTricode === teamFilter || x.homeTeam.teamTricode === teamFilter);
    if (!g) g = games.find(x => x.gameStatus === 2);
    if (!g) { process.stdout.write('\rNo live game right now…            '); return; }
    const pc = parsePT(g.gameClock);
    const payload = {
      clock: pc ? pc.display : '',
      sec: pc ? pc.sec : null,
      period: g.period || 0,
      status: g.gameStatusText || '',
      running: !!(g.gameClock && g.gameClock !== 'PT00M00.00S' && g.gameStatus === 2),
      ts: Date.now(),
    };
    await db.doc(`live_graphics/${token}`).set({ nbaClock: payload }, { merge: true });
    const tag = `${g.awayTeam.teamTricode} ${g.awayTeam.score} @ ${g.homeTeam.score} ${g.homeTeam.teamTricode}`;
    if (payload.clock !== last) { last = payload.clock; }
    process.stdout.write(`\r${tag}  ${g.gameStatusText}  → ${payload.clock}     `);
  } catch (e) {
    process.stdout.write(`\rerror: ${e.message}            `);
  }
}

console.log(`\nPRO-LOGIC clock agent`);
console.log(`  feed:  ${host} (${league.toUpperCase()})`);
console.log(`  doc:   live_graphics/${token}`);
console.log(`  team:  ${teamFilter || 'first live game'}`);
console.log(`  writing the arena clock every second… (Ctrl+C to stop)\n`);
tick();
setInterval(tick, 1000);

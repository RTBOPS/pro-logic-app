#!/usr/bin/env node
/* OES ISC-9000IP → Pro-Logic CG clock agent.
 *
 * The ISC9000-IP bridges its serial game-data stream over UDP unicast: in the
 * controller's Ethernet module you add this machine's IP + a UDP port under
 * "UDP Client Settings" → "Send data to the following network services"
 * (manual p.40-41: send on 25ms idle / 1024 bytes, UART 115200-8-N-1).
 *
 * Modes:
 *   node scripts/oes-clock-agent.js capture <port>
 *     Prints every UDP frame as hex + ASCII and appends raw bytes to
 *     oes-capture-<timestamp>.bin — run this at the arena first so we can
 *     decode the STANDARD/PRO frame layout from a real game.
 *
 *   node scripts/oes-clock-agent.js run <port> <token>
 *     Parses frames (parseFrame below — filled in once we have a capture)
 *     and writes { nbaClock: { sec, clock, period, running, ts } } to
 *     live_graphics/<token>, the field the output overlay already prefers.
 *     Needs FIREBASE_* env vars or ../.env.local (same as the app).
 */
const dgram = require('node:dgram');
const fs = require('node:fs');
const path = require('node:path');

const [, , mode = 'capture', portArg = '5000', token] = process.argv;
const PORT = parseInt(portArg, 10) || 5000;

/* ── frame parser ──────────────────────────────────────────────
 * UNKNOWN until we capture a real game. The OES "message protocol"
 * (STANDARD / PRO, per-sport) is not published in the user manual.
 * Once we have oes-capture-*.bin from the arena, implement here and
 * return { sec, clock, period, running } or null while unknown. */
function parseFrame(buf) {
  void buf;
  return null;
}

function hexDump(buf) {
  const hex = buf.toString('hex').replace(/(..)/g, '$1 ').trim();
  const ascii = [...buf].map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
  return `${hex}\n    "${ascii}"`;
}

const sock = dgram.createSocket('udp4');

if (mode === 'capture') {
  const out = path.join(process.cwd(), `oes-capture-${Date.now()}.bin`);
  const fd = fs.openSync(out, 'a');
  let n = 0;
  sock.on('message', (buf, rinfo) => {
    n++;
    // length-prefixed so frames stay separable in the capture file
    const len = Buffer.alloc(4); len.writeUInt32BE(buf.length);
    fs.writeSync(fd, Buffer.concat([len, buf]));
    console.log(`[${new Date().toISOString()}] #${n} ${rinfo.address}:${rinfo.port} ${buf.length}B\n  ${hexDump(buf)}`);
  });
  sock.bind(PORT, () => console.log(`OES capture listening on UDP :${PORT}\nSaving raw frames to ${out}\nStart the game clock and let it run + stop a few times, then send us this file.`));
} else if (mode === 'run') {
  if (!token) { console.error('usage: node scripts/oes-clock-agent.js run <port> <token>'); process.exit(1); }
  const admin = require('firebase-admin');
  const envFile = path.join(__dirname, '..', '.env.local');
  const env = { ...process.env };
  if (fs.existsSync(envFile)) for (const l of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) { let v = l.slice(i + 1).trim(); if (v.startsWith('"')) v = v.slice(1, -1); env[l.slice(0, i).trim()] ||= v; }
  }
  admin.initializeApp({ credential: admin.credential.cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
  const doc = admin.firestore().doc(`live_graphics/${token}`);
  let last = '';
  sock.on('message', buf => {
    const f = parseFrame(buf);
    if (!f) return;
    const key = `${f.clock}|${f.period}|${f.running}`;
    if (key === last) return;   // only write on change — the clock ticks once a second
    last = key;
    doc.set({ nbaClock: { ...f, ts: Date.now() } }, { merge: true }).catch(e => console.error('write failed:', e.message));
    console.log(`clock → ${f.clock} P${f.period} ${f.running ? '▶' : '⏸'}`);
  });
  sock.bind(PORT, () => console.log(`OES agent on UDP :${PORT} → live_graphics/${token} (parser: ${parseFrame(Buffer.alloc(0)) === null ? 'PENDING CAPTURE' : 'active'})`));
} else {
  console.error('modes: capture <port> | run <port> <token>');
  process.exit(1);
}

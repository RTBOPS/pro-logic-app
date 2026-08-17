'use client';

/* Graphics output — the page a vision mixer captures (OBS/vMix/ATEM browser
   source, 1920×1080). Transparent background by default; ?bg=green for chroma,
   ?bg=dark for preview. No login: it reads a public live_graphics token doc
   for the operator's cues and polls the NBA feed for live data. */

import { useState, useEffect, useMemo, use } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AnimatePresence, motion } from 'framer-motion';
import {
  normalizeSummary, gameLeaders, comparedTeamStats, periodLabel,
  type Summary, type Athlete,
} from '@/lib/nba';

interface GfxDoc {
  eventId?: string;
  bug?: boolean;
  lowerId?: string | null;
  full?: 'teamstats' | 'lineups' | 'leaders' | null;
}

export default function GraphicsOutput({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [gfx, setGfx] = useState<GfxDoc>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bg, setBg] = useState('transparent');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('bg');
    if (p === 'green') setBg('#00ff00');
    else if (p === 'dark') setBg('linear-gradient(140deg,#111827,#1f2937)');
  }, []);

  /* Operator cues (real-time) */
  useEffect(() => {
    return onSnapshot(doc(db, 'live_graphics', token),
      snap => setGfx(snap.exists() ? (snap.data() as GfxDoc) : {}),
      () => setGfx({}));
  }, [token]);

  /* Live game data (4 s poll) */
  useEffect(() => {
    const eventId = gfx.eventId;
    if (!eventId) { setSummary(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/nba/summary?event=${eventId}`);
        const json = await res.json();
        if (alive) setSummary(normalizeSummary(json));
      } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [gfx.eventId]);

  const lower: Athlete | null = useMemo(() => {
    if (!summary || !gfx.lowerId) return null;
    return [...summary.home.athletes, ...summary.away.athletes].find(a => a.id === gfx.lowerId) || null;
  }, [summary, gfx.lowerId]);

  return (
    <div className="fixed inset-0 overflow-hidden font-sans" style={{ background: bg }}>
      {summary && (
        <>
          {/* ── SCORE BUG ── */}
          <AnimatePresence>
            {gfx.bug && (
              <motion.div
                initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="absolute bottom-8 left-8 flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white"
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                <TeamCell team={summary.away} />
                <div className="bg-zinc-900 px-4 flex flex-col items-center justify-center min-w-[92px]">
                  {summary.state === 'in' ? (
                    <>
                      <span className="text-yellow-400 font-bold text-lg leading-tight">{summary.clock}</span>
                      <span className="text-zinc-400 text-xs font-semibold">{periodLabel(summary.period)}</span>
                    </>
                  ) : (
                    <span className="text-zinc-300 text-xs font-bold uppercase text-center leading-tight px-1">{summary.statusDetail}</span>
                  )}
                </div>
                <TeamCell team={summary.home} reverse />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PLAYER LOWER THIRD ── */}
          <AnimatePresence>
            {lower && (
              <motion.div
                key={lower.id}
                initial={{ x: -420, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -420, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                className="absolute bottom-28 left-8 flex items-end">
                <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-2xl relative"
                  style={{ background: `linear-gradient(160deg, ${lower.teamColor}, #111)` }}>
                  {lower.headshot && <img src={lower.headshot} className="absolute inset-0 w-full h-full object-cover object-top" alt="" />}
                </div>
                <div className="ml-[-10px] mb-2">
                  <div className="bg-zinc-900/95 text-white pl-6 pr-8 py-3 rounded-tr-2xl shadow-2xl">
                    <div className="text-2xl font-black leading-none">{lower.name}</div>
                    <div className="text-xs font-semibold mt-1" style={{ color: lower.teamColor === '#1f2937' ? '#9ca3af' : lower.teamColor }}>
                      {lower.teamAbbr} · #{lower.jersey} · {lower.pos}
                    </div>
                  </div>
                  <div className="flex text-white shadow-2xl rounded-br-2xl overflow-hidden">
                    <StatChip label="PTS" value={lower.stats.pts} color={lower.teamColor} big />
                    <StatChip label="REB" value={lower.stats.reb} />
                    <StatChip label="AST" value={lower.stats.ast} />
                    <StatChip label="FG" value={lower.stats.fg} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── FULL SCREENS ── */}
          <AnimatePresence>
            {gfx.full && (
              <motion.div
                key={gfx.full}
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center justify-center">
                <div className="w-[900px] max-w-[92vw] bg-zinc-900/95 text-white rounded-3xl shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-8 py-4"
                    style={{ background: `linear-gradient(90deg, ${summary.away.color}cc, #18181b 45%, #18181b 55%, ${summary.home.color}cc)` }}>
                    <div className="flex items-center gap-3">
                      {summary.away.logo && <img src={summary.away.logo} className="w-10 h-10" alt="" />}
                      <span className="text-2xl font-black">{summary.away.abbr}</span>
                      <span className="text-3xl font-black">{summary.away.score}</span>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-yellow-400">{summary.state === 'in' ? `${periodLabel(summary.period)} · ${summary.clock}` : summary.statusDetail}</div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-400 mt-0.5">
                        {gfx.full === 'teamstats' ? 'Team Stats' : gfx.full === 'lineups' ? 'Starting Lineups' : 'Top Performers'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black">{summary.home.score}</span>
                      <span className="text-2xl font-black">{summary.home.abbr}</span>
                      {summary.home.logo && <img src={summary.home.logo} className="w-10 h-10" alt="" />}
                    </div>
                  </div>

                  {gfx.full === 'teamstats' && <TeamStats summary={summary} />}
                  {gfx.full === 'lineups' && <Lineups summary={summary} />}
                  {gfx.full === 'leaders' && <Leaders summary={summary} />}

                  <div className="px-8 py-2.5 bg-black/40 text-right text-[10px] uppercase tracking-widest text-zinc-500">
                    PRO-LOGIC Studio · Live Graphics
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function TeamCell({ team, reverse = false }: { team: Summary['home']; reverse?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${reverse ? 'flex-row-reverse' : ''}`}
      style={{ background: `linear-gradient(${reverse ? '270deg' : '90deg'}, ${team.color}, #18181b 140%)` }}>
      {team.logo && <img src={team.logo} className="w-9 h-9 drop-shadow" alt="" />}
      <span className="font-black text-xl tracking-wide">{team.abbr}</span>
      <span className="font-black text-3xl">{team.score}</span>
    </div>
  );
}

function StatChip({ label, value, color, big = false }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div className={`px-4 py-2 text-center ${big ? '' : 'bg-zinc-800/95'}`}
      style={big ? { background: color || '#7c3aed' } : undefined}>
      <div className="text-lg font-black leading-none">{value || '0'}</div>
      <div className="text-[9px] font-bold text-white/70 tracking-widest">{label}</div>
    </div>
  );
}

function TeamStats({ summary }: { summary: Summary }) {
  const rows = comparedTeamStats(summary);
  const pct = (v: string) => Math.min(100, parseFloat(v) || 0);
  return (
    <div className="px-10 py-6 space-y-3">
      {rows.map(r => {
        const a = pct(r.away), h = pct(r.home);
        const total = a + h || 1;
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-sm font-bold mb-1">
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.away}</span>
              <span className="text-[11px] uppercase tracking-widest text-zinc-400">{r.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.home}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
              <div style={{ width: `${(a / total) * 100}%`, background: summary.away.color }} />
              <div className="flex-1" style={{ background: summary.home.color, opacity: 0.9 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Lineups({ summary }: { summary: Summary }) {
  const five = (t: Summary['home']) => t.athletes.filter(a => a.starter).slice(0, 5);
  return (
    <div className="px-8 py-6 grid grid-cols-2 gap-8">
      {[summary.away, summary.home].map(team => (
        <div key={team.abbr}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: team.color }}>{team.name}</div>
          <div className="space-y-2">
            {five(team).map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-1.5">
                {a.headshot ? <img src={a.headshot} className="w-10 h-10 rounded-full object-cover object-top bg-zinc-700" alt="" /> : <div className="w-10 h-10 rounded-full bg-zinc-700" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{a.name}</div>
                  <div className="text-[10px] text-zinc-400">#{a.jersey} · {a.pos}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Leaders({ summary }: { summary: Summary }) {
  const top = gameLeaders(summary, 3);
  return (
    <div className="px-8 py-8 grid grid-cols-3 gap-6">
      {top.map((a, i) => (
        <div key={a.id} className="rounded-2xl overflow-hidden bg-zinc-800/60">
          <div className="h-40 relative" style={{ background: `linear-gradient(160deg, ${a.teamColor}, #111)` }}>
            {a.headshot && <img src={a.headshot} className="absolute inset-0 w-full h-full object-cover object-top" alt="" />}
            <div className="absolute top-2 left-2 bg-black/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {i === 0 ? '★ GAME LEADER' : `#${i + 1}`}
            </div>
          </div>
          <div className="p-4">
            <div className="font-black leading-tight">{a.name}</div>
            <div className="text-[10px] font-semibold mb-3" style={{ color: a.teamColor }}>{a.teamAbbr} · #{a.jersey} · {a.pos}</div>
            <div className="flex gap-4 text-center">
              {[['PTS', a.stats.pts], ['REB', a.stats.reb], ['AST', a.stats.ast]].map(([l, v]) => (
                <div key={l}>
                  <div className="text-xl font-black">{v || '0'}</div>
                  <div className="text-[9px] text-zinc-400 font-bold tracking-widest">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

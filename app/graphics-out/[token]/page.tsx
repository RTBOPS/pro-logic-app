'use client';

/* Graphics output — the page a vision mixer captures (OBS/vMix/ATEM browser
   source, 1920×1080). Transparent background by default; ?bg=green for chroma,
   ?bg=dark for preview. No login: it reads a public live_graphics token doc
   for the operator's cues and polls the NBA feed for live data. */

import { useState, useEffect, useMemo, useRef, use } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AnimatePresence, motion } from 'framer-motion';
import PlayerPhoto from '@/components/PlayerPhoto';
import {
  normalizeSummary, gameLeaders, comparedTeamStats, periodLabel, detectCallouts,
  manualToSummary, topFive, DEFAULT_PORTAL_VIDEO, DEFAULT_PORTAL_VIDEO_HEVC, type ManualGame,
  type Summary, type Athlete, type Callout,
} from '@/lib/nba';

interface BusState {
  bug?: boolean;
  lowerId?: string | null;
  full?: 'teamstats' | 'lineups' | 'leaders' | 'matchup' | 'trivia' | null;
  banner?: string | null;               // URL of the currently-aired banner
  portal?: boolean;                     // hoop-portal sponsor reveal
  talent?: boolean;                     // broadcast team graphic
  mention?: boolean;                    // special guest / VIP mention
}

interface GfxDoc extends BusState {
  eventId?: string;
  league?: string;
  sourceMode?: 'feed' | 'manual';       // manual: operator-keyed game data
  manual?: ManualGame | null;
  preview?: BusState | null;            // staged look — aired via TAKE
  brand?: { logo?: string; name?: string } | null;
  showBrand?: boolean;
  autoCallouts?: boolean;
  callout?: Callout | null;             // manual fire from the control panel
  theme?: { useTeamColors?: boolean; c1?: string; c2?: string; logoScale?: number; brandScale?: number; motion?: boolean } | null;
  trivia?: { question?: string; options?: string[]; correct?: number; sponsor?: string; reveal?: boolean } | null;
  portalCfg?: { x?: number; y?: number; size?: number; logo?: string; video?: string; content?: 'logo' | 'trivia' } | null;
  talentCfg?: { list?: { id: string; name: string; role: string; photo: string }[] } | null;
  mentionCfg?: { label?: string; name?: string; title?: string; photo?: string } | null;
}

const CALLOUT_MS = 4500;

export default function GraphicsOutput({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [gfx, setGfx] = useState<GfxDoc>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bg, setBg] = useState('transparent');
  const [queue, setQueue] = useState<Callout[]>([]);
  const prevSummary = useRef<Summary | null>(null);
  const lastManual = useRef<string>('');

  const [busMode, setBusMode] = useState<'program' | 'preview'>('program');
  const [cursorHidden, setCursorHidden] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('bg');
    if (p === 'green') setBg('#00ff00');
    else if (p === 'dark') setBg('linear-gradient(140deg,#111827,#1f2937)');
    if (q.get('mode') === 'preview') setBusMode('preview');
  }, []);

  /* Clean HDMI/screen output: F or double-click → fullscreen, cursor
     auto-hides after 3 s idle, and a wake lock keeps the display on. */
  useEffect(() => {
    const goFullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'f' || e.key === 'F') goFullscreen(); };
    let idle: ReturnType<typeof setTimeout>;
    const onMove = () => {
      setCursorHidden(false);
      clearTimeout(idle);
      idle = setTimeout(() => setCursorHidden(true), 3000);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('dblclick', goFullscreen);
    document.addEventListener('mousemove', onMove);
    onMove();

    let lock: any = null;
    const acquire = () => (navigator as any).wakeLock?.request('screen')
      .then((l: any) => { lock = l; }).catch(() => {});
    acquire();
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('dblclick', goFullscreen);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(idle);
      lock?.release?.().catch?.(() => {});
    };
  }, []);

  /* Operator cues (real-time) */
  useEffect(() => {
    return onSnapshot(doc(db, 'live_graphics', token),
      snap => setGfx(snap.exists() ? (snap.data() as GfxDoc) : {}),
      () => setGfx({}));
  }, [token]);

  /* Manual callouts from the control panel */
  useEffect(() => {
    const c = gfx.callout;
    if (c?.id && c.id !== lastManual.current) {
      lastManual.current = c.id;
      setQueue(q => [...q, c].slice(-6));
    }
  }, [gfx.callout]);

  /* Live game data + auto callout detection.
     Feed mode: poll our NBA proxy every 4 s.
     Manual mode: rebuild from the operator-keyed doc every 500 ms so the
     running clock ticks locally between doc updates. */
  useEffect(() => {
    if (gfx.sourceMode === 'manual') {
      if (!gfx.manual) { setSummary(null); prevSummary.current = null; return; }
      const tick = () => {
        const next = manualToSummary(gfx.manual!);
        if (gfx.autoCallouts !== false) {
          const events = detectCallouts(prevSummary.current, next);
          if (events.length) setQueue(q => [...q, ...events].slice(-6));
        }
        prevSummary.current = next;
        setSummary(next);
      };
      tick();
      const t = setInterval(tick, 500);
      return () => clearInterval(t);
    }

    const eventId = gfx.eventId;
    if (!eventId) { setSummary(null); prevSummary.current = null; return; }
    let alive = true;
    const league = gfx.league || 'nba';
    const load = async () => {
      try {
        const res = await fetch(`/api/nba/summary?event=${eventId}&league=${league}`);
        const json = await res.json();
        if (!alive) return;
        const next = normalizeSummary(json);
        if (next) {
          if (gfx.autoCallouts !== false && next.state === 'in') {
            const events = detectCallouts(prevSummary.current, next);
            if (events.length) setQueue(q => [...q, ...events].slice(-6));
          }
          prevSummary.current = next;
          setSummary(next);
        }
      } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [gfx.eventId, gfx.autoCallouts, gfx.sourceMode, gfx.manual, gfx.league]);

  /* Callout queue: show one at a time */
  const current = queue[0] || null;
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue(q => q.slice(1)), current.ms || CALLOUT_MS);
    return () => clearTimeout(t);
  }, [current?.id]);

  /* Which bus this window shows: program (default) or the staged preview */
  const bus: BusState = busMode === 'preview' ? (gfx.preview || {}) : gfx;

  const lower: Athlete | null = useMemo(() => {
    if (!summary || !bus.lowerId) return null;
    return [...summary.home.athletes, ...summary.away.athletes].find(a => a.id === bus.lowerId) || null;
  }, [summary, bus.lowerId]);

  /* Theme: official team colors by default, operator overrides at will */
  const custom = !!(gfx.theme && gfx.theme.useTeamColors === false);
  const awayColor = custom && gfx.theme?.c1 ? gfx.theme.c1 : summary?.away.color || '#1f2937';
  const homeColor = custom && gfx.theme?.c2 ? gfx.theme.c2 : summary?.home.color || '#1f2937';
  const calloutColor = (c: Callout) => (custom ? awayColor : c.color) || '#7c3aed';

  const brand = gfx.showBrand !== false && gfx.brand?.logo ? gfx.brand : null;
  const logoScale = gfx.theme?.logoScale || 1;
  const brandScale = gfx.theme?.brandScale || 1;
  const motionOn = !!gfx.theme?.motion;

  return (
    <div className="fixed inset-0 overflow-hidden font-sans"
      style={{ background: bg, cursor: cursorHidden ? 'none' : 'default' }}>
      {/* Warm the default portal FX so firing it is instant */}
      <video muted playsInline preload="auto" className="hidden">
        <source src={DEFAULT_PORTAL_VIDEO} type="video/webm" />
        <source src={DEFAULT_PORTAL_VIDEO_HEVC} type="video/quicktime" />
      </video>
      <style>{`
        @keyframes plg-cell-flash { 0% { filter: brightness(2.6) saturate(0.4); } 100% { filter: brightness(1) saturate(1); } }
        @keyframes plg-rise { from { opacity: 0; transform: translateY(46px) scale(0.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes plg-slide-r { from { opacity: 0; transform: translateX(70px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      {summary && (
        <>
          {/* ── SCORE BUG ── */}
          <AnimatePresence>
            {bus.bug && (
              <motion.div
                initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="absolute bottom-8 left-8"
                style={{ fontVariantNumeric: 'tabular-nums' }}>

                {/* Callout pill above the bug */}
                <AnimatePresence mode="popLayout">
                  {busMode === 'program' && current && (
                    <motion.div key={current.id}
                      initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      className="mb-2 inline-flex items-center gap-3 rounded-xl overflow-hidden shadow-2xl text-white">
                      <div className="px-4 py-2 font-black text-lg tracking-wide"
                        style={{ background: calloutColor(current) }}>
                        {current.title}
                      </div>
                      {current.sub && (
                        <div className="pr-4 py-2 -ml-1 text-sm font-semibold bg-zinc-900/95 pl-3 self-stretch flex items-center">
                          {current.sub}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white">
                  {motionOn && (
                    <motion.div
                      animate={{ x: ['-130%', '430%'] }}
                      transition={{ repeat: Infinity, duration: 1.8, repeatDelay: 4.5, ease: 'easeInOut' }}
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-10" />
                  )}
                  {/* Company brand chip */}
                  {brand && (
                    <div className="bg-white px-3 flex items-center">
                      <img src={brand.logo} className="object-contain" style={{ height: 32 * brandScale, maxWidth: 72 * brandScale }} alt={brand.name || ''} />
                    </div>
                  )}
                  <TeamCell team={summary.away} color={awayColor} scale={logoScale} float={motionOn} />
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
                  <TeamCell team={summary.home} color={homeColor} scale={logoScale} float={motionOn} reverse />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CUSTOM BANNER ── */}
          <AnimatePresence>
            {bus.banner && (
              <motion.div key={bus.banner}
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2">
                <img src={bus.banner || undefined} className="max-h-28 max-w-[860px] object-contain rounded-xl shadow-2xl" alt="" />
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
                  style={{ background: `linear-gradient(160deg, ${custom ? awayColor : lower.teamColor}, #111)` }}>
                  <PlayerPhoto src={lower.headshot} className="absolute inset-0 w-full h-full object-cover object-top" />
                </div>
                <div className="ml-[-10px] mb-2">
                  <div className="bg-zinc-900/95 text-white pl-6 pr-8 py-3 rounded-tr-2xl shadow-2xl flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-black leading-none">{lower.name}</div>
                      <div className="text-xs font-semibold mt-1 text-zinc-400">
                        {lower.teamAbbr} · #{lower.jersey} · {lower.pos}
                      </div>
                    </div>
                    {lower.teamLogo && <img src={lower.teamLogo} className="w-11 h-11 object-contain drop-shadow shrink-0" alt="" />}
                  </div>
                  <div className="flex text-white shadow-2xl rounded-br-2xl overflow-hidden">
                    <StatChip label="PTS" value={lower.stats.pts} color={custom ? awayColor : lower.teamColor} big />
                    <StatChip label="REB" value={lower.stats.reb} />
                    <StatChip label="AST" value={lower.stats.ast} />
                    <StatChip label="FG" value={lower.stats.fg} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── HOOP PORTAL (AR-style sponsor/trivia reveal on the backboard cam)
              Pure CSS animations: VP9-alpha decode can starve the JS rAF loop on
              weaker machines, but compositor-driven CSS keeps animating. ── */}
          {bus.portal && (() => {
            const cfg = gfx.portalCfg || {};
            const size = cfg.size || 1;
            const video = cfg.video === 'ring' ? '' : (cfg.video || DEFAULT_PORTAL_VIDEO);
            const logo = cfg.logo || gfx.trivia?.sponsor || brand?.logo || '';
            const showTrivia = cfg.content === 'trivia';
            const t = gfx.trivia || {};
            const emergeFrom = video ? 170 * size : 0;
            const contentY = showTrivia ? (video ? 335 * size : 105 * size) : (video ? 330 * size : 120 * size);
            return (
              <div className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${cfg.x ?? 50}%`, top: `${cfg.y ?? 30}%` }}>
                <style>{`
                  @keyframes plg-portal-in { from { opacity: 0; transform: scale(0.55); } to { opacity: 1; transform: scale(1); } }
                  @keyframes plg-drop { from { opacity: 0; transform: translate(-50%, var(--plg-from)) scale(0.25); } to { opacity: 1; transform: translate(-50%, var(--plg-to)) scale(1); } }
                  @keyframes plg-float { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-7px) rotate(1.5deg); } }
                  @keyframes plg-ring-pulse { 0%, 100% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(1.05); opacity: 1; } }
                `}</style>
                <div className="relative" style={{ animation: 'plg-portal-in 0.5s ease-out both' }}>

                  {/* Content emerging from behind the portal, downward */}
                  {(showTrivia || logo) && (
                    <div className="absolute left-1/2 top-0 z-0"
                      style={{
                        '--plg-from': `${emergeFrom}px`,
                        '--plg-to': `${contentY}px`,
                        transformOrigin: 'top center',
                        width: showTrivia ? 430 * size : 'auto',
                        animation: 'plg-drop 0.8s cubic-bezier(0.34, 1.4, 0.64, 1) 0.35s both',
                      } as React.CSSProperties}>
                      {showTrivia ? (
                        <div className="bg-zinc-900/95 text-white rounded-2xl shadow-2xl border border-amber-500/40 overflow-hidden">
                          <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
                            <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-amber-400">
                              Trivia {(t.sponsor || logo) && 'presented by'}
                            </span>
                            {(t.sponsor || logo) && <img src={t.sponsor || logo} className="h-6 max-w-[110px] object-contain" alt="" />}
                          </div>
                          <div className="px-4 pb-3 text-base font-black leading-tight">{t.question || '…'}</div>
                          <div className="px-3 pb-3 space-y-1.5">
                            {(t.options || []).map((opt, i) => {
                              const isCorrect = t.reveal && i === (t.correct ?? 0);
                              const dimmed = t.reveal && !isCorrect;
                              return (
                                <div key={i}
                                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-bold transition-all duration-500 ${
                                    isCorrect ? 'bg-green-500/25 ring-1 ring-green-400' : dimmed ? 'bg-zinc-800/50 opacity-40' : 'bg-zinc-800/80'}`}>
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                                    style={{ background: isCorrect ? '#22c55e' : '#f59e0b' }}>
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span className="leading-tight">{opt || '—'}</span>
                                  {isCorrect && <span className="ml-auto text-green-400 font-black">✓</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <img src={logo} alt=""
                          className="object-contain drop-shadow-2xl"
                          style={{ maxWidth: 200 * size, maxHeight: 100 * size, animation: 'plg-float 3.2s ease-in-out 1.2s infinite' }} />
                      )}
                    </div>
                  )}

                  {/* The portal itself: fire FX video (alpha) or the CSS golden ring */}
                  {video ? (
                    <video autoPlay loop muted playsInline preload="auto"
                      ref={el => { if (el && el.paused) el.play().catch(() => {}); }}
                      className="relative z-10 pointer-events-none"
                      style={{ width: 700 * size, maxWidth: 'none' }}>
                      {video === DEFAULT_PORTAL_VIDEO ? (
                        <>
                          <source src={DEFAULT_PORTAL_VIDEO} type="video/webm" />
                          <source src={DEFAULT_PORTAL_VIDEO_HEVC} type="video/quicktime" />
                        </>
                      ) : (
                        <source src={video} />
                      )}
                    </video>
                  ) : (
                    <>
                      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                        style={{
                          top: 20 * size, width: 190 * size, height: 190 * size,
                          background: 'linear-gradient(180deg, rgba(251,191,36,0.4), transparent)',
                          clipPath: 'polygon(22% 0, 78% 0, 95% 100%, 5% 100%)',
                        }} />
                      <div className="relative z-10 rounded-[50%]"
                        style={{
                          width: 240 * size, height: 84 * size,
                          border: `${5 * size}px solid #fbbf24`,
                          boxShadow: `0 0 ${30 * size}px rgba(251,191,36,0.9), inset 0 0 ${26 * size}px rgba(251,191,36,0.7)`,
                          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55), rgba(251,191,36,0.12))',
                          animation: 'plg-ring-pulse 1.8s ease-in-out infinite',
                        }} />
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── BROADCAST TEAM (commentators) ── */}
          {bus.talent && (gfx.talentCfg?.list || []).length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-4">
              {(gfx.talentCfg?.list || []).map((c, i) => (
                <div key={c.id}
                  className="w-52 rounded-2xl overflow-hidden shadow-2xl bg-zinc-900/95 text-white"
                  style={{ animation: `plg-rise 0.6s cubic-bezier(0.34, 1.3, 0.64, 1) ${i * 0.18}s both` }}>
                  <div className="h-40 relative" style={{ background: `linear-gradient(160deg, ${awayColor}, #111)` }}>
                    <PlayerPhoto src={c.photo} className="absolute inset-0 w-full h-full object-cover object-top" />
                  </div>
                  <div className="px-3 py-2.5 border-t-2" style={{ borderColor: awayColor }}>
                    <div className="font-black leading-tight truncate">{c.name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{c.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SPECIAL MENTION / VIP ── */}
          {bus.mention && gfx.mentionCfg?.name && (
            <div className="absolute right-10 bottom-28 w-80"
              style={{ animation: 'plg-slide-r 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>
              <div className="rounded-2xl overflow-hidden shadow-2xl bg-zinc-900/95 text-white">
                <div className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-black"
                  style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' }}>
                  ★ {gfx.mentionCfg.label || 'Special Guest'}
                </div>
                <div className="h-64 relative" style={{ background: `linear-gradient(160deg, ${homeColor}, #111)` }}>
                  <PlayerPhoto src={gfx.mentionCfg.photo} className="absolute inset-0 w-full h-full object-cover object-top" />
                  {brand?.logo && <img src={brand.logo} className="absolute top-2 right-2 h-6 max-w-[70px] object-contain bg-white/90 rounded px-1" alt="" />}
                </div>
                <div className="px-4 py-3">
                  <div className="text-xl font-black leading-tight">{gfx.mentionCfg.name}</div>
                  {gfx.mentionCfg.title && <div className="text-xs text-zinc-400 mt-0.5">{gfx.mentionCfg.title}</div>}
                </div>
              </div>
            </div>
          )}

          {/* ── FULL SCREENS ── */}
          <AnimatePresence>
            {bus.full && (
              <motion.div
                key={bus.full}
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center justify-center">
                <div className="w-[900px] max-w-[92vw] bg-zinc-900/95 text-white rounded-3xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-8 py-4"
                    style={{ background: `linear-gradient(90deg, ${awayColor}cc, #18181b 45%, #18181b 55%, ${homeColor}cc)` }}>
                    <div className="flex items-center gap-3">
                      {summary.away.logo && <img src={summary.away.logo} style={{ width: 40 * logoScale, height: 40 * logoScale }} alt="" />}
                      <span className="text-2xl font-black">{summary.away.abbr}</span>
                      <Score value={summary.away.score} />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-yellow-400">{summary.state === 'in' ? `${periodLabel(summary.period)} · ${summary.clock}` : summary.statusDetail}</div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-400 mt-0.5">
                        {bus.full === 'teamstats' ? 'Team Stats' : bus.full === 'lineups' ? 'Starting Lineups' : bus.full === 'matchup' ? 'Matchup — Top 5' : bus.full === 'trivia' ? 'Trivia' : 'Top Performers'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Score value={summary.home.score} />
                      <span className="text-2xl font-black">{summary.home.abbr}</span>
                      {summary.home.logo && <img src={summary.home.logo} style={{ width: 40 * logoScale, height: 40 * logoScale }} alt="" />}
                    </div>
                  </div>

                  {bus.full === 'teamstats' && <TeamStats summary={summary} awayColor={awayColor} homeColor={homeColor} />}
                  {bus.full === 'lineups' && <Lineups summary={summary} awayColor={awayColor} homeColor={homeColor} />}
                  {bus.full === 'leaders' && <Leaders summary={summary} custom={custom} awayColor={awayColor} />}
                  {bus.full === 'matchup' && <Matchup summary={summary} awayColor={awayColor} homeColor={homeColor} />}
                  {bus.full === 'trivia' && <Trivia trivia={gfx.trivia || {}} sponsorFallback={brand?.logo || ''} accent={awayColor} />}

                  <div className="px-8 py-2.5 bg-black/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {brand && <img src={brand.logo} className="h-5 max-w-[90px] object-contain brightness-0 invert opacity-80" alt="" />}
                      {brand?.name && <span className="text-[10px] font-semibold text-zinc-400">{brand.name}</span>}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">PRO-LOGIC Studio · Live Graphics</span>
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

/* Score number with a pulse when it changes */
function Score({ value, big = false }: { value: string; big?: boolean }) {
  return (
    <motion.span key={value} initial={{ scale: 1.45, color: '#fde047' }} animate={{ scale: 1, color: '#ffffff' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`font-black inline-block ${big ? 'text-3xl' : 'text-3xl'}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </motion.span>
  );
}

function TeamCell({ team, color, scale = 1, float = false, reverse = false }: { team: Summary['home']; color: string; scale?: number; float?: boolean; reverse?: boolean }) {
  return (
    <div key={team.score} className={`flex items-center gap-3 px-4 py-2.5 ${reverse ? 'flex-row-reverse' : ''}`}
      style={{ background: `linear-gradient(${reverse ? '270deg' : '90deg'}, ${color}, #18181b 140%)`, animation: 'plg-cell-flash 0.9s ease-out' }}>
      {team.logo && (
        <motion.img src={team.logo} className="drop-shadow" alt=""
          style={{ width: 36 * scale, height: 36 * scale }}
          animate={float ? { y: [0, -2.5, 0], scale: [1, 1.05, 1] } : { y: 0, scale: 1 }}
          transition={float ? { repeat: Infinity, duration: 3, ease: 'easeInOut' } : undefined} />
      )}
      <span className="font-black text-xl tracking-wide">{team.abbr}</span>
      <Score value={team.score} />
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

function TeamStats({ summary, awayColor, homeColor }: { summary: Summary; awayColor: string; homeColor: string }) {
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
              <div style={{ width: `${(a / total) * 100}%`, background: awayColor }} />
              <div className="flex-1" style={{ background: homeColor, opacity: 0.9 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Lineups({ summary, awayColor, homeColor }: { summary: Summary; awayColor: string; homeColor: string }) {
  const five = (t: Summary['home']) => t.athletes.filter(a => a.starter).slice(0, 5);
  return (
    <div className="px-8 py-6 grid grid-cols-2 gap-8">
      {[{ team: summary.away, color: awayColor }, { team: summary.home, color: homeColor }].map(({ team, color }) => (
        <div key={team.abbr}>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>{team.name}</div>
          <div className="space-y-2">
            {five(team).map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-zinc-800/60 rounded-xl px-3 py-1.5">
                <PlayerPhoto src={a.headshot} className="w-10 h-10 rounded-full object-cover object-top bg-zinc-700 shrink-0" />
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

/* Sponsored trivia: question + options, correct answer revealed live */
function Trivia({ trivia, sponsorFallback, accent }: {
  trivia: { question?: string; options?: string[]; correct?: number; sponsor?: string; reveal?: boolean };
  sponsorFallback: string;
  accent: string;
}) {
  const opts = (trivia.options || []).filter(o => o !== undefined);
  const sponsor = trivia.sponsor || sponsorFallback;
  return (
    <div className="px-10 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-400">
          Trivia {sponsor && 'presented by'}
        </div>
        {sponsor && <img src={sponsor} className="h-10 max-w-[180px] object-contain" alt="" />}
      </div>
      <div className="text-3xl font-black leading-tight mb-8">{trivia.question || '…'}</div>
      <div className="grid grid-cols-3 gap-4">
        {opts.map((opt, i) => {
          const isCorrect = trivia.reveal && i === (trivia.correct ?? 0);
          const dimmed = trivia.reveal && !isCorrect;
          return (
            <motion.div key={i}
              animate={isCorrect ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={isCorrect ? { duration: 0.5 } : undefined}
              className={`rounded-2xl px-5 py-4 flex items-center gap-3 border-2 transition-colors duration-500 ${
                isCorrect ? 'bg-green-500/20 border-green-400' : dimmed ? 'bg-zinc-800/40 border-transparent opacity-40' : 'bg-zinc-800/70 border-transparent'}`}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                style={{ background: isCorrect ? '#22c55e' : accent }}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-lg font-bold leading-tight">{opt || '—'}</span>
              {isCorrect && <span className="ml-auto text-green-400 text-2xl font-black">✓</span>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* Matchup: each team's top five, revealed one by one — away on top, home below */
function Matchup({ summary, awayColor, homeColor }: { summary: Summary; awayColor: string; homeColor: string }) {
  const rows = [
    { team: summary.away, color: awayColor, five: topFive(summary.away), delay: 0 },
    { team: summary.home, color: homeColor, five: topFive(summary.home), delay: 0.9 },
  ];
  return (
    <div className="px-8 py-6 space-y-6">
      {rows.map(({ team, color, five, delay }) => (
        <div key={team.abbr}>
          <div className="flex items-center gap-2 mb-3">
            {team.logo && <img src={team.logo} className="w-6 h-6" alt="" />}
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{team.name}</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {five.map((a, i) => (
              <motion.div key={a.id}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: delay + i * 0.18, type: 'spring', stiffness: 220, damping: 22 }}
                className="rounded-xl overflow-hidden bg-zinc-800/60">
                <div className="h-24 relative" style={{ background: `linear-gradient(160deg, ${color}, #111)` }}>
                  <PlayerPhoto src={a.headshot} className="absolute inset-0 w-full h-full object-cover object-top" />
                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-[10px] font-bold px-1.5 py-0.5 rounded-full">#{a.jersey}</div>
                </div>
                <div className="px-2.5 py-2">
                  <div className="text-xs font-bold truncate">{a.name}</div>
                  <div className="text-[10px] text-zinc-400">
                    {a.pos}{a.stats.pts !== '' && a.stats.pts !== '0' ? ` · ${a.stats.pts} PTS` : ''}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Leaders({ summary, custom, awayColor }: { summary: Summary; custom: boolean; awayColor: string }) {
  const top = gameLeaders(summary, 3);
  return (
    <div className="px-8 py-8 grid grid-cols-3 gap-6">
      {top.map((a, i) => {
        const color = custom ? awayColor : a.teamColor;
        return (
          <div key={a.id} className="rounded-2xl overflow-hidden bg-zinc-800/60">
            <div className="h-40 relative" style={{ background: `linear-gradient(160deg, ${color}, #111)` }}>
              <PlayerPhoto src={a.headshot} className="absolute inset-0 w-full h-full object-cover object-top" />
              <div className="absolute top-2 left-2 bg-black/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {i === 0 ? '★ GAME LEADER' : `#${i + 1}`}
              </div>
            </div>
            <div className="p-4">
              <div className="font-black leading-tight">{a.name}</div>
              <div className="flex items-center gap-1.5 mb-3">
                {a.teamLogo && <img src={a.teamLogo} className="w-4 h-4 object-contain" alt="" />}
                <span className="text-[10px] font-semibold" style={{ color }}>{a.teamAbbr} · #{a.jersey} · {a.pos}</span>
              </div>
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
        );
      })}
    </div>
  );
}

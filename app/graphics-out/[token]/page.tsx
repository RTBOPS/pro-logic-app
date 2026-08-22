'use client';

/* Graphics output — the page a vision mixer captures (OBS/vMix/ATEM browser
   source, 1920×1080). Transparent background by default; ?bg=green for chroma,
   ?bg=dark for preview. No login: it reads a public live_graphics token doc
   for the operator's cues and polls the NBA feed for live data. */

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import PlayerPhoto from '@/components/PlayerPhoto';
import {
  normalizeSummary, gameLeaders, comparedTeamStats, periodLabel,
  manualToSummary, topFive, applyPhotoOverrides, DEFAULT_PORTAL_VIDEO, DEFAULT_PORTAL_VIDEO_HEVC, type ManualGame,
  normalizeShots, normalizePlays, normalizeAssists, assistLeaders, computeAlerts, computeSplits,
  type Summary, type Athlete, type Callout, type ShotPlay, type PlayEvent, type AssistLink, type GameAlert, type ShotSplit,
} from '@/lib/nba';

/* Selectable surface textures for the colored panels (arena bug, matchup
   banner). Returns a CSS background-image value layered over the team color;
   `intensity` (default 1) scales how visible the pattern is. */
function buildTexture(name: string | undefined, intensity = 1): string {
  const a = (0.06 * intensity).toFixed(3);
  const d = (0.09 * intensity).toFixed(3);
  const w = `rgba(255,255,255,${a})`;
  const k = `rgba(0,0,0,${d})`;
  switch (name) {
    case 'none': return '';
    case 'lines': return `repeating-linear-gradient(0deg, ${w} 0 1px, transparent 1px 9px)`;
    case 'grid': return `repeating-linear-gradient(0deg, ${w} 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, ${w} 0 1px, transparent 1px 24px)`;
    case 'carbon': return `repeating-linear-gradient(45deg, ${w} 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, ${k} 0 2px, transparent 2px 5px)`;
    case 'mesh': return `repeating-linear-gradient(45deg, ${w} 0 1px, transparent 1px 12px), repeating-linear-gradient(-45deg, ${w} 0 1px, transparent 1px 12px)`;
    case 'chevron': return `repeating-linear-gradient(135deg, ${w} 0 2px, transparent 2px 16px)`;
    case 'diamond':
    default: return `repeating-linear-gradient(45deg, ${w} 0 1px, transparent 1px 26px), repeating-linear-gradient(-45deg, ${w} 0 1px, transparent 1px 26px)`;
  }
}

/* Clock helpers: parse ESPN/manual clock strings and format seconds back.
   Under a minute we show tenths, like a real game clock. */
function parseClockSec(str?: string): number | null {
  if (!str) return null;
  const t = str.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const mm = parseInt(m, 10), ss = parseFloat(s);
    if (isNaN(mm) || isNaN(ss)) return null;
    return mm * 60 + ss;
  }
  const v = parseFloat(t);
  return isNaN(v) ? null : v;
}
function fmtClockDisplay(sec: number): string {
  sec = Math.max(0, sec);
  // Above a minute, broadcast clocks round the seconds UP (a clock reads "6:20"
  // until it drops below 6:19.0), so ceil to match the arena/Courtside display.
  if (sec >= 60) { const total = Math.ceil(sec); const m = Math.floor(total / 60), s = total % 60; return `${m}:${String(s).padStart(2, '0')}`; }
  return sec.toFixed(1);
}

interface BusState {
  bug?: boolean;
  lowerId?: string | null;
  full?: 'teamstats' | 'lineups' | 'leaders' | 'matchup' | 'linescore' | 'shotchart' | 'assists' | 'alerts' | 'trivia' | 'nextgame' | 'matchupbanner' | 'compare' | 'statline' | 'taletape' | 'boxscore' | null;
  boxTeam?: 'away' | 'home';
  compareA?: string; compareB?: string;   // player-comparison athlete ids
  statLineId?: string;                     // stat-line banner athlete id
  shotFilter?: string | null;   // 'all' | teamId | athleteId (full-screen shot chart)
  shotLine?: string | null;     // 'all' | teamId | athleteId (bottom shooting-splits band)
  banner?: string | null;               // URL of the currently-aired banner
  portal?: boolean;                     // hoop-portal sponsor reveal
  talent?: boolean;                     // broadcast team graphic
  mention?: boolean;                    // special guest / VIP mention
  ftId?: string | null;                 // free-throw spotlight player
  pbp?: boolean;                        // live play-by-play rail
  pbpTicker?: boolean;                  // latest-play strip hanging off the score bug
  sub?: { inId: string; outId: string } | null;
  coach?: 'away' | 'home' | null;
}

interface GfxDoc extends BusState {
  eventId?: string;
  shotClock?: string;
  nbaClock?: { clock?: string; sec?: number | null; period?: number; status?: string; running?: boolean; ts?: number } | null;
  awayFouls?: string; homeFouls?: string;
  awayBonus?: boolean; homeBonus?: boolean;
  updatedAt?: string;
  league?: string;
  sourceMode?: 'feed' | 'manual';       // manual: operator-keyed game data
  manual?: ManualGame | null;
  preview?: BusState | null;            // staged look — aired via TAKE
  brand?: { logo?: string; name?: string } | null;
  showBrand?: boolean;
  autoCallouts?: boolean;
  callout?: Callout | null;             // manual fire from the control panel
  theme?: { useTeamColors?: boolean; c1?: string; c2?: string; logoScale?: number; brandScale?: number; motion?: boolean; bugPos?: 'left' | 'center' | 'right'; skin?: string; lowerPos?: 'left' | 'center' | 'right'; ftPos?: 'left' | 'right'; badgeSec?: number; bugStyle?: string; bugScale?: number; matchup3d?: boolean; gfxScale?: number; texture?: string; textureIntensity?: number; clockOffset?: number; fullScale?: number; atlScale?: number; gScale?: Record<string, number> } | null;
  trivia?: { question?: string; options?: string[]; correct?: number; sponsor?: string; reveal?: boolean } | null;
  portalCfg?: { x?: number; y?: number; size?: number; logo?: string; video?: string; content?: 'logo' | 'trivia' } | null;
  talentCfg?: { list?: { id: string; name: string; role: string; photo: string }[] } | null;
  mentionCfg?: { label?: string; name?: string; title?: string; photo?: string } | null;
  photoOverrides?: Record<string, string> | null;
  leagueBadge?: string | null;          // league logo chip (G League, NBA…)
  extraBadges?: string[] | null;        // sponsor logos in the badge roll
  nextGameCfg?: { awayName?: string; awayLogo?: string; homeName?: string; homeLogo?: string; date?: string; time?: string; venue?: string } | null;
  coachCfg?: { away?: string; home?: string } | null;
}

const CALLOUT_MS = 4500;

export default function GraphicsOutput({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [gfx, setGfx] = useState<GfxDoc>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [shots, setShots] = useState<ShotPlay[]>([]);
  const [plays, setPlays] = useState<PlayEvent[]>([]);
  // Smooth game clock: interpolate locally so it ticks every second, resync on each poll
  const clockRef = useRef<{ sec: number; at: number; running: boolean; period: number }>({ sec: 0, at: 0, running: false, period: 0 });
  const [, setClockTick] = useState(0);
  const [assists, setAssists] = useState<AssistLink[]>([]);
  const [alerts, setAlerts] = useState<GameAlert[]>([]);
  const [bg, setBg] = useState('transparent');
  const [queue, setQueue] = useState<Callout[]>([]);
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
    // iOS/Safari can block autoplay entirely (e.g. Low Power Mode): any tap resumes all videos
    const resumeVideos = () => document.querySelectorAll('video').forEach(v => { v.muted = true; if (v.paused) v.play().catch(() => {}); });
    document.addEventListener('touchstart', resumeVideos, { passive: true });
    document.addEventListener('click', resumeVideos);
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
      document.removeEventListener('touchstart', resumeVideos);
      document.removeEventListener('click', resumeVideos);
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

  /* Manual callouts from the control panel.
     The doc keeps the last callout — on (re)load we swallow it silently so
     old plays never replay; only callouts fired AFTER load go on air. */
  const calloutPrimed = useRef(false);
  useEffect(() => {
    const c = gfx.callout;
    if (!calloutPrimed.current) {
      if (gfx.updatedAt !== undefined || c !== undefined) {
        lastManual.current = c?.id || '';
        calloutPrimed.current = true;
      }
      return;
    }
    if (c?.id && c.id !== lastManual.current) {
      lastManual.current = c.id;
      setQueue(q => [...q, c].slice(-6));
    }
  }, [gfx.callout, gfx.updatedAt]);

  /* Live game data + auto callout detection.
     Feed mode: poll our NBA proxy every 4 s.
     Manual mode: rebuild from the operator-keyed doc every 500 ms so the
     running clock ticks locally between doc updates. */
  useEffect(() => {
    if (gfx.sourceMode === 'manual') {
      if (!gfx.manual) { setSummary(null); return; }
      const tick = () => setSummary(manualToSummary(gfx.manual!));
      tick();
      const t = setInterval(tick, 500);
      return () => clearInterval(t);
    }

    const eventId = gfx.eventId;
    if (!eventId) { setSummary(null); return; }
    let alive = true;
    const league = gfx.league || 'nba';
    const load = async () => {
      try {
        const res = await fetch(`/api/nba/summary?event=${eventId}&league=${league}`);
        const json = await res.json();
        if (!alive) return;
        const next = applyPhotoOverrides(normalizeSummary(json), gfx.photoOverrides);
        if (next) {
          setSummary(next);
          setShots(normalizeShots(json));
          setPlays(normalizePlays(json));
          setAssists(normalizeAssists(json));
          setAlerts(computeAlerts(json, next));
        }
      } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [gfx.eventId, gfx.autoCallouts, gfx.sourceMode, gfx.manual, gfx.league, gfx.photoOverrides]);

  /* Anchor the smooth clock whenever the authoritative value changes */
  useEffect(() => {
    const sec = parseClockSec(summary?.clock);
    if (sec == null || summary?.state !== 'in') { clockRef.current = { sec: sec ?? 0, at: 0, running: false, period: summary?.period ?? 0 }; return; }
    const prev = clockRef.current;
    const running = prev.at !== 0 && prev.period === summary.period && sec < prev.sec - 0.05;
    clockRef.current = { sec, at: Date.now(), running, period: summary.period };
  }, [summary?.clock, summary?.period, summary?.state]);
  /* Re-render ~10x/s so the interpolated clock ticks */
  useEffect(() => {
    const t = setInterval(() => setClockTick(v => (v + 1) % 100000), 100);
    return () => clearInterval(t);
  }, []);
  const liveClock = (() => {
    const off = gfx.theme?.clockOffset || 0;   // operator sync nudge (seconds)
    const now = Date.now();
    // Prefer the NBA's own clock from the local agent when it's fresh. The agent
    // writes the exact clock every second, so show it raw — NO interpolation
    // (interpolating made it flicker when the NBA clock was stopped).
    const nba = gfx.nbaClock;
    if (nba && typeof nba.sec === 'number' && now - (nba.ts || 0) < 6000) {
      return fmtClockDisplay(nba.sec + off);
    }
    const a = clockRef.current;
    if (summary?.state !== 'in' || !a.at) return summary?.clock || '';
    const base = a.running ? a.sec - Math.min((now - a.at) / 1000, 2.4) : a.sec;
    return fmtClockDisplay(base + off);
  })();

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

  const ftPlayer: Athlete | null = useMemo(() => {
    if (!summary || !bus.ftId) return null;
    return [...summary.home.athletes, ...summary.away.athletes].find(a => a.id === bus.ftId) || null;
  }, [summary, bus.ftId]);

  const subPair = useMemo(() => {
    if (!summary || !bus.sub) return null;
    const all = [...summary.home.athletes, ...summary.away.athletes];
    const pin = all.find(a => a.id === bus.sub!.inId);
    const pout = all.find(a => a.id === bus.sub!.outId);
    return pin && pout ? { pin, pout } : null;
  }, [summary, bus.sub]);

  /* Theme: official team colors by default, operator overrides at will */
  const custom = !!(gfx.theme && gfx.theme.useTeamColors === false);
  const awayColor = custom && gfx.theme?.c1 ? gfx.theme.c1 : summary?.away.color || '#1f2937';
  const homeColor = custom && gfx.theme?.c2 ? gfx.theme.c2 : summary?.home.color || '#1f2937';
  const calloutColor = (c: Callout) => (custom ? awayColor : c.color) || '#7c3aed';

  const brand = gfx.showBrand !== false && gfx.brand?.logo ? gfx.brand : null;
  const lowerPosCls = (gfx.theme?.lowerPos || 'left') === 'center' ? 'left-1/2 -translate-x-1/2'
    : (gfx.theme?.lowerPos || 'left') === 'right' ? 'right-8' : 'left-8';
  // Lower thirds sit higher when a tall bug (arena) is on air so they never collide
  const lowerBottomCls = (bus.bug && !bus.full && (gfx.theme?.bugStyle === 'arena')) ? 'bottom-44' : 'bottom-28';
  const ftPosCls = (gfx.theme?.ftPos || 'right') === 'left' ? 'left-8' : 'right-8';
  const logoScale = gfx.theme?.logoScale || 1;
  const brandScale = gfx.theme?.brandScale || 1;
  const motionOn = !!gfx.theme?.motion;

  return (
    <div className={`fixed inset-0 overflow-hidden font-sans skin-${gfx.theme?.skin || 'clean'}`}
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
        @keyframes plg-score-pop { 0% { transform: scale(1.45); text-shadow: 0 0 14px rgba(253, 224, 71, 0.95); } 100% { transform: scale(1); text-shadow: none; } }
        @keyframes plg-pop { from { opacity: 0; transform: translateY(16px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes plg-lower-in { from { opacity: 0; transform: translateX(-420px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes plg-full-in { from { opacity: 0; transform: scale(0.955); } to { opacity: 1; transform: scale(1); } }
        @keyframes plg-shine { 0% { transform: translateX(-130%); } 26% { transform: translateX(430%); } 100% { transform: translateX(430%); } }
        @keyframes plg-float-logo { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2.5px) scale(1.05); } }
        @keyframes plg-correct-pop { 0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); } }
        @keyframes plg-gauge { from { stroke-dashoffset: 327; } to { stroke-dashoffset: var(--off, 327); } }
        @keyframes plg-ball { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes plg-ft-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes plg-needle { from { transform: rotate(-90deg); } to { transform: rotate(var(--ang, 0deg)); } }
        @keyframes plg-spin3d { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }

        /* ── Surface system: every bar/panel uses these; skins re-texture them ── */
        .plg-panel { background: rgba(24, 24, 27, 0.95); }
        .plg-accent { background-image: linear-gradient(var(--dir, 90deg), var(--tc, #52525b), #18181b 140%); }
        .plg-label { background: linear-gradient(135deg, #fbbf24, #f59e0b); }

        .skin-glass .plg-panel { background: rgba(13, 18, 28, 0.55); backdrop-filter: blur(14px) saturate(1.3); border-top: 1px solid rgba(255,255,255,0.22); }
        .skin-glass .plg-accent { background-image: linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.02) 48%), linear-gradient(var(--dir, 90deg), var(--tc, #52525b), rgba(24,24,27,0.4) 150%); backdrop-filter: blur(10px); }
        .skin-glass .plg-label { background: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 50%), linear-gradient(135deg, #fbbf24, #f59e0b); }

        .skin-steel .plg-panel { background: repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px), linear-gradient(180deg, #3d4046, #1a1c1f 52%, #26282c); border-top: 1px solid rgba(255,255,255,0.3); }
        .skin-steel .plg-accent { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 3px), linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0) 42%, rgba(0,0,0,0.42)), linear-gradient(var(--dir, 90deg), var(--tc, #52525b), #101113 150%); }
        .skin-steel .plg-label { background: repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 3px), linear-gradient(180deg, #e8e9ec, #9aa0a8 50%, #6b7078); }

        .skin-gold .plg-panel { background: linear-gradient(180deg, #241d10, #171309 55%, #1f1a0d); border-top: 1px solid rgba(251,191,36,0.45); }
        .skin-gold .plg-accent { background-image: linear-gradient(180deg, rgba(255,235,170,0.35), rgba(255,255,255,0) 42%, rgba(0,0,0,0.35)), linear-gradient(var(--dir, 90deg), var(--tc, #52525b), #171309 150%); }
        .skin-gold .plg-label { background: linear-gradient(180deg, #f9e8a0, #e3b341 48%, #a97e1a); }

        .skin-carbon .plg-panel { background: linear-gradient(27deg, #1b1d1f 5px, transparent 5px) 0 5px, linear-gradient(207deg, #1b1d1f 5px, transparent 5px) 10px 0, linear-gradient(27deg, #222427 5px, transparent 5px) 0 10px, linear-gradient(207deg, #222427 5px, transparent 5px) 10px 5px, linear-gradient(90deg, #17181a 10px, transparent 10px), linear-gradient(#131416 25%, #17181a 25%, #17181a 50%, transparent 50%, transparent 75%, #202124 75%, #202124); background-color: #131416; background-size: 20px 20px; }
        .skin-carbon .plg-accent { background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 4px), linear-gradient(var(--dir, 90deg), var(--tc, #52525b), #101113 150%); }
        .skin-carbon .plg-label { background: repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0 2px, transparent 2px 4px), linear-gradient(135deg, #fbbf24, #d97706); }

        .skin-neon .plg-panel { background: rgba(8, 10, 18, 0.92); border: 1px solid color-mix(in srgb, var(--tc, #22d3ee) 65%, white 10%); box-shadow: 0 0 14px color-mix(in srgb, var(--tc, #22d3ee) 45%, transparent), inset 0 0 10px color-mix(in srgb, var(--tc, #22d3ee) 18%, transparent); }
        .skin-neon .plg-accent { background-image: linear-gradient(var(--dir, 90deg), color-mix(in srgb, var(--tc, #22d3ee) 70%, black), rgba(8,10,18,0.9) 130%); border: 1px solid var(--tc, #22d3ee); box-shadow: 0 0 16px color-mix(in srgb, var(--tc, #22d3ee) 60%, transparent); }
        .skin-neon .plg-label { background: #0c0f18; border: 1px solid #fbbf24; box-shadow: 0 0 14px rgba(251,191,36,0.65); color: #fbbf24 !important; }

        /* ── Team pack: Austin Spurs — Silver & Black (home) ── */
        .skin-spurs .plg-panel { background: repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 9px), linear-gradient(180deg, #131315, #060607 60%, #0e0e10); border-top: 1px solid rgba(196,206,212,0.55); }
        .skin-spurs .plg-accent { background-image: repeating-linear-gradient(115deg, rgba(0,0,0,0.05) 0 2px, transparent 2px 9px), linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 45%, rgba(0,0,0,0.18)), linear-gradient(var(--dir, 90deg), var(--tc, #c4ced4), #7c848b 150%); color: #0b0b0d; text-shadow: 0 1px 0 rgba(255,255,255,0.35); }
        .skin-spurs .plg-accent .text-zinc-400, .skin-spurs .plg-accent .text-yellow-400 { color: #26282c !important; }
        .skin-spurs .plg-label { background: linear-gradient(180deg, #f2f5f7, #b9c2c9 50%, #838b93); color: #0b0b0d !important; }

        /* ── Team pack: Austin Spurs — DC Comics Night ── */
        .skin-spurs-dc .plg-panel { background-image: radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.6px), linear-gradient(180deg, #0d1b3d, #070f24 65%, #0a1530); background-size: 7px 7px, 100% 100%; border: 2px solid #0b0c0e; box-shadow: 0 3px 0 #0b0c0e; }
        .skin-spurs-dc .plg-accent { background-image: radial-gradient(rgba(0,0,0,0.18) 1px, transparent 1.6px), linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 45%), linear-gradient(var(--dir, 90deg), var(--tc, #d0021b), #12235c 155%); background-size: 6px 6px, 100% 100%, 100% 100%; border: 2px solid #0b0c0e; font-style: italic; }
        .skin-spurs-dc .plg-label { background: #ffd83d; color: #0b0c0e !important; border: 2px solid #0b0c0e; box-shadow: 3px 3px 0 #0b0c0e; font-style: italic; }

        /* ── Team pack: Austin Spurs — Texas Fiesta ── */
        .skin-spurs-fiesta .plg-panel { background: linear-gradient(180deg, #17121c, #0e0a12 60%, #140f19); border-top: 3px solid; border-image: linear-gradient(90deg, #e91e8c, #ff8c00, #ffd400, #00b8a9, #7b5cff) 1; }
        .skin-spurs-fiesta .plg-accent { background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.1) 0 3px, transparent 3px 10px), linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 50%), linear-gradient(var(--dir, 90deg), var(--tc, #e91e8c), rgba(20,15,25,0.55) 165%); }
        .skin-spurs-fiesta .plg-label { background: linear-gradient(90deg, #e91e8c, #ff8c00 30%, #ffd400 55%, #00b8a9 80%, #7b5cff); color: #14101a !important; }

        /* ── Toros Throwback: rawhide & maroon western ── */
        .skin-spurs-toros .plg-panel { background: repeating-linear-gradient(80deg, rgba(0,0,0,0.25) 0 2px, transparent 2px 7px), linear-gradient(180deg, #221512, #140c0a 60%, #1b100d); border-top: 2px solid #c9a227; }
        .skin-spurs-toros .plg-accent { background-image: repeating-linear-gradient(80deg, rgba(0,0,0,0.2) 0 2px, transparent 2px 7px), linear-gradient(180deg, rgba(255,220,150,0.18), transparent 45%), linear-gradient(var(--dir, 90deg), var(--tc, #7a1f1f), #1b100d 155%); }
        .skin-spurs-toros .plg-label { background: linear-gradient(180deg, #e5c35a, #c9a227 55%, #8a6d14); color: #1b100d !important; letter-spacing: 0.3em; }

        /* ── Riverdragons: jade dragon scales & gold ── */
        .skin-spurs-dragons .plg-panel { background-image: radial-gradient(circle at 4px 0, transparent 4px, rgba(14,122,95,0.16) 4.5px, transparent 6px), linear-gradient(180deg, #0c1f1b, #071411 60%, #0b1a16); background-size: 12px 8px, 100% 100%; border-top: 2px solid #d3a625; }
        .skin-spurs-dragons .plg-accent { background-image: radial-gradient(circle at 5px 0, transparent 4px, rgba(0,0,0,0.25) 4.5px, transparent 6.5px), linear-gradient(180deg, rgba(255,255,255,0.2), transparent 45%), linear-gradient(var(--dir, 90deg), var(--tc, #0e7a5f), #071411 155%); background-size: 13px 9px, 100% 100%, 100% 100%; }
        .skin-spurs-dragons .plg-label { background: linear-gradient(180deg, #f1d582, #d3a625 55%, #96741a); color: #0b1a16 !important; }

        /* ── ATX Night: Austin live-music neon duotone ── */
        .skin-spurs-atx .plg-panel { background: repeating-linear-gradient(0deg, rgba(255,45,149,0.05) 0 1px, transparent 1px 5px), linear-gradient(160deg, #14060f, #060612 70%); border: 1px solid rgba(255,45,149,0.5); box-shadow: 0 0 14px rgba(255,45,149,0.25), 0 0 22px rgba(0,194,255,0.15); }
        .skin-spurs-atx .plg-accent { background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 4px), linear-gradient(180deg, rgba(255,255,255,0.22), transparent 45%), linear-gradient(var(--dir, 90deg), var(--tc, #ff2d95), rgba(0,194,255,0.55) 160%); border: 1px solid rgba(255,255,255,0.25); }
        .skin-spurs-atx .plg-label { background: linear-gradient(90deg, #ff2d95, #7b5cff 55%, #00c2ff); color: #0a0511 !important; }

        /* ── Los Raros: psychedelic teal/pink farewell ── */
        .skin-spurs-raros .plg-panel { background: linear-gradient(120deg, #12081a, #081411 55%, #140812); border-top: 3px solid; border-image: linear-gradient(90deg, #00c9b1, #ff5da2, #9b5cff) 1; }
        .skin-spurs-raros .plg-accent { background-image: repeating-linear-gradient(150deg, rgba(255,255,255,0.09) 0 4px, transparent 4px 11px), linear-gradient(var(--dir, 90deg), var(--tc, #00c9b1), #ff5da2 170%); }
        .skin-spurs-raros .plg-label { background: linear-gradient(90deg, #00c9b1, #ff5da2 60%, #9b5cff); color: #120817 !important; }

        /* ── Star Wars Night: starfield & saber edges ── */
        .skin-spurs-wars .plg-panel { background-image: radial-gradient(rgba(255,255,255,0.35) 0.6px, transparent 1.1px), radial-gradient(rgba(255,255,255,0.18) 0.5px, transparent 1px), linear-gradient(180deg, #05060d, #010208); background-size: 34px 27px, 19px 15px, 100% 100%; border-top: 1px solid rgba(58,169,255,0.6); box-shadow: 0 0 16px rgba(58,169,255,0.2); }
        .skin-spurs-wars .plg-accent { background-image: radial-gradient(rgba(255,255,255,0.5) 0.6px, transparent 1.1px), linear-gradient(180deg, rgba(255,255,255,0.14), transparent 50%), linear-gradient(var(--dir, 90deg), var(--tc, #3aa9ff), #05060d 160%); background-size: 26px 21px, 100% 100%, 100% 100%; border-bottom: 2px solid var(--tc, #3aa9ff); box-shadow: inset 0 -6px 12px -6px var(--tc, #3aa9ff); }
        .skin-spurs-wars .plg-label { background: #ffe81f; color: #05060d !important; letter-spacing: 0.35em; }

        /* ── Harry Potter Night: scarlet, parchment & gold ── */
        .skin-spurs-potter .plg-panel { background: repeating-linear-gradient(45deg, rgba(211,166,37,0.05) 0 2px, transparent 2px 9px), linear-gradient(180deg, #1c0d10, #12070a 65%); border-top: 2px solid #d3a625; }
        .skin-spurs-potter .plg-accent { background-image: repeating-linear-gradient(45deg, rgba(211,166,37,0.14) 0 2px, transparent 2px 8px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 8px), linear-gradient(180deg, rgba(255,230,160,0.2), transparent 50%), linear-gradient(var(--dir, 90deg), var(--tc, #740001), #12070a 160%); }
        .skin-spurs-potter .plg-label { background: linear-gradient(180deg, #f3e3bd, #e0c98f); color: #4a2c0c !important; box-shadow: inset 0 0 0 1px #b08d57; font-style: italic; }

        /* ── Princess Night: rose, lavender & sparkles ── */
        .skin-spurs-princess .plg-panel { background-image: radial-gradient(rgba(255,255,255,0.5) 0.6px, transparent 1.2px), linear-gradient(180deg, #1c1020, #140b18 65%); background-size: 26px 22px, 100% 100%; border-top: 2px solid #ffb6d9; }
        .skin-spurs-princess .plg-accent { background-image: radial-gradient(rgba(255,255,255,0.45) 0.7px, transparent 1.3px), linear-gradient(180deg, rgba(255,255,255,0.3), transparent 50%), linear-gradient(var(--dir, 90deg), var(--tc, #ff9ecb), #6f5a8f 165%); background-size: 20px 17px, 100% 100%, 100% 100%; }
        .skin-spurs-princess .plg-label { background: linear-gradient(180deg, #ffd9ea, #ffb0d4 60%, #e58fb9); color: #47143b !important; }

        /* ── Lotería Night: card frames, folk red & teal ── */
        .skin-spurs-loteria .plg-panel { background: linear-gradient(180deg, #17100c, #100a08 65%); border: 2px solid #f6e7c1; outline: 2px solid #d62828; outline-offset: -6px; }
        .skin-spurs-loteria .plg-accent { background-image: radial-gradient(rgba(246,231,193,0.3) 1px, transparent 1.6px), linear-gradient(180deg, rgba(255,244,214,0.18), transparent 45%), linear-gradient(var(--dir, 90deg), var(--tc, #d62828), #100a08 160%); background-size: 9px 9px, 100% 100%, 100% 100%; border-bottom: 2px dashed rgba(246,231,193,0.55); }
        .skin-spurs-loteria .plg-label { background: #f6e7c1; color: #a01818 !important; box-shadow: inset 0 0 0 2px #d62828; }

        /* ── Pride Night: classic rainbow trims ── */
        .skin-spurs-pride .plg-panel { background: linear-gradient(180deg, #16161a, #0d0d11 65%); border-top: 4px solid; border-image: linear-gradient(90deg, #e40303, #ff8c00, #ffed00, #008026, #24408e, #732982) 1; }
        .skin-spurs-pride .plg-accent { background-image: linear-gradient(180deg, rgba(255,255,255,0.18), transparent 50%), linear-gradient(var(--dir, 90deg), var(--tc, #24408e), #0d0d11 160%); }
        .skin-spurs-pride .plg-label { background: linear-gradient(90deg, #e40303, #ff8c00 22%, #ffed00 42%, #008026 62%, #24408e 82%, #732982); color: #0d0d11 !important; }

        /* ── Hoops for Troops: camo & stencil ── */
        .skin-spurs-troops .plg-panel { background-image: radial-gradient(ellipse 46px 26px at 18% 30%, rgba(75,83,32,0.55) 45%, transparent 52%), radial-gradient(ellipse 52px 30px at 72% 68%, rgba(60,52,36,0.6) 45%, transparent 52%), radial-gradient(ellipse 40px 22px at 48% 12%, rgba(94,86,60,0.45) 45%, transparent 52%), linear-gradient(180deg, #23251a, #171910); }
        .skin-spurs-troops .plg-accent { background-image: radial-gradient(ellipse 42px 24px at 26% 40%, rgba(0,0,0,0.28) 45%, transparent 52%), radial-gradient(ellipse 46px 26px at 70% 62%, rgba(0,0,0,0.22) 45%, transparent 52%), linear-gradient(var(--dir, 90deg), var(--tc, #4b5320), #171910 160%); }
        .skin-spurs-troops .plg-label { background: #4b5320; color: #e8e4cf !important; letter-spacing: 0.3em; border: 1px dashed #e8e4cf; }
      `}</style>
      {summary && (
        <div className="absolute inset-0" style={{ transform: `scale(${gfx.theme?.gfxScale || 1})`, transformOrigin: 'center center' }}>
          {/* ── SCORE BUG (pure CSS — rAF-proof) ── */}
          {bus.bug && !bus.full && (() => {
            const pos = gfx.theme?.bugPos || 'left';
            const bugStyle = gfx.theme?.bugStyle || 'classic';
            const posCls = pos === 'center' ? 'left-1/2 -translate-x-1/2 items-center'
              : pos === 'right' ? 'right-8 items-end' : 'left-8 items-start';
            const badgeSecs = gfx.theme?.badgeSec || 4.5;
            const badges = [brand?.logo || '', gfx.leagueBadge || '', ...(gfx.extraBadges || [])].filter(Boolean);
            const shine = motionOn && (
              <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-10"
                style={{ animation: 'plg-shine 6.4s ease-in-out infinite' }} />
            );
            const clockCol = (
              summary.state === 'in' ? (
                <>
                  <span className="text-yellow-400 font-bold text-lg leading-tight">{liveClock}</span>
                  <span className="text-zinc-400 text-xs font-semibold">{periodLabel(summary.period)}</span>
                </>
              ) : (
                <span className="text-zinc-300 text-xs font-bold uppercase text-center leading-tight px-1">{summary.statusDetail}</span>
              )
            );
            const wrapCls = bugStyle === 'arena' ? 'left-0 right-0 items-center' : posCls;
            return (
              <div className={`absolute bottom-8 flex flex-col gap-2 ${wrapCls}`}
                style={{ fontVariantNumeric: 'tabular-nums', zoom: gfx.theme?.bugScale || 1, animation: 'plg-rise 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>

                {/* Callout pill above the bug */}
                {busMode === 'program' && current && (
                  <div key={current.id} className="inline-flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white"
                    style={{ animation: 'plg-pop 0.4s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>
                    <div className="plg-accent px-4 py-2 font-black text-lg tracking-wide flex items-center"
                      style={{ ['--tc' as any]: calloutColor(current), ['--dir' as any]: '135deg' }}>
                      {current.title}
                    </div>
                    {current.sub && (
                      <div className="plg-panel pr-4 pl-3 text-sm font-semibold flex items-center">
                        {current.sub}
                      </div>
                    )}
                  </div>
                )}

                {bus.pbpTicker && <PlayTicker plays={plays} summary={summary} awayColor={awayColor} homeColor={homeColor} />}

                {bugStyle === 'classic' && (
                  <div className="relative flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white">
                    {shine}
                    {badges.length > 0 && (
                      <div className="bg-white px-2.5 flex items-center">
                        <BadgeRoll logos={badges} scale={brandScale} secs={badgeSecs} />
                      </div>
                    )}
                    <TeamCell team={summary.away} color={awayColor} scale={logoScale} float={motionOn} />
                    <div className="plg-panel px-4 flex flex-col items-center justify-center min-w-[92px]">
                      {clockCol}
                    </div>
                    <TeamCell team={summary.home} color={homeColor} scale={logoScale} float={motionOn} reverse />
                  </div>
                )}

                {/* Broadcast bar — full horizontal band, scores oversized, sponsor strip below */}
                {bugStyle === 'bar' && (
                  <div className="flex flex-col rounded-lg overflow-hidden shadow-2xl text-white">
                    <div className="relative flex items-stretch">
                      {shine}
                      {([summary.away, summary.home] as const).map((t, i) => {
                        const first = i === 0;
                        const cells = [
                          t.logo && <img key="l" src={t.logo} className="drop-shadow object-contain" alt=""
                            style={{ width: 34 * logoScale, height: 34 * logoScale, animation: motionOn ? 'plg-float-logo 3s ease-in-out infinite' : undefined }} />,
                          <span key="a" className="font-black text-lg tracking-wide">{t.abbr}</span>,
                          <Score key="s" value={t.score} />,
                        ];
                        return (
                          <div key={t.id} className={`plg-accent flex items-center gap-3 px-5 ${first ? '' : 'flex-row-reverse'}`}
                            style={{ ['--tc' as any]: first ? awayColor : homeColor, ['--dir' as any]: first ? '90deg' : '270deg' }}>
                            {cells}
                          </div>
                        );
                      }).flatMap((el, i) => i === 1 ? [
                        <div key="clock" className="plg-panel px-5 py-1.5 flex flex-col items-center justify-center min-w-[110px]">{clockCol}</div>, el,
                      ] : [el])}
                    </div>
                    {badges.length > 0 && (
                      <div className="plg-panel border-t border-white/15 flex items-center justify-center py-1">
                        {/* Broadcast-style sponsor strip: every logo as a white silhouette */}
                        <BadgeRoll logos={badges} scale={brandScale * 0.75} secs={badgeSecs} mono />
                      </div>
                    )}
                  </div>
                )}

                {/* Sideline strip — compact single row with team color edges + info line */}
                {bugStyle === 'strip' && (
                  <div className="flex flex-col rounded-md overflow-hidden shadow-2xl text-white">
                    <div className="relative flex items-stretch">
                      {shine}
                      {badges.length > 0 && (
                        <div className="bg-white px-2 flex items-center">
                          <BadgeRoll logos={badges} scale={brandScale * 0.85} secs={badgeSecs} />
                        </div>
                      )}
                      {([summary.away, summary.home] as const).map((t, i) => (
                        <div key={t.id} className="plg-panel flex items-center gap-2 pl-3 pr-4 py-1.5"
                          style={{ boxShadow: `inset 4px 0 0 ${i === 0 ? awayColor : homeColor}` }}>
                          {t.logo && <img src={t.logo} className="object-contain" alt="" style={{ width: 26 * logoScale, height: 26 * logoScale }} />}
                          <span className="font-black text-base tracking-wide">{t.abbr}</span>
                          <span key={t.score} className="font-black text-2xl ml-1" style={{ animation: 'plg-score-pop 0.6s ease-out both' }}>{t.score}</span>
                        </div>
                      ))}
                      <div className="plg-accent px-4 flex items-center gap-2" style={{ ['--tc' as any]: '#1f2937', ['--dir' as any]: '90deg' }}>
                        {summary.state === 'in' ? (
                          <>
                            <span className="text-zinc-300 text-xs font-bold">{periodLabel(summary.period)}</span>
                            <span className="text-yellow-400 font-black text-xl">{liveClock}</span>
                          </>
                        ) : (
                          <span className="text-zinc-200 text-xs font-bold uppercase">{summary.statusDetail}</span>
                        )}
                      </div>
                    </div>
                    <div className="plg-label text-[10px] font-bold px-3 py-0.5 tracking-widest uppercase text-center">
                      {summary.away.name} vs {summary.home.name}
                    </div>
                  </div>
                )}

                {/* Center stack — boxed vertical layout, clock on top, abbr rail below */}
                {bugStyle === 'stack' && (
                  <div className="relative flex flex-col rounded-lg overflow-hidden shadow-2xl text-white min-w-[280px]">
                    {shine}
                    <div className="plg-panel text-center text-[11px] font-bold uppercase tracking-widest px-4 py-1 border-b border-white/15">
                      {summary.state === 'in' ? (
                        <>
                          <span className="text-zinc-400 mr-2">{periodLabel(summary.period)}</span>
                          <span className="text-yellow-400 text-sm">{liveClock}</span>
                        </>
                      ) : (
                        <span className="text-zinc-300">{summary.statusDetail}</span>
                      )}
                    </div>
                    <div className="flex items-stretch">
                      {([summary.away, summary.home] as const).map((t, i) => {
                        const first = i === 0;
                        return (
                          <div key={t.id} className={`plg-accent flex-1 flex items-center justify-between gap-3 px-4 py-2 ${first ? '' : 'flex-row-reverse'}`}
                            style={{ ['--tc' as any]: first ? awayColor : homeColor, ['--dir' as any]: first ? '90deg' : '270deg' }}>
                            {t.logo
                              ? <img src={t.logo} className="drop-shadow object-contain" alt=""
                                  style={{ width: 34 * logoScale, height: 34 * logoScale, animation: motionOn ? 'plg-float-logo 3s ease-in-out infinite' : undefined }} />
                              : <span className="font-black text-base">{t.abbr}</span>}
                            <Score value={t.score} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-stretch text-[10px] font-black uppercase tracking-widest">
                      <div className="flex-1 plg-panel text-center py-1">{summary.away.abbr}</div>
                      {badges.length > 0 && (
                        <div className="bg-white px-2 flex items-center">
                          <BadgeRoll logos={badges} scale={brandScale * 0.65} secs={badgeSecs} />
                        </div>
                      )}
                      <div className="flex-1 plg-panel text-center py-1">{summary.home.abbr}</div>
                    </div>
                  </div>
                )}

                {/* Faceted full-width arena bug — strongly angled hexagonal team
                   panels, big scores over a black wedge, records + fouls/bonus in
                   the corners, dashed underlines, and an inset clock strip. */}
                {bugStyle === 'arena' && (() => {
                  const awayFouls = gfx.awayFouls || (summary.state === 'in' ? summary.away.fouls : '');
                  const homeFouls = gfx.homeFouls || (summary.state === 'in' ? summary.home.fouls : '');
                  const texRaw = buildTexture(gfx.theme?.texture, gfx.theme?.textureIntensity ?? 1);
                  const tex = texRaw ? texRaw + ', ' : '';
                  const gloss = 'inset 0 40px 55px -30px rgba(255,255,255,0.22), inset 0 -26px 44px -18px rgba(0,0,0,0.65)';
                  const lsz = 128 * logoScale;
                  return (
                  <div className="relative text-white" style={{ width: 'min(1180px, 97vw)', height: 118 }}>
                    {/* AWAY faceted panel */}
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pr-28 z-10" style={{ width: '55%' }}>
                      <div className="absolute inset-0 shadow-2xl"
                        style={{ background: `${tex}linear-gradient(105deg, ${awayColor}, ${awayColor} 60%, #0a0a0e)`, boxShadow: gloss, clipPath: 'polygon(4% 0, 100% 0, 74% 100%, 0 100%, 0 26%)' }} />
                      {summary.away.logo && <img src={summary.away.logo} className="relative object-contain z-20"
                        style={{ width: lsz, height: lsz, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))', marginTop: -18, animation: motionOn ? 'plg-float-logo 3s ease-in-out infinite' : undefined }} alt="" />}
                      <div className="absolute top-2.5 left-[172px] flex items-center gap-3 text-sm font-black tracking-wide z-30" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
                        {summary.away.record && <span>{summary.away.record}</span>}
                        {awayFouls && <span className="text-white/85">FOULS: {awayFouls}</span>}
                        {gfx.awayBonus && <span className="text-yellow-300">BONUS</span>}
                      </div>
                      <div className="absolute left-7 bottom-2 w-2/5 border-t-[3px] border-dashed border-white/80 z-10" />
                    </div>
                    {/* HOME faceted panel */}
                    <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 pl-28 z-10" style={{ width: '55%' }}>
                      <div className="absolute inset-0 shadow-2xl"
                        style={{ background: `${tex}linear-gradient(255deg, ${homeColor}, ${homeColor} 60%, #0a0a0e)`, boxShadow: gloss, clipPath: 'polygon(26% 0, 96% 0, 100% 26%, 100% 100%, 0 100%)' }} />
                      <div className="absolute top-2.5 right-[172px] flex items-center gap-3 text-sm font-black tracking-wide z-30" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
                        {gfx.homeBonus && <span className="text-yellow-300">BONUS</span>}
                        {homeFouls && <span className="text-white/85">FOULS: {homeFouls}</span>}
                        {summary.home.record && <span>{summary.home.record}</span>}
                      </div>
                      {summary.home.logo && <img src={summary.home.logo} className="relative object-contain z-20"
                        style={{ width: lsz, height: lsz, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))', marginTop: -18, animation: motionOn ? 'plg-float-logo 3s ease-in-out infinite' : undefined }} alt="" />}
                      <div className="absolute right-7 bottom-2 w-2/5 border-t-[3px] border-dashed border-white/80 z-10" />
                    </div>
                    {/* CENTER black wedge with scores */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-20 flex items-start justify-center pt-1" style={{ width: 500 }}>
                      <div className="absolute inset-0 bg-black" style={{ clipPath: 'polygon(11% 0, 89% 0, 100% 100%, 0 100%)' }} />
                      <div className="relative flex items-center justify-center z-10">
                        <span key={'a' + summary.away.score} className="text-7xl font-black leading-none text-right pr-6" style={{ fontStyle: 'italic', minWidth: 150, animation: 'plg-score-pop 0.6s ease-out both' }}>{summary.away.score}</span>
                        <span className="w-[3px] h-14 bg-white/25 shrink-0" />
                        <span key={'h' + summary.home.score} className="text-7xl font-black leading-none text-left pl-6 text-zinc-300" style={{ fontStyle: 'italic', minWidth: 150, animation: 'plg-score-pop 0.6s ease-out both' }}>{summary.home.score}</span>
                      </div>
                    </div>
                    {/* CLOCK strip inset at the bottom center */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-1 z-30 flex items-stretch rounded overflow-hidden shadow-xl bg-black text-white text-2xl font-black tracking-wide"
                      style={{ fontStyle: 'italic' }}>
                      {summary.state === 'in' ? (
                        <>
                          <span className="px-4 py-0.5">{periodLabel(summary.period)}</span>
                          <span className="px-4 py-0.5 border-l border-white/15">{liveClock}</span>
                          {gfx.shotClock && <span className="px-4 py-0.5 border-l border-white/15 text-yellow-400">{gfx.shotClock}</span>}
                        </>
                      ) : (
                        <span className="px-5 py-0.5 uppercase text-zinc-200 not-italic text-lg">{summary.statusDetail}</span>
                      )}
                    </div>
                  </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ── CUSTOM BANNER (pure CSS) ── */}
          {bus.banner && (
            <div key={bus.banner} className="absolute bottom-8 left-1/2 -translate-x-1/2"
              style={{ animation: 'plg-rise 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>
              <img src={bus.banner} className="max-h-28 max-w-[860px] object-contain rounded-xl shadow-2xl" alt="" />
            </div>
          )}

          {/* ── PLAYER LOWER THIRD (pure CSS) ── */}
          {lower && (
            <div key={lower.id} className={`absolute ${lowerBottomCls} flex items-end ${lowerPosCls}`}
              style={{ animation: 'plg-lower-in 0.5s cubic-bezier(0.3, 1.15, 0.6, 1) both' }}>
              <div className="w-36 h-36 rounded-2xl overflow-hidden shadow-2xl relative"
                style={{ background: `linear-gradient(160deg, ${custom ? awayColor : lower.teamColor}, #111)` }}>
                <PlayerPhoto src={lower.headshot} className="absolute inset-0 w-full h-full object-cover object-top" />
              </div>
              <div className="ml-[-10px] mb-2">
                <div className="plg-panel text-white pl-6 pr-8 py-3 rounded-tr-2xl shadow-2xl flex items-center gap-4">
                  <div>
                    <div className="text-2xl font-black leading-none">{lower.name}</div>
                    <div className="text-xs font-semibold mt-1 text-zinc-400">
                      {lower.teamAbbr} · #{lower.jersey} · {lower.pos}
                    </div>
                  </div>
                  {lower.teamLogo && <img src={lower.teamLogo} className="w-14 h-14 object-contain drop-shadow shrink-0" alt="" />}
                </div>
                <div className="flex text-white shadow-2xl rounded-br-2xl overflow-hidden">
                  <StatChip label="PTS" value={lower.stats.pts} color={custom ? awayColor : lower.teamColor} big />
                  <StatChip label="REB" value={lower.stats.reb} />
                  <StatChip label="AST" value={lower.stats.ast} />
                  <StatChip label="FG" value={lower.stats.fg} />
                </div>
              </div>
            </div>
          )}

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
                        <div className="plg-panel text-white rounded-2xl shadow-2xl border border-amber-500/40 overflow-hidden">
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
                      ref={el => {
                        if (!el) return;
                        el.muted = true;
                        const tryPlay = () => { if (el.paused) el.play().catch(() => {}); };
                        tryPlay();
                        el.addEventListener('canplay', tryPlay, { once: true });
                        setTimeout(tryPlay, 800);
                      }}
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

          {/* ── BROADCAST TEAM (text ribbon, unified style) ── */}
          {bus.talent && (gfx.talentCfg?.list || []).length > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: bus.bug && (gfx.theme?.bugPos || 'left') === 'center' ? '8.5rem' : '2rem',
                animation: 'plg-rise 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) both',
                zIndex: 5,
              }}>
              <div className="flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white">
                <div className="plg-label px-4 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">
                  Broadcast Team
                </div>
                {(gfx.talentCfg?.list || []).map((c, i) => (
                  <div key={c.id}
                    className={`plg-panel px-5 py-2.5 ${i > 0 ? 'border-l border-white/10' : ''}`}
                    style={{ animation: `plg-rise 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) ${0.15 + i * 0.15}s both` }}>
                    <div className="font-black leading-tight whitespace-nowrap">{c.name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">{c.role}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SPECIAL MENTION / VIP (text ribbon, centered above the stack) ── */}
          {bus.mention && gfx.mentionCfg?.name && (() => {
            const bugCentered = bus.bug && (gfx.theme?.bugPos || 'left') === 'center';
            const base = bugCentered ? 8.5 : 2;
            const talentOn = bus.talent && (gfx.talentCfg?.list || []).length > 0;
            return (
            <div className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: `${talentOn ? base + 4.6 : base}rem`,
                animation: 'plg-rise 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) both',
                zIndex: 5,
              }}>
              <div className="flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white">
                <div className="plg-label px-4 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">
                  ★ {gfx.mentionCfg.label || 'Special Guest'}
                </div>
                <div className="plg-panel px-5 py-2.5">
                  <div className="text-lg font-black leading-tight whitespace-nowrap">{gfx.mentionCfg.name}</div>
                  {gfx.mentionCfg.title && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">{gfx.mentionCfg.title}</div>
                  )}
                </div>
                {brand?.logo && (
                  <div className="bg-white px-3 flex items-center">
                    <img src={brand.logo} className="h-6 max-w-[64px] object-contain" alt="" />
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* ── SHOOTING SPLITS LOWER THIRD ── */}
          {bus.shotLine && (() => {
            const sp = computeSplits(shots, bus.shotLine, summary);
            return (
              <div key={bus.shotLine} className={`absolute ${lowerBottomCls} ${lowerPosCls}`}
                style={{ animation: 'plg-lower-in 0.5s cubic-bezier(0.3, 1.15, 0.6, 1) both' }}>
                <div className="flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white">
                  <div className="plg-accent flex items-center gap-3 px-4 py-2.5"
                    style={{ ['--tc' as any]: sp.color, ['--dir' as any]: '135deg' }}>
                    {sp.isPlayer
                      ? <PlayerPhoto src={sp.headshot} className="w-11 h-11 rounded-full object-cover object-top bg-black/30 shrink-0" />
                      : sp.logo && <img src={sp.logo} className="w-14 h-14 object-contain drop-shadow shrink-0" alt="" />}
                    <div>
                      <div className="text-lg font-black leading-tight whitespace-nowrap">{sp.label}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">
                        {sp.isPlayer ? `${sp.teamAbbr}${sp.jersey ? ' · #' + sp.jersey : ''} · Shooting` : 'Team Shooting'}
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <StatChip label="FG" value={`${sp.fgm}/${sp.fga}`} color={sp.color} big />
                    <StatChip label="FG%" value={`${sp.pct}%`} />
                    <StatChip label="3PT" value={`${sp.tpm}/${sp.tpa}`} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── SUBSTITUTION ── */}
          {subPair && (
            <div className={`absolute ${lowerBottomCls} ${lowerPosCls}`}
              style={{ animation: 'plg-lower-in 0.5s cubic-bezier(0.3, 1.15, 0.6, 1) both' }}>
              <div className="flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white">
                <div className="plg-label px-3 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-black">
                  Substitution
                </div>
                <div className="plg-accent px-4 py-2 flex items-center gap-2.5"
                  style={{ ['--tc' as any]: '#16a34a', ['--dir' as any]: '135deg' }}>
                  <span className="text-lg font-black">▲</span>
                  <PlayerPhoto src={subPair.pin.headshot} className="w-9 h-9 rounded-full object-cover object-top bg-black/30 shrink-0" />
                  <div>
                    <div className="font-black leading-tight whitespace-nowrap">{subPair.pin.name}</div>
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">#{subPair.pin.jersey} · IN</div>
                  </div>
                </div>
                <div className="plg-accent px-4 py-2 flex items-center gap-2.5"
                  style={{ ['--tc' as any]: '#dc2626', ['--dir' as any]: '135deg' }}>
                  <span className="text-lg font-black">▼</span>
                  <PlayerPhoto src={subPair.pout.headshot} className="w-9 h-9 rounded-full object-cover object-top bg-black/30 shrink-0" />
                  <div>
                    <div className="font-black leading-tight whitespace-nowrap">{subPair.pout.name}</div>
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">#{subPair.pout.jersey} · {subPair.pout.stats.pts || '0'} PTS · OUT</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── HEAD COACH ── */}
          {bus.coach && (() => {
            const team = bus.coach === 'home' ? summary.home : summary.away;
            const name = bus.coach === 'home' ? gfx.coachCfg?.home : gfx.coachCfg?.away;
            const color = bus.coach === 'home' ? homeColor : awayColor;
            if (!name) return null;
            return (
              <div className={`absolute ${lowerBottomCls} ${lowerPosCls}`}
                style={{ animation: 'plg-lower-in 0.5s cubic-bezier(0.3, 1.15, 0.6, 1) both' }}>
                <div className="flex items-stretch rounded-xl overflow-hidden shadow-2xl text-white">
                  <div className="plg-accent px-4 flex items-center" style={{ ['--tc' as any]: color, ['--dir' as any]: '135deg' }}>
                    {team.logo ? <img src={team.logo} className="w-12 h-12 object-contain drop-shadow" alt="" /> : <span className="font-black">{team.abbr}</span>}
                  </div>
                  <div className="plg-panel px-5 py-2.5">
                    <div className="text-xl font-black leading-tight whitespace-nowrap">{name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Head Coach · {team.name}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── FREE THROW SPOTLIGHT (side panel, animated FT gauge) ── */}
          {ftPlayer && (
            <AtTheLine a={ftPlayer} shots={shots} custom={custom} awayColor={awayColor} posCls={ftPosCls} brand={brand} scale={gfx.theme?.atlScale || 1} />
          )}

          {/* ── LIVE PLAY-BY-PLAY RAIL ── */}
          {bus.pbp && <PlayByPlayRail plays={plays} summary={summary} awayColor={awayColor} homeColor={homeColor} clock={liveClock} />}

          {/* ── MATCHUP BANNER (full-width lower third) ── */}
          {bus.full === 'matchupbanner' && (
            <div style={{ zoom: gfx.theme?.gScale?.matchupbanner || gfx.theme?.fullScale || 1 }}>
              <MatchupBanner summary={summary} sponsor={gfx.leagueBadge || brand?.logo || ''}
                awayColor={awayColor} homeColor={homeColor} logoScale={logoScale} logo3d={!!gfx.theme?.matchup3d}
                tex={buildTexture(gfx.theme?.texture, gfx.theme?.textureIntensity ?? 1)} />
            </div>
          )}

          {/* ── PLAYER COMPARISON (head-to-head) ── */}
          {bus.full === 'compare' && (
            <PlayerCompare summary={summary} aId={gfx.compareA || ''} bId={gfx.compareB || ''} awayColor={awayColor} homeColor={homeColor} brand={brand} scale={gfx.theme?.gScale?.compare || gfx.theme?.fullScale || 1} />
          )}

          {/* ── PLAYER STAT LINE (full-width banner) ── */}
          {bus.full === 'statline' && (
            <div style={{ zoom: gfx.theme?.gScale?.statline || gfx.theme?.fullScale || 1 }}>
              <StatLineBanner summary={summary} id={gfx.statLineId || ''} awayColor={awayColor} homeColor={homeColor} />
            </div>
          )}

          {/* ── TALE OF THE TAPE (team comparison) ── */}
          {bus.full === 'taletape' && (
            <TaleOfTape summary={summary} awayColor={awayColor} homeColor={homeColor} scale={gfx.theme?.gScale?.taletape || gfx.theme?.fullScale || 1} />
          )}

          {/* ── FULL BOXSCORE (one team, all columns) ── */}
          {bus.full === 'boxscore' && (
            <BoxscoreFull summary={summary} teamKey={bus.boxTeam || 'away'} awayColor={awayColor} homeColor={homeColor} scale={gfx.theme?.gScale?.boxscore || gfx.theme?.fullScale || 1} />
          )}

          {/* ── FULL SCREENS (pure CSS) ── */}
          {bus.full && bus.full !== 'matchupbanner' && bus.full !== 'compare' && bus.full !== 'statline' && bus.full !== 'taletape' && bus.full !== 'boxscore' && (
            <div key={bus.full} className="absolute inset-0 flex items-center justify-center"
              style={{ animation: 'plg-full-in 0.3s ease-out both', zoom: gfx.theme?.gScale?.[bus.full as string] || gfx.theme?.fullScale || 1 }}>
              <div className="plg-panel w-[900px] max-w-[92vw] text-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-8 py-4"
                  style={{ background: `linear-gradient(90deg, ${awayColor}cc, #18181b 45%, #18181b 55%, ${homeColor}cc)` }}>
                  <div className="flex items-center gap-3">
                    {summary.away.logo && <img src={summary.away.logo} style={{ width: 56 * logoScale, height: 56 * logoScale }} alt="" />}
                    <span className="text-2xl font-black">{summary.away.abbr}</span>
                    <Score value={summary.away.score} />
                  </div>
                  <div className="text-center">
                    {gfx.leagueBadge && (
                      <img src={gfx.leagueBadge} className="h-7 mx-auto mb-1 object-contain" alt="" />
                    )}
                    <div className="text-sm font-bold text-yellow-400">{summary.state === 'in' ? `${periodLabel(summary.period)} · ${liveClock}` : summary.statusDetail}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 mt-0.5">
                      {bus.full === 'teamstats' ? 'Team Stats' : bus.full === 'lineups' ? 'Starting Lineups' : bus.full === 'matchup' ? 'Matchup — Top 5' : bus.full === 'linescore' ? (summary.state === 'post' ? 'Final Stats' : 'Quarter Break') : bus.full === 'shotchart' ? 'Shot Chart' : bus.full === 'assists' ? 'Assist Leaders' : bus.full === 'alerts' ? 'Game Alerts' : bus.full === 'trivia' ? 'Trivia' : bus.full === 'nextgame' ? 'Up Next' : 'Top Performers'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Score value={summary.home.score} />
                    <span className="text-2xl font-black">{summary.home.abbr}</span>
                    {summary.home.logo && <img src={summary.home.logo} style={{ width: 56 * logoScale, height: 56 * logoScale }} alt="" />}
                  </div>
                </div>

                {bus.full === 'teamstats' && <TeamStats summary={summary} awayColor={awayColor} homeColor={homeColor} />}
                {bus.full === 'lineups' && <Lineups summary={summary} awayColor={awayColor} homeColor={homeColor} />}
                {bus.full === 'leaders' && <Leaders summary={summary} custom={custom} awayColor={awayColor} />}
                {bus.full === 'matchup' && <Matchup summary={summary} awayColor={awayColor} homeColor={homeColor} />}
                {bus.full === 'linescore' && <QuarterBreak summary={summary} awayColor={awayColor} homeColor={homeColor} nextGame={gfx.nextGameCfg || null} />}
                {bus.full === 'shotchart' && <ShotChart summary={summary} shots={shots} filter={gfx.shotFilter || 'all'} awayColor={awayColor} homeColor={homeColor} />}
                {bus.full === 'assists' && <AssistBoard summary={summary} links={assists} awayColor={awayColor} homeColor={homeColor} />}
                {bus.full === 'alerts' && <AlertsBoard summary={summary} alerts={alerts} awayColor={awayColor} homeColor={homeColor} />}
                {bus.full === 'trivia' && <Trivia trivia={gfx.trivia || {}} sponsorFallback={brand?.logo || ''} accent={awayColor} />}
                {bus.full === 'nextgame' && (() => {
                  const ng = gfx.nextGameCfg || {};
                  const fmtDate = (d?: string) => {
                    if (!d) return '';
                    const dt = new Date(d + 'T12:00:00');
                    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                  };
                  const fmtTime = (t?: string) => {
                    if (!t) return '';
                    const m = t.match(/^(\d{1,2}):(\d{2})$/);
                    if (!m) return t;
                    const h = parseInt(m[1], 10);
                    return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
                  };
                  return (
                    <div className="px-10 py-10">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8">
                        {([['away', awayColor], ['home', homeColor]] as ['away' | 'home', string][]).map(([side, color], i) => (
                          <React.Fragment key={side}>
                            {i === 1 && (
                              <div className="text-center">
                                <div className="text-4xl font-black text-zinc-500"
                                  style={{ animation: 'plg-ft-pulse 2s ease-in-out infinite' }}>VS</div>
                              </div>
                            )}
                            <div className="text-center" style={{ animation: `plg-rise 0.7s cubic-bezier(0.34, 1.3, 0.64, 1) ${0.15 + i * 0.25}s both` }}>
                              <div className="mx-auto w-44 h-44 rounded-3xl plg-accent flex items-center justify-center mb-4"
                                style={{ ['--tc' as any]: color, ['--dir' as any]: '160deg' }}>
                                {(ng as any)[side + 'Logo']
                                  ? <Logo3D src={(ng as any)[side + 'Logo']} size={140} />
                                  : <span className="text-5xl font-black opacity-60">VS</span>}
                              </div>
                              <div className="text-2xl font-black leading-tight">{(ng as any)[side + 'Name'] || (side === 'away' ? 'Visitors' : 'Home')}</div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="mt-8 flex items-center justify-center gap-4 text-center">
                        {[fmtDate(ng.date), fmtTime(ng.time), ng.venue].filter(Boolean).map((v, i) => (
                          <div key={i} className="plg-panel rounded-xl px-5 py-2.5"
                            style={{ animation: `plg-rise 0.6s cubic-bezier(0.34, 1.3, 0.64, 1) ${0.7 + i * 0.15}s both` }}>
                            <span className="text-sm font-black tracking-wide">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="px-8 py-2.5 bg-black/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {brand && <img src={brand.logo} className="h-5 max-w-[90px] object-contain brightness-0 invert opacity-80" alt="" />}
                    {brand?.name && <span className="text-[10px] font-semibold text-zinc-400">{brand.name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <img src="/logo-white.svg" className="h-4 object-contain opacity-70" alt="" />
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500">Live Graphics</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* 3D coin-spin logo: fake extrusion by stacking the same image at depth
   offsets inside a preserve-3d rotator — reads as a real 3D logo with any
   PNG, no vectorizing, pure CSS (compositor-driven). */
function Logo3D({ src: url, size, spin = true }: { src: string; size: number; spin?: boolean }) {
  const layers = 9;
  const depth = 7;
  return (
    <div style={{ width: size, height: size, perspective: 900 }}>
      <div className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d',
          animation: spin ? 'plg-spin3d 7s linear infinite' : undefined,
          transform: spin ? undefined : 'rotateY(-22deg) rotateX(6deg)' }}>
        {Array.from({ length: layers }, (_, i) => {
          const z = -depth / 2 + (depth * i) / (layers - 1);
          const edge = i === 0 || i === layers - 1;
          return (
            <img key={i} src={url} alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                transform: `translateZ(${z}px)`,
                filter: edge ? 'brightness(1)' : 'brightness(0.55) saturate(0.8)',
                backfaceVisibility: 'visible',
              }} />
          );
        })}
      </div>
    </div>
  );
}

/* Rotating badge chip: rolls UP through company logo, league logo and any
   extra badges — pure CSS keyframes (generated per list), seamless loop. */
function BadgeRoll({ logos, scale, secs = 4.5, mono = false }: { logos: string[]; scale: number; secs?: number; mono?: boolean }) {
  const monoStyle = mono ? { filter: 'brightness(0) invert(1)' } : undefined;
  const itemH = Math.round(34 * scale);
  const w = Math.round(78 * scale);
  if (logos.length === 0) return null;
  if (logos.length === 1) {
    return <img src={logos[0]} className="object-contain" style={{ width: w, height: itemH - 4, ...monoStyle }} alt="" />;
  }
  const N = logos.length;
  const name = `plgroll${N}x${itemH}`;
  let kf = `@keyframes ${name} { `;
  for (let i = 0; i < N; i++) {
    kf += `${((i / N) * 100).toFixed(2)}% { transform: translateY(${-i * itemH}px); } `;
    kf += `${(((i + 0.88) / N) * 100).toFixed(2)}% { transform: translateY(${-i * itemH}px); } `;
  }
  kf += `100% { transform: translateY(${-N * itemH}px); } }`;
  return (
    <div style={{ height: itemH, width: w, overflow: 'hidden' }}>
      <style>{kf}</style>
      <div style={{ animation: `${name} ${N * secs}s cubic-bezier(0.5, 0, 0.2, 1) infinite` }}>
        {[...logos, logos[0]].map((l, i) => (
          <div key={i} style={{ height: itemH, width: w }} className="flex items-center justify-center">
            <img src={l} className="object-contain" style={{ width: w - 4, height: itemH - 4, ...monoStyle }} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Score number with a pulse when it changes (pure CSS) */
function Score({ value }: { value: string; big?: boolean }) {
  return (
    <span key={value} className="font-black inline-block text-3xl"
      style={{ fontVariantNumeric: 'tabular-nums', animation: 'plg-score-pop 0.6s ease-out both' }}>
      {value}
    </span>
  );
}

function TeamCell({ team, color, scale = 1, float = false, reverse = false }: { team: Summary['home']; color: string; scale?: number; float?: boolean; reverse?: boolean }) {
  return (
    <div key={team.score} className={`plg-accent flex items-center gap-3 px-4 py-2.5 ${reverse ? 'flex-row-reverse' : ''}`}
      style={{ ['--tc' as any]: color, ['--dir' as any]: reverse ? '270deg' : '90deg', animation: 'plg-cell-flash 0.9s ease-out' }}>
      {team.logo && (
        <img src={team.logo} className="drop-shadow" alt=""
          style={{ width: 36 * scale, height: 36 * scale, animation: float ? 'plg-float-logo 3s ease-in-out infinite' : undefined }} />
      )}
      <span className="font-black text-xl tracking-wide">{team.abbr}</span>
      <Score value={team.score} />
    </div>
  );
}

function StatChip({ label, value, color, big = false }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div className={`px-4 py-2 text-center ${big ? 'plg-accent' : 'plg-panel'}`}
      style={big ? { ['--tc' as any]: color || '#7c3aed', ['--dir' as any]: '135deg' } : undefined}>
      <div className="text-lg font-black leading-none">{value || '0'}</div>
      <div className="text-[9px] font-bold text-white/70 tracking-widest">{label}</div>
    </div>
  );
}

/* Head-to-head player comparison — mugshots on the sides in team color,
   a center column of stats, the leader per row highlighted. */
function PlayerCompare({ summary, aId, bId, awayColor, homeColor, brand, scale }: {
  summary: Summary; aId: string; bId: string; awayColor: string; homeColor: string; brand: { logo?: string; name?: string } | null; scale: number;
}) {
  const all = [...summary.away.athletes, ...summary.home.athletes];
  const A = all.find(x => x.id === aId), B = all.find(x => x.id === bId);
  if (!A || !B) return null;
  const aColor = A.teamColor || awayColor, bColor = B.teamColor || homeColor;
  const rows: [string, string, string][] = [
    ['PTS', A.stats.pts || '0', B.stats.pts || '0'],
    ['REB', A.stats.reb || '0', B.stats.reb || '0'],
    ['AST', A.stats.ast || '0', B.stats.ast || '0'],
    ['FG', A.stats.fg || '0-0', B.stats.fg || '0-0'],
    ['3PT', A.stats.tp || '0-0', B.stats.tp || '0-0'],
  ];
  const lead = (a: string, b: string) => { const na = parseInt(a) || 0, nb = parseInt(b) || 0; return na === nb ? 0 : na > nb ? -1 : 1; };
  const Player = ({ p, color, side }: { p: Athlete; color: string; side: 'l' | 'r' }) => (
    <div className="relative w-[270px] flex flex-col justify-end shrink-0" style={{ background: `linear-gradient(${side === 'l' ? 160 : 200}deg, ${color}, #0b0b0f)` }}>
      <PlayerPhoto src={p.headshot} className="absolute inset-0 w-full h-full object-cover object-top" />
      {p.teamLogo && <img src={p.teamLogo} className={`absolute -top-4 ${side === 'l' ? '-left-3' : '-right-3'} w-28 h-28 object-contain z-20`} style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' }} alt="" />}
      <div className={`relative z-10 bg-gradient-to-t from-black via-black/70 to-transparent pt-20 pb-5 px-5 ${side === 'r' ? 'text-right' : ''}`}>
        <div className="text-xs font-bold uppercase tracking-widest text-white/70">{p.teamAbbr} · #{p.jersey}</div>
        <div className="text-3xl font-black leading-none mt-0.5">{p.name}</div>
      </div>
    </div>
  );
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'plg-full-in 0.3s ease-out both', zoom: scale }}>
      <div className="relative flex items-stretch w-[940px] max-w-[94vw] h-[420px] rounded-3xl overflow-hidden shadow-2xl text-white plg-panel">
        <Player p={A} color={aColor} side="l" />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-3xl font-black tracking-wide mb-7">PLAYER COMPARISON</div>
          <div className="w-full space-y-3.5">
            {rows.map(([label, a, b]) => {
              const l = lead(a, b);
              return (
                <div key={label} className="flex items-center">
                  <div className={`w-2/5 text-right text-3xl font-black tabular-nums whitespace-nowrap ${l === -1 ? '' : 'text-white/45'}`}>{a}</div>
                  <div className="w-1/5 text-center text-[11px] font-bold uppercase tracking-widest text-zinc-400">{label}</div>
                  <div className={`w-2/5 text-left text-3xl font-black tabular-nums whitespace-nowrap ${l === 1 ? '' : 'text-white/45'}`}>{b}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-7 flex items-center gap-2.5 opacity-85">
            {brand?.logo && <img src={brand.logo} className="h-5 max-w-[70px] object-contain" alt="" />}
            {brand?.name && <span className="text-[10px] font-semibold text-zinc-400">{brand.name}</span>}
            <span className="text-zinc-600">·</span>
            <img src="/logo-white.svg" className="h-4 object-contain opacity-70" alt="" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Live Graphics</span>
          </div>
        </div>
        <Player p={B} color={bColor} side="r" />
      </div>
    </div>
  );
}

/* Full-width player stat line banner — mugshot in team color, full-game line. */
function StatLineBanner({ summary, id, awayColor, homeColor }: {
  summary: Summary; id: string; awayColor: string; homeColor: string;
}) {
  const p = [...summary.away.athletes, ...summary.home.athletes].find(x => x.id === id);
  if (!p) return null;
  const isHome = summary.home.athletes.some(x => x.id === id);
  const color = p.teamColor || (isHome ? homeColor : awayColor);
  const cells: [string, string][] = [
    ['PTS', p.stats.pts || '0'], ['REB', p.stats.reb || '0'], ['AST', p.stats.ast || '0'],
    ['STL', p.stats.stl || '0'], ['BLK', p.stats.blk || '0'], ['FG', p.stats.fg || '0-0'], ['3PT', p.stats.tp || '0-0'],
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[150px] flex items-stretch text-white overflow-hidden"
      style={{ animation: 'plg-rise 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>
      <div className="relative flex items-end gap-4 pl-8 pr-10 shrink-0" style={{ background: `linear-gradient(100deg, ${color}, #0b0b0f)`, minWidth: 330 }}>
        <PlayerPhoto src={p.headshot} className="h-[158px] w-32 object-cover object-top self-end shrink-0" />
        <div className="pb-4">
          <div className="text-sm font-bold uppercase tracking-widest text-white/70">{p.teamAbbr} · #{p.jersey} · {p.pos}</div>
          <div className="text-4xl font-black leading-none mt-1">{p.name}</div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-around bg-black/75 px-6">
        {cells.map(([l, v]) => (
          <div key={l} className="text-center">
            <div className="text-5xl font-black tabular-nums">{v}</div>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-400 mt-1.5">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Full boxscore for one team — every column, with a team totals row. */
function BoxscoreFull({ summary, teamKey, awayColor, homeColor, scale }: {
  summary: Summary; teamKey: 'away' | 'home'; awayColor: string; homeColor: string; scale: number;
}) {
  const t = teamKey === 'home' ? summary.home : summary.away;
  const color = teamKey === 'home' ? homeColor : awayColor;
  const players = t.athletes.filter(a => a.played);
  const cols: [string, keyof Athlete['stats']][] = [
    ['MIN', 'min'], ['FG', 'fg'], ['3PT', 'tp'], ['FT', 'ft'], ['OREB', 'oreb'], ['DREB', 'dreb'],
    ['REB', 'reb'], ['AST', 'ast'], ['PF', 'pf'], ['STL', 'stl'], ['TO', 'to'], ['BLK', 'blk'], ['+/-', 'plusMinus'], ['PTS', 'pts'],
  ];
  const n = (s: string) => parseInt(s || '0', 10) || 0;
  const sumMadeAtt = (k: keyof Athlete['stats']) => {
    let m = 0, a = 0;
    for (const p of players) { const [pm, pa] = (p.stats[k] || '0-0').split('-'); m += n(pm); a += n(pa); }
    return `${m}-${a}`;
  };
  const total = (label: string, k: keyof Athlete['stats']) => {
    if (['fg', 'tp', 'ft'].includes(k as string)) return sumMadeAtt(k);
    if (k === 'min' || k === 'plusMinus') return '';
    return String(players.reduce((s, p) => s + n(p.stats[k]), 0));
  };
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'plg-full-in 0.3s ease-out both', zoom: scale }}>
      <div className="plg-panel w-[1040px] max-w-[96vw] text-white rounded-3xl shadow-2xl overflow-hidden" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <div className="flex items-center gap-4 px-7 py-4" style={{ background: `linear-gradient(90deg, ${color}dd, #18181b 80%)` }}>
          {t.logo && <img src={t.logo} className="w-14 h-14 object-contain drop-shadow" alt="" />}
          <div className="flex-1">
            <div className="text-2xl font-black leading-none">{t.name}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/70 mt-1">
              {t.record ? `${t.record} · ` : ''}{t.fouls ? `FOULS ${t.fouls} · ` : ''}BOX SCORE
            </div>
          </div>
          <div className="text-5xl font-black">{t.score}</div>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-wider text-zinc-400 border-b border-white/15">
              <th className="text-left pl-6 py-2">Player</th>
              {cols.map(([lab]) => <th key={lab} className="py-2 px-1.5 text-right w-[52px]">{lab}</th>)}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id} className="border-b border-white/5"
                style={{ animation: `plg-lower-in 0.4s cubic-bezier(0.3,1.15,0.6,1) ${Math.min(i * 0.035, 0.7)}s both` }}>
                <td className="pl-6 py-1.5">
                  <span className="text-white/50 mr-2">{p.jersey}</span>
                  <span className="font-bold">{p.name}</span>
                  {p.starter && <span className="text-[9px] text-zinc-500 ml-1.5">S</span>}
                </td>
                {cols.map(([lab, k]) => (
                  <td key={lab} className={`py-1.5 px-1.5 text-right ${k === 'pts' ? 'font-black' : 'text-zinc-300'}`}>{p.stats[k] || '0'}</td>
                ))}
              </tr>
            ))}
            <tr className="font-black" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <td className="pl-6 py-2 text-[10px] uppercase tracking-widest text-zinc-400">Team Totals</td>
              {cols.map(([lab, k]) => <td key={lab} className="py-2 px-1.5 text-right">{total(lab, k)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Tale of the Tape — team-vs-team category comparison with an arrow to the
   leader of each row. Uses this game's team stats. */
function TaleOfTape({ summary, awayColor, homeColor, scale }: {
  summary: Summary; awayColor: string; homeColor: string; scale: number;
}) {
  const stat = (t: Summary['home'], label: string) => t.stats.find(s => s.label === label)?.value || '0';
  const rows = [
    { cat: 'POINTS', a: summary.away.score || '0', h: summary.home.score || '0', lowerWins: false },
    { cat: 'REBOUNDS', a: stat(summary.away, 'Rebounds'), h: stat(summary.home, 'Rebounds'), lowerWins: false },
    { cat: 'ASSISTS', a: stat(summary.away, 'Assists'), h: stat(summary.home, 'Assists'), lowerWins: false },
    { cat: 'STEALS', a: stat(summary.away, 'Steals'), h: stat(summary.home, 'Steals'), lowerWins: false },
    { cat: 'BLOCKS', a: stat(summary.away, 'Blocks'), h: stat(summary.home, 'Blocks'), lowerWins: false },
    { cat: 'TURNOVERS', a: stat(summary.away, 'Turnovers'), h: stat(summary.home, 'Turnovers'), lowerWins: true },
    { cat: 'FIELD GOAL %', a: stat(summary.away, 'Field Goal %'), h: stat(summary.home, 'Field Goal %'), lowerWins: false },
    { cat: 'THREE POINT %', a: stat(summary.away, 'Three Point %'), h: stat(summary.home, 'Three Point %'), lowerWins: false },
    { cat: 'FREE THROW %', a: stat(summary.away, 'Free Throw %'), h: stat(summary.home, 'Free Throw %'), lowerWins: false },
  ];
  const winner = (r: typeof rows[number]) => {
    const na = parseFloat(r.a), nb = parseFloat(r.h);
    if (isNaN(na) || isNaN(nb) || na === nb) return 0;
    const awayBetter = r.lowerWins ? na < nb : na > nb;
    return awayBetter ? -1 : 1;
  };
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'plg-full-in 0.3s ease-out both', zoom: scale }}>
      <div className="plg-panel w-[900px] max-w-[94vw] text-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-8 py-4"
          style={{ background: `linear-gradient(90deg, ${awayColor}cc, #18181b 45%, #18181b 55%, ${homeColor}cc)` }}>
          <div className="flex items-center gap-3">
            {summary.away.logo && <img src={summary.away.logo} className="w-16 h-16 object-contain" alt="" />}
            <span className="text-2xl font-black">{summary.away.abbr}</span>
          </div>
          <span className="text-2xl font-black tracking-widest">TALE OF THE TAPE</span>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black">{summary.home.abbr}</span>
            {summary.home.logo && <img src={summary.home.logo} className="w-16 h-16 object-contain" alt="" />}
          </div>
        </div>
        <div className="px-10 py-5">
          {rows.map((r, i) => {
            const w = winner(r);
            return (
              <div key={r.cat} className="flex items-center py-2.5 border-b border-white/10 last:border-0"
                style={{ animation: `plg-lower-in 0.5s cubic-bezier(0.3,1.15,0.6,1) ${i * 0.07}s both` }}>
                <div className={`w-1/4 text-right text-3xl font-black tabular-nums ${w === -1 ? '' : 'text-white/45'}`}>{r.a}</div>
                <div className="w-1/6 flex justify-center text-2xl font-black" style={{ color: w === -1 ? awayColor : 'transparent' }}>◄</div>
                <div className="flex-1 text-center text-sm font-bold uppercase tracking-widest text-zinc-300">{r.cat}</div>
                <div className="w-1/6 flex justify-center text-2xl font-black" style={{ color: w === 1 ? homeColor : 'transparent' }}>►</div>
                <div className={`w-1/4 text-left text-3xl font-black tabular-nums ${w === 1 ? '' : 'text-white/45'}`}>{r.h}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Full-width matchup lower third: team color halves, big logos bleeding off
   the edges, tricode + full name, a center sponsor slot and the venue. */
function MatchupBanner({ summary, sponsor, awayColor, homeColor, logoScale, logo3d, tex }: {
  summary: Summary; sponsor: string; awayColor: string; homeColor: string; logoScale: number; logo3d?: boolean; tex?: string;
}) {
  const [venName, venCity] = (summary.venue || '').split(' · ');
  const sz = 210 * logoScale;   // giant — allowed to float past the bar
  const texture = tex || 'transparent';
  const Side = ({ t, color, side }: { t: Summary['home']; color: string; side: 'l' | 'r' }) => (
    <div className={`relative flex-1 flex items-center ${side === 'r' ? 'flex-row-reverse' : ''}`}>
      {/* textured color background (clipped to the bar) */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(${side === 'l' ? '100deg' : '260deg'}, ${color}, #0b0b0f)` }} />
        <div className="absolute inset-0" style={{ backgroundImage: texture }} />
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 40px 60px -30px rgba(255,255,255,0.18), inset 0 -30px 50px -20px rgba(0,0,0,0.6)' }} />
      </div>
      {/* GIANT logo — floats above and off the outer edge */}
      {t.logo && (
        <div className="relative z-20 shrink-0"
          style={{ marginTop: -58, marginBottom: -26, [side === 'l' ? 'marginLeft' : 'marginRight']: -24 } as any}>
          {logo3d
            ? <Logo3D src={t.logo} size={sz} />
            : <img src={t.logo} className="object-contain" alt=""
                style={{ width: sz, height: sz, filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.55))', animation: 'plg-float-logo 3.4s ease-in-out infinite' }} />}
        </div>
      )}
      <div className={`relative z-10 ${side === 'r' ? 'text-right pr-2' : 'pl-2'}`}>
        <div className="text-7xl font-black leading-none tracking-tight" style={{ textShadow: '0 3px 10px rgba(0,0,0,0.5)' }}>{t.abbr}</div>
        <div className="text-base font-bold uppercase tracking-widest text-white/85 mt-1 whitespace-nowrap">{t.name}</div>
      </div>
    </div>
  );
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[172px] flex items-stretch text-white"
      style={{ animation: 'plg-rise 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>
      <Side t={summary.away} color={awayColor} side="l" />
      <div className="relative flex flex-col items-center justify-center px-5 bg-black/75 backdrop-blur-sm z-30 min-w-[230px]">
        {sponsor
          ? <div className="bg-white rounded-lg px-4 py-3 flex items-center shadow-lg"><img src={sponsor} className="h-12 max-w-[160px] object-contain" alt="" /></div>
          : <div className="text-3xl font-black tracking-widest text-white/40">VS</div>}
        {venName && (
          <div className="mt-3 text-center leading-tight">
            <div className="text-[13px] font-black uppercase tracking-wider">{venName}</div>
            {venCity && <div className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{venCity}</div>}
          </div>
        )}
      </div>
      <Side t={summary.home} color={homeColor} side="r" />
    </div>
  );
}

/* Compact latest-play strip that hangs off the score bug and rolls up each
   time a new play lands — the bug-attached counterpart to the side rail. */
function PlayTicker({ plays, summary, awayColor, homeColor }: {
  plays: PlayEvent[]; summary: Summary; awayColor: string; homeColor: string;
}) {
  const latest = plays[plays.length - 1];
  if (!latest) return null;
  const isHome = latest.teamId === summary.home.id;
  const isAway = latest.teamId === summary.away.id;
  const color = isHome ? homeColor : isAway ? awayColor : '#52525b';
  const logo = isHome ? summary.home.logo : isAway ? summary.away.logo : '';
  const abbr = isHome ? summary.home.abbr : isAway ? summary.away.abbr : '';
  return (
    <div className="overflow-hidden rounded-lg shadow-2xl" style={{ maxWidth: 560 }}>
      <style>{`@keyframes plg-tickroll { from { transform: translateY(115%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
      <div key={latest.id} className="plg-panel flex items-center gap-2.5 pl-3 pr-4 py-2 text-white"
        style={{ boxShadow: `inset 4px 0 0 ${color}`, animation: 'plg-tickroll 0.45s cubic-bezier(0.3, 1.15, 0.6, 1) both' }}>
        {logo && <img src={logo} className="w-6 h-6 object-contain shrink-0" alt="" />}
        <span className="text-[13px] font-semibold leading-tight truncate min-w-0">{latest.text}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 shrink-0 ml-auto">
          {abbr}{latest.clock ? ` · ${latest.clock}` : ''}
        </span>
      </div>
    </div>
  );
}

/* Live play-by-play rail — newest plays at the top, scoring plays accented
   in team color. Auto-updates as the feed advances. Sits on the right edge. */
function PlayByPlayRail({ plays, summary, awayColor, homeColor, clock }: {
  plays: PlayEvent[]; summary: Summary; awayColor: string; homeColor: string; clock: string;
}) {
  const recent = plays.slice(-7).reverse();
  const colorOf = (teamId: string) => (teamId === summary.home.id ? homeColor : teamId === summary.away.id ? awayColor : '#52525b');
  const abbrOf = (teamId: string) => (teamId === summary.home.id ? summary.home.abbr : teamId === summary.away.id ? summary.away.abbr : '');
  const logoOf = (teamId: string) => (teamId === summary.home.id ? summary.home.logo : teamId === summary.away.id ? summary.away.logo : '');
  return (
    <div className="absolute top-8 right-8 w-[340px]"
      style={{ animation: 'plg-lower-in 0.5s cubic-bezier(0.3, 1.15, 0.6, 1) both' }}>
      <div className="plg-panel rounded-2xl overflow-hidden shadow-2xl text-white">
        <div className="plg-accent px-4 py-2.5 flex items-center justify-between"
          style={{ ['--tc' as any]: '#111827', ['--dir' as any]: '90deg' }}>
          <span className="text-xs font-black uppercase tracking-[0.2em]">Play by Play</span>
          <span className="text-[11px] font-bold text-yellow-400">
            {summary.state === 'in' ? `${periodLabel(summary.period)} · ${clock}` : summary.statusDetail}
          </span>
        </div>
        <div className="divide-y divide-white/10">
          {recent.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5"
              style={{ boxShadow: `inset 4px 0 0 ${p.scoring ? colorOf(p.teamId) : 'transparent'}`,
                animation: i === 0 ? 'plg-lower-in 0.4s cubic-bezier(0.3,1.15,0.6,1) both' : undefined }}>
              {logoOf(p.teamId)
                ? <img src={logoOf(p.teamId)} className="w-9 h-9 object-contain shrink-0" alt="" />
                : <div className="w-7 h-7 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] leading-snug ${p.scoring ? 'font-bold' : 'font-medium text-zinc-300'}`}>{p.text}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">
                  {abbrOf(p.teamId)}{p.clock ? ` · ${p.clock}` : ''}
                </div>
              </div>
              {p.scoring && (
                <div className="text-xs font-black tabular-nums shrink-0 text-zinc-300">{p.awayScore}-{p.homeScore}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Vertical "At The Line" panel: big mugshot bleeding out the top, the player's
   FT gauge (hot/steady/cold), their shot chart, and FT + points. Sits on the
   side so it can stay up with the score bug — fired at the free-throw line. */
function AtTheLine({ a, shots, custom, awayColor, posCls, brand, scale }: {
  a: Athlete; shots: ShotPlay[]; custom: boolean; awayColor: string; posCls: string; brand: { logo?: string; name?: string } | null; scale: number;
}) {
  const [made, att] = (a.stats.ft || '').split('-').map(n => parseInt(n, 10));
  const hasFt = Number.isFinite(made) && Number.isFinite(att) && att > 0;
  const pct = hasFt ? made / att : 0;
  const color = custom ? awayColor : a.teamColor;
  const zone = !hasFt ? null : pct >= 0.75 ? 'hot' : pct >= 0.5 ? 'steady' : 'cold';
  const zoneColor = zone === 'hot' ? '#22c55e' : zone === 'steady' ? '#f59e0b' : '#ef4444';
  const mine = shots.filter(s => s.athleteId === a.id);
  const W = 300, H = 250, S = 5.7;
  const cx = (x: number) => x * S;
  const cy = (y: number) => H - y * S - 16;
  const pt = (pp: number) => { const ang = Math.PI * (1 - pp); return [60 + 46 * Math.cos(ang), 58 - 46 * Math.sin(ang)]; };
  const arc = (p1: number, p2: number) => { const [x1, y1] = pt(p1); const [x2, y2] = pt(p2); return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A 46 46 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const seg = (p1: number, p2: number, c: string, id: string) => (
    <path key={id} d={arc(p1, p2)} fill="none" stroke={c} strokeWidth="9" strokeLinecap="round"
      opacity={zone === id ? 1 : 0.28} style={zone === id ? { filter: `drop-shadow(0 0 5px ${c})` } : undefined} />
  );
  const bodyBg = `radial-gradient(135% 90% at 26% -8%, ${color}55, transparent 55%), linear-gradient(180deg, #16161c, #0b0b0f)`;
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 w-[348px] ${posCls}`}
      style={{ animation: 'plg-slide-r 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) both', zoom: scale }}>
      {/* BIG team logo bleeding out of the top-left corner */}
      {a.teamLogo && <img src={a.teamLogo} className="absolute -top-9 -left-6 w-32 h-32 object-contain z-10"
        style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))' }} alt="" />}
      {/* mugshot below the logo (may overlap it), no frame */}
      <PlayerPhoto src={a.headshot}
        className="absolute top-8 left-3 w-32 h-36 rounded-xl object-cover object-top shadow-2xl z-20" />
      <div className="rounded-2xl overflow-hidden shadow-2xl text-white" style={{ background: bodyBg }}>
        <div className="plg-label px-4 py-2.5 text-right text-[12px] font-black uppercase tracking-[0.28em] text-black">At The Line</div>
        {/* header: name + team beside the face/logo stack */}
        <div className="plg-accent pl-[150px] pr-4 py-4 min-h-[112px] flex flex-col justify-center" style={{ ['--tc' as any]: color, ['--dir' as any]: '160deg' }}>
          <div className="text-3xl font-black leading-tight">{a.name}</div>
          <div className="flex items-center gap-2.5 mt-2.5">
            {a.teamLogo && <img src={a.teamLogo} className="w-9 h-9 object-contain drop-shadow" alt="" />}
            <span className="text-2xl font-black leading-none">#{a.jersey}</span>
            <span className="text-sm font-bold uppercase tracking-widest opacity-80">{a.teamAbbr}</span>
          </div>
        </div>
        {/* shot chart */}
        <div className="px-4 pt-3 pb-2">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400 mb-1.5">Shot Chart</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
            <rect x={1} y={1} width={W - 2} height={H - 2} rx={10} fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
            <rect x={W / 2 - 42} y={H - 104 - 16} width={84} height={104} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
            <circle cx={W / 2} cy={H - 104 - 16} r={31} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
            <circle cx={W / 2} cy={H - 40} r={5} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} />
            <path d={`M 18 ${H - 16} L 18 ${H - 84} A 132 132 0 0 0 ${W - 18} ${H - 84} L ${W - 18} ${H - 16}`} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
            {mine.map((s, i) => s.made
              ? <circle key={i} cx={cx(s.x)} cy={cy(s.y)} r={6} fill={color} stroke="#fff" strokeWidth={1.5} />
              : <g key={i}>
                  <line x1={cx(s.x) - 4.5} y1={cy(s.y) - 4.5} x2={cx(s.x) + 4.5} y2={cy(s.y) + 4.5} stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
                  <line x1={cx(s.x) + 4.5} y1={cy(s.y) - 4.5} x2={cx(s.x) - 4.5} y2={cy(s.y) + 4.5} stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
                </g>)}
          </svg>
        </div>
        {/* efficiency: gauge + FT + points */}
        <div className="px-5 pt-2 pb-3">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400 mb-1.5">Efficiency</div>
          <div className="flex items-center gap-4">
            <div className="relative w-[140px] shrink-0">
              <svg viewBox="0 0 120 66" className="w-full">
                {seg(0.02, 0.46, '#ef4444', 'cold')}
                {seg(0.52, 0.71, '#f59e0b', 'steady')}
                {seg(0.77, 0.98, '#22c55e', 'hot')}
                {hasFt && (
                  <g style={{ transformOrigin: '60px 58px', ['--ang' as any]: `${((pct - 0.5) * 180).toFixed(1)}deg`, animation: 'plg-needle 1.2s cubic-bezier(0.2, 1.2, 0.4, 1) 0.4s both' }}>
                    <line x1="60" y1="58" x2="60" y2="18" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
                  </g>
                )}
                <circle cx="60" cy="58" r="5.5" fill="#ffffff" />
              </svg>
              <div className="text-center -mt-1">
                <span className="text-4xl font-black leading-none" style={{ color: hasFt ? zoneColor : undefined }}>{hasFt ? Math.round(pct * 100) + '%' : '—'}</span>
                <div className="text-[11px] font-black tracking-[0.25em] mt-1" style={{ color: hasFt ? zoneColor : '#71717a' }}>
                  {zone === 'hot' ? 'HOT' : zone === 'steady' ? 'STEADY' : zone === 'cold' ? 'COLD' : 'FT TONIGHT'}
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="text-3xl font-black leading-none tabular-nums">{hasFt ? `${made}-${att}` : '0-0'}</div>
                <div className="text-[10px] font-bold tracking-widest text-zinc-400 mt-0.5">FREE THROWS</div>
              </div>
              <div>
                <div className="text-3xl font-black leading-none tabular-nums">{a.stats.pts || '0'}</div>
                <div className="text-[10px] font-bold tracking-widest text-zinc-400 mt-0.5">POINTS</div>
              </div>
            </div>
          </div>
        </div>
        {/* footer: company + Pro-Logic */}
        <div className="px-4 py-2 bg-black/50 flex items-center justify-between border-t border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            {brand?.logo && <img src={brand.logo} className="h-4 max-w-[54px] object-contain" alt="" />}
            {brand?.name && <span className="text-[9px] font-semibold text-zinc-400 truncate">{brand.name}</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <img src="/logo-white.svg" className="h-3 object-contain opacity-70" alt="" />
            <span className="text-[8px] uppercase tracking-widest text-zinc-500">Live Graphics</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Half-court shot chart. ESPN coords: x 0..50 (25 = center), y = distance
   from baseline (0 at rim). Made = filled dot in team color, miss = hollow. */
function ShotChart({ summary, shots, filter, awayColor, homeColor }: {
  summary: Summary; shots: ShotPlay[]; filter: string; awayColor: string; homeColor: string;
}) {
  const W = 500, H = 470, S = 10;   // 50ft x 47ft, 10px/ft
  const sel = shots.filter(s =>
    filter === 'all' ? true : (s.teamId === filter || s.athleteId === filter));
  const cx = (x: number) => x * S;
  const cy = (y: number) => H - y * S - 20;   // rim near the bottom
  const colorOf = (s: ShotPlay) => (s.teamId === summary.home.id ? homeColor : awayColor);
  const made = sel.filter(s => s.made);
  const eff = sel.length ? Math.round((made.length / sel.length) * 100) : 0;
  const three = sel.filter(s => s.value === 3);
  const threeMade = three.filter(s => s.made).length;
  const who = filter === 'all' ? 'Both Teams'
    : summary.home.id === filter ? summary.home.name
    : summary.away.id === filter ? summary.away.name
    : [...summary.home.athletes, ...summary.away.athletes].find(a => a.id === filter)?.name || '';
  return (
    <div className="px-8 py-6 flex gap-6 items-center">
      <div className="shrink-0">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 380, height: 357 }}>
          <rect x={2} y={2} width={W - 4} height={H - 4} rx={10} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
          {/* paint */}
          <rect x={W / 2 - 80} y={H - 190 - 20} width={160} height={190} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
          {/* free-throw circle */}
          <circle cx={W / 2} cy={H - 190 - 20} r={60} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
          {/* restricted + rim */}
          <path d={`M ${W / 2 - 40} ${H - 20} A 40 40 0 0 1 ${W / 2 + 40} ${H - 20}`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
          <circle cx={W / 2} cy={H - 52} r={7.5} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={2.5} />
          {/* 3pt arc */}
          <path d={`M 30 ${H - 20} L 30 ${H - 140} A 237 237 0 0 0 ${W - 30} ${H - 140} L ${W - 30} ${H - 20}`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
          {sel.map((s, i) => s.made ? (
            <circle key={i} cx={cx(s.x)} cy={cy(s.y)} r={7} fill={colorOf(s)} stroke="#fff" strokeWidth={1.5}
              style={{ animation: `plg-pop 0.4s ease-out ${Math.min(i * 0.012, 1)}s both` }} />
          ) : (
            <g key={i} style={{ animation: `plg-pop 0.4s ease-out ${Math.min(i * 0.012, 1)}s both` }}>
              <line x1={cx(s.x) - 5} y1={cy(s.y) - 5} x2={cx(s.x) + 5} y2={cy(s.y) + 5} stroke={colorOf(s)} strokeWidth={2.5} strokeLinecap="round" opacity={0.75} />
              <line x1={cx(s.x) + 5} y1={cy(s.y) - 5} x2={cx(s.x) - 5} y2={cy(s.y) + 5} stroke={colorOf(s)} strokeWidth={2.5} strokeLinecap="round" opacity={0.75} />
            </g>
          ))}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-black leading-tight mb-1">{who}</div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-5">Shot Chart</div>
        <div className="flex gap-2.5">
          {[['FG', `${made.length}/${sel.length}`], ['FG%', `${eff}%`], ['3PT', `${threeMade}/${three.length}`]].map(([k, v]) => (
            <div key={k} className="flex-1 min-w-0 rounded-xl border border-white/10 px-2 py-3 text-center">
              <div className="text-xl font-black tabular-nums whitespace-nowrap">{v}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-1">{k}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-5 mt-5 text-xs font-bold text-zinc-300">
          <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: awayColor, boxShadow: '0 0 0 1.5px #fff' }} />Made</span>
          <span className="flex items-center gap-1.5"><span className="text-base leading-none" style={{ color: awayColor }}>✕</span>Missed</span>
        </div>
      </div>
    </div>
  );
}

/* Assist leaders — bars per team with the top playmakers by assists dished. */
function AssistBoard({ summary, links, awayColor, homeColor }: {
  summary: Summary; links: AssistLink[]; awayColor: string; homeColor: string;
}) {
  const cols: [Summary['home'], string][] = [[summary.away, awayColor], [summary.home, homeColor]];
  const max = Math.max(1, ...cols.flatMap(([t]) => assistLeaders(summary, links, t.id).slice(0, 5).map(x => x.count)));
  return (
    <div className="px-8 py-6 grid grid-cols-2 gap-8">
      {cols.map(([t, color]) => {
        const rows = assistLeaders(summary, links, t.id).slice(0, 5);
        return (
          <div key={t.id}>
            <div className="flex items-center gap-2.5 mb-4">
              {t.logo && <img src={t.logo} className="w-12 h-12 object-contain" alt="" />}
              <span className="text-lg font-black">{t.name}</span>
            </div>
            <div className="space-y-3">
              {rows.length === 0 && <div className="text-sm text-zinc-500">No assists yet</div>}
              {rows.map(({ athlete, count }, i) => (
                <div key={athlete.id} className="flex items-center gap-3"
                  style={{ animation: `plg-lower-in 0.5s cubic-bezier(0.3,1.15,0.6,1) ${i * 0.1}s both` }}>
                  <PlayerPhoto src={athlete.headshot} className="w-10 h-10 rounded-full object-cover object-top shrink-0 border border-white/10" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black truncate">{athlete.name}</div>
                    <div className="h-2.5 rounded-full mt-1" style={{ width: `${(count / max) * 100}%`, background: color, minWidth: 8 }} />
                  </div>
                  <div className="text-2xl font-black tabular-nums w-8 text-right">{count}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Game alerts — computed run / lead cards from the play stream. */
function AlertsBoard({ summary, alerts, awayColor, homeColor }: {
  summary: Summary; alerts: GameAlert[]; awayColor: string; homeColor: string;
}) {
  const colorOf = (id?: string) => (id === summary.home.id ? homeColor : id === summary.away.id ? awayColor : '#f59e0b');
  return (
    <div className="px-8 py-8 flex flex-col gap-4 items-center justify-center min-h-[240px]">
      {alerts.length === 0 && <div className="text-lg text-zinc-500">No active alerts</div>}
      {alerts.map((a, i) => (
        <div key={i} className="w-full max-w-[620px] flex items-center gap-5 rounded-2xl overflow-hidden shadow-2xl"
          style={{ animation: `plg-pop 0.5s cubic-bezier(0.34,1.3,0.64,1) ${i * 0.12}s both` }}>
          <div className="plg-accent px-6 py-5 font-black text-4xl tracking-wide flex items-center justify-center min-w-[150px]"
            style={{ ['--tc' as any]: colorOf(a.teamId), ['--dir' as any]: '135deg' }}>
            {a.title}
          </div>
          <div className="plg-panel flex-1 px-5 py-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{a.kind === 'run' ? 'Scoring Run' : a.kind === 'lead' ? 'Lead Watch' : a.kind}</div>
            <div className="text-xl font-black mt-1">{a.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Quarter-break board: linescore that fills in period by period, team stat
   leaders, and the upcoming game — fired when going to commercials. */
function QuarterBreak({ summary, awayColor, homeColor, nextGame }: {
  summary: Summary; awayColor: string; homeColor: string;
  nextGame: { awayName?: string; awayLogo?: string; homeName?: string; homeLogo?: string; date?: string; time?: string; venue?: string } | null;
}) {
  const nP = Math.max(4, summary.period, summary.away.linescores?.length || 0, summary.home.linescores?.length || 0);
  const cols = Array.from({ length: nP }, (_, i) => i);
  const colLabel = (i: number) => (i < 4 ? String(i + 1) : nP > 5 ? `OT${i - 3}` : 'OT');
  const topBy = (t: Summary['home'], key: 'pts' | 'reb' | 'ast') =>
    [...t.athletes].filter(a => a.played)
      .sort((a, b) => parseInt(b.stats[key] || '0') - parseInt(a.stats[key] || '0'))[0];
  const ng = nextGame && (nextGame.awayName || nextGame.homeName) ? nextGame : null;
  const fmtDate = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d + 'T12:00:00');
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  };
  const fmtTime = (t?: string) => {
    if (!t) return '';
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    const h = parseInt(m[1], 10);
    return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const CATS: ['pts' | 'reb' | 'ast', string][] = [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists']];
  return (
    <div className="px-8 py-6 flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="rounded-xl overflow-hidden border border-white/10"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          <div className="flex text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-white/5">
            <div className="w-36 px-4 py-2">Team</div>
            {cols.map(i => <div key={i} className="flex-1 text-center py-2">{colLabel(i)}</div>)}
            <div className="w-16 text-center py-2 text-yellow-400">T</div>
          </div>
          {([summary.away, summary.home] as const).map((t, r) => (
            <div key={t.id} className="flex items-center border-t border-white/10 text-lg font-black"
              style={{ boxShadow: `inset 5px 0 0 ${r === 0 ? awayColor : homeColor}` }}>
              <div className="w-36 px-4 py-2.5 flex items-center gap-2.5">
                {t.logo && <img src={t.logo} className="w-10 h-10 object-contain" alt="" />}
                <span>{t.abbr}</span>
              </div>
              {cols.map(i => (
                <div key={i} className="flex-1 text-center py-2.5"
                  style={{ animation: t.linescores?.[i] ? 'plg-score-pop 0.6s ease-out both' : undefined }}>
                  {t.linescores?.[i] || '–'}
                </div>
              ))}
              <div className="w-16 text-center py-2.5 text-yellow-400 text-xl">{t.score}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-5">
          {([summary.away, summary.home] as const).map((t, r) => (
            <div key={t.id} className="rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white"
                style={{ background: `linear-gradient(90deg, ${r === 0 ? awayColor : homeColor}cc, transparent 130%)` }}>
                {t.abbr} Stat Leaders
              </div>
              {CATS.map(([k, label]) => {
                const a = topBy(t, k);
                return (
                  <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-1.5 border-t border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
                    <span className="text-sm font-black truncate">{a ? `${a.shortName} — ${a.stats[k] || '0'}` : '—'}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {ng && (
        <div className="w-52 shrink-0 border-l border-white/10 pl-5 flex flex-col justify-center gap-2.5">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Upcoming</div>
          {(ng.awayLogo || ng.homeLogo) && (
            <div className="flex items-center gap-2.5">
              {ng.awayLogo && <img src={ng.awayLogo} className="w-14 h-14 object-contain drop-shadow" alt="" />}
              <span className="text-xs font-black text-zinc-400">VS</span>
              {ng.homeLogo && <img src={ng.homeLogo} className="w-14 h-14 object-contain drop-shadow" alt="" />}
            </div>
          )}
          <div className="text-sm font-black leading-snug">{[ng.awayName, ng.homeName].filter(Boolean).join(' vs ')}</div>
          <div className="text-xs font-bold text-yellow-400">{[fmtDate(ng.date), fmtTime(ng.time)].filter(Boolean).join(' · ')}</div>
          {ng.venue && <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{ng.venue}</div>}
        </div>
      )}
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
            <div key={`${i}-${isCorrect}`}
              style={isCorrect ? { animation: 'plg-correct-pop 0.5s ease-out both' } : undefined}
              className={`rounded-2xl px-5 py-4 flex items-center gap-3 border-2 transition-colors duration-500 ${
                isCorrect ? 'bg-green-500/20 border-green-400' : dimmed ? 'bg-zinc-800/40 border-transparent opacity-40' : 'bg-zinc-800/70 border-transparent'}`}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                style={{ background: isCorrect ? '#22c55e' : accent }}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-lg font-bold leading-tight">{opt || '—'}</span>
              {isCorrect && <span className="ml-auto text-green-400 text-2xl font-black">✓</span>}
            </div>
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
              <div key={a.id}
                style={{ animation: `plg-rise 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) ${delay + i * 0.18}s both` }}
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
              </div>
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

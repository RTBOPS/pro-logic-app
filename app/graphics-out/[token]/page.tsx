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
  normalizeShots, normalizeAssists, assistLeaders, computeAlerts,
  type Summary, type Athlete, type Callout, type ShotPlay, type AssistLink, type GameAlert,
} from '@/lib/nba';

interface BusState {
  bug?: boolean;
  lowerId?: string | null;
  full?: 'teamstats' | 'lineups' | 'leaders' | 'matchup' | 'linescore' | 'shotchart' | 'assists' | 'alerts' | 'trivia' | 'nextgame' | null;
  shotFilter?: string | null;   // 'all' | teamId | athleteId
  banner?: string | null;               // URL of the currently-aired banner
  portal?: boolean;                     // hoop-portal sponsor reveal
  talent?: boolean;                     // broadcast team graphic
  mention?: boolean;                    // special guest / VIP mention
  ftId?: string | null;                 // free-throw spotlight player
  sub?: { inId: string; outId: string } | null;
  coach?: 'away' | 'home' | null;
}

interface GfxDoc extends BusState {
  eventId?: string;
  updatedAt?: string;
  league?: string;
  sourceMode?: 'feed' | 'manual';       // manual: operator-keyed game data
  manual?: ManualGame | null;
  preview?: BusState | null;            // staged look — aired via TAKE
  brand?: { logo?: string; name?: string } | null;
  showBrand?: boolean;
  autoCallouts?: boolean;
  callout?: Callout | null;             // manual fire from the control panel
  theme?: { useTeamColors?: boolean; c1?: string; c2?: string; logoScale?: number; brandScale?: number; motion?: boolean; bugPos?: 'left' | 'center' | 'right'; skin?: string; lowerPos?: 'left' | 'center' | 'right'; ftPos?: 'left' | 'right'; badgeSec?: number; bugStyle?: string } | null;
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
          setAssists(normalizeAssists(json));
          setAlerts(computeAlerts(json, next));
        }
      } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [gfx.eventId, gfx.autoCallouts, gfx.sourceMode, gfx.manual, gfx.league, gfx.photoOverrides]);

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
        <>
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
                  <span className="text-yellow-400 font-bold text-lg leading-tight">{summary.clock}</span>
                  <span className="text-zinc-400 text-xs font-semibold">{periodLabel(summary.period)}</span>
                </>
              ) : (
                <span className="text-zinc-300 text-xs font-bold uppercase text-center leading-tight px-1">{summary.statusDetail}</span>
              )
            );
            return (
              <div className={`absolute bottom-8 flex flex-col gap-2 ${posCls}`}
                style={{ fontVariantNumeric: 'tabular-nums', animation: 'plg-rise 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>

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
                            <span className="text-yellow-400 font-black text-xl">{summary.clock}</span>
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
                          <span className="text-yellow-400 text-sm">{summary.clock}</span>
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
            <div key={lower.id} className={`absolute bottom-28 flex items-end ${lowerPosCls}`}
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
                  {lower.teamLogo && <img src={lower.teamLogo} className="w-11 h-11 object-contain drop-shadow shrink-0" alt="" />}
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

          {/* ── SUBSTITUTION ── */}
          {subPair && (
            <div className={`absolute bottom-28 ${lowerPosCls}`}
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
              <div className={`absolute bottom-28 ${lowerPosCls}`}
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
          {ftPlayer && (() => {
            const a = ftPlayer;
            const [made, att] = (a.stats.ft || '').split('-').map(n => parseInt(n, 10));
            const hasFt = Number.isFinite(made) && Number.isFinite(att) && att > 0;
            const pct = hasFt ? made / att : 0;
            const C = 327;   // circumference of r=52 ring
            const color = custom ? awayColor : a.teamColor;
            return (
              <div className={`absolute top-1/2 -translate-y-1/2 w-64 ${ftPosCls}`}
                style={{ animation: 'plg-slide-r 0.55s cubic-bezier(0.34, 1.3, 0.64, 1) both' }}>
                <div className="rounded-2xl overflow-hidden shadow-2xl text-white">
                  <div className="plg-label px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-black">
                    At The Line
                  </div>
                  <div className="plg-accent px-4 py-3 flex items-center gap-3"
                    style={{ ['--tc' as any]: color, ['--dir' as any]: '135deg' }}>
                    <PlayerPhoto src={a.headshot} className="w-14 h-14 rounded-xl object-cover object-top bg-black/30 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-lg font-black leading-tight truncate">{a.name}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 flex items-center gap-1.5">
                        {a.teamLogo && <img src={a.teamLogo} className="w-4 h-4 object-contain" alt="" />}
                        {a.teamAbbr} · #{a.jersey}
                      </div>
                    </div>
                  </div>
                  <div className="plg-panel px-4 py-4 flex items-center gap-4">
                    <div className="relative w-[120px] shrink-0">
                      {(() => {
                        const zone = !hasFt ? null : pct >= 0.75 ? 'hot' : pct >= 0.5 ? 'steady' : 'cold';
                        const zoneColor = zone === 'hot' ? '#22c55e' : zone === 'steady' ? '#f59e0b' : '#ef4444';
                        const pt = (pp: number) => {
                          const ang = Math.PI * (1 - pp);
                          return [60 + 46 * Math.cos(ang), 58 - 46 * Math.sin(ang)];
                        };
                        const arc = (p1: number, p2: number) => {
                          const [x1, y1] = pt(p1); const [x2, y2] = pt(p2);
                          return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A 46 46 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
                        };
                        const seg = (p1: number, p2: number, colorSeg: string, id: string) => (
                          <path key={id} d={arc(p1, p2)} fill="none" stroke={colorSeg} strokeWidth="9" strokeLinecap="round"
                            opacity={zone === id ? 1 : 0.28}
                            style={zone === id ? { filter: `drop-shadow(0 0 5px ${colorSeg})` } : undefined} />
                        );
                        return (
                          <>
                            <svg viewBox="0 0 120 66" className="w-full">
                              {seg(0.02, 0.46, '#ef4444', 'cold')}
                              {seg(0.52, 0.71, '#f59e0b', 'steady')}
                              {seg(0.77, 0.98, '#22c55e', 'hot')}
                              {hasFt && (
                                <g style={{ transformOrigin: '60px 58px', ['--ang' as any]: `${((pct - 0.5) * 180).toFixed(1)}deg`, animation: 'plg-needle 1.2s cubic-bezier(0.2, 1.2, 0.4, 1) 0.4s both' }}>
                                  <line x1="60" y1="58" x2="60" y2="20" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
                                </g>
                              )}
                              <circle cx="60" cy="58" r="5.5" fill="#ffffff" />
                            </svg>
                            <div className="text-center -mt-1">
                              <span className="text-2xl font-black leading-none" style={{ color: hasFt ? zoneColor : undefined }}>
                                {hasFt ? Math.round(pct * 100) + '%' : '—'}
                              </span>
                              <div className="text-[9px] font-black tracking-[0.25em] mt-0.5"
                                style={{ color: hasFt ? zoneColor : '#71717a' }}>
                                {zone === 'hot' ? 'HOT 🔥' : zone === 'steady' ? 'STEADY' : zone === 'cold' ? 'COLD' : 'FT TONIGHT'}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <div className="text-xl font-black leading-none" style={{ animation: 'plg-ft-pulse 1.6s ease-in-out infinite' }}>
                          {hasFt ? `${made}-${att}` : '0-0'}
                        </div>
                        <div className="text-[9px] font-bold tracking-widest text-zinc-400">FREE THROWS</div>
                      </div>
                      <div>
                        <div className="text-xl font-black leading-none">{a.stats.pts || '0'}</div>
                        <div className="text-[9px] font-bold tracking-widest text-zinc-400">POINTS</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── FULL SCREENS (pure CSS) ── */}
          {bus.full && (
            <div key={bus.full} className="absolute inset-0 flex items-center justify-center"
              style={{ animation: 'plg-full-in 0.3s ease-out both' }}>
              <div className="plg-panel w-[900px] max-w-[92vw] text-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-8 py-4"
                  style={{ background: `linear-gradient(90deg, ${awayColor}cc, #18181b 45%, #18181b 55%, ${homeColor}cc)` }}>
                  <div className="flex items-center gap-3">
                    {summary.away.logo && <img src={summary.away.logo} style={{ width: 40 * logoScale, height: 40 * logoScale }} alt="" />}
                    <span className="text-2xl font-black">{summary.away.abbr}</span>
                    <Score value={summary.away.score} />
                  </div>
                  <div className="text-center">
                    {gfx.leagueBadge && (
                      <img src={gfx.leagueBadge} className="h-7 mx-auto mb-1 object-contain" alt="" />
                    )}
                    <div className="text-sm font-bold text-yellow-400">{summary.state === 'in' ? `${periodLabel(summary.period)} · ${summary.clock}` : summary.statusDetail}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 mt-0.5">
                      {bus.full === 'teamstats' ? 'Team Stats' : bus.full === 'lineups' ? 'Starting Lineups' : bus.full === 'matchup' ? 'Matchup — Top 5' : bus.full === 'linescore' ? (summary.state === 'post' ? 'Final Stats' : 'Quarter Break') : bus.full === 'shotchart' ? 'Shot Chart' : bus.full === 'assists' ? 'Assist Leaders' : bus.full === 'alerts' ? 'Game Alerts' : bus.full === 'trivia' ? 'Trivia' : bus.full === 'nextgame' ? 'Up Next' : 'Top Performers'}
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
        </>
      )}
    </div>
  );
}

/* 3D coin-spin logo: fake extrusion by stacking the same image at depth
   offsets inside a preserve-3d rotator — reads as a real 3D logo with any
   PNG, no vectorizing, pure CSS (compositor-driven). */
function Logo3D({ src: url, size }: { src: string; size: number }) {
  const layers = 9;
  const depth = 7;
  return (
    <div style={{ width: size, height: size, perspective: 900 }}>
      <div className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d', animation: 'plg-spin3d 7s linear infinite' }}>
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
              {t.logo && <img src={t.logo} className="w-8 h-8 object-contain" alt="" />}
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
                {t.logo && <img src={t.logo} className="w-7 h-7 object-contain" alt="" />}
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
              {ng.awayLogo && <img src={ng.awayLogo} className="w-10 h-10 object-contain drop-shadow" alt="" />}
              <span className="text-xs font-black text-zinc-400">VS</span>
              {ng.homeLogo && <img src={ng.homeLogo} className="w-10 h-10 object-contain drop-shadow" alt="" />}
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

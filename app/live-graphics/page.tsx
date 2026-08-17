'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { useCompany } from '@/hooks/useCompany';
import PageHeader from '@/components/PageHeader';
import { UpgradeGate } from '@/components/UpgradeGate';
import {
  MonitorPlay, Copy, ExternalLink, Loader2, RefreshCw, Eye, EyeOff, Search,
  Upload, Trash2, Zap, Plus, Play, Pause,
} from 'lucide-react';
import {
  normalizeScoreboard, normalizeSummary, gameLeaders, periodLabel, buildCallout,
  LEAGUES, emptyManualGame, manualToSummary, manualClockRemaining, fmtClockSec,
  type Game, type Summary, type Athlete, type Callout, type ManualGame, type ManualPlayer,
} from '@/lib/nba';

/* Live Graphics control panel — pick an NBA game, everything populates from
   the live feed (scores, official clock, player stats, headshots), and the
   operator fires graphics onto the output page captured by OBS/vMix/ATEM. */

interface BannerItem { id: string; url: string; name: string }
interface GfxState {
  bug: boolean;
  lowerId: string | null;
  full: 'teamstats' | 'lineups' | 'leaders' | 'matchup' | null;
  banner: string | null;
}
const GFX_OFF: GfxState = { bug: false, lowerId: null, full: null, banner: null };

const DEMO = { label: 'Demo: Finals 2024 — DAL @ BOS (G5)', date: '20240617' };

function ControlInner() {
  const [games, setGames] = useState<Game[]>([]);
  const [date, setDate] = useState('');            // '' = today, else YYYYMMDD
  const [loadingGames, setLoadingGames] = useState(false);
  const [eventId, setEventId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [gfx, setGfx] = useState<GfxState>(GFX_OFF);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [playerQuery, setPlayerQuery] = useState('');
  const pushing = useRef(false);
  const company = useCompany();

  /* Preview/Program: stage in PVW, put on air with TAKE (or CUT direct) */
  const [mode, setMode] = useState<'preview' | 'direct'>('preview');
  const [pvw, setPvw] = useState<GfxState>(GFX_OFF);

  /* Data source: live ESPN feed (any supported league) or operator-keyed manual game */
  const [source, setSource] = useState<'feed' | 'manual'>('feed');
  const [league, setLeague] = useState('nba');
  const [manual, setManual] = useState<ManualGame>(emptyManualGame());
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Branding & presentation settings */
  const [showBrand, setShowBrand] = useState(true);
  const [autoCallouts, setAutoCallouts] = useState(true);
  const [useTeamColors, setUseTeamColors] = useState(true);
  const [c1, setC1] = useState('#7c3aed');
  const [c2, setC2] = useState('#0ea5e9');
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);

  /* Output token: stable per browser so the OBS source URL survives reloads.
     Hydrate persisted settings (banners, colors) from the existing doc. */
  useEffect(() => {
    let t = localStorage.getItem('plg_gfx_token');
    if (!t) { t = crypto.randomUUID(); localStorage.setItem('plg_gfx_token', t); }
    setToken(t);
    getDoc(doc(db, 'live_graphics', t)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      if (d.preview) setPvw({ ...GFX_OFF, ...d.preview });
      if (d.sourceMode === 'manual') setSource('manual');
      if (d.league) setLeague(d.league);
      if (d.manual) setManual({ ...emptyManualGame(), ...d.manual });
      if (d.eventId && d.sourceMode !== 'manual') setEventId(d.eventId);
      if (Array.isArray(d.banners)) setBanners(d.banners);
      if (d.showBrand === false) setShowBrand(false);
      if (d.autoCallouts === false) setAutoCallouts(false);
      if (d.theme) {
        if (d.theme.useTeamColors === false) setUseTeamColors(false);
        if (d.theme.c1) setC1(d.theme.c1);
        if (d.theme.c2) setC2(d.theme.c2);
      }
    }).catch(() => {});
  }, []);

  /* Scoreboard polling (15 s) — feed mode */
  const loadGames = async (d: string) => {
    setLoadingGames(true);
    try {
      const res = await fetch(`/api/nba/scoreboard?league=${league}${d ? `&dates=${d}` : ''}`);
      const json = await res.json();
      setGames(normalizeScoreboard(json));
    } catch { /* keep last list */ }
    finally { setLoadingGames(false); }
  };
  useEffect(() => {
    if (source !== 'feed') return;
    loadGames(date);
    const t = setInterval(() => loadGames(date), 15000);
    return () => clearInterval(t);
  }, [date, league, source]);

  /* Summary: feed → poll (5 s); manual → rebuild locally (500 ms clock tick) */
  useEffect(() => {
    if (source === 'manual') {
      const tick = () => setSummary(manualToSummary(manual));
      tick();
      const t = setInterval(tick, 500);
      return () => clearInterval(t);
    }
    if (!eventId) { setSummary(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/nba/summary?event=${eventId}&league=${league}`);
        const json = await res.json();
        if (alive) setSummary(normalizeSummary(json));
      } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [eventId, source, manual, league]);

  /* Write to the public output doc (always carries branding/theme settings) */
  const pushDoc = async (fields: Record<string, any>, nextEventId = eventId) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !token) return;
    pushing.current = true;
    try {
      await setDoc(doc(db, 'live_graphics', token), {
        uid, eventId: nextEventId,
        sourceMode: source, league,
        brand: { logo: company?.logo_url || '', name: company?.name || '' },
        showBrand, autoCallouts,
        theme: { useTeamColors, c1, c2 },
        banners,
        updatedAt: new Date().toISOString(),
        ...fields,
      }, { merge: true });
    } catch (e) { console.error('gfx push failed', e); }
    finally { pushing.current = false; }
  };

  /* The bus the buttons operate on: PVW when previewing, PGM when cutting direct */
  const active = mode === 'preview' ? pvw : gfx;
  const fire = (patch: Partial<GfxState>) => {
    if (mode === 'preview') {
      const next = { ...pvw, ...patch };
      setPvw(next);
      pushDoc({ preview: next });
    } else {
      const next = { ...gfx, ...patch };
      setGfx(next);
      pushDoc({ ...next });
    }
  };
  const take = () => { setGfx(pvw); pushDoc({ ...pvw }); };
  const clearPvw = () => { setPvw(GFX_OFF); pushDoc({ preview: GFX_OFF }); };
  const clearProgram = () => { setGfx(GFX_OFF); pushDoc({ ...GFX_OFF }); };

  /* Re-push settings when branding/theme changes (only once a game is loaded) */
  useEffect(() => {
    if ((eventId || source === 'manual') && token) pushDoc({});
  }, [showBrand, autoCallouts, useTeamColors, c1, c2, banners]);

  /* Fire a play callout for the on-air player (or top scorer) */
  const calloutTarget: Athlete | null = useMemo(() => {
    if (!summary) return null;
    const all = [...summary.home.athletes, ...summary.away.athletes];
    return all.find(a => a.id === (active.lowerId || gfx.lowerId)) || gameLeaders(summary, 1)[0] || null;
  }, [summary, active.lowerId, gfx.lowerId]);

  const fireCallout = (kind: Callout['kind']) => {
    if (!calloutTarget) return;
    pushDoc({ callout: buildCallout(calloutTarget, kind) });
  };

  /* Banner upload to Storage */
  const uploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid;
    if (!file || !uid) return;
    setUploading(true);
    try {
      const path = `graphics_banners/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setBanners(b => [...b, { id: Math.random().toString(36).slice(2, 10), url, name: file.name }]);
    } catch (err: any) { alert('Upload failed: ' + err.message); }
    finally { setUploading(false); if (bannerRef.current) bannerRef.current.value = ''; }
  };

  const selectGame = (id: string) => {
    setEventId(id);
    setGfx(GFX_OFF);
    setPvw(GFX_OFF);
    pushDoc({ ...GFX_OFF, preview: GFX_OFF, sourceMode: 'feed' }, id);
  };

  const switchSource = (s: 'feed' | 'manual') => {
    setSource(s);
    pushDoc({ sourceMode: s, manual: s === 'manual' ? manual : (manual as any) });
  };

  /* ── Manual game ops ──
     Text edits debounce; score/clock ops write immediately. */
  const pushManual = (next: ManualGame, immediate = false) => {
    setManual(next);
    if (manualTimer.current) clearTimeout(manualTimer.current);
    if (immediate) { pushDoc({ manual: next, sourceMode: 'manual' }); return; }
    manualTimer.current = setTimeout(() => pushDoc({ manual: next, sourceMode: 'manual' }), 600);
  };

  const mTeam = (side: 'home' | 'away', patch: Partial<ManualGame['home']>, immediate = false) =>
    pushManual({ ...manual, [side]: { ...manual[side], ...patch } }, immediate);

  const mScore = (side: 'home' | 'away', delta: number) =>
    mTeam(side, { score: Math.max(0, manual[side].score + delta) }, true);

  const mAddPlayer = (side: 'home' | 'away') =>
    mTeam(side, {
      players: [...manual[side].players, {
        id: Math.random().toString(36).slice(2, 10),
        name: '', jersey: '', pos: '', starter: manual[side].players.length < 5,
        photo: '', pts: 0, reb: 0, ast: 0,
      }],
    });

  const mPlayer = (side: 'home' | 'away', id: string, patch: Partial<ManualPlayer>, immediate = false) =>
    mTeam(side, { players: manual[side].players.map(p => p.id === id ? { ...p, ...patch } : p) }, immediate);

  const mRemovePlayer = (side: 'home' | 'away', id: string) =>
    mTeam(side, { players: manual[side].players.filter(p => p.id !== id) }, true);

  /* Player scored: bump their points AND the team score (auto-callout fires off the diff) */
  const mBucket = (side: 'home' | 'away', id: string, points: number) => {
    const p = manual[side].players.find(x => x.id === id);
    if (!p) return;
    pushManual({
      ...manual,
      [side]: {
        ...manual[side],
        score: Math.max(0, manual[side].score + points),
        players: manual[side].players.map(x => x.id === id ? { ...x, pts: Math.max(0, x.pts + points) } : x),
      },
    }, true);
  };
  const mStat = (side: 'home' | 'away', id: string, key: 'reb' | 'ast', delta: number) => {
    const p = manual[side].players.find(x => x.id === id);
    if (!p) return;
    mPlayer(side, id, { [key]: Math.max(0, p[key] + delta) } as any, true);
  };

  /* Clock ops */
  const clockRemaining = manualClockRemaining(manual);
  const mClockStart = () =>
    pushManual({ ...manual, clockRunning: true, clockSec: clockRemaining, clockUpdatedAt: new Date().toISOString() }, true);
  const mClockPause = () =>
    pushManual({ ...manual, clockRunning: false, clockSec: clockRemaining, clockUpdatedAt: new Date().toISOString() }, true);
  const mClockSet = (mmss: string) => {
    const [mm, ss] = mmss.split(':').map(n => parseInt(n, 10) || 0);
    pushManual({ ...manual, clockRunning: false, clockSec: mm * 60 + (ss || 0), clockUpdatedAt: new Date().toISOString() }, true);
  };
  const mPeriod = (delta: number) =>
    pushManual({ ...manual, period: Math.max(1, manual.period + delta) }, true);

  /* Team logo upload (Storage) */
  const uploadTeamLogo = async (side: 'home' | 'away', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid;
    if (!file || !uid) return;
    try {
      const path = `graphics_banners/${uid}/logo_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      mTeam(side, { logo: url }, true);
    } catch (err: any) { alert('Upload failed: ' + err.message); }
  };

  const outputUrl = typeof window !== 'undefined' && token
    ? `${window.location.origin}/graphics-out/${token}` : '';

  const copyUrl = async () => {
    await navigator.clipboard.writeText(outputUrl);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const leaders = useMemo(() => summary ? gameLeaders(summary, 3) : [], [summary]);
  const allAthletes = useMemo(() => summary
    ? [...summary.away.athletes, ...summary.home.athletes].filter(a => a.played)
    : [], [summary]);
  const filteredAthletes = useMemo(() => {
    const q = playerQuery.toLowerCase();
    return q ? allAthletes.filter(a => a.name.toLowerCase().includes(q)) : allAthletes;
  }, [allAthletes, playerQuery]);

  const fireBtn = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';

  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Live Graphics" subtitle="NBA broadcast graphics driven by the live game feed — capture the output page in OBS / vMix / ATEM">
        <button onClick={() => loadGames(date)} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
          <RefreshCw size={14} className={loadingGames ? 'animate-spin' : ''} /> Refresh
        </button>
      </PageHeader>

      {/* Output URL bar */}
      {token && (
        <div className="mb-6 bg-gray-900 text-white rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-3">
          <MonitorPlay size={16} className="text-green-400 shrink-0" />
          <div className="text-xs text-gray-400">Output (browser source, 1920×1080, transparent):</div>
          <code className="text-xs bg-white/10 rounded-lg px-2.5 py-1.5 flex-1 min-w-[240px] truncate">{outputUrl}</code>
          <button onClick={copyUrl} className="flex items-center gap-1.5 bg-white text-black px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-200">
            <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <a href={`${outputUrl}?bg=dark`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 border border-white/20 px-3 py-1.5 rounded-lg text-xs hover:bg-white/10">
            <ExternalLink size={12} /> Open output
          </a>
          <div className="w-full text-[11px] text-gray-500">
            HDMI / screen out: open the output on the external display and press <span className="text-gray-300 font-semibold">F</span> (or double-click) for a clean fullscreen feed — cursor auto-hides and the screen stays awake. For a bulletproof feed use Chrome kiosk mode instead of Safari.
          </div>
        </div>
      )}

      {/* ── PVW / PGM monitors + TAKE ── */}
      {token && summary && (
        <div className="mb-6 bg-zinc-950 rounded-2xl p-4 flex flex-wrap items-center justify-center gap-5">
          <Monitor label="PREVIEW" color="text-yellow-400"
            src={`/graphics-out/${token}?mode=preview&bg=dark`} />
          <div className="flex flex-col items-center gap-2">
            <button onClick={take}
              className="w-24 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-lg tracking-widest shadow-lg">
              TAKE
            </button>
            <button onClick={clearPvw}
              className="w-24 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[10px] font-bold hover:bg-zinc-800">
              CLEAR PVW
            </button>
            <button onClick={() => setMode(m => m === 'preview' ? 'direct' : 'preview')}
              className={`w-24 py-1.5 rounded-lg text-[10px] font-bold ${mode === 'preview' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-600/40' : 'bg-red-500/20 text-red-400 border border-red-600/40'}`}>
              {mode === 'preview' ? 'PVW → TAKE' : 'CUT DIRECT'}
            </button>
          </div>
          <Monitor label="PROGRAM" color="text-red-500"
            src={`/graphics-out/${token}?bg=dark`} />
        </div>
      )}

      {/* Data source: feed (by league) or manual ingest */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => switchSource('feed')}
              className={`px-3.5 py-1.5 rounded-lg text-sm ${source === 'feed' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>
              Live Feed
            </button>
            <button onClick={() => switchSource('manual')}
              className={`px-3.5 py-1.5 rounded-lg text-sm ${source === 'manual' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>
              Manual / Local
            </button>
          </div>
          {source === 'feed' && (
            <>
              <select value={league} onChange={e => { setLeague(e.target.value); setEventId(''); }}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                {LEAGUES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button onClick={() => setDate('')}
                className={`${fireBtn} ${!date ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                Today
              </button>
              <input type="date" onChange={e => setDate(e.target.value.replace(/-/g, ''))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
              {league === 'nba' && (
                <button onClick={() => setDate(DEMO.date)}
                  className={`${fireBtn} ${date === DEMO.date ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {DEMO.label}
                </button>
              )}
            </>
          )}
        </div>

        {source === 'feed' ? (
          games.length === 0 ? (
            <p className="text-sm text-gray-400">{loadingGames ? 'Loading games…' : 'No games on this date.'}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {games.map(g => (
                <button key={g.id} onClick={() => selectGame(g.id)}
                  className={`text-left rounded-xl border p-3 transition-colors ${eventId === g.id ? 'border-black ring-1 ring-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {g.away.logo && <img src={g.away.logo} className="w-6 h-6" alt="" />}
                      <span className="text-sm font-semibold">{g.away.abbr} {g.away.score}</span>
                      <span className="text-xs text-gray-400">@</span>
                      <span className="text-sm font-semibold">{g.home.score} {g.home.abbr}</span>
                      {g.home.logo && <img src={g.home.logo} className="w-6 h-6" alt="" />}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      g.state === 'in' ? 'bg-red-100 text-red-600' : g.state === 'post' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                      {g.state === 'in' ? `LIVE ${periodLabel(g.period)} ${g.clock}` : g.statusDetail}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          /* ── MANUAL GAME EDITOR ── */
          <div className="space-y-5">
            {/* Clock & period console */}
            <div className="bg-gray-900 text-white rounded-2xl p-4 flex flex-wrap items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-black font-mono text-yellow-400">{fmtClockSec(clockRemaining)}</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400">Game clock</div>
              </div>
              <button onClick={manual.clockRunning ? mClockPause : mClockStart}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${manual.clockRunning ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white'}`}>
                {manual.clockRunning ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Start</>}
              </button>
              <input placeholder="10:00" defaultValue={fmtClockSec(manual.clockSec)}
                onKeyDown={e => { if (e.key === 'Enter') mClockSet((e.target as HTMLInputElement).value); }}
                className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-sm font-mono text-center"
                title="Type mm:ss and press Enter" />
              <div className="flex items-center gap-2">
                <button onClick={() => mPeriod(-1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 font-bold">−</button>
                <div className="text-center min-w-[44px]">
                  <div className="font-black text-lg">{periodLabel(manual.period)}</div>
                  <div className="text-[9px] uppercase tracking-widest text-gray-400">Period</div>
                </div>
                <button onClick={() => mPeriod(1)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 font-bold">+</button>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                Length
                <input type="number" min={1} max={20} value={manual.periodMin}
                  onChange={e => pushManual({ ...manual, periodMin: parseInt(e.target.value) || 10 }, true)}
                  className="w-12 bg-white/10 border border-white/20 rounded-lg px-1.5 py-1 text-center" /> min
              </label>
              <button onClick={() => pushManual({ ...manual, period: manual.period + 1, clockRunning: false, clockSec: (manual.periodMin || 10) * 60, clockUpdatedAt: new Date().toISOString() }, true)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold">
                Next period ↺ reset clock
              </button>
            </div>

            {/* Teams */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(['away', 'home'] as const).map(side => {
                const t = manual[side];
                return (
                  <div key={side} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 flex flex-wrap items-center gap-2" style={{ background: `${t.color}14` }}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{side}</span>
                      <input value={t.name} onChange={e => mTeam(side, { name: e.target.value })} placeholder="Team name"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[120px] bg-white" />
                      <input value={t.abbr} onChange={e => mTeam(side, { abbr: e.target.value.toUpperCase().slice(0, 4) })} placeholder="ABR"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-16 font-bold bg-white" />
                      <input type="color" value={t.color} onChange={e => mTeam(side, { color: e.target.value }, true)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                      <label className="cursor-pointer text-gray-400 hover:text-gray-700" title="Upload team logo">
                        {t.logo ? <img src={t.logo} className="w-7 h-7 object-contain" alt="" /> : <Upload size={15} />}
                        <input type="file" accept="image/*" className="hidden" onChange={e => uploadTeamLogo(side, e)} />
                      </label>
                    </div>
                    {/* Score console */}
                    <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                      <span className="text-3xl font-black tabular-nums w-16" style={{ color: t.color }}>{t.score}</span>
                      {[1, 2, 3].map(n => (
                        <button key={n} onClick={() => mScore(side, n)}
                          className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-700">+{n}</button>
                      ))}
                      <button onClick={() => mScore(side, -1)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">−1</button>
                      <span className="ml-auto text-[10px] text-gray-400">Team score only — use player rows to track stats</span>
                    </div>
                    {/* Roster */}
                    <div className="divide-y divide-gray-50">
                      {t.players.map(pl => (
                        <div key={pl.id} className="px-3 py-2 flex flex-wrap items-center gap-1.5 group">
                          <input value={pl.name} onChange={e => mPlayer(side, pl.id, { name: e.target.value })} placeholder="Player name"
                            className="border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-1.5 py-1 text-xs flex-1 min-w-[110px] focus:outline-none" />
                          <input value={pl.jersey} onChange={e => mPlayer(side, pl.id, { jersey: e.target.value.slice(0, 3) })} placeholder="#"
                            className="border border-transparent hover:border-gray-200 rounded px-1 py-1 text-xs w-9 text-center focus:outline-none focus:border-blue-400" />
                          <input value={pl.pos} onChange={e => mPlayer(side, pl.id, { pos: e.target.value.toUpperCase().slice(0, 2) })} placeholder="P"
                            className="border border-transparent hover:border-gray-200 rounded px-1 py-1 text-xs w-9 text-center focus:outline-none focus:border-blue-400" />
                          <button onClick={() => mPlayer(side, pl.id, { starter: !pl.starter }, true)}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pl.starter ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}
                            title="Starter">S</button>
                          <span className="text-xs font-bold w-6 text-right tabular-nums">{pl.pts}</span>
                          {[1, 2, 3].map(n => (
                            <button key={n} onClick={() => mBucket(side, pl.id, n)}
                              className="text-[10px] font-bold px-1.5 py-1 rounded bg-gray-100 hover:bg-green-100 hover:text-green-700">+{n}</button>
                          ))}
                          <button onClick={() => mStat(side, pl.id, 'reb', 1)}
                            className="text-[10px] px-1.5 py-1 rounded bg-gray-100 hover:bg-blue-100 hover:text-blue-700">R{pl.reb}</button>
                          <button onClick={() => mStat(side, pl.id, 'ast', 1)}
                            className="text-[10px] px-1.5 py-1 rounded bg-gray-100 hover:bg-purple-100 hover:text-purple-700">A{pl.ast}</button>
                          <button onClick={() => mRemovePlayer(side, pl.id)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                        </div>
                      ))}
                      <button onClick={() => mAddPlayer(side)}
                        className="w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-1.5 justify-center">
                        <Plus size={12} /> Add player
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400">
              The +1/+2/+3 buttons on a player add to their points AND the team score — and fire the
              auto callouts (3-POINTER!, +2…) on air, same as the live feed. R/A bump rebounds and assists.
            </p>
          </div>
        )}
      </div>

      {!summary ? (
        eventId ? <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading boxscore…</div> : null
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Fire panel ── */}
          <div className="space-y-5">
            {/* Live score header */}
            <div className="bg-gray-900 text-white rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {summary.away.logo && <img src={summary.away.logo} className="w-8 h-8" alt="" />}
                  <span className="font-bold text-lg">{summary.away.abbr}</span>
                  <span className="font-black text-2xl">{summary.away.score}</span>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-mono font-bold">{summary.state === 'in' ? `${periodLabel(summary.period)} ${summary.clock}` : ''}</div>
                  <div className="text-xs text-gray-400">{summary.statusDetail}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-2xl">{summary.home.score}</span>
                  <span className="font-bold text-lg">{summary.home.abbr}</span>
                  {summary.home.logo && <img src={summary.home.logo} className="w-8 h-8" alt="" />}
                </div>
              </div>
            </div>

            {/* Graphics triggers */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">Fire graphics</h2>
              <button onClick={() => fire({ bug: !active.bug })}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${active.bug ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Score Bug (auto clock + score) {active.bug ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              {([
                ['teamstats', 'Team Stats — full screen'],
                ['lineups', 'Starting Lineups — full screen'],
                ['leaders', 'Top Performers / MVP — full screen'],
                ['matchup', 'Matchup Top 5 vs Top 5 — full screen'],
              ] as ['teamstats' | 'lineups' | 'leaders' | 'matchup', string][]).map(([kind, label]) => (
                <button key={kind} onClick={() => fire({ full: active.full === kind ? null : kind })}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${active.full === kind ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {label} {active.full === kind ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              ))}
              {active.lowerId && (
                <button onClick={() => fire({ lowerId: null })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white">
                  Hide player lower third
                </button>
              )}
              <button onClick={clearProgram}
                className="w-full px-4 py-2 rounded-xl text-xs text-red-500 border border-red-200 hover:bg-red-50">
                CLEAR PROGRAM
              </button>
            </div>

            {/* Play callouts */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Play callouts</h2>
                <button onClick={() => setAutoCallouts(v => !v)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${autoCallouts ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <Zap size={10} className="inline mr-1" />Auto {autoCallouts ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Auto detects threes, buckets, assists and double-doubles from the live feed.
                Manual fire targets: <span className="font-semibold text-gray-600">{calloutTarget?.name || '—'}</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['3pt', '3-POINTER'], ['2pt', '+2'], ['ft', '+1 FT'],
                  ['ast', 'ASSIST'], ['dd', 'DOUBLE-DBL'], ['td', 'TRIPLE-DBL'],
                ] as [Callout['kind'], string][]).map(([kind, label]) => (
                  <button key={kind} onClick={() => fireCallout(kind)} disabled={!calloutTarget}
                    className="px-2 py-2 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-yellow-800 disabled:opacity-40">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Branding & look */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">Branding & look</h2>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {company?.logo_url
                    ? <img src={company.logo_url} className="h-6 max-w-[70px] object-contain" alt="" />
                    : <span className="text-xs text-gray-400">No logo — set it in Company Info</span>}
                  <span className="text-xs text-gray-600 truncate">{company?.name}</span>
                </div>
                <button onClick={() => setShowBrand(v => !v)} disabled={!company?.logo_url}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${showBrand && company?.logo_url ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {showBrand ? 'On air' : 'Hidden'}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Colors</span>
                  <button onClick={() => setUseTeamColors(v => !v)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${useTeamColors ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {useTeamColors ? 'Official team colors' : 'Custom colors'}
                  </button>
                </div>
                {!useTeamColors && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      Away <input type="color" value={c1} onChange={e => setC1(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      Home <input type="color" value={c2} onChange={e => setC2(e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                    </label>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Banners ({banners.length})</span>
                  <button onClick={() => bannerRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40">
                    {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
                  </button>
                  <input ref={bannerRef} type="file" accept="image/*" onChange={uploadBanner} className="hidden" />
                </div>
                {banners.length === 0 ? (
                  <p className="text-xs text-gray-400">Upload sponsor or show banners (PNG with transparency works best).</p>
                ) : (
                  <div className="space-y-1.5">
                    {banners.map(b => (
                      <div key={b.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${active.banner === b.url ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <img src={b.url} className="h-6 w-14 object-contain shrink-0" alt="" />
                        <span className="text-xs text-gray-600 truncate flex-1">{b.name}</span>
                        <button onClick={() => fire({ banner: active.banner === b.url ? null : b.url })}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active.banner === b.url ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                          {active.banner === b.url ? (mode === 'preview' ? 'IN PVW' : 'ON AIR') : (mode === 'preview' ? 'PVW' : 'AIR')}
                        </button>
                        <button onClick={() => {
                          if (gfx.banner === b.url || pvw.banner === b.url) fire({ banner: null });
                          setBanners(list => list.filter(x => x.id !== b.id));
                        }} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Leaders quick-fire */}
            {leaders.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Top scorers — one-tap lower third</h2>
                <div className="space-y-2">
                  {leaders.map(a => (
                    <button key={a.id} onClick={() => fire({ lowerId: active.lowerId === a.id ? null : a.id })}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left ${active.lowerId === a.id ? 'bg-purple-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      {a.headshot && <img src={a.headshot} className="w-9 h-9 rounded-full object-cover bg-gray-200" alt="" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{a.name}</div>
                        <div className={`text-xs ${active.lowerId === a.id ? 'text-purple-200' : 'text-gray-500'}`}>{a.teamAbbr} · #{a.jersey}</div>
                      </div>
                      <div className="text-sm font-bold shrink-0">{a.stats.pts} PTS</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Player roster (fire lower thirds) ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-800">Players — click to fire lower third</h2>
              <div className="relative ml-auto">
                <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                <input value={playerQuery} onChange={e => setPlayerQuery(e.target.value)} placeholder="Search player"
                  className="border border-gray-200 rounded-lg pl-7 pr-2 py-1 text-xs w-44 focus:outline-none" />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Player</th>
                    <th className="px-2 py-2 text-left w-12">Team</th>
                    <th className="px-2 py-2 text-right w-10">MIN</th>
                    <th className="px-2 py-2 text-right w-10">PTS</th>
                    <th className="px-2 py-2 text-right w-10">REB</th>
                    <th className="px-2 py-2 text-right w-10">AST</th>
                    <th className="px-2 py-2 text-right w-14">FG</th>
                    <th className="px-2 py-2 text-right w-14">3PT</th>
                    <th className="px-2 py-2 text-right w-12">+/−</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAthletes.map(a => (
                    <tr key={a.id} onClick={() => fire({ lowerId: active.lowerId === a.id ? null : a.id })}
                      className={`cursor-pointer ${active.lowerId === a.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {a.headshot ? <img src={a.headshot} className="w-7 h-7 rounded-full object-cover bg-gray-100" alt="" /> : <div className="w-7 h-7 rounded-full bg-gray-200" />}
                          <span className="font-medium text-gray-800">{a.name}</span>
                          {a.starter && <span className="text-[10px] text-gray-400">S</span>}
                          {active.lowerId === a.id && <span className="text-[10px] font-bold text-purple-600">{mode === 'preview' ? 'IN PVW' : 'ON AIR'}</span>}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 font-semibold" style={{ color: a.teamColor }}>{a.teamAbbr}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{a.stats.min}</td>
                      <td className="px-2 py-1.5 text-right font-bold">{a.stats.pts}</td>
                      <td className="px-2 py-1.5 text-right">{a.stats.reb}</td>
                      <td className="px-2 py-1.5 text-right">{a.stats.ast}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{a.stats.fg}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{a.stats.tp}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{a.stats.plusMinus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Scaled 1920×1080 monitor of an output bus */
function Monitor({ src, label, color }: { src: string; label: string; color: string }) {
  return (
    <div>
      <div className={`text-[10px] font-black tracking-[0.2em] mb-1.5 ${color}`}>{label}</div>
      <div className="relative w-[352px] h-[198px] overflow-hidden rounded-xl bg-black border border-zinc-800">
        <iframe src={src} title={label}
          className="absolute top-0 left-0 border-0 pointer-events-none"
          style={{ width: 1920, height: 1080, transform: 'scale(0.18333)', transformOrigin: 'top left' }} />
      </div>
    </div>
  );
}

export default function LiveGraphicsPage() {
  return (
    <UpgradeGate feature="Live Graphics" requires="pro">
      <ControlInner />
    </UpgradeGate>
  );
}

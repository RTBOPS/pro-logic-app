'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { useCompany } from '@/hooks/useCompany';
import PageHeader from '@/components/PageHeader';
import PlayerPhoto from '@/components/PlayerPhoto';
import { UpgradeGate } from '@/components/UpgradeGate';
import {
  MonitorPlay, Copy, ExternalLink, Loader2, RefreshCw, Eye, EyeOff, Search,
  Upload, Trash2, Zap, Plus, Play, Pause,
  Palette, HelpCircle, Flame, Mic, Star, Calendar, ClipboardList, Users, X, Settings,
} from 'lucide-react';
import {
  normalizeScoreboard, normalizeSummary, normalizeTeams, gameLeaders, periodLabel, buildCallout, detectCallouts, detectRichCallouts, advanceManualPeriod,
  LEAGUES, emptyManualGame, manualToSummary, manualClockRemaining, fmtClockSec,
  type Game, type Summary, type Athlete, type Callout, type ManualGame, type ManualPlayer, type LeagueTeam,
} from '@/lib/nba';

/* Live Graphics control panel — pick an NBA game, everything populates from
   the live feed (scores, official clock, player stats, headshots), and the
   operator fires graphics onto the output page captured by OBS/vMix/ATEM. */

interface BannerItem { id: string; url: string; name: string }
interface GfxState {
  bug: boolean;
  lowerId: string | null;
  full: 'teamstats' | 'lineups' | 'leaders' | 'matchup' | 'linescore' | 'shotchart' | 'assists' | 'alerts' | 'trivia' | 'nextgame' | 'matchupbanner' | 'compare' | 'statline' | 'taletape' | 'boxscore' | null;
  compareA?: string; compareB?: string;
  statLineId?: string;
  boxTeam?: 'away' | 'home';
  shotFilter?: string | null;
  shotLine?: string | null;
  banner: string | null;
  portal: boolean;
  talent: boolean;
  mention: boolean;
  pbp?: boolean;
  pbpTicker?: boolean;
  ftId: string | null;
  sub: { inId: string; outId: string } | null;
  coach: 'away' | 'home' | null;
}
const GFX_OFF: GfxState = { bug: false, lowerId: null, full: null, banner: null, portal: false, talent: false, mention: false, ftId: null, sub: null, coach: null, pbp: false, pbpTicker: false };

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
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterWidth, setRosterWidth] = useState(460);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [gfxSettings, setGfxSettings] = useState<string | null>(null);
  const [gScale, setGScale] = useState<Record<string, number>>({});
  useEffect(() => { const w = parseInt(localStorage.getItem('plg_roster_w') || '', 10); if (w >= 320 && w <= 1000) setRosterWidth(w); }, []);
  const startResizeRoster = (e: React.MouseEvent) => {
    e.preventDefault();
    let lastW = rosterWidth;
    const onMove = (ev: MouseEvent) => { lastW = Math.min(1000, Math.max(320, window.innerWidth - ev.clientX)); setRosterWidth(lastW); };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); localStorage.setItem('plg_roster_w', String(Math.round(lastW))); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };
  const [savedNote, setSavedNote] = useState('');
  const pushing = useRef(false);
  const company = useCompany();

  /* Preview/Program: stage in PVW, put on air with TAKE (or CUT direct) */
  const [mode, setMode] = useState<'preview' | 'direct'>('preview');
  const [pvw, setPvw] = useState<GfxState>(GFX_OFF);

  /* Data source: live ESPN feed (any supported league) or operator-keyed manual game */
  const [source, setSource] = useState<'feed' | 'manual'>('feed');
  const [league, setLeague] = useState('nba');
  const [manual, setManual] = useState<ManualGame>(emptyManualGame());
  const [clockMM, setClockMM] = useState('10');
  const [clockSS, setClockSS] = useState('00');
  const [lenStr, setLenStr] = useState('10');
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Branding & presentation settings */
  const [showBrand, setShowBrand] = useState(true);
  const [autoCallouts, setAutoCallouts] = useState(true);
  const [autoFt, setAutoFt] = useState(false);
  const autoFtRef = useRef(false);
  const ftSeenRef = useRef('');
  const ftPrimedRef = useRef(false);
  const [useTeamColors, setUseTeamColors] = useState(true);
  const [c1, setC1] = useState('#7c3aed');
  const [c2, setC2] = useState('#0ea5e9');
  const [logoScale, setLogoScale] = useState(1);      // team logos on bug & headers
  const [brandScale, setBrandScale] = useState(1);    // company logo chip
  const [badgeSec, setBadgeSec] = useState(4.5);      // seconds each badge-roll logo holds
  const [bugStyle, setBugStyle] = useState<'classic' | 'bar' | 'strip' | 'stack' | 'arena'>('classic');
  const [bugScale, setBugScale] = useState(1);
  const [clockOffset, setClockOffset] = useState(0);
  const [fullScale, setFullScale] = useState(1);
  const [atlScale, setAtlScale] = useState(1);
  const [urlBarOpen, setUrlBarOpen] = useState(false);
  const [matchup3d, setMatchup3d] = useState(false);
  const [gfxScale, setGfxScale] = useState(1);   // global size of all output graphics
  const [texture, setTexture] = useState('diamond');
  const [textureIntensity, setTextureIntensity] = useState(1);
  const [motionFx, setMotionFx] = useState(false);    // breathing logos + shine sweep
  const [bugPos, setBugPos] = useState<'left' | 'center' | 'right'>('left');
  const [lowerPos, setLowerPos] = useState<'left' | 'center' | 'right'>('left');
  const [ftPos, setFtPos] = useState<'left' | 'right'>('right');
  const [skin, setSkin] = useState('clean');
  const [monSize, setMonSize] = useState(352);
  useEffect(() => {
    const s = parseInt(localStorage.getItem('plg_mon_size') || '352', 10);
    if (s) setMonSize(s);
  }, []);
  const pickMonSize = (w: number) => { setMonSize(w); localStorage.setItem('plg_mon_size', String(w)); };

  /* Sponsored trivia */
  const [trivia, setTrivia] = useState({
    question: '', options: ['', '', ''], correct: 0, sponsor: '', reveal: false,
  });

  /* Hoop portal (AR-style sponsor reveal aligned to the backboard shot) */
  const [portalCfg, setPortalCfg] = useState({ x: 50, y: 30, size: 1, logo: '', video: '', content: 'logo' as 'logo' | 'trivia' });

  /* Broadcast team & special mentions */
  const [talentList, setTalentList] = useState<{ id: string; name: string; role: string; photo: string }[]>([]);
  const [mentionCfg, setMentionCfg] = useState({ label: 'Special Guest', name: '', title: '', photo: '' });
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});
  const [leagueBadge, setLeagueBadge] = useState('auto');   // auto | none | url
  const [extraBadges, setExtraBadges] = useState<string[]>([]);   // sponsor logos in the badge roll
  const [dock, setDock] = useState<null | 'branding' | 'trivia' | 'portal' | 'team' | 'mention' | 'nextgame' | 'coaches'>(null);
  const [nextGameCfg, setNextGameCfg] = useState({ awayName: '', awayLogo: '', homeName: '', homeLogo: '', date: '', time: '', venue: '' });
  const [leagueTeams, setLeagueTeams] = useState<LeagueTeam[]>([]);
  useEffect(() => {
    if (dock !== 'nextgame' || leagueTeams.length > 0) return;
    fetch(`/api/nba/teams?league=${league}`).then(r => r.json()).then(j => setLeagueTeams(normalizeTeams(j))).catch(() => {});
  }, [dock, league]);
  const [coachCfg, setCoachCfg] = useState({ away: '', home: '' });
  const [subIn, setSubIn] = useState('');
  const [calloutWho, setCalloutWho] = useState('auto');   // auto | generic | athleteId
  const [shotPick, setShotPick] = useState('all');   // all | teamId | athleteId (shooting graphics)
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');
  const [statPick, setStatPick] = useState('');
  const [suggestions, setSuggestions] = useState<(Callout & { ts: number })[]>([]);
  const prevSumRef = useRef<Summary | null>(null);
  useEffect(() => { autoFtRef.current = autoFt; }, [autoFt]);
  const seenPlaysRef = useRef<Set<string>>(new Set());   // play ids already turned into suggestions
  const playsPrimedRef = useRef(false);                  // first poll seeds the set, emits nothing
  const suggest = (s: Summary | null, json?: any) => {
    if (!s) return;
    if (autoCallouts && s.state === 'in') {
      let evts: Callout[] = [];
      if (json) {
        // Feed mode: rich callouts from the play stream (real shot + assist),
        // plus dd/td milestones which only a boxscore diff surfaces.
        const rich = detectRichCallouts(json, s, seenPlaysRef.current);
        if (!playsPrimedRef.current) {
          playsPrimedRef.current = true;   // seed the seen-set on first poll, don't dump the game
        } else {
          const ms = detectCallouts(prevSumRef.current, s).filter(e => e.kind === 'dd' || e.kind === 'td');
          evts = [...ms, ...rich];
        }
      } else {
        evts = detectCallouts(prevSumRef.current, s);
      }
      if (evts.length) setSuggestions(prev => [...evts.map(e => ({ ...e, ts: Date.now() })), ...prev].slice(0, 6));
    }
    prevSumRef.current = s;
  };
  useEffect(() => {
    const t = setInterval(() => setSuggestions(prev => prev.filter(x => Date.now() - x.ts < 45000)), 5000);
    return () => clearInterval(t);
  }, []);
  const [subOut, setSubOut] = useState('');
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);
  const badgeLogoRef = useRef<HTMLInputElement>(null);

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
      if (d.manual) {
        const m = { ...emptyManualGame(), ...d.manual };
        setManual(m);
        setLenStr(String(m.periodMin || 10));
        setClockMM(String(Math.floor((m.clockSec || 600) / 60)));
        setClockSS(String(Math.floor((m.clockSec || 600) % 60)).padStart(2, '0'));
      }
      if (d.eventId && d.sourceMode !== 'manual') setEventId(d.eventId);
      if (Array.isArray(d.banners)) setBanners(d.banners);
      if (d.showBrand === false) setShowBrand(false);
      if (d.autoCallouts === false) setAutoCallouts(false);
      if (d.theme) {
        if (d.theme.useTeamColors === false) setUseTeamColors(false);
        if (d.theme.c1) setC1(d.theme.c1);
        if (d.theme.c2) setC2(d.theme.c2);
        if (d.theme.logoScale) setLogoScale(d.theme.logoScale);
        if (d.theme.brandScale) setBrandScale(d.theme.brandScale);
        if (d.theme.motion) setMotionFx(true);
        if (d.theme.bugPos) setBugPos(d.theme.bugPos);
        if (d.theme.lowerPos) setLowerPos(d.theme.lowerPos);
        if (d.theme.ftPos) setFtPos(d.theme.ftPos);
        if (d.theme.skin) setSkin(d.theme.skin);
        if (d.theme.badgeSec) setBadgeSec(d.theme.badgeSec);
        if (d.theme.bugStyle) setBugStyle(d.theme.bugStyle);
        if (d.theme.bugScale) setBugScale(d.theme.bugScale);
        if (typeof d.theme.clockOffset === 'number') setClockOffset(d.theme.clockOffset);
        if (d.theme.fullScale) setFullScale(d.theme.fullScale);
        if (d.theme.atlScale) setAtlScale(d.theme.atlScale);
        if (d.theme.gScale && typeof d.theme.gScale === 'object') setGScale(d.theme.gScale);
        if (d.theme.matchup3d) setMatchup3d(true);
        if (d.theme.gfxScale) setGfxScale(d.theme.gfxScale);
        if (d.theme.texture) setTexture(d.theme.texture);
        if (d.theme.textureIntensity != null) setTextureIntensity(d.theme.textureIntensity);
      }
      if (d.trivia) setTrivia({ question: '', options: ['', '', ''], correct: 0, sponsor: '', reveal: false, ...d.trivia });
      if (d.portalCfg) setPortalCfg({ x: 50, y: 30, size: 1, logo: '', video: '', content: 'logo', ...d.portalCfg });
      if (Array.isArray(d.talentCfg?.list)) setTalentList(d.talentCfg.list);
      if (d.mentionCfg) setMentionCfg({ label: 'Special Guest', name: '', title: '', photo: '', ...d.mentionCfg });
      if (d.photoOverrides) setPhotoOverrides(d.photoOverrides);
      if (d.leagueBadgeMode) setLeagueBadge(d.leagueBadgeMode);
      if (Array.isArray(d.extraBadges)) setExtraBadges(d.extraBadges);
      if (d.nextGameCfg) setNextGameCfg({ awayName: '', awayLogo: '', homeName: '', homeLogo: '', date: '', time: '', venue: '', ...d.nextGameCfg });
      if (d.coachCfg) setCoachCfg({ away: '', home: '', ...d.coachCfg });
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
      const tick = () => {
        const s = manualToSummary(manual);
        suggest(s);
        setSummary(s);
      };
      tick();
      const t = setInterval(tick, 500);
      return () => clearInterval(t);
    }
    if (!eventId) { setSummary(null); return; }
    // Fresh game → forget prior plays so old scoring never replays as suggestions
    seenPlaysRef.current = new Set();
    playsPrimedRef.current = false;
    prevSumRef.current = null;
    ftSeenRef.current = ''; ftPrimedRef.current = false;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/nba/summary?event=${eventId}&league=${league}`);
        const json = await res.json();
        if (alive) {
          const s = normalizeSummary(json);
          suggest(s, json);
          setSummary(s);
          // Auto free-throw spotlight: when a shooter reaches the line, target them
          if (autoFtRef.current) {
            const fts = (json?.plays || []).filter((p: any) => /free throw/i.test(p.text || ''));
            const last = fts[fts.length - 1];
            const pid = last ? String(last.id || last.sequenceNumber || '') : '';
            const shooter = last ? String(last.participants?.[0]?.athlete?.id || '') : '';
            if (pid && pid !== ftSeenRef.current && shooter) {
              ftSeenRef.current = pid;
              if (ftPrimedRef.current) { setGfx(g => ({ ...g, ftId: shooter })); pushDoc({ ftId: shooter }); }
              else ftPrimedRef.current = true;
            }
          }
        }
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
        theme: { useTeamColors, c1, c2, logoScale, brandScale, motion: motionFx, bugPos, skin, lowerPos, ftPos, badgeSec, bugStyle, bugScale, matchup3d, gfxScale, texture, textureIntensity, clockOffset, fullScale, atlScale, gScale },
        trivia,
        portalCfg,
        talentCfg: { list: talentList },
        mentionCfg,
        photoOverrides,
        leagueBadgeMode: leagueBadge,
        extraBadges,
        nextGameCfg,
        coachCfg,
        leagueBadge: leagueBadge === 'none' ? '' : leagueBadge === 'auto'
          ? (source === 'feed' ? (LEAGUES.find(l => l.id === league)?.logo || '') : '')
          : leagueBadge,
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
  }, [showBrand, autoCallouts, useTeamColors, c1, c2, banners, logoScale, brandScale, badgeSec, bugStyle, bugScale, matchup3d, gfxScale, texture, textureIntensity, clockOffset, fullScale, atlScale, gScale, motionFx, trivia, portalCfg, talentList, mentionCfg, bugPos, skin, lowerPos, ftPos, photoOverrides, leagueBadge, league, source, extraBadges, nextGameCfg, coachCfg]);

  /* Fire a play callout for the on-air player (or top scorer) */
  const calloutTarget: Athlete | null = useMemo(() => {
    if (!summary) return null;
    const all = [...summary.home.athletes, ...summary.away.athletes];
    return all.find(a => a.id === (active.lowerId || gfx.lowerId)) || gameLeaders(summary, 1)[0] || null;
  }, [summary, active.lowerId, gfx.lowerId]);

  const CALLOUT_TITLES: Record<Callout['kind'], string> = {
    '3pt': '3-POINTER!', '2pt': '+2', ft: '+1 FT', ast: 'ASSIST',
    dd: 'DOUBLE-DOUBLE!', td: 'TRIPLE-DOUBLE!', custom: '',
  };
  const clearCalloutSoon = () => setTimeout(() => pushDoc({ callout: null }), 8000);
  const fireGeneric = (kind: Callout['kind']) => {
    pushDoc({ callout: { id: Math.random().toString(36).slice(2, 10), kind, title: CALLOUT_TITLES[kind], color: '#f59e0b' } });
    clearCalloutSoon();
  };
  const fireCallout = (kind: Callout['kind']) => {
    if (calloutWho === 'generic') { fireGeneric(kind); return; }
    /* Specific pick that no longer exists in this game airs nameless —
       never fall back to a different player's name. */
    const target = calloutWho === 'auto'
      ? calloutTarget
      : allAthletes.find(a => a.id === calloutWho) || null;
    if (!target) { fireGeneric(kind); return; }
    pushDoc({ callout: buildCallout(target, kind) });
    clearCalloutSoon();
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

  /* Custom center logo for the score bug chip */
  const uploadCenterLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid;
    if (!file || !uid) return;
    setUploading(true);
    try {
      const path = `graphics_banners/${uid}/centerlogo_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setBanners(b => [...b, { id: Math.random().toString(36).slice(2, 10), url, name: file.name }]);
      setLeagueBadge(url);
    } catch (err: any) { alert('Upload failed: ' + err.message); }
    finally { setUploading(false); if (badgeLogoRef.current) badgeLogoRef.current.value = ''; }
  };

  /* Custom portal FX video upload (alpha webm/mov) */
  const uploadPortalVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid;
    if (!file || !uid) return;
    setUploading(true);
    try {
      const path = `graphics_banners/${uid}/portalfx_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setPortalCfg(c => ({ ...c, video: url }));
    } catch (err: any) { alert('Upload failed: ' + err.message); }
    finally { setUploading(false); }
  };

  /* Person photo upload (commentators / special guests) */
  const uploadPersonPhoto = async (e: React.ChangeEvent<HTMLInputElement>, assign: (url: string) => void) => {
    const file = e.target.files?.[0];
    const uid = auth.currentUser?.uid;
    if (!file || !uid) return;
    try {
      const path = `graphics_banners/${uid}/person_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      assign(await getDownloadURL(snap.ref));
    } catch (err: any) { alert('Upload failed: ' + err.message); }
  };

  /* ── Mugshot tools: find on Google → copy → paste here (or upload a file) ── */
  const uploadBlobAsPhoto = async (blob: Blob, assign: (url: string) => void) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const path = `graphics_banners/${uid}/mug_${Date.now()}.${ext}`;
    const snap = await uploadBytes(storageRef(storage, path), blob);
    assign(await getDownloadURL(snap.ref));
  };
  const googleMugshot = (name: string, team: string) =>
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${name} ${team} basketball`)}`, '_blank');
  const pasteMugshot = async (assign: (url: string) => void) => {
    try {
      const items = await (navigator.clipboard as any).read();
      for (const item of items) {
        const type = item.types.find((t: string) => t.startsWith('image/'));
        if (type) {
          await uploadBlobAsPhoto(await item.getType(type), assign);
          return;
        }
      }
      alert('No image on the clipboard. In Google Images: right-click the photo → "Copy image", then try again.');
    } catch (e: any) {
      alert('Clipboard not available: ' + (e?.message || e));
    }
  };
  const uploadMugshot = (e: React.ChangeEvent<HTMLInputElement>, assign: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) uploadBlobAsPhoto(file, assign).catch(err => alert('Upload failed: ' + err.message));
  };
  const overrideFor = (a: Athlete) => (url: string) => setPhotoOverrides(o => ({ ...o, [a.id]: url }));

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
  const mClockSet = () => {
    const mm = parseInt(clockMM, 10) || 0;
    const ss = Math.min(59, parseInt(clockSS, 10) || 0);
    pushManual({ ...manual, clockRunning: false, clockSec: mm * 60 + ss, clockUpdatedAt: new Date().toISOString() }, true);
  };
  const mClockNudge = (delta: number) =>
    pushManual({ ...manual, clockSec: Math.max(0, clockRemaining + delta), clockUpdatedAt: new Date().toISOString() }, true);
  const mSetLength = () => {
    const v = Math.min(30, Math.max(1, parseInt(lenStr, 10) || 10));
    setLenStr(String(v));
    pushManual({ ...manual, periodMin: v }, true);
  };
  const mPeriod = (delta: number) =>
    pushManual(advanceManualPeriod(manual, Math.max(1, manual.period + delta)), true);

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
  /* Seed player pickers with sensible defaults when the game changes */
  useEffect(() => {
    if (!summary) return;
    const aTop = [...summary.away.athletes].filter(a => a.played).sort((x, y) => parseInt(y.stats.pts || '0') - parseInt(x.stats.pts || '0'))[0];
    const hTop = [...summary.home.athletes].filter(a => a.played).sort((x, y) => parseInt(y.stats.pts || '0') - parseInt(x.stats.pts || '0'))[0];
    setCmpA(prev => prev || aTop?.id || '');
    setCmpB(prev => prev || hTop?.id || '');
    setStatPick(prev => prev || aTop?.id || '');
  }, [summary?.eventId]);

  /* Selection pointing at a player who isn't in this game drops to generic */
  useEffect(() => {
    if (calloutWho !== 'auto' && calloutWho !== 'generic' && !allAthletes.some(a => a.id === calloutWho)) {
      setCalloutWho('generic');
    }
  }, [allAthletes, calloutWho]);

  /* Sweep any leftover callout from a previous run so it can never replay */
  useEffect(() => {
    if (!token) return;
    setDoc(doc(db, 'live_graphics', token), { callout: null }, { merge: true }).catch(() => {});
  }, [token]);

  const filteredAthletes = useMemo(() => {
    const q = playerQuery.toLowerCase();
    return q ? allAthletes.filter(a => a.name.toLowerCase().includes(q)) : allAthletes;
  }, [allAthletes, playerQuery]);

  const fireBtn = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';

  /* Save the pre-game setup as a restorable snapshot (branding, themes, sizes,
     textures, next game, coaches, trivia…). Live on-air toggles are excluded. */
  const savePreset = async () => {
    if (!token) return;
    try {
      const snap = await getDoc(doc(db, 'live_graphics', token));
      if (!snap.exists()) { setSavedNote('Nothing to save yet'); setTimeout(() => setSavedNote(''), 2500); return; }
      const d = snap.data() as any;
      const { bug, full, callout, preview, lowerId, ftId, sub, coach, banner, portal, talent, mention, pbp, pbpTicker, shotLine, updatedAt, ...preset } = d;
      await setDoc(doc(db, 'live_graphics', token), { savedPreset: preset }, { merge: true });
      localStorage.setItem('plg_cg_preset_' + token, JSON.stringify(preset));
      setSavedNote('Setup saved ✓'); setTimeout(() => setSavedNote(''), 2500);
    } catch { setSavedNote('Save failed'); setTimeout(() => setSavedNote(''), 2500); }
  };
  const restorePreset = async () => {
    if (!token) return;
    let preset: any = null;
    try { const raw = localStorage.getItem('plg_cg_preset_' + token); if (raw) preset = JSON.parse(raw); } catch { /* ignore */ }
    if (!preset) { try { const snap = await getDoc(doc(db, 'live_graphics', token)); preset = (snap.data() as any)?.savedPreset; } catch { /* ignore */ } }
    if (!preset) { setSavedNote('No saved setup'); setTimeout(() => setSavedNote(''), 2500); return; }
    await setDoc(doc(db, 'live_graphics', token), preset, { merge: true });
    window.location.reload();
  };

  return (
    <div className="p-4 md:p-8 pb-24" style={{ marginRight: rosterOpen ? rosterWidth : 0, transition: 'margin 0.2s' }}>
      <PageHeader title="Live Graphics" subtitle="NBA broadcast graphics driven by the live game feed — capture the output page in OBS / vMix / ATEM">
        {savedNote && <span className="text-xs font-semibold text-green-600 self-center mr-1">{savedNote}</span>}
        <button onClick={savePreset} title="Save your whole setup so you can restore it if anything gets moved"
          className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm hover:bg-black">
          <Copy size={14} /> Save setup
        </button>
        <button onClick={restorePreset} title="Restore the last saved setup"
          className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
          <RefreshCw size={14} /> Restore
        </button>
        <button onClick={() => setRosterOpen(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${rosterOpen ? 'bg-purple-600 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
          <Users size={14} /> Players
        </button>
        <button onClick={() => loadGames(date)} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm hover:bg-gray-50">
          <RefreshCw size={14} className={loadingGames ? 'animate-spin' : ''} /> Refresh
        </button>
      </PageHeader>

      {/* Output URL bar (collapsible — it only matters at setup, not during the game) */}
      {token && !urlBarOpen && (
        <button onClick={() => setUrlBarOpen(true)}
          className="mb-4 text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1.5">
          <MonitorPlay size={13} className="text-green-500" /> Output URL & HDMI tips ▸
        </button>
      )}
      {token && urlBarOpen && (
        <div className="mb-6 bg-gray-900 text-white rounded-2xl px-5 py-3.5 flex flex-wrap items-center gap-3">
          <button onClick={() => setUrlBarOpen(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
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
        <div className="mb-4 bg-zinc-950 rounded-2xl p-3 flex flex-nowrap items-center justify-center gap-4">
          <Monitor label="PREVIEW" color="text-yellow-400" width={monSize}
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
            <input type="range" min={240} max={620} step={10} value={monSize}
              onChange={e => pickMonSize(parseInt(e.target.value, 10))} className="w-24 accent-zinc-400" title="Resize monitors" />
          </div>
          <Monitor label="PROGRAM" color="text-red-500" width={monSize}
            src={`/graphics-out/${token}?bg=dark`} />
        </div>
      )}

      {/* Data source: feed (by league) or manual ingest — collapsible; only needed at setup */}
      {token && summary && !pickerOpen && (
        <button onClick={() => setPickerOpen(true)}
          className="mb-4 text-xs font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1.5">
          ▸ Feed & games {summary ? `· ${summary.away.abbr} @ ${summary.home.abbr}` : ''}
        </button>
      )}
      {pickerOpen && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 relative">
        <button onClick={() => setPickerOpen(false)} title="Collapse"
          className="absolute top-2.5 right-3 text-[11px] font-medium text-gray-400 hover:text-gray-700">Hide ▲</button>
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
              <div className="flex items-center gap-1">
                <input value={clockMM} onChange={e => setClockMM(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  inputMode="numeric" className="w-12 bg-white/10 border border-white/20 rounded-lg px-1 py-2 text-sm font-mono text-center" />
                <span className="font-mono text-lg">:</span>
                <input value={clockSS} onChange={e => setClockSS(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  inputMode="numeric" className="w-12 bg-white/10 border border-white/20 rounded-lg px-1 py-2 text-sm font-mono text-center" />
                <button onClick={mClockSet}
                  className="px-3 py-2 rounded-lg bg-white text-black text-xs font-black hover:bg-gray-200">SET</button>
              </div>
              <div className="flex items-center gap-1">
                {[-10, -1, 1, 10].map(d => (
                  <button key={d} onClick={() => mClockNudge(d)}
                    className="px-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold">
                    {d > 0 ? `+${d}` : d}s
                  </button>
                ))}
              </div>
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
                <input value={lenStr} inputMode="numeric"
                  onChange={e => setLenStr(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={mSetLength}
                  onKeyDown={e => { if (e.key === 'Enter') mSetLength(); }}
                  className="w-12 bg-white/10 border border-white/20 rounded-lg px-1.5 py-1 text-center" /> min
              </label>
              <button onClick={() => pushManual({ ...advanceManualPeriod(manual, manual.period + 1), clockRunning: false, clockSec: (manual.periodMin || 10) * 60, clockUpdatedAt: new Date().toISOString() }, true)}
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
                          <PlayerPhoto src={pl.photo} tone="light" className="w-6 h-6 rounded-full object-cover object-top bg-gray-200 shrink-0" />
                          <button onClick={() => googleMugshot(pl.name, t.name || t.abbr)} title="Find photo on Google Images"
                            className="px-1 py-0.5 rounded bg-gray-100 hover:bg-blue-100 text-[10px]">🔍</button>
                          <button onClick={() => pasteMugshot(url => mPlayer(side, pl.id, { photo: url }, true))} title="Paste image from clipboard"
                            className="px-1 py-0.5 rounded bg-gray-100 hover:bg-green-100 text-[10px]">📋</button>
                          <button onClick={() => fire({ ftId: active.ftId === pl.id ? null : pl.id })} title="Free throw — at the line"
                            className={`px-1 py-0.5 rounded text-[10px] ${active.ftId === pl.id ? 'bg-amber-400' : 'bg-gray-100 hover:bg-amber-100'}`}>🎯</button>
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
      )}

      {!summary ? (
        eventId ? <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading boxscore…</div> : null
      ) : (
        <div>
          {/* ── Fire panel — cards flow across columns to fill the width; roster lives in the right drawer ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start pb-28">
            {/* Live score header (full-width bar) */}
            <div className="bg-gray-900 text-white rounded-2xl p-3 lg:col-span-2 xl:col-span-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {summary.away.logo && <img src={summary.away.logo} className="w-8 h-8" alt="" />}
                  <span className="font-bold text-lg">{summary.away.abbr}</span>
                  <span className="font-black text-xl md:text-2xl">{summary.away.score}</span>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-mono font-bold">{summary.state === 'in' ? `${periodLabel(summary.period)} ${summary.clock}` : ''}</div>
                  <div className="text-xs text-gray-400">{summary.statusDetail}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wide mr-1">Clock sync</span>
                    <button onClick={() => setClockOffset(v => Math.round((v - 1) * 10) / 10)} className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-bold hover:bg-white/20">−1s</button>
                    <span className="text-[11px] font-mono w-9 text-center tabular-nums">{clockOffset > 0 ? '+' : ''}{clockOffset}s</span>
                    <button onClick={() => setClockOffset(v => Math.round((v + 1) * 10) / 10)} className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-bold hover:bg-white/20">+1s</button>
                    {clockOffset !== 0 && <button onClick={() => setClockOffset(0)} className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] hover:bg-white/20">reset</button>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-xl md:text-2xl">{summary.home.score}</span>
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
                Score Bug {active.bug ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button onClick={() => fire({ pbp: !active.pbp })}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${active.pbp ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Play-by-Play Rail {active.pbp ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button onClick={() => fire({ pbpTicker: !active.pbpTicker })}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${active.pbpTicker ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Play Ticker (on bug) {active.pbpTicker ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">League badge</span>
                <select value={leagueBadge} onChange={e => setLeagueBadge(e.target.value)}
                  className="ml-auto border border-gray-200 rounded-lg px-2 py-1 text-[11px] bg-white">
                  <option value="auto">Auto (feed league)</option>
                  <option value="none">None</option>
                  {LEAGUES.filter(l => l.logo).map(l => <option key={l.id} value={l.logo}>{l.label}</option>)}
                  {banners.map(b => <option key={b.id} value={b.url}>{b.name}</option>)}
                </select>
                <button onClick={() => badgeLogoRef.current?.click()} title="Upload center logo"
                  className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200">
                  <Upload size={12} />
                </button>
                <input ref={badgeLogoRef} type="file" accept="image/*" className="hidden" onChange={uploadCenterLogo} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Bug style</span>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
                  {(['classic', 'bar', 'strip', 'stack', 'arena'] as const).map(s => (
                    <button key={s} onClick={() => setBugStyle(s)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${bugStyle === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-wide">
                <span>Bug size</span>
                <input type="range" min={0.6} max={1.8} step={0.05} value={bugScale}
                  onChange={e => setBugScale(parseFloat(e.target.value))} className="flex-1" />
                <span className="w-9 text-right tabular-nums text-gray-600">{bugScale.toFixed(2)}×</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Bug position</span>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
                  {(['left', 'center', 'right'] as const).map(p => (
                    <button key={p} onClick={() => setBugPos(p)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${bugPos === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                      {p === 'left' ? '◀' : p === 'center' ? '■' : '▶'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Lower third / Sub / Coach</span>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
                  {(['left', 'center', 'right'] as const).map(p => (
                    <button key={p} onClick={() => setLowerPos(p)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${lowerPos === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                      {p === 'left' ? '◀' : p === 'center' ? '■' : '▶'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Free Throw side</span>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
                  {(['left', 'right'] as const).map(p => (
                    <button key={p} onClick={() => setFtPos(p)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${ftPos === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                      {p === 'left' ? '◀' : '▶'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
              {([
                ['teamstats', 'Team Stats'],
                ['lineups', 'Lineups'],
                ['leaders', 'Top Performers'],
                ['matchup', 'Matchup Top 5'],
                ['linescore', 'Quarter Break'],
                ['shotchart', 'Shot Chart'],
                ['assists', 'Assist Leaders'],
                ['alerts', 'Game Alerts'],
                ['matchupbanner', 'Matchup Banner'],
                ['taletape', 'Tale of the Tape'],
              ] as ['teamstats' | 'lineups' | 'leaders' | 'matchup' | 'linescore' | 'shotchart' | 'assists' | 'alerts' | 'matchupbanner' | 'taletape', string][]).map(([kind, label]) => (
                <div key={kind} className="relative flex items-stretch gap-1">
                  <button onClick={() => fire({ full: active.full === kind ? null : kind })}
                    className={`flex-1 min-w-0 flex items-center justify-between gap-1 px-3 py-2 rounded-lg text-xs font-medium ${active.full === kind ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <span className="truncate">{label}</span> {active.full === kind ? <Eye size={13} className="shrink-0" /> : <EyeOff size={13} className="shrink-0" />}
                  </button>
                  <button onClick={() => setGfxSettings(s => s === kind ? null : kind)} title={`Modify ${label}`}
                    className={`px-2 rounded-lg shrink-0 ${gfxSettings === kind ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    <Settings size={13} />
                  </button>
                  {gfxSettings === kind && (
                    <div className="absolute z-30 top-full mt-1 right-0 w-60 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 space-y-2.5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-12 shrink-0">Size</span>
                        <input type="range" min={0.6} max={1.8} step={0.05} value={gScale[kind] ?? 1}
                          onChange={e => setGScale(m => ({ ...m, [kind]: parseFloat(e.target.value) }))} className="flex-1" />
                        <span className="w-9 text-right tabular-nums">{(gScale[kind] ?? 1).toFixed(2)}×</span>
                      </label>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-12 shrink-0">Texture</span>
                        <select value={texture} onChange={e => setTexture(e.target.value)}
                          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
                          {['diamond', 'mesh', 'grid', 'lines', 'carbon', 'chevron', 'none'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      {texture !== 'none' && (
                        <label className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-12 shrink-0">Intensity</span>
                          <input type="range" min={0.2} max={2.5} step={0.1} value={textureIntensity}
                            onChange={e => setTextureIntensity(parseFloat(e.target.value))} className="flex-1" />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0">Boxscore</span>
                <button onClick={() => fire({ full: active.full === 'boxscore' && active.boxTeam === 'away' ? null : 'boxscore', boxTeam: 'away' })}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold ${active.full === 'boxscore' && active.boxTeam === 'away' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {summary?.away.abbr || 'Away'}
                </button>
                <button onClick={() => fire({ full: active.full === 'boxscore' && active.boxTeam === 'home' ? null : 'boxscore', boxTeam: 'home' })}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold ${active.full === 'boxscore' && active.boxTeam === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {summary?.home.abbr || 'Home'}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Matchup logos</span>
                <button onClick={() => setMatchup3d(v => !v)}
                  className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium ${matchup3d ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500'}`}>
                  {matchup3d ? '3D ON' : '3D OFF'}
                </button>
              </div>

              {/* Player comparison + stat line */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Player comparison</span>
                <div className="flex items-center gap-1.5">
                  <select value={cmpA} onChange={e => setCmpA(e.target.value)}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    {[summary?.away, summary?.home].map(t => t && (
                      <optgroup key={t.id} label={t.name}>
                        {t.athletes.filter(a => a.played).slice().sort(byJerseyThenName).map(a => (
                          <option key={a.id} value={a.id}>{a.jersey ? `#${a.jersey} ` : ''}{a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="text-[10px] font-black text-gray-400">VS</span>
                  <select value={cmpB} onChange={e => setCmpB(e.target.value)}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    {[summary?.away, summary?.home].map(t => t && (
                      <optgroup key={t.id} label={t.name}>
                        {t.athletes.filter(a => a.played).slice().sort(byJerseyThenName).map(a => (
                          <option key={a.id} value={a.id}>{a.jersey ? `#${a.jersey} ` : ''}{a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <button onClick={() => fire({ full: active.full === 'compare' ? null : 'compare', compareA: cmpA, compareB: cmpB })}
                  disabled={!cmpA || !cmpB}
                  className={`w-full px-2 py-2 rounded-lg text-xs font-bold disabled:opacity-40 ${active.full === 'compare' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-800'}`}>
                  Player Comparison
                </button>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0">Stat line</span>
                  <select value={statPick} onChange={e => setStatPick(e.target.value)}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    {[summary?.away, summary?.home].map(t => t && (
                      <optgroup key={t.id} label={t.name}>
                        {t.athletes.filter(a => a.played).slice().sort(byJerseyThenName).map(a => (
                          <option key={a.id} value={a.id}>{a.jersey ? `#${a.jersey} ` : ''}{a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={() => fire({ full: active.full === 'statline' ? null : 'statline', statLineId: statPick })}
                    disabled={!statPick}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 ${active.full === 'statline' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
                    {active.full === 'statline' ? 'HIDE' : 'FIRE'}
                  </button>
                </div>
              </div>
              {active.full === 'shotchart' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0">Shot filter</span>
                  <select value={active.shotFilter || 'all'} onChange={e => fire({ shotFilter: e.target.value })}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    <option value="all">Both teams</option>
                    {[summary?.away, summary?.home].map(t => t && (
                      <optgroup key={t.id} label={t.name}>
                        <option value={t.id}>{t.name} — all shots</option>
                        {t.athletes.filter(a => a.played).slice().sort(byJerseyThenName).map(a => (
                          <option key={a.id} value={a.id}>{a.jersey ? `#${a.jersey} — ` : ''}{a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
              {active.ftId && (
                <button onClick={() => fire({ ftId: null })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-white">
                  Hide Free Throw
                </button>
              )}
              {active.lowerId && (
                <button onClick={() => fire({ lowerId: null })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white">
                  Hide Lower Third
                </button>
              )}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Shooting splits</span>
                  {active.shotLine && (
                    <button onClick={() => fire({ shotLine: null })} className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-wide">Hide</button>
                  )}
                </div>
                <select value={shotPick} onChange={e => setShotPick(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  <option value="all">Both teams</option>
                  {[summary?.away, summary?.home].map(t => t && (
                    <optgroup key={t.id} label={t.name}>
                      <option value={t.id}>{t.name} — team</option>
                      {t.athletes.filter(a => a.played).slice().sort(byJerseyThenName).map(a => (
                        <option key={a.id} value={a.id}>{a.jersey ? `#${a.jersey} — ` : ''}{a.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => fire({ shotLine: active.shotLine === shotPick ? null : shotPick })}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold ${active.shotLine === shotPick ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-800'}`}>
                    Lower Third
                  </button>
                  <button onClick={() => fire({ full: active.full === 'shotchart' && active.shotFilter === shotPick ? null : 'shotchart', shotFilter: shotPick })}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold ${active.full === 'shotchart' && active.shotFilter === shotPick ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-800'}`}>
                    Full Chart
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Substitution</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select value={subIn} onChange={e => setSubIn(e.target.value)}
                    className="flex-1 border border-green-200 bg-green-50 rounded-lg px-1.5 py-1.5 text-xs">
                    <option value="">▲ IN…</option>
                    {allAthletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <select value={subOut} onChange={e => setSubOut(e.target.value)}
                    className="flex-1 border border-red-200 bg-red-50 rounded-lg px-1.5 py-1.5 text-xs">
                    <option value="">▼ OUT…</option>
                    {allAthletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button onClick={() => fire({ sub: active.sub ? null : (subIn && subOut ? { inId: subIn, outId: subOut } : null) })}
                    disabled={!active.sub && (!subIn || !subOut)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 ${active.sub ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
                    {active.sub ? 'HIDE' : 'FIRE'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 w-20">Head coach</span>
                  <button onClick={() => fire({ coach: active.coach === 'away' ? null : 'away' })}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold ${active.coach === 'away' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {summary?.away.abbr || 'Away'}
                  </button>
                  <button onClick={() => fire({ coach: active.coach === 'home' ? null : 'home' })}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold ${active.coach === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {summary?.home.abbr || 'Home'}
                  </button>
                </div>
              </div>
              <button onClick={clearProgram}
                className="w-full px-4 py-2 rounded-xl text-xs text-red-500 border border-red-200 hover:bg-red-50">
                CLEAR PROGRAM
              </button>
            </div>

            {/* Play callouts */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Play callouts</h2>
                <button onClick={() => setAutoFt(v => !v)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-bold mr-2 ${autoFt ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  Auto FT {autoFt ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => setAutoCallouts(v => !v)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${autoCallouts ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <Zap size={10} className="inline mr-1" />Detect {autoCallouts ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Detected plays appear below as suggestions — nothing airs until you tap it.
              </p>
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  {suggestions.map(sg => (
                    <div key={sg.id} className="flex items-center gap-1.5">
                      <button
                        onClick={() => { pushDoc({ callout: { ...sg, id: Math.random().toString(36).slice(2, 10) } }); clearCalloutSoon(); setSuggestions(prev => prev.filter(x => x.id !== sg.id)); }}
                        className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-left">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: sg.color || '#f59e0b', color: '#fff' }}>{sg.title}</span>
                        <span className="text-xs text-gray-700 truncate">{sg.sub || ''}</span>
                        <span className="ml-auto text-[10px] font-black text-amber-600">AIR ▸</span>
                      </button>
                      <button onClick={() => setSuggestions(prev => prev.filter(x => x.id !== sg.id))}
                        className="text-gray-300 hover:text-red-500 text-sm px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0">Manual target</span>
                <select value={calloutWho} onChange={e => setCalloutWho(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  <option value="generic">Generic — no player name</option>
                  <option value="auto">Auto (on-air / top scorer{calloutTarget ? `: ${calloutTarget.name}` : ''})</option>
                  {[summary?.away, summary?.home].map(t => t && (
                    <optgroup key={t.id} label={t.name}>
                      {t.athletes.filter(a => a.played).slice().sort(byJerseyThenName).map(a => (
                        <option key={a.id} value={a.id}>{a.jersey ? `#${a.jersey} — ` : ''}{a.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['3pt', '3-POINTER'], ['2pt', '+2'], ['ft', '+1 FT'],
                  ['ast', 'ASSIST'], ['dd', 'DOUBLE-DBL'], ['td', 'TRIPLE-DBL'],
                ] as [Callout['kind'], string][]).map(([kind, label]) => (
                  <button key={kind} onClick={() => fireCallout(kind)} disabled={calloutWho === 'auto' && !calloutTarget}
                    className="px-2 py-2 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-yellow-800 disabled:opacity-40">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Leaders quick-fire */}
            {leaders.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Top scorers — one-tap lower third</h2>
                <div className="grid grid-cols-3 gap-2">
                  {leaders.map(a => (
                    <button key={a.id} onClick={() => fire({ lowerId: active.lowerId === a.id ? null : a.id })}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-center ${active.lowerId === a.id ? 'bg-purple-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <PlayerPhoto src={photoOverrides[a.id] || a.headshot} tone="light" className="w-11 h-11 rounded-full object-cover object-top bg-gray-200 shrink-0" />
                      <div className="text-xs font-semibold truncate w-full leading-tight">{a.name}</div>
                      <div className={`text-[10px] leading-none ${active.lowerId === a.id ? 'text-purple-200' : 'text-gray-500'}`}>{a.teamAbbr} · #{a.jersey}</div>
                      <div className="text-sm font-black">{a.stats.pts} PTS</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Player roster — right hamburger drawer, ready to fire lower thirds ── */}
          <div className={`fixed top-0 right-0 h-screen max-w-[96vw] z-50 bg-white shadow-2xl border-l border-gray-200 flex flex-col ${rosterOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: rosterWidth, transition: 'transform 0.3s' }}>
            <div onMouseDown={startResizeRoster} title="Drag to resize" className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-purple-400/40 z-10" />
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3 shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">Players — tap to fire lower third</h2>
              <div className="relative ml-auto">
                <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                <input value={playerQuery} onChange={e => setPlayerQuery(e.target.value)} placeholder="Search player"
                  className="border border-gray-200 rounded-lg pl-7 pr-2 py-1 text-xs w-36 focus:outline-none" />
              </div>
              <button onClick={() => setRosterOpen(false)} className="text-gray-400 hover:text-gray-700 shrink-0"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
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
                  {[summary.away, summary.home].map(team => (
                    <React.Fragment key={team.abbr}>
                      <tr>
                        <td colSpan={9} className="px-3 py-2 text-xs font-black uppercase tracking-widest text-white"
                          style={{ background: team.color }}>
                          {team.logo && <img src={team.logo} className="inline w-5 h-5 mr-2 align-middle" alt="" />}
                          {team.name} · {team.abbr}
                        </td>
                      </tr>
                      {team.athletes.filter(a => a.played && (!playerQuery || a.name.toLowerCase().includes(playerQuery.toLowerCase()))).map(a => (
                    <tr key={a.id} onClick={() => fire({ lowerId: active.lowerId === a.id ? null : a.id })}
                      className={`cursor-pointer ${active.lowerId === a.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2 group/mug">
                          <PlayerPhoto src={photoOverrides[a.id] || a.headshot} tone="light" className="w-7 h-7 rounded-full object-cover object-top bg-gray-200 shrink-0" />
                          <span className="font-medium text-gray-800">{a.name}</span>
                          {a.starter && <span className="text-[10px] text-gray-400">S</span>}
                          {active.lowerId === a.id && <span className="text-[10px] font-bold text-purple-600">{mode === 'preview' ? 'IN PVW' : 'ON AIR'}</span>}
                          <span className="ml-auto flex items-center gap-1 opacity-0 group-hover/mug:opacity-100" onClick={e => e.stopPropagation()}>
                            <button onClick={() => fire({ ftId: active.ftId === a.id ? null : a.id })} title="Free throw — at the line"
                              className={`px-1.5 py-0.5 rounded text-[10px] ${active.ftId === a.id ? 'bg-amber-400' : 'bg-gray-100 hover:bg-amber-100'}`}>🎯</button>
                            <button onClick={() => googleMugshot(a.name, a.teamAbbr)} title="Find photo on Google Images"
                              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-blue-100 text-[10px]">🔍</button>
                            <button onClick={() => pasteMugshot(overrideFor(a))} title="Paste image from clipboard"
                              className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-green-100 text-[10px]">📋</button>
                            <label title="Upload file" className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-[10px] cursor-pointer">⬆
                              <input type="file" accept="image/*" className="hidden" onChange={e => uploadMugshot(e, overrideFor(a))} />
                            </label>
                          </span>
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
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Pre-game setup dock ── */}
      <div className="fixed bottom-0 left-0 md:left-16 z-40 bg-zinc-950/95 backdrop-blur border-t border-zinc-800" style={{ right: rosterOpen ? rosterWidth : 0, transition: 'right 0.2s' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-1.5 px-3 py-2.5 overflow-x-auto">
          {([
            ['branding', Palette, 'Branding'],
            ['trivia', HelpCircle, 'Trivia'],
            ['portal', Flame, 'Portal'],
            ['team', Mic, 'Team'],
            ['mention', Star, 'Mention'],
            ['nextgame', Calendar, 'Next Game'],
            ['coaches', ClipboardList, 'Coaches'],
          ] as [typeof dock, any, string][]).map(([id, Icon, label]) => (
            <button key={id as string} onClick={() => setDock(d => d === id ? null : id)} title={label}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${dock === id ? 'bg-white text-black' : 'text-zinc-300 hover:bg-zinc-800'}`}>
              <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drawer with the selected pre-game card */}
      {dock && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDock(null)} />
          <div className="relative w-full max-w-2xl mx-auto max-h-[75vh] overflow-y-auto bg-gray-50 rounded-t-2xl shadow-2xl p-4 space-y-4 pb-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Pre-game setup</span>
              <button onClick={() => setDock(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
            </div>
            {dock === 'branding' && (<>
            {/* Branding & look */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">Branding & look</h2>

              <div>
                <span className="text-xs font-medium text-gray-600 block mb-2">Graphics style</span>
                <div className="mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Team pack · Austin Spurs 2025-26</span>
                  <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {([
                      ['spurs', 'Silver & Black', 'linear-gradient(180deg, #f2f5f7, #b9c2c9 50%, #1a1b1e)', '#3a3d42', '#c4ced4'],
                      ['spurs-toros', 'Toros Throwback', 'linear-gradient(180deg, #7a1f1f, #c9a227)', '#6b6e72', '#7a1f1f'],
                      ['spurs-dragons', 'Riverdragons', 'linear-gradient(135deg, #0e7a5f, #d3a625)', '#4b2e83', '#0e7a5f'],
                      ['spurs-atx', 'ATX Night', 'linear-gradient(90deg, #ff2d95, #00c2ff)', '#00c2ff', '#ff2d95'],
                      ['spurs-raros', 'Los Raros', 'linear-gradient(90deg, #00c9b1, #ff5da2, #9b5cff)', '#9b5cff', '#00c9b1'],
                      ['spurs-dc', 'DC Superhero', 'radial-gradient(circle at 30% 30%, #ffd83d 18%, transparent 19%), linear-gradient(135deg, #d0021b 40%, #0d1b3d 60%)', '#123a8f', '#d0021b'],
                      ['spurs-wars', 'Star Wars', 'radial-gradient(circle at 25% 30%, #fff 4%, transparent 5%), linear-gradient(135deg, #05060d 60%, #3aa9ff)', '#37d24a', '#3aa9ff'],
                      ['spurs-potter', 'Harry Potter', 'linear-gradient(135deg, #740001 55%, #d3a625)', '#1a472a', '#740001'],
                      ['spurs-fiesta', 'Fiesta Night', 'linear-gradient(90deg, #e91e8c, #ff8c00, #ffd400, #00b8a9)', '#00b8a9', '#e91e8c'],
                      ['spurs-princess', 'Princess Night', 'linear-gradient(135deg, #ffd9ea, #b39ddb)', '#b39ddb', '#ff9ecb'],
                      ['spurs-loteria', 'Lotería Night', 'linear-gradient(135deg, #f6e7c1 50%, #d62828 50%)', '#1d8a99', '#d62828'],
                      ['spurs-pride', 'Pride Night', 'linear-gradient(90deg, #e40303, #ff8c00, #ffed00, #008026, #24408e, #732982)', '#24408e', '#732982'],
                      ['spurs-troops', 'Hoops for Troops', 'linear-gradient(135deg, #4b5320, #6b6347 60%, #23251a)', '#5e563c', '#4b5320'],
                    ] as [string, string, string, string, string][]).map(([id, label, swatch, packC1, packC2]) => (
                      <button key={id}
                        onClick={() => { setSkin(id); setUseTeamColors(false); setC1(packC1); setC2(packC2); }}
                        className={`rounded-xl px-2 py-2 text-[11px] font-bold flex items-center gap-2 border ${skin === id ? 'border-black ring-1 ring-black' : 'border-gray-200 hover:border-gray-300'}`}>
                        <span className="w-5 h-5 rounded-md shrink-0 border border-black/10" style={{ background: swatch }} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['clean', 'Clean', 'linear-gradient(135deg, #27272a, #18181b)'],
                    ['glass', 'Glass', 'linear-gradient(135deg, rgba(148,163,184,0.55), rgba(30,41,59,0.7))'],
                    ['steel', 'Steel', 'linear-gradient(180deg, #cbd5e1, #64748b 50%, #334155)'],
                    ['gold', 'Gold', 'linear-gradient(180deg, #f9e8a0, #d4a017 55%, #92700c)'],
                    ['carbon', 'Carbon', 'repeating-linear-gradient(45deg, #111 0 3px, #26272b 3px 6px)'],
                    ['neon', 'Neon', 'linear-gradient(135deg, #0c0f18 60%, #22d3ee)'],
                  ] as [string, string, string][]).map(([id, label, swatch]) => (
                    <button key={id} onClick={() => setSkin(id)}
                      className={`rounded-xl px-2 py-2 text-[11px] font-bold flex items-center gap-2 border ${skin === id ? 'border-black ring-1 ring-black' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="w-5 h-5 rounded-md shrink-0 border border-black/10" style={{ background: swatch }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Logo sizes</span>
                  <button onClick={() => setMotionFx(v => !v)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${motionFx ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500'}`}>
                    ✦ Motion {motionFx ? 'ON' : 'OFF'}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14">Teams</span>
                  <input type="range" min={0.7} max={2} step={0.05} value={logoScale}
                    onChange={e => setLogoScale(parseFloat(e.target.value))} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{logoScale.toFixed(2)}×</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14">Brand</span>
                  <input type="range" min={0.7} max={2} step={0.05} value={brandScale}
                    onChange={e => setBrandScale(parseFloat(e.target.value))} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{brandScale.toFixed(2)}×</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14">Roll time</span>
                  <input type="range" min={2} max={10} step={0.5} value={badgeSec}
                    onChange={e => setBadgeSec(parseFloat(e.target.value))} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{badgeSec.toFixed(1)}s</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700 font-semibold pt-1 border-t border-gray-100">
                  <span className="w-14">All GFX</span>
                  <input type="range" min={0.6} max={1.8} step={0.05} value={gfxScale}
                    onChange={e => setGfxScale(parseFloat(e.target.value))} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{gfxScale.toFixed(2)}×</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14">Full scrn</span>
                  <input type="range" min={0.6} max={1.6} step={0.05} value={fullScale}
                    onChange={e => setFullScale(parseFloat(e.target.value))} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{fullScale.toFixed(2)}×</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14">At Line</span>
                  <input type="range" min={0.6} max={1.6} step={0.05} value={atlScale}
                    onChange={e => setAtlScale(parseFloat(e.target.value))} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{atlScale.toFixed(2)}×</span>
                </label>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14">Texture</span>
                  <select value={texture} onChange={e => setTexture(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
                    {['diamond', 'mesh', 'grid', 'lines', 'carbon', 'chevron', 'none'].map(t => (
                      <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-14">Intensity</span>
                  <input type="range" min={0.2} max={2.5} step={0.1} value={textureIntensity}
                    onChange={e => setTextureIntensity(parseFloat(e.target.value))} className="flex-1" disabled={texture === 'none'} />
                  <span className="w-10 text-right tabular-nums">{textureIntensity.toFixed(1)}×</span>
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-600">Badge roll — sponsors (H-E-B, Ledger…)</span>
                <div className="flex flex-wrap gap-1.5">
                  {extraBadges.map((b, i) => (
                    <span key={i} className="flex items-center gap-1 bg-gray-100 rounded-lg px-1.5 py-1">
                      <img src={b} className="h-5 max-w-[52px] object-contain" alt="" />
                      <button onClick={() => setExtraBadges(l => l.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                    </span>
                  ))}
                  <label className="flex items-center gap-1 border border-dashed border-gray-300 rounded-lg px-2 py-1 text-[10px] text-gray-500 cursor-pointer hover:bg-gray-50">
                    <Upload size={10} /> Add
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => uploadMugshot(e, url => setExtraBadges(l => [...l, url]))} />
                  </label>
                  {banners.length > 0 && (
                    <select value="" onChange={e => { if (e.target.value) setExtraBadges(l => [...l, e.target.value]); }}
                      className="border border-gray-200 rounded-lg px-1.5 py-1 text-[10px] bg-white">
                      <option value="">from banners…</option>
                      {banners.map(b => <option key={b.id} value={b.url}>{b.name}</option>)}
                    </select>
                  )}
                </div>
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
            </>)}
            {dock === 'trivia' && (<>
            {/* Sponsored Trivia */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Sponsored Trivia</h2>
                <button onClick={() => fire({ full: active.full === 'trivia' ? null : 'trivia' })}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold ${active.full === 'trivia' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {active.full === 'trivia' ? (mode === 'preview' ? 'IN PVW' : 'ON AIR') : 'FIRE'}
                </button>
              </div>
              <input value={trivia.question} onChange={e => setTrivia(t => ({ ...t, question: e.target.value }))}
                placeholder="Question — e.g. How many championships has the team won?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black" />
              {trivia.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button onClick={() => setTrivia(t => ({ ...t, correct: i }))}
                    className={`w-6 h-6 rounded-full text-[10px] font-black shrink-0 ${trivia.correct === i ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}
                    title="Mark as correct answer">
                    {String.fromCharCode(65 + i)}
                  </button>
                  <input value={opt}
                    onChange={e => setTrivia(t => ({ ...t, options: t.options.map((o, j) => j === i ? e.target.value : o) }))}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
                </div>
              ))}
              <div className="flex items-center gap-2">
                {trivia.sponsor && <img src={trivia.sponsor} className="h-7 max-w-[64px] object-contain shrink-0" alt="" />}
                <select value={trivia.sponsor} onChange={e => setTrivia(t => ({ ...t, sponsor: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  <option value="">Sponsor logo: none (use brand)</option>
                  {banners.map(b => <option key={b.id} value={b.url}>{b.name}</option>)}
                  {trivia.sponsor && !banners.some(b => b.url === trivia.sponsor) && (
                    <option value={trivia.sponsor}>Uploaded sponsor</option>
                  )}
                </select>
                <label title="Upload sponsor logo" className="cursor-pointer text-gray-400 hover:text-gray-700 shrink-0 border border-dashed border-gray-300 rounded-lg p-1.5">
                  <Upload size={13} />
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => uploadMugshot(e, url => setTrivia(t => ({ ...t, sponsor: url })))} />
                </label>
                <button onClick={() => setTrivia(t => ({ ...t, reveal: !t.reveal }))}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold ${trivia.reveal ? 'bg-green-600 text-white' : 'border border-green-300 text-green-700 hover:bg-green-50'}`}>
                  {trivia.reveal ? 'ANSWER SHOWN' : 'REVEAL ANSWER'}
                </button>
              </div>
            </div>
            </>)}
            {dock === 'portal' && (<>
            {/* Hoop Portal — AR-style sponsor reveal on the backboard camera */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Hoop Portal</h2>
                <button onClick={() => fire({ portal: !active.portal })}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold ${active.portal ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {active.portal ? (mode === 'preview' ? 'IN PVW' : 'ON AIR') : 'FIRE'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                On the backboard camera shot: align the glowing portal with the real rim
                (X/Y/size) — the sponsor logo drops out of the net.
              </p>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(['logo', 'trivia'] as const).map(c => (
                  <button key={c} onClick={() => setPortalCfg(cfg => ({ ...cfg, content: c }))}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs capitalize ${portalCfg.content === c ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>
                    {c === 'logo' ? 'Sponsor logo' : 'Trivia'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select value={portalCfg.video} onChange={e => setPortalCfg(c => ({ ...c, video: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  <option value="">FX: Fire portal (default)</option>
                  <option value="ring">FX: Golden ring (CSS)</option>
                  {portalCfg.video && portalCfg.video !== 'ring' && !portalCfg.video.startsWith('http') === false && (
                    <option value={portalCfg.video}>FX: Custom video</option>
                  )}
                </select>
                <label className="cursor-pointer text-gray-400 hover:text-gray-700 shrink-0" title="Upload FX video (alpha webm/mov)">
                  <Upload size={14} />
                  <input type="file" accept="video/*" className="hidden" onChange={uploadPortalVideo} />
                </label>
              </div>
              {portalCfg.content === 'logo' && (
                <div className="flex items-center gap-2">
                  {portalCfg.logo && <img src={portalCfg.logo} className="h-7 max-w-[64px] object-contain shrink-0" alt="" />}
                  <select value={portalCfg.logo} onChange={e => setPortalCfg(c => ({ ...c, logo: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    <option value="">Logo: trivia sponsor / brand</option>
                    {banners.map(b => <option key={b.id} value={b.url}>{b.name}</option>)}
                    {portalCfg.logo && !banners.some(b => b.url === portalCfg.logo) && (
                      <option value={portalCfg.logo}>Uploaded logo</option>
                    )}
                  </select>
                  <label title="Upload sponsor logo" className="cursor-pointer text-gray-400 hover:text-gray-700 shrink-0 border border-dashed border-gray-300 rounded-lg p-1.5">
                    <Upload size={13} />
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => uploadMugshot(e, url => setPortalCfg(c => ({ ...c, logo: url })))} />
                  </label>
                </div>
              )}
              {([['x', 'X', 0, 100], ['y', 'Y', 0, 100], ['size', 'Size', 0.5, 2]] as [keyof typeof portalCfg, string, number, number][]).map(([k, label, min, max]) => (
                <label key={k} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-8">{label}</span>
                  <input type="range" min={min} max={max} step={k === 'size' ? 0.05 : 1} value={portalCfg[k] as number}
                    onChange={e => setPortalCfg(c => ({ ...c, [k]: parseFloat(e.target.value) }))} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{k === 'size' ? `${(portalCfg[k] as number).toFixed(2)}×` : `${portalCfg[k]}%`}</span>
                </label>
              ))}
            </div>
            </>)}
            {dock === 'team' && (<>
            {/* Broadcast Team (commentators) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Broadcast Team</h2>
                <button onClick={() => fire({ talent: !active.talent })} disabled={talentList.length === 0}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 ${active.talent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {active.talent ? (mode === 'preview' ? 'IN PVW' : 'ON AIR') : 'FIRE'}
                </button>
              </div>
              {talentList.map(c => (
                <div key={c.id} className="flex items-center gap-2 group">
                  <input value={c.name} onChange={e => setTalentList(l => l.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))}
                    placeholder="Name" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                  <input value={c.role} onChange={e => setTalentList(l => l.map(x => x.id === c.id ? { ...x, role: e.target.value } : x))}
                    placeholder="Play-by-play / Analyst" className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                  <button onClick={() => setTalentList(l => l.filter(x => x.id !== c.id))}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={() => setTalentList(l => [...l, { id: Math.random().toString(36).slice(2, 10), name: '', role: '', photo: '' }])}
                className="w-full py-1.5 rounded-lg border border-dashed border-gray-200 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1.5">
                <Plus size={12} /> Add commentator
              </button>
            </div>
            </>)}
            {dock === 'mention' && (<>
            {/* Special Mention / VIP */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Special Mention</h2>
                <button onClick={() => fire({ mention: !active.mention })} disabled={!mentionCfg.name}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 ${active.mention ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {active.mention ? (mode === 'preview' ? 'IN PVW' : 'ON AIR') : 'FIRE'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400">A celebrity walks in? Photo + name and it's on air in seconds.</p>
              <input value={mentionCfg.name} onChange={e => setMentionCfg(m => ({ ...m, name: e.target.value }))}
                placeholder="Guest name" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
              <input value={mentionCfg.title} onChange={e => setMentionCfg(m => ({ ...m, title: e.target.value }))}
                placeholder="Why they matter — '3x Grammy winner'" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
              <input value={mentionCfg.label} onChange={e => setMentionCfg(m => ({ ...m, label: e.target.value }))}
                placeholder="Ribbon label — Special Guest / In the Building" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
            </div>
            </>)}
            {dock === 'nextgame' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-800">Next Game announcement</h2>
                  <button onClick={() => fire({ full: active.full === 'nextgame' ? null : 'nextgame' })}
                    disabled={!nextGameCfg.homeName && !nextGameCfg.awayName}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 ${active.full === 'nextgame' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {active.full === 'nextgame' ? (mode === 'preview' ? 'IN PVW' : 'ON AIR') : 'FIRE'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['away', 'home'] as const).map(side => (
                    <div key={side} className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{side}</span>
                      <select value="" onChange={e => {
                          const t = leagueTeams.find(x => x.id === e.target.value);
                          if (t) setNextGameCfg(c => ({ ...c, [side + 'Name']: t.name, [side + 'Logo']: t.logo }));
                        }}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                        <option value="">Pick a league team…</option>
                        {leagueTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input value={(nextGameCfg as any)[side + 'Name']} onChange={e => setNextGameCfg(c => ({ ...c, [side + 'Name']: e.target.value }))}
                        placeholder="Team name" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                        {(nextGameCfg as any)[side + 'Logo']
                          ? <img src={(nextGameCfg as any)[side + 'Logo']} className="w-9 h-9 object-contain" alt="" />
                          : <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Upload size={13} /></span>}
                        Logo
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => uploadMugshot(e, url => setNextGameCfg(c => ({ ...c, [side + 'Logo']: url })))} />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="date" value={nextGameCfg.date} onChange={e => setNextGameCfg(c => ({ ...c, date: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white" />
                  <input type="time" value={nextGameCfg.time} onChange={e => setNextGameCfg(c => ({ ...c, time: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white" />
                  <input value={nextGameCfg.venue} onChange={e => setNextGameCfg(c => ({ ...c, venue: e.target.value }))}
                    placeholder="H-E-B Center at Cedar Park" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                </div>
              </div>
            )}
            {dock === 'coaches' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-800">Head Coaches</h2>
                <p className="text-[11px] text-gray-400">Names shown on the coach graphic with each team's logo. Fire from the Fire graphics card.</p>
                {(['away', 'home'] as const).map(side => (
                  <div key={side} className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 w-12">{side}</span>
                    <input value={coachCfg[side]} onChange={e => setCoachCfg(c => ({ ...c, [side]: e.target.value }))}
                      placeholder="Coach name" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Scaled 1920×1080 monitor of an output bus — resizable, pops out to its own
   window (drag it to a second display, press F there for fullscreen) */
function Monitor({ src, label, color, width = 352 }: { src: string; label: string; color: string; width?: number }) {
  const h = Math.round(width * 9 / 16);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-black tracking-[0.2em] ${color}`}>{label}</span>
        <button
          onClick={() => window.open(src, `plg-${label}`, `width=1280,height=720`)}
          title="Open in its own window — drag to another screen, press F for fullscreen"
          className="text-zinc-500 hover:text-white">
          <ExternalLink size={12} />
        </button>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-black border border-zinc-800" style={{ width, height: h }}>
        <iframe src={src} title={label}
          className="absolute top-0 left-0 border-0 pointer-events-none"
          style={{ width: 1920, height: 1080, transform: `scale(${width / 1920})`, transformOrigin: 'top left' }} />
      </div>
    </div>
  );
}

const byJerseyThenName = (a: Athlete, b: Athlete) => {
  const na = parseInt(a.jersey, 10), nb = parseInt(b.jersey, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  if (!isNaN(na) !== !isNaN(nb)) return isNaN(na) ? 1 : -1;
  const last = (n: string) => n.trim().split(/\s+/).slice(-1)[0].toLowerCase();
  return last(a.name).localeCompare(last(b.name));
};

export default function LiveGraphicsPage() {
  return (
    <UpgradeGate feature="Live Graphics" requires="pro">
      <ControlInner />
    </UpgradeGate>
  );
}

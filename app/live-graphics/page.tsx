'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import PageHeader from '@/components/PageHeader';
import { UpgradeGate } from '@/components/UpgradeGate';
import {
  MonitorPlay, Copy, ExternalLink, Loader2, RefreshCw, Eye, EyeOff, Search,
} from 'lucide-react';
import {
  normalizeScoreboard, normalizeSummary, gameLeaders, periodLabel,
  type Game, type Summary, type Athlete,
} from '@/lib/nba';

/* Live Graphics control panel — pick an NBA game, everything populates from
   the live feed (scores, official clock, player stats, headshots), and the
   operator fires graphics onto the output page captured by OBS/vMix/ATEM. */

interface GfxState {
  bug: boolean;
  lowerId: string | null;
  full: 'teamstats' | 'lineups' | 'leaders' | null;
}
const GFX_OFF: GfxState = { bug: false, lowerId: null, full: null };

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

  /* Output token: stable per browser so the OBS source URL survives reloads */
  useEffect(() => {
    let t = localStorage.getItem('plg_gfx_token');
    if (!t) { t = crypto.randomUUID(); localStorage.setItem('plg_gfx_token', t); }
    setToken(t);
  }, []);

  /* Scoreboard polling (15 s) */
  const loadGames = async (d: string) => {
    setLoadingGames(true);
    try {
      const res = await fetch(`/api/nba/scoreboard${d ? `?dates=${d}` : ''}`);
      const json = await res.json();
      setGames(normalizeScoreboard(json));
    } catch { /* keep last list */ }
    finally { setLoadingGames(false); }
  };
  useEffect(() => {
    loadGames(date);
    const t = setInterval(() => loadGames(date), 15000);
    return () => clearInterval(t);
  }, [date]);

  /* Summary polling (5 s) for the selected game */
  useEffect(() => {
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
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [eventId]);

  /* Push graphics state to the public output doc */
  const push = async (next: GfxState, nextEventId = eventId) => {
    setGfx(next);
    const uid = auth.currentUser?.uid;
    if (!uid || !token || pushing.current) { if (!uid || !token) return; }
    pushing.current = true;
    try {
      await setDoc(doc(db, 'live_graphics', token), {
        uid, eventId: nextEventId, ...next,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) { console.error('gfx push failed', e); }
    finally { pushing.current = false; }
  };

  const selectGame = (id: string) => {
    setEventId(id);
    push(GFX_OFF, id);
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
            <ExternalLink size={12} /> Preview
          </a>
        </div>
      )}

      {/* Game picker */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Game</h2>
          <button onClick={() => setDate('')}
            className={`${fireBtn} ${!date ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            Today
          </button>
          <input type="date" onChange={e => setDate(e.target.value.replace(/-/g, ''))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
          <button onClick={() => setDate(DEMO.date)}
            className={`${fireBtn} ${date === DEMO.date ? 'bg-black text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {DEMO.label}
          </button>
        </div>
        {games.length === 0 ? (
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
              <button onClick={() => push({ ...gfx, bug: !gfx.bug })}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${gfx.bug ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                Score Bug (auto clock + score) {gfx.bug ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              {([
                ['teamstats', 'Team Stats — full screen'],
                ['lineups', 'Starting Lineups — full screen'],
                ['leaders', 'Top Performers / MVP — full screen'],
              ] as ['teamstats' | 'lineups' | 'leaders', string][]).map(([kind, label]) => (
                <button key={kind} onClick={() => push({ ...gfx, full: gfx.full === kind ? null : kind })}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium ${gfx.full === kind ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {label} {gfx.full === kind ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              ))}
              {gfx.lowerId && (
                <button onClick={() => push({ ...gfx, lowerId: null })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white">
                  Hide player lower third
                </button>
              )}
              <button onClick={() => push(GFX_OFF)}
                className="w-full px-4 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50">
                CLEAR ALL
              </button>
            </div>

            {/* Leaders quick-fire */}
            {leaders.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Top scorers — one-tap lower third</h2>
                <div className="space-y-2">
                  {leaders.map(a => (
                    <button key={a.id} onClick={() => push({ ...gfx, lowerId: gfx.lowerId === a.id ? null : a.id })}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left ${gfx.lowerId === a.id ? 'bg-purple-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      {a.headshot && <img src={a.headshot} className="w-9 h-9 rounded-full object-cover bg-gray-200" alt="" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{a.name}</div>
                        <div className={`text-xs ${gfx.lowerId === a.id ? 'text-purple-200' : 'text-gray-500'}`}>{a.teamAbbr} · #{a.jersey}</div>
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
                    <tr key={a.id} onClick={() => push({ ...gfx, lowerId: gfx.lowerId === a.id ? null : a.id })}
                      className={`cursor-pointer ${gfx.lowerId === a.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {a.headshot ? <img src={a.headshot} className="w-7 h-7 rounded-full object-cover bg-gray-100" alt="" /> : <div className="w-7 h-7 rounded-full bg-gray-200" />}
                          <span className="font-medium text-gray-800">{a.name}</span>
                          {a.starter && <span className="text-[10px] text-gray-400">S</span>}
                          {gfx.lowerId === a.id && <span className="text-[10px] font-bold text-purple-600">ON AIR</span>}
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

export default function LiveGraphicsPage() {
  return (
    <UpgradeGate feature="Live Graphics" requires="pro">
      <ControlInner />
    </UpgradeGate>
  );
}

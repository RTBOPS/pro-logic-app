/* NBA live data helpers — normalizes ESPN's public NBA API into the shapes
   the live-graphics control panel and output overlay consume.
   Data flows through our /api/nba/* proxy to keep one origin and add caching. */

export interface GameTeam {
  id: string;
  abbr: string;
  name: string;
  logo: string;
  color: string;       // '#RRGGBB'
  altColor: string;
  score: string;
  record?: string;
}

export interface Game {
  id: string;
  shortName: string;     // "DAL @ BOS"
  state: 'pre' | 'in' | 'post';
  statusDetail: string;  // "7:00 PM EDT" | "End of 3rd" | "Final"
  clock: string;         // "7:42"
  period: number;
  home: GameTeam;
  away: GameTeam;
}

export interface AthleteStats {
  min: string; pts: string; fg: string; tp: string; ft: string;
  reb: string; ast: string; to: string; stl: string; blk: string;
  pf: string; plusMinus: string;
}

export interface Athlete {
  id: string;
  name: string;
  shortName: string;
  jersey: string;
  pos: string;
  starter: boolean;
  headshot: string;
  teamAbbr: string;
  teamColor: string;
  teamLogo: string;
  stats: AthleteStats;
  played: boolean;
}

export interface TeamBox {
  id: string;
  abbr: string;
  name: string;
  logo: string;
  color: string;
  homeAway: 'home' | 'away';
  score: string;
  linescores?: string[];     // points per period (fills in as the game advances)
  stats: { label: string; value: string }[];
  athletes: Athlete[];
}

export interface Summary {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  statusDetail: string;
  clock: string;
  period: number;
  home: TeamBox;
  away: TeamBox;
}

export function periodLabel(period: number, statusDetail?: string): string {
  if (!period) return statusDetail || '';
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}

/* Default fire-portal FX video (alpha webm in the studio's Storage bucket) */
export const DEFAULT_PORTAL_VIDEO =
  'https://firebasestorage.googleapis.com/v0/b/prologicstudio-4a6f5.firebasestorage.app/o/graphics_assets%2Fportal-fire.webm?alt=media&token=274cfd8f-3713-4820-806f-e7a3971e7ec4';
/* HEVC-alpha fallback for Safari (no VP9/webm support there) */
export const DEFAULT_PORTAL_VIDEO_HEVC =
  'https://firebasestorage.googleapis.com/v0/b/prologicstudio-4a6f5.firebasestorage.app/o/graphics_assets%2Fportal-fire.mov?alt=media&token=a1b2c3d4-portal-hevc-2026';

/* ESPN league slugs this CG can drive automatically */
export const LEAGUES: { id: string; label: string; logo: string }[] = [
  { id: 'nba', label: 'NBA', logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png' },
  { id: 'nba-development', label: 'G League', logo: 'https://firebasestorage.googleapis.com/v0/b/prologicstudio-4a6f5.firebasestorage.app/o/graphics_assets%2Fgleague.png?alt=media&token=gleague-logo-2026' },
  { id: 'mens-college-basketball', label: 'NCAA Men', logo: '' },
  { id: 'womens-college-basketball', label: 'NCAA Women', logo: '' },
  { id: 'wnba', label: 'WNBA', logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/wnba.png' },
];

/* ── Manual game mode ──────────────────────────────────────
   For teams outside any feed (local universities, city leagues): the operator
   keys score, clock and player stats by hand and the same graphics render. */

export interface ManualPlayer {
  id: string;
  name: string;
  jersey: string;
  pos: string;
  starter: boolean;
  photo: string;    // optional URL
  pts: number; reb: number; ast: number;
}

export interface ManualTeam {
  name: string;
  abbr: string;
  color: string;
  logo: string;     // optional URL
  score: number;
  players: ManualPlayer[];
}

export interface ManualGame {
  home: ManualTeam;
  away: ManualTeam;
  period: number;
  periodMin: number;         // period length in minutes (12 NBA, 10 FIBA/NCAA-W…)
  clockSec: number;          // seconds remaining when last updated
  clockRunning: boolean;
  clockUpdatedAt: string;    // ISO — reference point while running
  lines?: { away: number[]; home: number[] };   // captured points per period
}

export function manualClockRemaining(m: ManualGame, nowMs = Date.now()): number {
  if (!m.clockRunning) return Math.max(0, m.clockSec);
  const elapsed = (nowMs - new Date(m.clockUpdatedAt).getTime()) / 1000;
  return Math.max(0, m.clockSec - elapsed);
}

export function fmtClockSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* Adapt a manual game to the same Summary shape the feed produces, so every
   graphic (bug, lower thirds, full screens, leaders, callouts) just works. */
export function manualToSummary(m: ManualGame, nowMs = Date.now()): Summary {
  const team = (t: ManualTeam, homeAway: 'home' | 'away'): TeamBox => ({
    id: homeAway,
    abbr: t.abbr || (homeAway === 'home' ? 'HOME' : 'AWAY'),
    name: t.name || t.abbr || '',
    logo: t.logo || '',
    color: t.color || '#1f2937',
    homeAway,
    score: String(t.score ?? 0),
    linescores: (m.lines?.[homeAway] || []).map(v => String(v)),
    stats: [
      { label: 'Rebounds', value: String(t.players.reduce((a, p) => a + (p.reb || 0), 0)) },
      { label: 'Assists', value: String(t.players.reduce((a, p) => a + (p.ast || 0), 0)) },
    ],
    athletes: (t.players || []).map(p => ({
      id: p.id,
      name: p.name,
      shortName: p.name,
      jersey: p.jersey || '',
      pos: p.pos || '',
      starter: !!p.starter,
      headshot: p.photo || '',
      teamAbbr: t.abbr || '',
      teamColor: t.color || '#1f2937',
      teamLogo: t.logo || '',
      played: true,
      stats: {
        min: '', pts: String(p.pts || 0), fg: '', tp: '', ft: '',
        reb: String(p.reb || 0), ast: String(p.ast || 0), to: '',
        stl: '0', blk: '0', pf: '', plusMinus: '',
      },
    })),
  });

  return {
    eventId: 'manual',
    state: 'in',
    statusDetail: 'LIVE',
    clock: fmtClockSec(manualClockRemaining(m, nowMs)),
    period: m.period || 1,
    home: team(m.home, 'home'),
    away: team(m.away, 'away'),
  };
}

/* Moving to a later period locks in what each team scored during the period
   that just ended (total so far minus already-captured quarters). */
export function advanceManualPeriod(m: ManualGame, newPeriod: number): ManualGame {
  const lines = { away: [...(m.lines?.away || [])], home: [...(m.lines?.home || [])] };
  if (newPeriod > m.period) {
    (['away', 'home'] as const).forEach(k => {
      for (let i = 0; i < m.period - 1; i++) if (lines[k][i] == null) lines[k][i] = 0;
      const recorded = lines[k].reduce((a, b) => a + (b || 0), 0);
      lines[k][m.period - 1] = Math.max(0, (m[k].score || 0) - recorded);
    });
  }
  return { ...m, period: newPeriod, lines };
}

export function emptyManualGame(): ManualGame {
  return {
    home: { name: '', abbr: '', color: '#1d4ed8', logo: '', score: 0, players: [] },
    away: { name: '', abbr: '', color: '#dc2626', logo: '', score: 0, players: [] },
    period: 1,
    periodMin: 10,
    clockSec: 600,
    clockRunning: false,
    clockUpdatedAt: new Date().toISOString(),
  };
}

/* Top five of a team for the matchup graphic: by points, starters as tiebreak */
export function topFive(team: TeamBox): Athlete[] {
  const played = team.athletes.filter(a => a.played);
  const pool = played.length >= 5 ? played : team.athletes;
  return [...pool]
    .sort((a, b) =>
      (parseInt(b.stats.pts || '0') - parseInt(a.stats.pts || '0')) ||
      (Number(b.starter) - Number(a.starter)))
    .slice(0, 5);
}

const hex = (c?: string) => (c ? (c.startsWith('#') ? c : `#${c}`) : '#1f2937');

function normTeam(comp: any): GameTeam {
  const t = comp.team || {};
  return {
    id: String(t.id || ''),
    abbr: t.abbreviation || '',
    name: t.shortDisplayName || t.displayName || '',
    logo: t.logo || '',
    color: hex(t.color),
    altColor: hex(t.alternateColor),
    score: String(comp.score ?? ''),
    record: (comp.records || []).find((r: any) => r.type === 'total')?.summary,
  };
}

export function normalizeScoreboard(json: any): Game[] {
  return (json?.events || []).map((e: any) => {
    const c = e.competitions?.[0] || {};
    const comps = c.competitors || [];
    const home = comps.find((x: any) => x.homeAway === 'home');
    const away = comps.find((x: any) => x.homeAway === 'away');
    const st = c.status || {};
    return {
      id: String(e.id),
      shortName: e.shortName || '',
      state: (st.type?.state || 'pre') as Game['state'],
      statusDetail: st.type?.shortDetail || '',
      clock: st.displayClock || '',
      period: st.period || 0,
      home: home ? normTeam(home) : ({} as GameTeam),
      away: away ? normTeam(away) : ({} as GameTeam),
    };
  });
}

function statIdx(keys: string[]) {
  const find = (k: string) => keys.indexOf(k);
  return {
    min: find('minutes'), pts: find('points'),
    fg: find('fieldGoalsMade-fieldGoalsAttempted'),
    tp: find('threePointFieldGoalsMade-threePointFieldGoalsAttempted'),
    ft: find('freeThrowsMade-freeThrowsAttempted'),
    reb: find('rebounds'), ast: find('assists'), to: find('turnovers'),
    stl: find('steals'), blk: find('blocks'), pf: find('fouls'),
    plusMinus: find('plusMinus'),
  };
}

export function normalizeSummary(json: any): Summary | null {
  const comp = json?.header?.competitions?.[0];
  if (!comp) return null;
  const st = comp.status || {};
  const scores: Record<string, string> = {};
  const lines: Record<string, string[]> = {};
  (comp.competitors || []).forEach((c: any) => {
    const id = String(c.team?.id ?? c.id);
    scores[id] = String(c.score ?? '');
    lines[id] = (c.linescores || []).map((l: any) => String(l.displayValue ?? l.value ?? ''));
  });

  const teamsRaw = json?.boxscore?.teams || [];
  const playersRaw = json?.boxscore?.players || [];

  const buildTeam = (tRaw: any): TeamBox => {
    const t = tRaw?.team || {};
    const pl = playersRaw.find((p: any) => String(p.team?.id) === String(t.id));
    let athletes: Athlete[] = [];
    if (pl?.statistics?.[0]) {
      const block = pl.statistics[0];
      const idx = statIdx(block.keys || []);
      const get = (arr: string[], i: number) => (i >= 0 && arr[i] != null ? String(arr[i]) : '');
      athletes = (block.athletes || []).map((a: any) => {
        const ath = a.athlete || {};
        const s: string[] = a.stats || [];
        return {
          id: String(ath.id || ''),
          name: ath.displayName || '',
          shortName: ath.shortName || ath.displayName || '',
          jersey: ath.jersey || '',
          pos: ath.position?.abbreviation || '',
          starter: !!a.starter,
          headshot: ath.headshot?.href || '',
          teamAbbr: t.abbreviation || '',
          teamColor: hex(t.color),
          teamLogo: t.logo || '',
          played: s.length > 0 && !a.didNotPlay,
          stats: {
            min: get(s, idx.min), pts: get(s, idx.pts), fg: get(s, idx.fg),
            tp: get(s, idx.tp), ft: get(s, idx.ft), reb: get(s, idx.reb),
            ast: get(s, idx.ast), to: get(s, idx.to), stl: get(s, idx.stl),
            blk: get(s, idx.blk), pf: get(s, idx.pf), plusMinus: get(s, idx.plusMinus),
          },
        };
      });
    }
    return {
      id: String(t.id || ''),
      abbr: t.abbreviation || '',
      name: t.shortDisplayName || t.displayName || '',
      logo: t.logo || '',
      color: hex(t.color),
      homeAway: (tRaw?.homeAway || 'home') as 'home' | 'away',
      score: scores[String(t.id)] || '',
      linescores: lines[String(t.id)] || [],
      stats: (tRaw?.statistics || []).map((s: any) => ({
        label: s.label || s.abbreviation || '',
        value: s.displayValue || '',
      })),
      athletes,
    };
  };

  const homeRaw = teamsRaw.find((t: any) => t.homeAway === 'home') || teamsRaw[1];
  const awayRaw = teamsRaw.find((t: any) => t.homeAway === 'away') || teamsRaw[0];
  if (!homeRaw || !awayRaw) return null;

  return {
    eventId: String(json?.header?.id || ''),
    state: (st.type?.state || 'pre') as Summary['state'],
    statusDetail: st.type?.shortDetail || '',
    clock: st.displayClock || '',
    period: st.period || 0,
    home: buildTeam(homeRaw),
    away: buildTeam(awayRaw),
  };
}

/* Top-N scorers across both teams (for the leaders full-screen) */
export function gameLeaders(summary: Summary, n = 3): Athlete[] {
  return [...summary.home.athletes, ...summary.away.athletes]
    .filter(a => a.played && a.stats.pts !== '')
    .sort((a, b) => parseInt(b.stats.pts || '0') - parseInt(a.stats.pts || '0'))
    .slice(0, n);
}

/* ── Play callouts ─────────────────────────────────────────
   Flash-graphics fired over the score bug: manually by the operator, or
   auto-detected by diffing consecutive live boxscores. */
export interface Callout {
  id: string;
  kind: '3pt' | '2pt' | 'ft' | 'ast' | 'dd' | 'td' | 'custom';
  title: string;
  sub?: string;
  color?: string;
  ms?: number;      // on-air duration override (default 4500)
}

const num = (s?: string) => parseInt(s || '0', 10) || 0;
const madeOf = (s?: string) => num((s || '').split('-')[0]);
const ddCats = (s: AthleteStats) =>
  [s.pts, s.reb, s.ast, s.stl, s.blk].filter(v => num(v) >= 10).length;

export function buildCallout(a: Athlete, kind: Callout['kind']): Callout {
  const base = { id: Math.random().toString(36).slice(2, 10), kind, color: a.teamColor };
  switch (kind) {
    case '3pt': return { ...base, title: '3-POINTER!', sub: `${a.shortName} · ${madeOf(a.stats.tp)} threes · ${a.stats.pts} PTS` };
    case '2pt': return { ...base, title: '+2', sub: `${a.shortName} · ${a.stats.pts} PTS` };
    case 'ft':  return { ...base, title: '+1 FT', sub: `${a.shortName} · ${a.stats.pts} PTS` };
    case 'ast': return { ...base, title: 'ASSIST', sub: `${a.shortName} · ${a.stats.ast} AST` };
    case 'dd':  return { ...base, title: 'DOUBLE-DOUBLE!', sub: `${a.shortName} · ${a.stats.pts} PTS · ${a.stats.reb} REB · ${a.stats.ast} AST` };
    case 'td':  return { ...base, title: 'TRIPLE-DOUBLE!', sub: `${a.shortName} · ${a.stats.pts} PTS · ${a.stats.reb} REB · ${a.stats.ast} AST` };
    default:    return { ...base, title: '' };
  }
}

/* Diff two consecutive summaries → the callouts a broadcast would flash */
export function detectCallouts(prev: Summary | null, curr: Summary): Callout[] {
  if (!prev) return [];
  const prevMap = new Map(
    [...prev.home.athletes, ...prev.away.athletes].map(a => [a.id, a]));
  const events: Callout[] = [];
  for (const a of [...curr.home.athletes, ...curr.away.athletes]) {
    const p = prevMap.get(a.id);
    if (!p) continue;
    const ptsD = num(a.stats.pts) - num(p.stats.pts);
    const tpD = madeOf(a.stats.tp) - madeOf(p.stats.tp);
    const astD = num(a.stats.ast) - num(p.stats.ast);
    if (tpD > 0) events.push(buildCallout(a, '3pt'));
    else if (ptsD === 2) events.push(buildCallout(a, '2pt'));
    else if (ptsD === 1) events.push(buildCallout(a, 'ft'));
    if (astD > 0) events.push(buildCallout(a, 'ast'));
    const cats = ddCats(a.stats), prevCats = ddCats(p.stats);
    if (cats >= 3 && prevCats < 3) events.push(buildCallout(a, 'td'));
    else if (cats === 2 && prevCats < 2) events.push(buildCallout(a, 'dd'));
  }
  // Milestones outrank routine buckets; cap the burst per poll
  const rank: Record<string, number> = { td: 0, dd: 1, '3pt': 2, '2pt': 3, ft: 4, ast: 5, custom: 6 };
  return events.sort((x, y) => rank[x.kind] - rank[y.kind]).slice(0, 4);
}

/* The team-stat rows worth comparing on air */
const STAT_LABELS = ['Field Goal %', 'Three Point %', 'Free Throw %', 'Rebounds', 'Assists', 'Turnovers', 'Points in Paint', 'Fast Break Points', 'Largest Lead'];
export function comparedTeamStats(summary: Summary): { label: string; away: string; home: string }[] {
  return STAT_LABELS.map(label => ({
    label,
    away: summary.away.stats.find(s => s.label === label)?.value || '—',
    home: summary.home.stats.find(s => s.label === label)?.value || '—',
  })).filter(r => r.away !== '—' || r.home !== '—');
}

/* ── Photo overrides ───────────────────────────────────────
   Operator-assigned mugshots (pasted from a Google Images search or uploaded)
   that replace missing feed headshots everywhere they render. */
export function applyPhotoOverrides(
  summary: Summary | null,
  overrides: Record<string, string> | null | undefined
): Summary | null {
  if (!summary || !overrides || Object.keys(overrides).length === 0) return summary;
  const fix = (t: TeamBox): TeamBox => ({
    ...t,
    athletes: t.athletes.map(a => overrides[a.id] ? { ...a, headshot: overrides[a.id] } : a),
  });
  return { ...summary, home: fix(summary.home), away: fix(summary.away) };
}

/* League team directory (for pickers: next-game announcement, etc.) */
export interface LeagueTeam { id: string; name: string; abbr: string; logo: string }
export function normalizeTeams(json: any): LeagueTeam[] {
  const teams = json?.sports?.[0]?.leagues?.[0]?.teams || [];
  return teams.map((t: any) => ({
    id: String(t.team?.id || ''),
    name: t.team?.displayName || '',
    abbr: t.team?.abbreviation || '',
    logo: t.team?.logos?.[0]?.href || '',
  })).sort((a: LeagueTeam, b: LeagueTeam) => a.name.localeCompare(b.name));
}

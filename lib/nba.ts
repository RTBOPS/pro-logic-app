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
  record?: string;           // e.g. "24-34" (live/pre games)
  fouls?: string;            // total team fouls this game
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
  venue?: string;            // "TD Garden · Boston, MA"
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
  const recs: Record<string, string> = {};
  (comp.competitors || []).forEach((c: any) => {
    const id = String(c.team?.id ?? c.id);
    scores[id] = String(c.score ?? '');
    lines[id] = (c.linescores || []).map((l: any) => String(l.displayValue ?? l.value ?? ''));
    recs[id] = typeof c.record === 'string' ? c.record
      : (c.records || []).find((r: any) => r.type === 'total')?.summary || (c.records || [])[0]?.summary || '';
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
      record: recs[String(t.id)] || '',
      fouls: (tRaw?.statistics || []).find((s: any) => (s.label || s.name || '').toLowerCase() === 'fouls')?.displayValue || '',
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
    venue: (() => {
      const v = json?.gameInfo?.venue || {};
      const city = [v.address?.city, v.address?.state].filter(Boolean).join(', ');
      return v.fullName ? (city ? `${v.fullName} · ${city}` : v.fullName) : '';
    })(),
  };
}

/* ── Play-by-play derived data (shots, assists, feed, alerts) ──
   All parsed from ESPN's `plays` array — the same public summary payload,
   no extra source. Swappable for an official low-latency feed later. */

export interface ShotPlay {
  id: string;
  x: number;            // 0..50 court width (25 = center)
  y: number;            // 0..~47 distance from baseline (0 = at rim)
  made: boolean;
  value: number;        // 2 or 3
  teamId: string;
  athleteId: string;
  text: string;
  period: number;
  clock: string;
}

export interface PlayEvent {
  id: string;
  text: string;
  scoreValue: number;
  scoring: boolean;
  teamId: string;
  period: number;
  clock: string;
  awayScore: number;
  homeScore: number;
  athleteId: string;
}

export interface AssistLink {
  scorerId: string;
  assisterId: string;
  value: number;
  made: boolean;
}

export interface GameAlert {
  kind: 'run' | 'lead' | 'streak' | 'milestone';
  title: string;
  detail: string;
  teamId?: string;
}

const validCoord = (n: any) => typeof n === 'number' && Math.abs(n) <= 100;

export function normalizeShots(json: any): ShotPlay[] {
  const plays: any[] = json?.plays || [];
  return plays
    // Field goals only (pointsAttempted 2 or 3) — free throws excluded from the chart.
    // pointsAttempted marks the ATTEMPT value, so missed 3s count as 3s (scoreValue is 0 on a miss).
    .filter(p => p.shootingPlay && Number(p.pointsAttempted) >= 2
      && p.coordinate && validCoord(p.coordinate.x) && validCoord(p.coordinate.y))
    .map(p => ({
      id: String(p.id || p.sequenceNumber || ''),
      x: p.coordinate.x,
      y: p.coordinate.y,
      made: !!p.scoringPlay,
      value: Number(p.pointsAttempted) || 2,
      teamId: String(p.team?.id || ''),
      athleteId: String(p.participants?.[0]?.athlete?.id || ''),
      text: p.text || '',
      period: p.period?.number || 0,
      clock: p.clock?.displayValue || '',
    }));
}

export interface ShotSplit {
  label: string;
  fgm: number; fga: number; pct: number;
  tpm: number; tpa: number;
  headshot: string;
  logo: string;
  color: string;
  teamAbbr: string;
  jersey: string;
  isPlayer: boolean;
}

/* Shooting splits for a filter ('all' | teamId | athleteId) from the shot list. */
export function computeSplits(shots: ShotPlay[], filter: string, summary: Summary): ShotSplit {
  const all = [...summary.home.athletes, ...summary.away.athletes];
  const player = filter !== 'all' && filter !== summary.home.id && filter !== summary.away.id
    ? all.find(a => a.id === filter) : undefined;
  const team = filter === summary.home.id ? summary.home : filter === summary.away.id ? summary.away : undefined;
  const sel = shots.filter(s =>
    filter === 'all' ? true : (s.teamId === filter || s.athleteId === filter));
  const fga = sel.length;
  const fgm = sel.filter(s => s.made).length;
  const three = sel.filter(s => s.value === 3);
  return {
    label: player ? player.name : team ? team.name : 'Both Teams',
    fgm, fga, pct: fga ? Math.round((fgm / fga) * 100) : 0,
    tpm: three.filter(s => s.made).length, tpa: three.length,
    headshot: player?.headshot || '',
    logo: player ? player.teamLogo : team?.logo || '',
    color: player ? player.teamColor : team?.color || '#1f2937',
    teamAbbr: player?.teamAbbr || team?.abbr || '',
    jersey: player?.jersey || '',
    isPlayer: !!player,
  };
}

export function normalizePlays(json: any): PlayEvent[] {
  const plays: any[] = json?.plays || [];
  return plays.map(p => ({
    id: String(p.id || p.sequenceNumber || ''),
    text: p.text || '',
    scoreValue: Number(p.scoreValue) || 0,
    scoring: !!p.scoringPlay,
    teamId: String(p.team?.id || ''),
    period: p.period?.number || 0,
    clock: p.clock?.displayValue || '',
    awayScore: Number(p.awayScore) || 0,
    homeScore: Number(p.homeScore) || 0,
    athleteId: String(p.participants?.[0]?.athlete?.id || ''),
  }));
}

/* Assist connections from made shots that credit a second participant. */
export function normalizeAssists(json: any): AssistLink[] {
  const plays: any[] = json?.plays || [];
  return plays
    .filter(p => p.scoringPlay && p.shootingPlay && (p.participants?.length || 0) > 1)
    .map(p => ({
      scorerId: String(p.participants[0]?.athlete?.id || ''),
      assisterId: String(p.participants[1]?.athlete?.id || ''),
      value: Number(p.scoreValue) || 2,
      made: true,
    }));
}

/* Assist leaders for a team, resolved to athletes, from the assist links. */
export function assistLeaders(summary: Summary, links: AssistLink[], teamId?: string): { athlete: Athlete; count: number }[] {
  const all = [...summary.home.athletes, ...summary.away.athletes];
  const byId = new Map(all.map(a => [a.id, a]));
  const teamOf = (id: string) => (summary.home.athletes.some(a => a.id === id) ? summary.home.id : summary.away.id);
  const counts = new Map<string, number>();
  for (const l of links) {
    if (!l.assisterId) continue;
    if (teamId && teamOf(l.assisterId) !== teamId) continue;
    counts.set(l.assisterId, (counts.get(l.assisterId) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ athlete: byId.get(id)!, count }))
    .filter(x => x.athlete)
    .sort((a, b) => b.count - a.count);
}

/* Compute broadcast alerts from the play stream: scoring runs and biggest lead.
   Milestones/streaks that need historical data are left for the official feed. */
export function computeAlerts(json: any, summary: Summary): GameAlert[] {
  const plays = normalizePlays(json).filter(p => p.scoring);
  const alerts: GameAlert[] = [];
  if (plays.length < 2) return alerts;
  // Current scoring run: walk back while the same team keeps scoring
  const last = plays[plays.length - 1];
  let runTeamHome = last.homeScore > (plays[plays.length - 2]?.homeScore ?? 0);
  let runPts = 0, i = plays.length - 1;
  let prevA = plays[i].awayScore, prevH = plays[i].homeScore;
  for (; i >= 1; i--) {
    const dH = plays[i].homeScore - plays[i - 1].homeScore;
    const dA = plays[i].awayScore - plays[i - 1].awayScore;
    const scoredHome = dH > 0;
    if (i === plays.length - 1) runTeamHome = scoredHome;
    if (scoredHome === runTeamHome && (scoredHome ? dH : dA) > 0) {
      runPts += scoredHome ? dH : dA;
      prevA = plays[i - 1].awayScore; prevH = plays[i - 1].homeScore;
    } else break;
  }
  const oppScored = runTeamHome ? (last.awayScore - prevA) : (last.homeScore - prevH);
  if (runPts >= 6 && oppScored === 0) {
    const t = runTeamHome ? summary.home : summary.away;
    alerts.push({ kind: 'run', title: `${runPts}-0 RUN`, detail: `${t.name} on a ${runPts}-0 run`, teamId: t.id });
  }
  // Biggest current lead
  const hs = parseInt(summary.home.score || '0'), as = parseInt(summary.away.score || '0');
  const diff = Math.abs(hs - as);
  if (diff >= 10) {
    const leader = hs > as ? summary.home : summary.away;
    alerts.push({ kind: 'lead', title: `+${diff}`, detail: `${leader.name} lead by ${diff}`, teamId: leader.id });
  }
  return alerts;
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

/* Richer callouts straight from the play-by-play stream: real shot type,
   distance and the assisting player — text a boxscore diff can't produce.
   `seen` is a persistent Set of play ids so each scoring play fires once. */
export function detectRichCallouts(json: any, summary: Summary, seen: Set<string>): Callout[] {
  const plays: any[] = json?.plays || [];
  const byId = new Map([...summary.home.athletes, ...summary.away.athletes].map(a => [a.id, a]));
  const shotWord = (t: string) => {
    const s = t.toLowerCase();
    if (s.includes('dunk')) return 'dunk';
    if (s.includes('layup')) return 'layup';
    if (s.includes('hook')) return 'hook';
    if (s.includes('floating') || s.includes('floater')) return 'floater';
    if (s.includes('tip')) return 'tip-in';
    if (s.includes('fadeaway')) return 'fadeaway';
    if (s.includes('pullup') || s.includes('pull-up') || s.includes('pull up')) return 'pullup';
    if (s.includes('bank')) return 'bank shot';
    if (s.includes('jumper') || s.includes('jump shot')) return 'jumper';
    return '';
  };
  const out: Callout[] = [];
  for (const p of plays) {
    if (!p.scoringPlay) continue;
    const id = String(p.id || p.sequenceNumber || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const pa = Number(p.pointsAttempted) || Number(p.scoreValue) || 2;
    const scorer = byId.get(String(p.participants?.[0]?.athlete?.id || ''));
    const assister = p.participants?.length > 1 ? byId.get(String(p.participants[1]?.athlete?.id || '')) : undefined;
    const color = scorer?.teamColor || '#f59e0b';
    const name = scorer?.shortName || '';
    const distM = /(\d+)-foot/.exec(p.text || '');
    const dist = distM ? `${distM[1]}ft ` : '';
    const word = shotWord(p.text || '');
    const astTag = assister ? ` · ${assister.shortName} AST` : '';
    const base = { id: Math.random().toString(36).slice(2, 10), color };
    if (pa === 3) {
      out.push({ ...base, kind: '3pt', title: '3-POINTER!', sub: `${name} · ${dist}3PT${astTag}` });
    } else if (pa === 1) {
      out.push({ ...base, kind: 'ft', title: '+1 FT', sub: `${name} · ${scorer?.stats.pts || '0'} PTS` });
    } else {
      const dunk = word === 'dunk';
      out.push({ ...base, kind: '2pt', title: dunk ? 'SLAM DUNK!' : '+2', sub: `${name}${word ? ' · ' + word : ''}${astTag}` });
    }
  }
  return out.slice(-4);
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

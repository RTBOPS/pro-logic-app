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
  (comp.competitors || []).forEach((c: any) => {
    scores[String(c.team?.id ?? c.id)] = String(c.score ?? '');
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

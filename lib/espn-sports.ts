/* ESPN sport/league registry shared by the API proxies and the CG. Adding a
 * sport = one entry here; the proxies validate against it and the panel
 * derives the sport slug from the league id. */
export const SPORT_LEAGUES: Record<string, Set<string>> = {
  basketball: new Set(['nba', 'nba-development', 'mens-college-basketball', 'womens-college-basketball', 'wnba']),
  soccer:     new Set(['mex.1', 'usa.1', 'eng.1', 'esp.1', 'bra.1', 'arg.1', 'uefa.champions', 'concacaf.champions']),
  football:   new Set(['nfl', 'college-football']),
  hockey:     new Set(['nhl']),
  baseball:   new Set(['mlb']),
};

export function sportFor(league: string): string {
  for (const [sport, set] of Object.entries(SPORT_LEAGUES)) if (set.has(league)) return sport;
  return 'basketball';
}

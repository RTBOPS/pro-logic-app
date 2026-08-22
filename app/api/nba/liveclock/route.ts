import { NextRequest, NextResponse } from 'next/server';

/* Server-side proxy for the NBA/WNBA per-game liveData clock (the fresh feed
 * Courtside uses). If Vercel can reach cdn.*.com this makes the accurate clock
 * fully automatic — no local agent. ?league=wnba&home=TOR */

const H = (league: string) => ({
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  Referer: `https://www.${league}.com/`,
  Origin: `https://www.${league}.com`,
  Accept: 'application/json',
});

export async function GET(req: NextRequest) {
  const league = (req.nextUrl.searchParams.get('league') || 'wnba').toLowerCase();
  const home = (req.nextUrl.searchParams.get('home') || '').toUpperCase();
  const away = (req.nextUrl.searchParams.get('away') || '').toUpperCase();
  if (league !== 'wnba' && league !== 'nba') return NextResponse.json({ error: 'league' }, { status: 400 });
  const lid = league === 'nba' ? '00' : '10';
  const host = league === 'nba' ? 'cdn.nba.com' : 'cdn.wnba.com';
  try {
    const sb = await fetch(`https://${host}/static/json/liveData/scoreboard/todaysScoreboard_${lid}.json`, { headers: H(league), cache: 'no-store' });
    if (!sb.ok) return NextResponse.json({ error: `scoreboard ${sb.status}`, blocked: sb.status === 403 }, { status: 502 });
    const sbj = await sb.json();
    const games = sbj.scoreboard?.games || [];
    const match = (x: any) => x.homeTeam.teamTricode === home || x.awayTeam.teamTricode === home || x.homeTeam.teamTricode === away || x.awayTeam.teamTricode === away;
    let g = games.find((x: any) => x.gameStatus === 2 && (!(home || away) || match(x)));
    if (!g) g = games.find((x: any) => x.gameStatus === 2);
    if (!g) return NextResponse.json({ live: false });
    let gc = g.gameClock, status = g.gameStatusText, period = g.period;
    try {
      const bx = await fetch(`https://${host}/static/json/liveData/boxscore/boxscore_${g.gameId}.json`, { headers: H(league), cache: 'no-store' });
      if (bx.ok) { const bxj = await bx.json(); const gg = bxj.game || {}; gc = gg.gameClock || gc; status = gg.gameStatusText || status; period = gg.period || period; }
    } catch { /* fall back to scoreboard clock */ }
    const m = /PT(\d+)M([\d.]+)S/.exec(gc || '');
    const sec = m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : null;
    return NextResponse.json(
      { live: true, sec, period, status, clock: gc, game: `${g.awayTeam.teamTricode}@${g.homeTeam.teamTricode}` },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unreachable' }, { status: 502 });
  }
}

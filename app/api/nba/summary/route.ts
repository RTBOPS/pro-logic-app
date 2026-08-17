import { NextRequest, NextResponse } from 'next/server';

/* Proxy for ESPN's public NBA game summary (live boxscore, clock, period,
   player stats, team stats). ?event=<gameId> */

const LEAGUES = new Set(['nba', 'nba-development', 'mens-college-basketball', 'womens-college-basketball', 'wnba']);

export async function GET(req: NextRequest) {
  const event = req.nextUrl.searchParams.get('event') || '';
  const league = req.nextUrl.searchParams.get('league') || 'nba';
  if (!/^\d{5,12}$/.test(event)) {
    return NextResponse.json({ error: 'event id required' }, { status: 400 });
  }
  if (!LEAGUES.has(league)) {
    return NextResponse.json({ error: 'unknown league' }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/summary?event=${event}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `NBA data error (${res.status})` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10' },
    });
  } catch {
    return NextResponse.json({ error: 'NBA data unreachable' }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

/* Proxy for ESPN's public NBA scoreboard. Optional ?dates=YYYYMMDD
   (no date = current game day). Proxied to keep a single origin and
   add a short shared cache. */

const LEAGUES = new Set(['nba', 'nba-development', 'mens-college-basketball', 'womens-college-basketball', 'wnba']);

export async function GET(req: NextRequest) {
  const dates = req.nextUrl.searchParams.get('dates') || '';
  const league = req.nextUrl.searchParams.get('league') || 'nba';
  if (dates && !/^\d{8}$/.test(dates)) {
    return NextResponse.json({ error: 'dates must be YYYYMMDD' }, { status: 400 });
  }
  if (!LEAGUES.has(league)) {
    return NextResponse.json({ error: 'unknown league' }, { status: 400 });
  }
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/scoreboard${dates ? `?dates=${dates}` : ''}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `NBA data error (${res.status})` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch {
    return NextResponse.json({ error: 'NBA data unreachable' }, { status: 502 });
  }
}

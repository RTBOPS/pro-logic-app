import { NextRequest, NextResponse } from 'next/server';

/* Proxy for ESPN's team directory per league (names, abbreviations, logos).
   Team lists barely change — cache aggressively. */

const LEAGUES = new Set(['nba', 'nba-development', 'mens-college-basketball', 'womens-college-basketball', 'wnba']);

export async function GET(req: NextRequest) {
  const league = req.nextUrl.searchParams.get('league') || 'nba';
  if (!LEAGUES.has(league)) {
    return NextResponse.json({ error: 'unknown league' }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/teams?limit=400`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `NBA data error (${res.status})` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'NBA data unreachable' }, { status: 502 });
  }
}

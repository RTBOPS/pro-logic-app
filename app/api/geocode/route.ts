import { NextRequest, NextResponse } from 'next/server';

// Resolve a place name to coordinates (Open-Meteo geocoder, no key needed).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  if (!q.trim() || q.length > 120) return NextResponse.json({ error: 'invalid query' }, { status: 400 });
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=5&language=en&format=json`
    );
    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
      lat: r.latitude, lon: r.longitude,
    }));
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: 'geocoding failed' }, { status: 500 });
  }
}

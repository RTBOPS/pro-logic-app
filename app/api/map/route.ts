import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  try {
    // Geocode
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'PRO-LOGIC-Studio/1.0' } }
    );
    const geo = await geoRes.json();
    if (!geo.length) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    const { lat, lon } = geo[0];

    // Static map image
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=600x300&maptype=mapnik&markers=${lat},${lon},ol-marker-red`;
    const mapRes = await fetch(mapUrl, { headers: { 'User-Agent': 'PRO-LOGIC-Studio/1.0' } });
    if (!mapRes.ok) throw new Error('Map fetch failed');

    const buffer = await mapRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

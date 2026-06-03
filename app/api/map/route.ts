import { NextRequest, NextResponse } from 'next/server';

function latLonToTile(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  try {
    // Geocode with Nominatim
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'PRO-LOGIC-Studio/1.0' } }
    );
    const geo = await geoRes.json();
    if (!geo.length) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    const lat = parseFloat(geo[0].lat);
    const lon = parseFloat(geo[0].lon);
    const zoom = 15;
    const { x, y } = latLonToTile(lat, lon, zoom);

    // Fetch a 3x2 grid of tiles and stitch them (512x512 effective)
    // For simplicity, fetch the single center tile (256x256 at zoom 15 = ~1km)
    // Use multiple tile servers for reliability
    const tileServers = [
      `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
      `https://b.tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
      `https://c.tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
    ];

    const fetchWithTimeout = async (url: string, ms: number): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        return await fetch(url, { headers: { 'User-Agent': 'PRO-LOGIC-Studio/1.0' }, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    let tileBuffer: ArrayBuffer | null = null;
    for (const url of tileServers) {
      try {
        const res = await fetchWithTimeout(url, 8000);
        if (res.ok) { tileBuffer = await res.arrayBuffer(); break; }
      } catch {}
    }

    if (!tileBuffer) {
      try {
        const fallback = await fetchWithTimeout(
          `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=400x200&maptype=mapnik`,
          10000
        );
        if (fallback.ok) tileBuffer = await fallback.arrayBuffer();
      } catch {}
    }

    if (!tileBuffer) return NextResponse.json({ error: 'Map unavailable' }, { status: 503 });

    return new NextResponse(tileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

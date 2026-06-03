import { NextRequest, NextResponse } from 'next/server';

const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ heavy hail',
};

function wmoIcon(code: number): string {
  if (code === 0) return '01d';
  if (code <= 3) return '02d';
  if (code <= 48) return '50d';
  if (code <= 67) return '10d';
  if (code <= 77) return '13d';
  if (code <= 82) return '09d';
  if (code <= 86) return '13d';
  return '11d';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let lat = searchParams.get('lat');
  let lon = searchParams.get('lon');
  const city = searchParams.get('city');

  try {
    // Geocode city if no lat/lon
    if ((!lat || !lon) && city) {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
      );
      const geo = await geoRes.json();
      const result = geo.results?.[0];
      if (!result) return NextResponse.json({ error: 'City not found' }, { status: 404 });
      lat = String(result.latitude);
      lon = String(result.longitude);
    }

    if (!lat || !lon) return NextResponse.json({ error: 'lat/lon or city required' }, { status: 400 });

    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max` +
      `&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=7`
    );
    const data = await forecastRes.json();
    const d = data.daily;

    const forecast = (d.time || []).map((date: string, i: number) => ({
      date,
      temp_high: Math.round(d.temperature_2m_max[i]),
      temp_low: Math.round(d.temperature_2m_min[i]),
      description: WMO[d.weathercode[i]] || 'Unknown',
      icon: wmoIcon(d.weathercode[i]),
      precipitation: d.precipitation_probability_max[i] ?? 0,
      wind_speed: Math.round(d.windspeed_10m_max[i]),
    }));

    return NextResponse.json({ city: city || `${lat},${lon}`, forecast });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

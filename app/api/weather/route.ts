import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const city = searchParams.get('city');
  const key = process.env.OPENWEATHER_API_KEY;

  if (!key || key === 'your_openweather_api_key_here') {
    return NextResponse.json({ error: 'OPENWEATHER_API_KEY not configured' }, { status: 503 });
  }

  try {
    let url: string;
    if (lat && lon) {
      url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${key}`;
    } else if (city) {
      url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=imperial&appid=${key}`;
    } else {
      return NextResponse.json({ error: 'lat/lon or city required' }, { status: 400 });
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenWeather error: ${res.status}`);
    const data = await res.json();

    // Return simplified 5-day forecast (one entry per day at noon)
    const dailyMap: Record<string, any> = {};
    (data.list || []).forEach((item: any) => {
      const date = item.dt_txt.split(' ')[0];
      const hour = parseInt(item.dt_txt.split(' ')[1]);
      if (!dailyMap[date] || hour === 12) {
        dailyMap[date] = {
          date,
          temp_high: Math.round(item.main.temp_max),
          temp_low: Math.round(item.main.temp_min),
          feels_like: Math.round(item.main.feels_like),
          description: item.weather[0].description,
          icon: item.weather[0].icon,
          wind_speed: Math.round(item.wind.speed),
          humidity: item.main.humidity,
          precipitation: item.pop ? Math.round(item.pop * 100) : 0,
        };
      }
    });

    return NextResponse.json({
      city: data.city?.name || city,
      country: data.city?.country,
      forecast: Object.values(dailyMap).slice(0, 5),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

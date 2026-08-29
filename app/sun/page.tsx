'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/hooks/useData';
import { sunPosition, sunTimes, fmtTime, compassDir } from '@/lib/sun';
import { Sunrise, Sunset, Sun, MapPin, LocateFixed, Search, Clock } from 'lucide-react';

type Place = { name: string; lat: number; lon: number };

export default function SunPage() {
  const { data: locations } = useData('locations');
  const [place, setPlace] = useState<Place | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('plg_sun_loc');
      if (saved) setPlace(JSON.parse(saved));
    } catch {}
  }, []);
  const pick = (p: Place) => {
    setPlace(p); setResults([]); setQuery('');
    try { localStorage.setItem('plg_sun_loc', JSON.stringify(p)); } catch {}
  };

  const search = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {} finally { setSearching(false); }
  };

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => pick({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => alert('Could not get your location — check browser permissions.')
    );
  };

  const date = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [dateStr]);
  const at = useMemo(() => {
    const d = new Date(date); d.setMinutes(minutes); return d;
  }, [date, minutes]);

  const times = useMemo(() => place ? sunTimes(date, place.lat, place.lon) : null, [place, date]);
  const pos = useMemo(() => place ? sunPosition(at, place.lat, place.lon) : null, [place, at]);

  // Sun path samples for the SVG (every 10 min)
  const path = useMemo(() => {
    if (!place) return '';
    const pts: string[] = [];
    for (let m = 0; m <= 1440; m += 10) {
      const d = new Date(date); d.setMinutes(m);
      const p = sunPosition(d, place.lat, place.lon);
      const x = (m / 1440) * 700 + 20;
      const y = 150 - (p.altitude / 90) * 130;
      pts.push(`${pts.length ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [place, date]);

  const rows = times ? [
    { label: 'First light (civil dawn)', v: fmtTime(times.firstLight), icon: '·' },
    { label: 'Blue hour ends', v: fmtTime(times.blueEndAM), icon: '·' },
    { label: 'Sunrise', v: fmtTime(times.sunrise), icon: '↑' },
    { label: 'Golden hour ends', v: fmtTime(times.goldenEndAM), icon: '·' },
    { label: 'Solar noon', v: fmtTime(times.solarNoon), icon: '·' },
    { label: 'Golden hour begins', v: fmtTime(times.goldenStartPM), icon: '·' },
    { label: 'Sunset', v: fmtTime(times.sunset), icon: '↓' },
    { label: 'Blue hour begins', v: fmtTime(times.blueStartPM), icon: '·' },
    { label: 'Last light (civil dusk)', v: fmtTime(times.lastLight), icon: '·' },
  ] : [];

  const sunX = (minutes / 1440) * 700 + 20;
  const sunY = pos ? 150 - (pos.altitude / 90) * 130 : 150;
  const shadowAz = pos ? (pos.azimuth + 180) % 360 : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sun Tracker</h1>
          <p className="text-gray-500 text-sm">Sun position, golden hour and shadow direction for any location and date.</p>
        </div>
      </div>

      {/* Location picker */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(query)}
              placeholder="Search a city or place…"
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            {results.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {results.map((r, i) => (
                  <button key={i} onClick={() => pick(r)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                    <MapPin size={13} className="text-gray-400 shrink-0" />{r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => search(query)} disabled={searching} className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-black disabled:opacity-40">
            {searching ? 'Searching…' : 'Search'}
          </button>
          <button onClick={useMyLocation} className="flex items-center gap-1.5 border border-gray-200 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
            <LocateFixed size={14} /> My location
          </button>
          {locations.length > 0 && (
            <select
              onChange={e => {
                const l = locations.find((x: any) => x.id === e.target.value);
                if (l) search([l.address, l.city, l.state, l.country].filter(Boolean).join(', ') || l.name);
              }}
              defaultValue=""
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700"
            >
              <option value="" disabled>Saved locations…</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
        {place && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-gray-900"><MapPin size={14} className="text-amber-500" />{place.name}</span>
            <span className="text-gray-500">{place.lat.toFixed(4)}, {place.lon.toFixed(4)}</span>
            <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
          </div>
        )}
      </div>

      {!place && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500 text-sm">
          Search a place, use your location, or pick a saved location to see the sun data.
        </div>
      )}

      {place && times && pos && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Sun path */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Sun size={15} className="text-amber-500" /> Sun path</div>
              <div className="text-sm text-gray-600 flex items-center gap-1.5">
                <Clock size={13} />
                {at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                <span className="text-gray-400">·</span>
                <span className={pos.altitude > 0 ? 'text-amber-600 font-medium' : 'text-blue-500'}>
                  {pos.altitude > 0 ? `${pos.altitude.toFixed(1)}° above horizon` : 'below horizon'}
                </span>
              </div>
            </div>
            <svg viewBox="0 0 740 190" className="w-full">
              <rect x="20" y="20" width="700" height="130" fill="#f9fafb" rx="6" />
              <line x1="20" y1="150" x2="720" y2="150" stroke="#d1d5db" strokeWidth="1.5" />
              <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2" />
              {[0, 6, 12, 18, 24].map(h => (
                <text key={h} x={(h / 24) * 700 + 20} y="172" fontSize="10" fill="#9ca3af" textAnchor="middle">{h}:00</text>
              ))}
              <line x1={sunX} y1="20" x2={sunX} y2="150" stroke="#9ca3af" strokeDasharray="3 3" strokeWidth="1" />
              <circle cx={sunX} cy={Math.min(sunY, 150)} r="7" fill={pos.altitude > 0 ? '#f59e0b' : '#93c5fd'} stroke="#fff" strokeWidth="2" />
            </svg>
            <input type="range" min={0} max={1439} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-gray-400"><span>Midnight</span><span>Noon</span><span>Midnight</span></div>
          </div>

          {/* Compass */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Direction & shadow</div>
            <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto">
              <circle cx="100" cy="100" r="86" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1.5" />
              {['N', 'E', 'S', 'W'].map((c, i) => (
                <text key={c} x={100 + 74 * Math.sin(i * Math.PI / 2)} y={104 - 74 * Math.cos(i * Math.PI / 2)} fontSize="12" fontWeight="700" fill="#6b7280" textAnchor="middle">{c}</text>
              ))}
              {pos.altitude > -6 && (
                <g transform={`rotate(${pos.azimuth} 100 100)`}>
                  <line x1="100" y1="100" x2="100" y2="38" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="100" cy="32" r="7" fill="#f59e0b" />
                </g>
              )}
              <g transform={`rotate(${shadowAz} 100 100)`}>
                <line x1="100" y1="100" x2="100" y2="52" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
              </g>
              <circle cx="100" cy="100" r="4" fill="#111827" />
            </svg>
            <div className="text-sm text-gray-700 mt-2 space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Sun azimuth</span><span className="font-medium">{pos.azimuth.toFixed(0)}° {compassDir(pos.azimuth)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shadows fall</span><span className="font-medium">{compassDir(shadowAz)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Day length</span><span className="font-medium">{times.dayLengthMin != null ? `${Math.floor(times.dayLengthMin / 60)}h ${times.dayLengthMin % 60}m` : '—'}</span></div>
            </div>
          </div>

          {/* Key times */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Sunrise size={15} className="text-amber-500" /> Key light times</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {rows.map(r => (
                <div key={r.label} className={`rounded-xl border p-3 ${/Golden/.test(r.label) ? 'border-amber-200 bg-amber-50' : /Blue/.test(r.label) ? 'border-blue-100 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="text-[11px] text-gray-500">{r.label}</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">{r.v}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <Sunset size={12} /> Times shown in this device's time zone. Golden hour = sun between −4° and +6°; blue hour = −6° to −4°.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

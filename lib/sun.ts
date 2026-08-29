/* Solar position & key light times. Pure math (SunCalc-style astronomy,
   BSD-licensed formulas) — no API, works offline. Angles in degrees,
   azimuth measured clockwise from true north. */

const rad = Math.PI / 180;
const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
const e = rad * 23.4397; // obliquity of the Earth

const toJulian = (date: Date) => date.getTime() / dayMs - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs);
const toDays = (date: Date) => toJulian(date) - J2000;

const rightAscension = (l: number, b: number) =>
  Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l: number, b: number) =>
  Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));

const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
function eclipticLongitude(M: number) {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372; // perihelion of the Earth
  return M + C + P + Math.PI;
}
function sunCoords(d: number) {
  const M = solarMeanAnomaly(d), L = eclipticLongitude(M);
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}
const siderealTime = (d: number, lw: number) => rad * (280.16 + 360.9856235 * d) - lw;

export function sunPosition(date: Date, lat: number, lon: number) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(date);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi));
  return { altitude: altitude / rad, azimuth: (azSouth / rad + 180 + 360) % 360 };
}

// ── Times ──
const J0 = 0.0009;
const julianCycle = (d: number, lw: number) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, M: number, L: number) =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
function hourAngle(h: number, phi: number, dec: number) {
  const cosH = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return NaN; // sun never reaches this altitude today
  return Math.acos(cosH);
}

export type SunTimes = {
  solarNoon: Date; nadir: Date;
  sunrise: Date | null; sunset: Date | null;
  firstLight: Date | null; lastLight: Date | null;       // civil dawn/dusk, −6°
  goldenEndAM: Date | null; goldenStartPM: Date | null;  // sun at +6°
  blueEndAM: Date | null; blueStartPM: Date | null;      // sun at −4°
  dayLengthMin: number | null;
};

export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  const lw = rad * -lon, phi = rad * lat;
  const d = toDays(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M);
  const Jnoon = solarTransitJ(ds, M, L);

  const pair = (hDeg: number): [Date | null, Date | null] => {
    const w = hourAngle(hDeg * rad, phi, declination(L, 0));
    if (isNaN(w)) return [null, null];
    const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
    return [fromJulian(2 * Jnoon - Jset), fromJulian(Jset)]; // [morning, evening]
  };

  const [sunrise, sunset] = pair(-0.833);
  const [firstLight, lastLight] = pair(-6);
  const [blueEndAM, blueStartPM] = pair(-4);
  const [goldenEndAM, goldenStartPM] = pair(6);

  return {
    solarNoon: fromJulian(Jnoon),
    nadir: fromJulian(Jnoon - 0.5),
    sunrise, sunset, firstLight, lastLight, blueEndAM, blueStartPM, goldenEndAM, goldenStartPM,
    dayLengthMin: sunrise && sunset ? Math.round((sunset.getTime() - sunrise.getTime()) / 60000) : null,
  };
}

export const fmtTime = (d: Date | null) =>
  d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';

export function compassDir(az: number) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(az / 22.5) % 16];
}

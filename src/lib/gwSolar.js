/**
 * Solar position + terminator math for the Global Watch tool. Pure functions,
 * no deps, fully offline — ported from the standalone GLOBALWATCH dashboard
 * (~/workspace/aws/watchfloor-dashboard), unchanged.
 *
 * Returns the subsolar point and a night-region polygon for an equirectangular
 * map, a moon-phase estimate, sunrise/sunset for a lat/lon, and the next DST
 * transition for an IANA zone.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// Days since J2000.0 epoch for a given Date.
function julianDays(date) {
  return date.getTime() / 86400000 - 10957.5;
}

// Subsolar point: the lat/lon where the sun is directly overhead right now.
export function subsolarPoint(date) {
  const d = julianDays(date);
  const g = (357.529 + 0.98560028 * d) % 360; // mean anomaly
  const q = (280.459 + 0.98564736 * d) % 360; // mean longitude
  const L = (q + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD)) % 360; // ecliptic lon
  const e = 23.439 - 0.00000036 * d; // obliquity

  // Solar declination
  const dec = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) * DEG;

  // Equation of time (minutes) -> subsolar longitude
  const RA = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) * DEG;
  let eqTime = q - RA;
  if (eqTime > 180) eqTime -= 360;
  if (eqTime < -180) eqTime += 360;
  eqTime *= 4; // degrees -> minutes

  // UTC fractional hours
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lon = -15 * (utcH - 12 + eqTime / 60);
  lon = ((lon + 180) % 360 + 360) % 360 - 180;

  return { lat: dec, lon };
}

// For a given longitude, the latitude of the terminator (where sun is at horizon).
// Returns the boundary latitude; combined with sun declination sign we know which
// side is night.
function terminatorLat(lonDeg, sunLat, sunLon) {
  const lat = sunLat * RAD;
  const h = (lonDeg - sunLon) * RAD; // hour angle
  // tan(termLat) = -cos(h) / tan(decl)
  const t = -Math.cos(h) / Math.tan(lat);
  return Math.atan(t) * DEG;
}

// Build an SVG polygon (in lon/lat space, lon -180..180, lat 90..-90) covering
// the night hemisphere. Sampled across longitudes.
export function nightPolygon(date, samples = 240) {
  const sun = subsolarPoint(date);
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const lon = -180 + (360 * i) / samples;
    pts.push([lon, terminatorLat(lon, sun.lat, sun.lon)]);
  }
  // The night side is the hemisphere away from the sun. If the sun is in the
  // northern hemisphere (summer N), the south pole is in 24h day on the lit side
  // and the north pole is lit — night wraps the opposite pole. We close the
  // polygon along the pole that is currently in night.
  const nightPole = sun.lat >= 0 ? -90 : 90;
  const poly = [...pts];
  poly.push([180, nightPole]);
  poly.push([-180, nightPole]);
  return { points: poly, sun };
}

// Moon phase. Returns the illuminated fraction (0..1), the phase age in days,
// a phase name, and a waxing/waning flag. Based on the synodic month length
// measured from a known new moon (2000-01-06 18:14 UTC).
const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86400000; // days

export function moonPhase(date) {
  const days = date.getTime() / 86400000;
  let age = (days - KNOWN_NEW_MOON) % SYNODIC;
  if (age < 0) age += SYNODIC;

  const frac = age / SYNODIC; // 0 = new, 0.5 = full
  // Illuminated fraction of the disk.
  const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  const waxing = frac < 0.5;

  let name;
  if (age < 1.0) name = "NEW MOON";
  else if (age < 6.4) name = "WAXING CRESCENT";
  else if (age < 8.4) name = "FIRST QUARTER";
  else if (age < 13.8) name = "WAXING GIBBOUS";
  else if (age < 15.8) name = "FULL MOON";
  else if (age < 21.1) name = "WANING GIBBOUS";
  else if (age < 23.1) name = "LAST QUARTER";
  else if (age < 28.5) name = "WANING CRESCENT";
  else name = "NEW MOON";

  return { age, illum, waxing, name, frac };
}

// Sunrise / sunset / solar noon for a lat/lon on a given date.
// Returns UTC Date objects (or null for polar day/night), using the standard
// sunrise equation. `zenith` defaults to 90.833° (geometric + refraction);
// pass 96° for civil twilight.
export function sunTimes(date, lat, lon, zenith = 90.833) {
  const rad = Math.PI / 180;
  const N = dayOfYear(date);

  function event(rising) {
    const lngHour = lon / 15;
    const t = N + ((rising ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = ((RA % 360) + 360) % 360;
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH =
      (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1) return null; // sun never rises (polar night)
    if (cosH < -1) return null; // sun never sets (polar day)
    let H = rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H /= 15;
    const T = H + RA - 0.06571 * t - 6.622;
    let UT = (T - lngHour) % 24;
    UT = ((UT % 24) + 24) % 24;
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCMinutes(Math.round(UT * 60));
    return d;
  }

  return { sunrise: event(true), sunset: event(false) };
}

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000,
  );
}

// Next DST transition for a timezone, searching forward from `from` up to ~13
// months. Returns { date, forward } where forward=true means clocks spring
// ahead, or null if the zone has no upcoming transition (no DST).
export function nextDstTransition(tz, from) {
  function offsetMin(d) {
    const s =
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value || "GMT+0";
    const m = s.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
  }

  const DAY = 86400000;
  let lo = from.getTime();
  const baseOff = offsetMin(new Date(lo));
  const limit = lo + 400 * DAY;

  // Coarse daily scan to find the day the offset changes.
  let changeDay = null;
  for (let t = lo + DAY; t <= limit; t += DAY) {
    if (offsetMin(new Date(t)) !== baseOff) {
      changeDay = t;
      break;
    }
  }
  if (changeDay === null) return null;

  // Binary-search to the hour within that 24h window.
  let a = changeDay - DAY;
  let b = changeDay;
  while (b - a > 3600000) {
    const mid = a + Math.floor((b - a) / 2);
    if (offsetMin(new Date(mid)) === baseOff) a = mid;
    else b = mid;
  }
  const after = offsetMin(new Date(b));
  return { date: new Date(b), forward: after > baseOff };
}

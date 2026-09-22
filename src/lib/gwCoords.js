/**
 * Approximate representative coordinates for IANA timezones, used to place map
 * pins on the Global Watch tool. Falls back to deriving longitude from the
 * zone's UTC offset when the specific zone isn't in the table, so any added
 * zone still gets a pin. Ported from the standalone GLOBALWATCH dashboard
 * (~/workspace/aws/watchfloor-dashboard), unchanged.
 */

export const ZONE_COORDS = {
  UTC: { lat: 0, lon: 0 },
  "America/New_York": { lat: 40.7, lon: -74.0 },
  "America/Chicago": { lat: 41.8, lon: -87.6 },
  "America/Denver": { lat: 39.7, lon: -104.9 },
  "America/Los_Angeles": { lat: 34.0, lon: -118.2 },
  "America/Anchorage": { lat: 61.2, lon: -149.9 },
  "America/Sao_Paulo": { lat: -23.5, lon: -46.6 },
  "America/Mexico_City": { lat: 19.4, lon: -99.1 },
  "America/Toronto": { lat: 43.7, lon: -79.4 },
  "America/Bogota": { lat: 4.6, lon: -74.1 },
  "America/Argentina/Buenos_Aires": { lat: -34.6, lon: -58.4 },
  "Europe/London": { lat: 51.5, lon: -0.1 },
  "Europe/Paris": { lat: 48.9, lon: 2.4 },
  "Europe/Berlin": { lat: 52.5, lon: 13.4 },
  "Europe/Madrid": { lat: 40.4, lon: -3.7 },
  "Europe/Rome": { lat: 41.9, lon: 12.5 },
  "Europe/Moscow": { lat: 55.8, lon: 37.6 },
  "Europe/Istanbul": { lat: 41.0, lon: 29.0 },
  "Europe/Kyiv": { lat: 50.5, lon: 30.5 },
  "Africa/Cairo": { lat: 30.0, lon: 31.2 },
  "Africa/Johannesburg": { lat: -26.2, lon: 28.0 },
  "Africa/Lagos": { lat: 6.5, lon: 3.4 },
  "Africa/Nairobi": { lat: -1.3, lon: 36.8 },
  "Asia/Dubai": { lat: 25.2, lon: 55.3 },
  "Asia/Tehran": { lat: 35.7, lon: 51.4 },
  "Asia/Karachi": { lat: 24.9, lon: 67.0 },
  "Asia/Kolkata": { lat: 28.6, lon: 77.2 },
  "Asia/Dhaka": { lat: 23.8, lon: 90.4 },
  "Asia/Bangkok": { lat: 13.8, lon: 100.5 },
  "Asia/Jakarta": { lat: -6.2, lon: 106.8 },
  "Asia/Singapore": { lat: 1.35, lon: 103.8 },
  "Asia/Shanghai": { lat: 31.2, lon: 121.5 },
  "Asia/Hong_Kong": { lat: 22.3, lon: 114.2 },
  "Asia/Seoul": { lat: 37.6, lon: 127.0 },
  "Asia/Tokyo": { lat: 35.7, lon: 139.7 },
  "Australia/Perth": { lat: -31.9, lon: 115.9 },
  "Australia/Sydney": { lat: -33.9, lon: 151.2 },
  "Pacific/Auckland": { lat: -36.8, lon: 174.8 },
  "Pacific/Honolulu": { lat: 21.3, lon: -157.9 },
};

// Derive a rough lon from the zone's current UTC offset (15° per hour) and a
// plausible mid-latitude so unknown zones still pin somewhere sensible.
function fromOffset(tz) {
  try {
    const s =
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || "GMT+0";
    const m = s.match(/GMT([+-]?\d{1,2})(?::?(\d{2}))?/);
    if (!m) return { lat: 0, lon: 0 };
    const h = parseInt(m[1], 10) + (m[2] ? Number(m[2]) / 60 : 0);
    return { lat: 20, lon: Math.max(-180, Math.min(180, h * 15)) };
  } catch {
    return { lat: 0, lon: 0 };
  }
}

export function coordsFor(tz) {
  return ZONE_COORDS[tz] || fromOffset(tz);
}

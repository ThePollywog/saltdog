/**
 * Timezone utilities for the Global Watch tool, built on the Intl API — no
 * external deps, fully offline. Ported from the standalone GLOBALWATCH
 * dashboard (~/workspace/aws/watchfloor-dashboard), unchanged.
 */

// Full list of IANA zones if the runtime supports it; otherwise a solid fallback.
export function supportedZones() {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_ZONES;
}

const partsCache = new Map();
function fmt(tz, opts) {
  const key = tz + JSON.stringify(opts);
  let f = partsCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts });
    partsCache.set(key, f);
  }
  return f;
}

// Returns { hh, mm, ss, hour24, weekday, date, offset } for a given zone + Date.
export function zoneTime(tz, now, hourFormat = 24, showSeconds = true) {
  const parts = fmt(tz, {
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
    hour12: hourFormat === 12,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).formatToParts(now);

  const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
  const hour24 = Number(fmt(tz, { hour: "2-digit", hour12: false }).format(now).replace(/\D/g, "")) % 24;

  return {
    hh: get("hour"),
    mm: get("minute"),
    ss: get("second"),
    dayPeriod: get("dayPeriod"),
    weekday: get("weekday").toUpperCase(),
    date: `${get("day")} ${get("month")}`.toUpperCase(),
    hour24,
    offset: offsetLabel(tz, now),
  };
}

// UTC offset like "+05:30" or "-04:00"
export function offsetLabel(tz, now) {
  try {
    const s =
      fmt(tz, { timeZoneName: "shortOffset" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value || "";
    const m = s.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
    if (!m) return "UTC";
    const sign = m[1].startsWith("-") ? "-" : "+";
    const h = String(Math.abs(parseInt(m[1], 10))).padStart(2, "0");
    return `UTC${sign}${h}:${m[2] || "00"}`;
  } catch {
    return "—";
  }
}

// Day/night + workday classification for the status ring.
export function dayState(hour24, workStart, workEnd) {
  if (hour24 >= workStart && hour24 < workEnd) return "active";
  if (hour24 >= 6 && hour24 < 20) return "day";
  return "night";
}

const FALLBACK_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Tehran",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

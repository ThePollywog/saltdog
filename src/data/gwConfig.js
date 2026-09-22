/**
 * Global Watch default configuration — a curated watch list of major global
 * command/finance/ops hubs, plus clock/workday defaults. Ported from the
 * standalone GLOBALWATCH dashboard (~/workspace/aws/watchfloor-dashboard).
 *
 * Persistence differs from the source app on purpose: the standalone
 * dashboard is session-only (sessionStorage, cleared on tab close) because it
 * assumes a shared watchfloor terminal where the next operator shouldn't
 * inherit the last one's zone list. Embedded here as one tool among many on a
 * personal reference site, that assumption doesn't hold — every other tool on
 * this site persists across visits via localStorage, and someone's watch list
 * disappearing between sessions would read as a bug, not a feature. So this
 * config is saved the same way the points tracker and checklist are: see
 * GlobalWatchTool.vue's useLocalStore("globalwatch", ...) call.
 */

export const DEFAULT_CONFIG = {
  zones: [
    { id: "zulu", label: "ZULU", tz: "UTC", region: "REFERENCE" },
    { id: "dc", label: "WASHINGTON", tz: "America/New_York", region: "NORTHCOM" },
    { id: "sf", label: "SAN FRANCISCO", tz: "America/Los_Angeles", region: "PACOM-W" },
    { id: "hawaii", label: "HAWAII", tz: "Pacific/Honolulu", region: "INDOPACOM-HQ" },
    { id: "london", label: "LONDON", tz: "Europe/London", region: "EUCOM" },
    { id: "berlin", label: "BERLIN", tz: "Europe/Berlin", region: "EUCOM" },
    { id: "moscow", label: "MOSCOW", tz: "Europe/Moscow", region: "WATCH" },
    { id: "dubai", label: "DUBAI", tz: "Asia/Dubai", region: "CENTCOM" },
    { id: "delhi", label: "NEW DELHI", tz: "Asia/Kolkata", region: "INDOPACOM" },
    { id: "beijing", label: "BEIJING", tz: "Asia/Shanghai", region: "WATCH" },
    { id: "tokyo", label: "TOKYO", tz: "Asia/Tokyo", region: "INDOPACOM" },
    { id: "sydney", label: "SYDNEY", tz: "Australia/Sydney", region: "INDOPACOM" },
  ],
  selectedTz: "Europe/London", // center "selected time" panel
  hourFormat: 24, // 12 | 24
  showSeconds: true,
  workdayStart: 8, // local hour considered "active"
  workdayEnd: 18,
};

export function addZone(config, zone) {
  config.zones.push({ id: `z-${Date.now()}-${config.zones.length}`, ...zone });
}

export function removeZone(config, id) {
  const i = config.zones.findIndex((z) => z.id === id);
  if (i !== -1) config.zones.splice(i, 1);
}

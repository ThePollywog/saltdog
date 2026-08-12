/**
 * Ribbon rack layout and multiple-award device math.
 *
 * Pure functions — no Vue, no DOM, so the wear rules are testable in plain Node.
 * Planning aid only: this arranges what you tell it you have, in the precedence
 * order of the source chart. It does not know your record and cannot tell you
 * whether you rate an award.
 */
import { AWARDS, AWARD_BY_ID, MULTIPLE_DEVICE, DEVICE_BY_ID } from "../data/awards.js";

/** Precedence index by award id — position in AWARDS is the order of wear. */
const PRECEDENCE = new Map(AWARDS.map((a, i) => [a.id, i]));

/** Racks are mounted three ribbons to a row. */
export const PER_ROW = 3;

/**
 * Sort selected award ids into order of precedence.
 *
 * Unknown ids are dropped rather than sorted to the end: they can only come from
 * stale saved data (an award id that was renamed), and silently mounting an
 * unidentifiable ribbon is worse than omitting it. Callers that care get the
 * dropped list from `layoutRack().dropped`.
 */
export function sortByPrecedence(ids) {
  return [...new Set(ids)]
    .filter((id) => PRECEDENCE.has(id))
    .sort((a, b) => PRECEDENCE.get(a) - PRECEDENCE.get(b));
}

/**
 * Multiple-award devices for the nth award of a ribbon.
 *
 * The rule the chart states is uniform across star and oak-leaf devices: the
 * FIRST award carries no device, and each award after it adds one — with a silver
 * device worn in lieu of five of the lesser ones. So 6 awards is 5 devices, which
 * is one silver, not five bronze plus a silver.
 *
 * Two awards are special-cased because their device isn't a star:
 *   - AFRM: an hourglass per succeeding award (bronze/silver/gold by decade, but
 *     the chart doesn't state the colours, so only the count is claimed here).
 *   - Navy "E": one Battle "E" per award up to the third; the fourth and beyond
 *     are a single silver-wreathed "E" instead.
 *
 * @param {string} awardId
 * @param {number} count total awards held (1 = the award itself, no device)
 * @returns {{deviceId: string|null, silver: number, lesser: number, total: number, note?: string}}
 */
export function devicesFor(awardId, count) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const deviceId = MULTIPLE_DEVICE[awardId] ?? null;
  if (!deviceId) return { deviceId, silver: 0, lesser: 0, total: 0 };

  if (deviceId === "battle-e") {
    // The Navy "E" breaks the first-award-is-bare rule twice over: the chart
    // authorizes one device "for each award, up to the third", so a SINGLE award
    // already carries one device — and the fourth REPLACES the stack rather than
    // substituting five-for-one. Handled before the n < 2 bail-out for that
    // reason; folding it in with the stars zeroes the single-award case.
    if (n >= 4) {
      return {
        deviceId,
        silver: 1,
        lesser: 0,
        total: 1,
        note: 'Fourth and subsequent awards are a single silver-wreathed "E".',
      };
    }
    return { deviceId, silver: 0, lesser: n, total: n };
  }

  if (n < 2) return { deviceId, silver: 0, lesser: 0, total: 0 };

  if (deviceId === "hourglass") {
    return { deviceId, silver: 0, lesser: n - 1, total: n - 1 };
  }

  if (deviceId === "wintered-over") {
    // Bronze, gold, then silver — one per winter, not a substitution ladder.
    return {
      deviceId,
      silver: 0,
      lesser: Math.min(n - 1, 3),
      total: Math.min(n - 1, 3),
      note: "Bronze for the first winter, gold for the second, silver for the third.",
    };
  }

  const marks = n - 1;
  const silver = Math.floor(marks / 5);
  const lesser = marks % 5;
  return { deviceId, silver, lesser, total: silver + lesser };
}

/**
 * Build the rack.
 *
 * ROW ORDER IS THE THING TO GET RIGHT. A rack is worn with the senior ribbon top
 * left, and it is built from the BOTTOM up: when the count isn't a multiple of
 * three, the short row is the TOP one, and it is centred. So 7 ribbons is a top
 * row of 1 (the most senior award, alone and centred) over two full rows of 3 —
 * not 3/3/1. Laying it out top-down puts the junior awards in the short row and
 * gets every non-multiple-of-three rack wrong.
 *
 * @param {Array<string|{id: string, count?: number}>} selection
 * @returns {{rows: object[][], items: object[], dropped: string[], total: number}}
 *   `rows` is top row first, ready to render. Each item carries the award, its
 *   count, and its computed devices.
 */
export function layoutRack(selection) {
  const counts = new Map();
  const requested = [];
  for (const entry of selection ?? []) {
    const id = typeof entry === "string" ? entry : entry?.id;
    if (!id) continue;
    requested.push(id);
    const c = typeof entry === "object" ? entry.count : 1;
    counts.set(id, Math.max(1, Math.floor(Number(c) || 1)));
  }

  const ordered = sortByPrecedence(requested);
  const dropped = [...new Set(requested)].filter((id) => !PRECEDENCE.has(id));

  const items = ordered.map((id) => {
    const award = AWARD_BY_ID.get(id);
    const count = counts.get(id) ?? 1;
    const devices = devicesFor(id, count);
    return {
      id,
      award,
      count,
      devices,
      device: devices.deviceId ? DEVICE_BY_ID.get(devices.deviceId) : null,
      precedence: PRECEDENCE.get(id) + 1,
    };
  });

  // Build bottom-up so the remainder lands on the top row, then reverse.
  const bottomUp = [];
  for (let i = items.length; i > 0; i -= PER_ROW) {
    bottomUp.push(items.slice(Math.max(0, i - PER_ROW), i));
  }
  const rows = bottomUp.reverse();

  return { rows, items, dropped, total: items.length };
}

/**
 * Sprite offset for an award, in CSS pixels at the given rendered ribbon width.
 *
 * The sheet is a single column of tiles, so only the Y offset varies. Scaling is
 * derived from the tile aspect rather than hard-coded so a re-generated sheet at
 * a different tile size doesn't need this touched.
 */
export function spriteStyle(award, widthPx = 88) {
  const TILE_W = 176;
  const TILE_H = 56;
  const scale = widthPx / TILE_W;
  return {
    width: `${widthPx}px`,
    height: `${TILE_H * scale}px`,
    backgroundImage: "url(./img/ribbons.png)",
    backgroundSize: `${widthPx}px auto`,
    backgroundPosition: `0 -${award.sprite * TILE_H * scale}px`,
    backgroundRepeat: "no-repeat",
  };
}

/**
 * One-line human summary of an item's devices, for the list and for alt text.
 * Returns null when there's nothing to say, so callers can skip the element
 * rather than render an empty one.
 */
export function deviceSummary(item) {
  const { devices, device } = item;
  if (!device || devices.total === 0) return null;
  const name = (n) =>
    n === 1 ? (device.noun ?? device.name.toLowerCase()) : (device.plural ?? device.noun);
  const parts = [];
  if (devices.silver) parts.push(`${devices.silver} silver ${name(devices.silver)}`);
  if (devices.lesser) {
    // Only two-colour devices get a colour word. The hourglass and Battle "E"
    // have no bronze/silver distinction, so naming one would be an invention.
    const colour = device.lesserColour ? `${device.lesserColour} ` : "";
    parts.push(`${devices.lesser} ${colour}${name(devices.lesser)}`);
  }
  return parts.join(" + ");
}

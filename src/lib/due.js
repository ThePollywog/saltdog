/**
 * Turns the checklist's `due` descriptors into actual dates — and into an .ics
 * file you can put on a real calendar.
 *
 * WHY THIS EXISTS. The checklist knew what you had to do and the points tracker
 * knew your anniversary year, and neither one ever said "your PHA is due in 43
 * days." A list of obligations sorted by cadence is a reference; the same list
 * sorted by how soon it bites is a plan, and the difference is entirely date math
 * this app already had the inputs for.
 *
 * Pure, and pure on purpose: no DOM, no storage, no Vue. The tool component reads
 * the two existing stores (`checklist` for completion dates, `points` for the
 * anniversary) and hands them in as plain data, so every rule below is testable in
 * plain Node.
 *
 * FOUR THINGS HERE ARE EASY TO GET WRONG, so each is handled explicitly:
 *
 *  1. `new Date("2026-08-12")` parses as UTC midnight. West of Greenwich that is
 *     the 11th once rendered locally — every date in this file would be a day
 *     early for most of the United States. `parseISO` builds a LOCAL date from the
 *     parts instead, and nothing here ever hands an ISO string to the Date
 *     constructor.
 *
 *  2. `setMonth` overflows. A PHA completed 31 January plus one month is 3 March
 *     by JavaScript's arithmetic, because February has no 31st. `addMonths` clamps
 *     to the last valid day of the target month, which is what "monthly" means to
 *     a human.
 *
 *  3. Day counts across a DST boundary are not 24 hours apart. `daysBetween`
 *     compares calendar days via Date.UTC on the y/m/d parts, so a spring-forward
 *     week is still seven days.
 *
 *  4. An unknown due date is not a due date of today. Anything whose basis needs
 *     an anchor the user has not given returns `needs-anchor` and NO date, because
 *     a readiness tool that invents a deadline and renders it in the same red as a
 *     real one has done something worse than staying quiet.
 */
import { anniversaryWindow } from "./points.js";

/**
 * How early "due soon" starts, by recurrence interval in months.
 *
 * Not one global window, because the same number is wrong at both ends: 60 days
 * of warning on a task you do monthly means it is always amber, and 7 days on a
 * PHA is useless when the appointment itself takes three weeks to get.
 */
const WARN_DAYS = { 1: 7, 3: 21, 12: 60 };

/** Fallback for an interval not in the table above. */
function warnDaysFor(months, override) {
  if (Number.isFinite(override) && override > 0) return Math.round(override);
  if (WARN_DAYS[months]) return WARN_DAYS[months];
  return Math.min(60, Math.max(7, Math.round(months * 5)));
}

/** "YYYY-MM-DD" -> local midnight Date, or null. Never uses `new Date(str)`. */
export function parseISO(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  // Rejects 2026-02-31 rather than silently rolling it into March.
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Local Date -> "YYYY-MM-DD". Deliberately not toISOString(), same reason. */
export function toISO(date) {
  if (!(date instanceof Date) || Number.isNaN(+date)) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Days in a month, 1-indexed month. */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Add whole months, clamping the day to the target month's length. */
export function addMonths(date, months) {
  const y = date.getFullYear();
  const m = date.getMonth() + months; // may be out of 0..11; Date handles the roll
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth + 1));
  return new Date(targetYear, targetMonth, day);
}

/** Whole calendar days from `a` to `b`; DST-safe because it compares y/m/d. */
export function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

/**
 * The next occurrence of `MM-DD` on or after `from` — the fiscal-year deadline.
 *
 * On-or-after, not strictly after: 30 September is still your AT deadline on 30
 * September. Rolling to next year on the day itself would tell someone with an
 * unmet requirement that they have twelve months left.
 */
export function nextMonthDay(monthDay, from) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(monthDay ?? "").trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const candidate = new Date(from.getFullYear(), month - 1, day);
  if (daysBetween(from, candidate) >= 0) return candidate;
  return new Date(from.getFullYear() + 1, month - 1, day);
}

/**
 * @typedef {object} DueStatus
 * @property {string} itemId
 * @property {string|null} basis
 * @property {Date|null} dueDate
 * @property {string|null} dueISO
 * @property {number|null} daysUntil   negative when overdue
 * @property {number|null} warnDays
 * @property {string|null} completedISO
 * @property {"overdue"|"due-soon"|"ok"|"needs-anchor"|"unscheduled"} status
 * @property {string} reason           plain-language why, for the UI and for a11y
 * @property {number|null} intervalMonths  recurrence, for the .ics RRULE
 */

/**
 * Resolve one checklist item's due date.
 *
 * @param {object} item     a checklist item — needs `id`, may have `due`
 * @param {object} ctx
 * @param {Record<string,string>} [ctx.completions]  itemId -> "YYYY-MM-DD"
 * @param {string} [ctx.anniversaryMonthDay]         "MM-DD", from the points store
 * @param {Date}   [ctx.today]
 * @param {string} [ctx.cadence]  the group's own cadence, used as the honest
 *                                explanation for an item with no `due` at all
 * @returns {DueStatus}
 */
export function dueFor(item, ctx = {}) {
  const today = ctx.today instanceof Date && !Number.isNaN(+ctx.today) ? ctx.today : new Date();
  const completedISO = ctx.completions?.[item?.id] ?? null;
  const completed = parseISO(completedISO);

  const base = {
    itemId: item?.id ?? null,
    basis: item?.due?.basis ?? null,
    dueDate: null,
    dueISO: null,
    daysUntil: null,
    warnDays: null,
    completedISO: completed ? completedISO : null,
    intervalMonths: null,
  };

  const due = item?.due;
  if (!due?.basis) {
    return {
      ...base,
      status: "unscheduled",
      // The cadence sentence the group already carries ("Each drill weekend",
      // "When it happens") is a better answer than a fabricated date, and it is
      // the reason there is no date rather than an apology for its absence.
      reason: ctx.cadence
        ? `${ctx.cadence} — not a fixed calendar date.`
        : "No fixed calendar date; driven by events, not by a schedule.",
    };
  }

  let dueDate = null;
  let intervalMonths = null;
  let reason = "";

  if (due.basis === "completion") {
    intervalMonths = Number(due.months) || 12;
    if (!completed) {
      return {
        ...base,
        intervalMonths,
        warnDays: warnDaysFor(intervalMonths, due.warn),
        status: "needs-anchor",
        reason:
          "Check this off once with the date you last did it, and the next due " +
          "date is computed from there.",
      };
    }
    dueDate = addMonths(completed, intervalMonths);
    reason = `${intervalMonths} month${intervalMonths === 1 ? "" : "s"} after ${completedISO}.`;
  } else if (due.basis === "anniversary") {
    intervalMonths = 12;
    const win = anniversaryWindow(ctx.anniversaryMonthDay, today);
    if (!win) {
      return {
        ...base,
        intervalMonths,
        warnDays: warnDaysFor(12, due.warn),
        status: "needs-anchor",
        reason:
          "Needs your RC anniversary date — set it in the Points & Good Years " +
          "tool and this starts tracking.",
      };
    }
    // Done since the current anniversary year opened? Then the next anniversary
    // is the deadline. Otherwise the one that already passed is, and this reads
    // as overdue — which it is.
    const doneThisYear = completed && daysBetween(win.start, completed) >= 0;
    dueDate = doneThisYear
      ? new Date(win.start.getFullYear() + 1, win.start.getMonth(), win.start.getDate())
      : win.start;
    reason = doneThisYear
      ? `Next RC anniversary; the current year opened ${toISO(win.start)}.`
      : `Due at the RC anniversary that opened ${toISO(win.start)}.`;
  } else if (due.basis === "fiscalYear") {
    intervalMonths = 12;
    if (completed) {
      // Completing inside a fiscal year satisfies THAT year; the deadline moves
      // to the next one, which is exactly one year past the deadline the
      // completion fell before.
      const satisfied = nextMonthDay(due.monthDay, completed);
      dueDate = satisfied
        ? new Date(satisfied.getFullYear() + 1, satisfied.getMonth(), satisfied.getDate())
        : null;
      reason = `Fiscal-year requirement; ${toISO(satisfied)} was met on ${completedISO}.`;
    } else {
      dueDate = nextMonthDay(due.monthDay, today);
      reason = "Fiscal-year deadline — it arrives whether or not anything is checked off.";
    }
  } else {
    // An unrecognized basis is a data bug, and it should look like one rather
    // than quietly becoming "no schedule".
    return {
      ...base,
      status: "needs-anchor",
      reason: `Unknown due basis "${due.basis}".`,
    };
  }

  if (!dueDate) {
    return { ...base, intervalMonths, status: "needs-anchor", reason: reason || "Cannot compute." };
  }

  const daysUntil = daysBetween(today, dueDate);
  const warnDays = warnDaysFor(intervalMonths, due.warn);
  const status = daysUntil < 0 ? "overdue" : daysUntil <= warnDays ? "due-soon" : "ok";

  return {
    ...base,
    basis: due.basis,
    dueDate,
    dueISO: toISO(dueDate),
    daysUntil,
    warnDays,
    intervalMonths,
    status,
    reason,
  };
}

/** Sort weight — the order someone actually wants to read this in. */
const STATUS_ORDER = { overdue: 0, "due-soon": 1, ok: 2, "needs-anchor": 3, unscheduled: 4 };

/**
 * Resolve every item in every group, flattened and sorted by urgency.
 *
 * @param {Array<{id:string,heading:string,cadence?:string,items:object[]}>} groups
 */
export function buildSchedule(groups, ctx = {}) {
  const rows = [];
  for (const group of groups ?? []) {
    for (const item of group.items ?? []) {
      rows.push({
        ...dueFor(item, { ...ctx, cadence: group.cadence }),
        item,
        groupId: group.id,
        groupHeading: group.heading,
      });
    }
  }

  rows.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    // Within a status, soonest first. Undated rows keep their source order,
    // which is the cadence order the checklist was written in.
    if (a.daysUntil == null || b.daysUntil == null) return 0;
    return a.daysUntil - b.daysUntil;
  });

  return rows;
}

/** Counts per status, for the summary strip. */
export function summarizeSchedule(rows) {
  const counts = { overdue: 0, "due-soon": 0, ok: 0, "needs-anchor": 0, unscheduled: 0 };
  for (const r of rows ?? []) {
    if (counts[r.status] != null) counts[r.status] += 1;
  }
  return {
    ...counts,
    scheduled: counts.overdue + counts["due-soon"] + counts.ok,
    total: (rows ?? []).length,
  };
}

// --- .ics export ----------------------------------------------------------
//
// Hand-rolled rather than pulled from a library, for the same reason the orb is
// hand-rolled: the whole file is about eighty lines and the alternative is a
// dependency in a bundle that has a 200 KB budget. RFC 5545 has three
// requirements that are easy to skip and visibly break strict parsers — CRLF line
// endings, 75-octet line folding, and escaped text values — so all three are
// implemented and tested rather than assumed.

/** Escape an RFC 5545 TEXT value. Order matters: backslash first. */
function escapeText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to 75 octets per line with a leading space on continuations.
 *
 * Counted in UTF-8 BYTES, not characters — the spec's limit is octets, and the
 * em-dashes and "→" that this site's copy is full of are three bytes each. A
 * character-counted fold looks correct in a text editor and still overruns.
 */
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte sequence: back off to a lead byte boundary.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push(new TextDecoder().decode(bytes.subarray(start, end)));
    start = end;
    limit = 74; // continuation lines lose an octet to the leading space
  }
  return out.join("\r\n ");
}

/** "YYYYMMDD" for a DATE value. */
function icsDate(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
}

/** UTC "YYYYMMDDTHHMMSSZ" for DTSTAMP. */
function icsStamp(date) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}

/** RRULE for a recurrence interval in months. */
function rruleFor(months) {
  if (months === 12) return "FREQ=YEARLY";
  if (months === 1) return "FREQ=MONTHLY";
  if (months > 0 && months < 12) return `FREQ=MONTHLY;INTERVAL=${months}`;
  return null;
}

export const ICS_FILENAME = "saltdog-readiness.ics";

/**
 * Build an .ics calendar from schedule rows.
 *
 * Only rows with a real date are exported. `needs-anchor` and `unscheduled` rows
 * are skipped and reported back in `skipped`, so the UI can say how many were
 * left out — silently exporting 14 of 31 items would read as "everything's on
 * your calendar now", which is the one impression this must not create.
 *
 * @param {object[]} rows       output of buildSchedule()
 * @param {object} [opts]
 * @param {Date} [opts.stamp]   DTSTAMP; injectable so tests are deterministic
 * @param {boolean} [opts.alarms=true]  include a VALARM at the warn window
 * @returns {{ics:string, exported:number, skipped:number}}
 */
export function buildIcs(rows, opts = {}) {
  const stamp = opts.stamp instanceof Date && !Number.isNaN(+opts.stamp) ? opts.stamp : new Date();
  const alarms = opts.alarms !== false;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SALTDOG//Navy Reserve Readiness//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Navy Reserve readiness",
  ];

  let exported = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    if (!row?.dueDate) {
      skipped += 1;
      continue;
    }

    const label = row.item?.label ?? row.itemId;
    const desc = [
      row.reason,
      row.item?.note ?? "",
      "Planning aid from SALTDOG. Confirm dates with your NOSC — the record of truth is the system, not this calendar.",
    ]
      .filter(Boolean)
      .join("\n\n");

    lines.push("BEGIN:VEVENT");
    // Stable UID, so re-importing updates the event instead of duplicating it.
    // Keyed on the item id, which data/checklist.js guarantees is permanent.
    lines.push(`UID:saltdog-${row.itemId}@saltdog.invalid`);
    lines.push(`DTSTAMP:${icsStamp(stamp)}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(row.dueDate)}`);
    // All-day events are half-open in RFC 5545: DTEND is the day AFTER. Using
    // the same date as DTSTART yields a zero-length event that some clients
    // drop entirely and others render on the wrong day.
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDays(row.dueDate, 1))}`);
    lines.push(`SUMMARY:${escapeText(`${label} — due`)}`);
    lines.push(`DESCRIPTION:${escapeText(desc)}`);
    lines.push("TRANSP:TRANSPARENT");
    lines.push("CATEGORIES:Navy Reserve readiness");

    const rrule = rruleFor(row.intervalMonths ?? 0);
    if (rrule) lines.push(`RRULE:${rrule}`);

    if (alarms && row.warnDays) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      // The same window the page paints amber, so the calendar and the site
      // agree about what "due soon" means.
      lines.push(`TRIGGER:-P${row.warnDays}D`);
      lines.push(`DESCRIPTION:${escapeText(`${label} — due in ${row.warnDays} days`)}`);
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
    exported += 1;
  }

  lines.push("END:VCALENDAR");

  // CRLF throughout, and a trailing CRLF: both are required, and both are what
  // a naive join() gets wrong.
  return { ics: lines.map(fold).join("\r\n") + "\r\n", exported, skipped };
}

/** Add whole days. Used only for the half-open DTEND above. */
function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

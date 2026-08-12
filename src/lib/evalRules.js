/**
 * EVAL/FITREP due-date derivation from the reporting calendar.
 *
 * Everything here is DERIVED from the published rules, not an authoritative
 * date. The UI labels it as such: reporting windows shift, and special reports
 * (detachment, promotion, frocking) fall outside the regular cycle entirely.
 */
import { RULES, SCHEDULE } from "../data/evalCalendar.js";

const MONTH_NAMES = SCHEDULE.map((s) => s.month);

/** Days in a month, for the officer "last day of the month" rule. */
function daysInMonth(monthIndex, year) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** paygrade -> { monthIndex, month, tier } built once from the schedule. */
const INDEX = (() => {
  const map = new Map();
  SCHEDULE.forEach((entry, monthIndex) => {
    for (const g of entry.officer) {
      map.set(g.toUpperCase(), { monthIndex, month: entry.month, tier: "officer" });
    }
    for (const g of entry.enlisted) {
      map.set(g.toUpperCase(), { monthIndex, month: entry.month, tier: "enlisted" });
    }
  });
  return map;
})();

/** Every paygrade the calendar covers, in natural order. */
export const COVERED_PAYGRADES = [
  ...["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"],
  ...["W1", "W2", "W3", "W4", "W5"],
  ...["O1", "O2", "O3", "O4", "O5", "O6"],
].filter((g) => INDEX.has(g));

/** Flag grades exist but are absent from this calendar — handled explicitly. */
export const FLAG_PAYGRADES = ["O7", "O8", "O9", "O10"];

/** Accept "E-5", "e5", " E 5 " -> "E5". */
export function canonicalPaygrade(input) {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Look up a paygrade's reporting month and derived due dates.
 *
 * @param {string} paygrade e.g. "E6", "O-3", "W2"
 * @param {number} [year] reference year for the day-count; defaults to now
 * @returns {{status:'ok'|'flag'|'unknown', ...}}
 */
export function lookupPaygrade(paygrade, year) {
  const grade = canonicalPaygrade(paygrade);
  if (!grade) return { status: "unknown", grade, reason: "empty" };

  if (FLAG_PAYGRADES.includes(grade)) {
    return {
      status: "flag",
      grade,
      message:
        "Flag officers (O7–O10) are not on this calendar — they report on a different cycle. See your reporting senior.",
    };
  }

  const hit = INDEX.get(grade);
  if (!hit) {
    return {
      status: "unknown",
      grade,
      reason: "not-in-calendar",
      message: `${grade} is not in the published reporting calendar. Covered: E1–E9, W1–W5, O1–O6.`,
    };
  }

  const refYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const { monthIndex, month, tier } = hit;

  // Officer FITREPs are due the last day of the reporting month; enlisted
  // EVALs the 15th.
  const reportDay = tier === "officer" ? daysInMonth(monthIndex, refYear) : 15;

  // Counseling is due six months before the END of the reporting period.
  const counselingIndex = (monthIndex + 12 - 6) % 12;

  return {
    status: "ok",
    grade,
    tier,
    month,
    monthIndex,
    reportDue: {
      month,
      day: reportDay,
      rule:
        tier === "officer"
          ? "Officer FITREPs are due the last day of the reporting month."
          : "Enlisted EVALs are due the 15th of the reporting month.",
    },
    counseling: {
      month: MONTH_NAMES[counselingIndex],
      rule: "Counseling is due six months before the end of the reporting period.",
    },
    rules: RULES,
  };
}

/** Which paygrades report in a given month name. */
export function reportsInMonth(month) {
  const want = String(month ?? "").toLowerCase();
  return SCHEDULE.find((s) => s.month.toLowerCase() === want) ?? null;
}

/** Months with no scheduled reports, rendered explicitly rather than as blanks. */
export const EMPTY_MONTHS = SCHEDULE.filter(
  (s) => s.officer.length === 0 && s.enlisted.length === 0,
).map((s) => s.month);

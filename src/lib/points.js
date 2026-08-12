/**
 * Retirement point / good-year math for the SELRES tracker.
 *
 * Anniversary-year based, NOT fiscal or calendar year. A reservist's
 * "anniversary year" runs from their pay-entry/RC anniversary date, and using
 * the fiscal year instead is the classic bug in tools like this — it silently
 * mis-bins points near the year boundary.
 *
 * Planning aid only. NSIPS ESR (the Annual Retirement Point Record) is the
 * record of truth.
 */

/** Minimum points for a satisfactory ("good") year. */
export const GOOD_YEAR_MIN = 50;

/** Good years needed for a reserve retirement. */
export const RETIREMENT_YEARS = 20;

/** Membership points credited for a full year of SELRES participation. */
export const MEMBERSHIP_POINTS = 15;

/**
 * Annual cap on inactive-duty points (IDT + correspondence + membership).
 * Statutory cap is 130 for most years under current law; shown as guidance
 * only, and never used to silently reduce a user's entered numbers.
 */
export const INACTIVE_POINT_CAP = 130;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Total a single anniversary year.
 * @param {{idt?:number, at?:number, corr?:number, membership?:number}} year
 */
export function totalYear(year) {
  const idt = num(year?.idt);
  const at = num(year?.at);
  const corr = num(year?.corr);
  const membership = num(year?.membership ?? MEMBERSHIP_POINTS);

  const inactive = idt + corr + membership;
  const total = inactive + at;

  return {
    idt,
    at,
    corr,
    membership,
    inactive,
    total,
    isGood: total >= GOOD_YEAR_MIN,
    shortBy: Math.max(0, GOOD_YEAR_MIN - total),
    // Flag rather than clamp — the user's record is the user's record.
    overInactiveCap: inactive > INACTIVE_POINT_CAP,
  };
}

/** Roll up every tracked year. */
export function summarize(years) {
  const rows = (years ?? []).map((y) => ({ ...y, ...totalYear(y) }));
  const goodYears = rows.filter((r) => r.isGood).length;
  const totalPoints = rows.reduce((sum, r) => sum + r.total, 0);

  return {
    rows,
    goodYears,
    totalPoints,
    yearsTracked: rows.length,
    remainingToRetirement: Math.max(0, RETIREMENT_YEARS - goodYears),
    retirementEligible: goodYears >= RETIREMENT_YEARS,
    progress: Math.min(1, goodYears / RETIREMENT_YEARS),
  };
}

/**
 * The anniversary year window containing `onDate`.
 *
 * @param {string} anniversaryMonthDay "MM-DD", e.g. "10-01"
 * @param {Date} [onDate]
 * @returns {{start:Date, end:Date, label:string}|null}
 */
export function anniversaryWindow(anniversaryMonthDay, onDate) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(anniversaryMonthDay ?? "").trim());
  if (!m) return null;

  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const ref = onDate instanceof Date && !Number.isNaN(+onDate) ? onDate : new Date();
  const yr = ref.getFullYear();

  // The window starts on the anniversary that has already passed.
  let start = new Date(yr, month - 1, day);
  if (start > ref) start = new Date(yr - 1, month - 1, day);

  // Ends the day before the next anniversary.
  const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);

  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start, end, label: `${fmt(start)} → ${fmt(end)}` };
}

/** Suggest a label for a new year row, following whatever the user used last. */
export function nextYearLabel(years) {
  const last = years?.[years.length - 1]?.label;
  const fy = /^FY\s*(\d{2,4})$/i.exec(String(last ?? "").trim());
  if (fy) {
    const n = Number(fy[1]);
    const width = fy[1].length;
    return `FY${String(n + 1).padStart(width, "0")}`;
  }
  const plain = /^(\d{4})$/.exec(String(last ?? "").trim());
  if (plain) return String(Number(plain[1]) + 1);
  return `FY${String((new Date().getFullYear() + 1) % 100).padStart(2, "0")}`;
}

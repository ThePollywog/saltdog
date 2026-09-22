/**
 * PRT (Physical Readiness Test) scoring — OPNAVINST 6110.1 Guide-5A.
 *
 * Grading a single event walks the 12 category rows best-to-worst and takes
 * the first one the Sailor's performance clears — reps/hold time must meet or
 * beat the row's minimum, a cardio time must meet or beat the row's maximum.
 * That is Guide-5A's own definition of a category ("performance ... equal to
 * or better than"), not an approximation of it.
 *
 * The overall score is the average of the three event POINTS, then mapped
 * back onto the same 12-row ladder by points — same rule Guide-5A uses per
 * event, just applied once more to the average. But Guide-5A's actual pass
 * condition is stricter than "average clears Probationary": failing ANY one
 * event below Probationary fails the whole PRT regardless of the other two,
 * so that is checked and reported separately from the averaged category.
 */
import { AGE_GROUPS, PRT_TABLE } from "../data/prtTables.js";

export { AGE_GROUPS };

/** Cardio events, in the order Guide-5A lists them. `key` indexes a PRT_TABLE row. */
export const CARDIO_EVENTS = [
  { key: "run", label: "1.5-mile run/walk" },
  { key: "row", label: "2,000m row" },
  { key: "swim500", label: "500-yard swim" },
  { key: "swim450", label: "450-meter swim" },
];

/** The 12 PRT category rows, best to worst — same order as PRT_TABLE's rows. */
export const CATEGORY_LABELS = [
  "Outstanding — High",
  "Outstanding — Medium",
  "Outstanding — Low",
  "Excellent — High",
  "Excellent — Medium",
  "Excellent — Low",
  "Good — High",
  "Good — Medium",
  "Good — Low",
  "Satisfactory — High",
  "Satisfactory — Medium",
  "Probationary",
];

/** Age -> index into PRT_TABLE/AGE_GROUPS, clamped to the covered range. */
export function ageGroupIndex(age) {
  const a = Number(age);
  if (!Number.isFinite(a)) return -1;
  const i = AGE_GROUPS.findIndex((g) => a >= g.min && (g.max == null || a <= g.max));
  if (i >= 0) return i;
  // Guide-5A's youngest/oldest bands are open past their stated edges in
  // practice (there is no PRT standard below 17); clamp rather than refuse.
  return a < AGE_GROUPS[0].min ? 0 : AGE_GROUPS.length - 1;
}

/**
 * Grade one event.
 * @param {"pushups"|"plank"|"run"|"row"|"swim500"|"swim450"} eventKey
 * @param {number} value  Reps for push-ups; seconds for every other event.
 * @param {number} ageIdx  From ageGroupIndex().
 * @param {"M"|"F"} gender
 * @returns {{points:number, category:string, row:number, passed:boolean}|null}
 */
export function gradeEvent(eventKey, value, ageIdx, gender) {
  if (!Number.isFinite(value) || ageIdx < 0) return null;
  const rows = PRT_TABLE[ageIdx]?.[gender];
  if (!rows) return null;

  const higherIsBetter = eventKey === "pushups" || eventKey === "plank";
  for (let i = 0; i < rows.length; i++) {
    const threshold = rows[i][eventKey];
    const clears = higherIsBetter ? value >= threshold : value <= threshold;
    if (clears) {
      return { points: rows[i].points, category: CATEGORY_LABELS[i], row: i, passed: true };
    }
  }
  return { points: 0, category: "Failure", row: rows.length, passed: false };
}

/** Map an averaged point value onto the same 12-row category ladder. */
export function categoryForPoints(points) {
  const THRESHOLDS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45];
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (points >= THRESHOLDS[i]) return CATEGORY_LABELS[i];
  }
  return "Failure";
}

/**
 * Overall PRT result from the three graded events.
 * @param {{pushups: object|null, plank: object|null, cardio: object|null}} graded
 */
export function overallScore({ pushups, plank, cardio }) {
  if (!pushups || !plank || !cardio) return null;
  const anyFailed = !pushups.passed || !plank.passed || !cardio.passed;
  const average = (pushups.points + plank.points + cardio.points) / 3;
  return {
    average,
    category: anyFailed ? "Failure" : categoryForPoints(average),
    anyFailed,
  };
}

/** "3:24" <-> 204, for the plank/cardio time inputs. */
export function mmssToSeconds(text) {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(String(text ?? "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function secondsToMmss(total) {
  const s = Math.round(total);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

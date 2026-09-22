/**
 * PRT (Physical Readiness Test) — the muscular-endurance/cardio half of the
 * PFA. Source: Guide-5A (Dec 2025), issued under OPNAVINST 6110.1.
 *
 * Deliberately does NOT restate the standards tables here — those are 264
 * numbers across 11 age bands, both genders, and six events, and the tool
 * already renders them per selected age/gender from data/prtTables.js. A
 * second copy in prose would be the exact staleness risk this file exists to
 * avoid; this topic covers the rules the numbers sit inside instead.
 *
 * PFA scope note: the PFA also includes the Body Composition Assessment, a
 * separate pass/fail screen. That isn't sourced or scored anywhere on this
 * site — Guide-5A doesn't cover it, and the BCA guide wasn't available when
 * this was built. Said plainly here and in the tool rather than guessed at.
 */

export const COMPONENTS = [
  { k: "Push-ups", v: "Max reps in 2 minutes — upper-body muscular endurance." },
  {
    k: "Forearm plank",
    v: "Max hold time — replaced curl-ups as the core/abdominal endurance event.",
  },
  {
    k: "Cardio",
    v: "1.5-mile run/walk, or an approved alternate: 2,000m row, 500yd swim, 450m swim, stationary bike, or treadmill.",
  },
];

export const GRADING = [
  {
    k: "Categories",
    v: "Five: Outstanding, Excellent, Good, Satisfactory, and Probationary (lowest passing). Each of the top four splits into High/Medium/Low, for 12 scored levels worth 45-100 points.",
  },
  {
    k: "Per-event score",
    v: "Each event is graded independently against the age/gender table for that event.",
  },
  {
    k: "Overall PRT score",
    v: "The average of the three event point values, category-mapped the same way an individual event is.",
  },
  {
    k: "Pass/fail",
    v: "Passing requires Probationary or better on push-ups, plank, AND the cardio event — falling below Probationary on any one of the three fails the whole PRT regardless of the other two or the average.",
  },
];

export default {
  id: "prt",
  title: "Physical Readiness Test (PRT)",
  eyebrow: "PRT",
  blurb: "What the PRT tests, how it's graded, and how it fits into the PFA.",
  sourcePdf: "prt-guide-5a.pdf",
  keywords: [
    "prt",
    "physical readiness test",
    "push-ups",
    "forearm plank",
    "1.5 mile run",
    "prt score",
    "prt standards",
    "prt calculator",
  ],
  systems: ["prims2"],
  // Rendered by the calculator: the per-age/gender tables ARE the tool, so a
  // knowledge page repeating rules the tool already states in its header
  // would be the same content at a second URL — the pattern every other
  // tool-topic here already follows.
  home: { name: "tools", params: { tool: "prt" } },
  homeLabel: "PRT Calculator",
  sections: [
    {
      id: "components",
      refs: ["opnavinst-6110-1"],
      heading: "PRT Components",
      kind: "kv",
      keywords: ["events", "modalities", "push-ups", "plank", "cardio", "alternate cardio"],
      rows: COMPONENTS,
    },
    {
      id: "grading",
      refs: ["opnavinst-6110-1"],
      heading: "PRT Grading",
      kind: "kv",
      keywords: ["scoring", "categories", "points", "pass", "fail", "probationary", "average"],
      rows: GRADING,
    },
  ],
};

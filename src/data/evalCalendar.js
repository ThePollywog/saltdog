/**
 * U.S. Navy EVAL / FITREP planning calendar.
 *
 * Source of truth: guides/military/admin/build_eval_calendar.py (SCHEDULE, NOTES).
 *
 * NOTE the coverage gap, preserved faithfully: the source covers E1-E9, W1-W5
 * and O1-O6 only. O7-O10 (flag officers) are absent, and AUGUST/DECEMBER have
 * no reports due. Both facts are rendered explicitly rather than as blanks —
 * an empty cell reads as missing data.
 */

export const SCHEDULE = [
  { month: "January", officer: ["O3"], enlisted: [] },
  { month: "February", officer: ["O2"], enlisted: [] },
  { month: "March", officer: ["W3", "W4", "W5"], enlisted: ["E5"] },
  { month: "April", officer: ["O5"], enlisted: ["E9"] },
  { month: "May", officer: ["O1"], enlisted: [] },
  { month: "June", officer: [], enlisted: ["E4"] },
  { month: "July", officer: ["O6"], enlisted: ["E1", "E2", "E3"] },
  { month: "August", officer: [], enlisted: [] },
  { month: "September", officer: ["W1", "W2"], enlisted: ["E7", "E8"] },
  { month: "October", officer: ["O4"], enlisted: [] },
  { month: "November", officer: [], enlisted: ["E6"] },
  { month: "December", officer: [], enlisted: [] },
];

export const RULES = [
  {
    k: "Counseling",
    v: "Due six months before the end of the regular reporting period (mid-term counseling).",
  },
  { k: "Officer FITREPs", v: "Due the last day of the reporting month." },
  { k: "Enlisted EVALs", v: "Due the 15th of the reporting month." },
];

export default {
  id: "eval-fitrep",
  title: "EVAL / FITREP Planning Calendar",
  eyebrow: "EVAL",
  blurb:
    "Which month your reporting period ends, by paygrade group, and when the report and counseling are due.",
  sourcePdf: "eval-fitrep-calendar.pdf",
  keywords: [
    "eval",
    "fitrep",
    "reporting period",
    "counseling",
    "brag sheet",
    "due date",
    "when is my eval",
    "evaluation",
  ],
  // eNAVFIT is where the report is written; iPERMS is where you confirm it
  // landed. Both are named in the caveats below.
  systems: ["enavfit", "ompf"],
  toolRoute: { name: "tools", params: { tool: "eval" } },
  toolLabel: "Look up my paygrade",
  sections: [
    {
      id: "schedule",
      refs: ["bupersinst-1610-10"],
      heading: "Reporting Schedule",
      kind: "eval-schedule",
      keywords: ["month", "paygrade", "reporting month", "schedule", "cycle"],
      rows: SCHEDULE,
    },
    {
      id: "rules",
      refs: ["bupersinst-1610-10"],
      heading: "Due-Date Rules",
      kind: "kv",
      keywords: ["due date", "deadline", "when is it due", "mid-term", "counseling"],
      rows: RULES,
    },
    {
      id: "coverage",
      refs: ["bupersinst-1610-10"],
      heading: "Coverage & Caveats",
      kind: "kv",
      keywords: ["flag officer", "o7", "o8", "o9", "o10", "admiral", "no reports"],
      rows: [
        {
          k: "Paygrades covered",
          v: "E1–E9, W1–W5, and O1–O6. Flag officers (O7–O10) report on a different cycle — see your reporting senior.",
        },
        {
          k: "Months with no reports",
          v: "August and December have no scheduled reporting periods in this calendar.",
        },
        {
          k: "Concurrent & special reports",
          v: "Detachment, promotion, and other special reports fall outside the regular cycle shown here.",
        },
      ],
    },
  ],
};

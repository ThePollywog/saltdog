/**
 * Joint Staff J1–J9 directorate structure.
 * Source of truth: guides/notes/build_jcodes.py (JCODES, EQUIV, NOTES).
 * Entities converted to Unicode.
 */

export const JCODES = [
  {
    code: "J1",
    title: "Manpower & Personnel",
    bullets: [
      "Personnel readiness, accountability, and strength reporting",
      "Manpower management and joint manning documents (JMD)",
      "Personnel policy, awards, casualty, and morale/welfare",
      "Postal, religious, and personnel support services",
    ],
  },
  {
    code: "J2",
    title: "Intelligence",
    bullets: [
      "All-source intelligence, threat assessment, and ISR",
      "Indications & warning; the joint intelligence picture",
      "Collection management and intel support to targeting",
      "Counterintelligence and security oversight",
    ],
  },
  {
    code: "J3",
    title: "Operations",
    bullets: [
      "Current operations — directs and synchronizes execution",
      "Joint fires, maneuver, and the operational picture",
      "Rules of engagement (ROE) and operational orders",
      "Information operations and special operations coordination",
    ],
  },
  {
    code: "J4",
    title: "Logistics",
    bullets: [
      "Supply, maintenance, transportation, and distribution",
      "Engineering, health-service support, and contracting",
      "Logistics planning and sustainment of the force",
      "Mobility and basing / host-nation support",
    ],
  },
  {
    code: "J5",
    title: "Plans & Policy",
    bullets: [
      "Future plans, strategy, and deliberate/crisis-action planning",
      "Policy development and interagency coordination",
      "Campaign and contingency plan (OPLAN/CONPLAN) development",
      "Politico-military assessment and partner engagement",
    ],
  },
  {
    code: "J6",
    title: "Command, Control, Comms & Computers (C4)",
    bullets: [
      "Communications systems, networks, and spectrum management",
      "Cyber defense of networks and information assurance",
      "Interoperability and the common operating picture systems",
      "C4 planning and the Joint Communications Architecture",
    ],
  },
  {
    code: "J7",
    title: "Joint Training & Exercises",
    bullets: [
      "Joint training, doctrine, and the exercise program",
      "Lessons learned and joint force development",
      "Education and readiness training requirements",
      "Modeling, simulation, and concept development",
    ],
  },
  {
    code: "J8",
    title: "Force Structure, Resources & Assessment",
    bullets: [
      "Resources, requirements, and program/budget analysis",
      "Force structure and capability assessments",
      "Studies, analysis, and the PPBE process support",
      "Capability development and trade-off analysis",
    ],
  },
  {
    code: "J9",
    title: "Civil-Military Operations",
    bullets: [
      "Civil affairs and civil-military coordination",
      "Interagency, NGO, and host-nation civil interface",
      "Stability, humanitarian, and reconstruction support",
      "(On some staffs: experimentation / interagency, varies by command)",
    ],
  },
];

export const EQUIVALENTS = [
  { k: "J-code", v: "Joint Staff (joint task force / combatant command)" },
  { k: "N-code", v: "Navy staff (e.g., N1=personnel, N2=intel, N3=ops, N6=comms)" },
  { k: "G-code", v: "Army/Marine general staff, division & above (G1–G9)" },
  { k: "S-code", v: "Army/Marine staff, brigade & below (S1–S9)" },
  { k: "A-code", v: "Air Force staff (A1–A9)" },
  { k: "C-code", v: "Coalition / combined staff" },
];

export const NOTES = [
  {
    k: "Numbering logic",
    v: "Same functional number across services: '1'=personnel, '2'=intel, '3'=ops, '4'=logistics, '5'=plans, '6'=comms, '7'=training, '8'=resources, '9'=civil-mil.",
  },
  {
    k: "Director",
    v: "Each directorate is led by a director (e.g., 'J3' refers to both the directorate and its director).",
  },
  {
    k: "Cross-functional",
    v: "Boards, bureaus, centers, cells, and working groups (B2C2WG) integrate the J-codes across a staff.",
  },
  {
    k: "Special staff",
    v: "SJA (legal), PAO (public affairs), Surgeon, Chaplain, and the IG sit outside the numbered directorates.",
  },
];

export default {
  id: "joint-codes",
  title: "Joint Staff Codes",
  eyebrow: "J",
  blurb:
    "J1–J9 directorate structure, what each one owns, and the N/G/S/A-code equivalents across services.",
  sourcePdf: "joint-staff-codes.pdf",
  keywords: [
    "joint staff",
    "j code",
    "directorate",
    "j1",
    "j2",
    "j3",
    "j4",
    "j5",
    "j6",
    "j7",
    "j8",
    "j9",
    "n code",
    "staff",
  ],
  sections: [
    {
      id: "directorates",
      heading: "Directorates J1–J9",
      kind: "code-cards",
      keywords: [
        "directorate",
        "manpower",
        "personnel",
        "intelligence",
        "operations",
        "logistics",
        "plans",
        "policy",
        "communications",
        "training",
        "exercises",
        "force structure",
        "resources",
        "civil military",
      ],
      rows: JCODES,
    },
    {
      id: "equivalents",
      heading: "Service / Staff Equivalents",
      kind: "kv",
      keywords: ["equivalent", "n code", "g code", "s code", "a code", "c code"],
      rows: EQUIVALENTS,
    },
    {
      id: "notes",
      heading: "Notes",
      kind: "kv",
      keywords: ["numbering", "director", "b2c2wg", "special staff", "sja", "pao"],
      rows: NOTES,
    },
  ],
};

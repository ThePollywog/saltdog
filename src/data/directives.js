/**
 * The instructions, manuals and regulations behind everything else on this site.
 *
 * WHY THIS EXISTS. Until now the checklist asserted rules — 50 points, 12 AT
 * days, Class 1/2 dental, the 15th of the reporting month — with no authority
 * attached. That is fine for a one-page card and not fine for a site somebody
 * might quote to their chain. The reference index this was modelled on
 * (kellybeamsley.com/navy) puts the governing instruction under every subsection,
 * and it is the single biggest reason that page reads as authoritative rather
 * than as somebody's notes.
 *
 * THE REVISION LETTER IS NOT PART OF THE IDENTITY. "BUPERSINST 1610.10H" is what
 * you see printed; "BUPERSINST 1610.10" is what stays true. Revisions supersede
 * each other every few years, and a citation carrying the letter is wrong from
 * the day the next one drops — silently, and in a way that looks precise. So
 * `label` holds the durable series number, `rev` holds the letter observed at
 * transcription, and `display()` puts them back together with the letter marked
 * as "as of". Nothing in this file is load-bearing on the letter: search indexes
 * the series, `refs` cite the series, and the link goes to a library that always
 * serves the current revision.
 *
 * THERE ARE NO DOCUMENT URLS HERE, ON PURPOSE. A deep link to a PDF on a Navy
 * host is the fastest-rotting thing this site could contain — the file moves with
 * every revision, and www.mynavyhr.navy.mil WAF-blocks every non-browser client
 * so a broken one could not even be detected by a build check. Each entry names
 * a LIBRARY instead, resolved through data/systems.js, and the label is the
 * string you search for once you're there. A link to the right shelf that keeps
 * working beats a link to the right document that stops.
 *
 * ACCURACY BOUNDARY. Series numbers and titles below are transcribed from the
 * documents' own naming and corroborated against that reference index. Article
 * numbers within a manual, and the revision letters, are the parts that drift
 * fastest — which is why the topic note says out loud that DONI is the authority
 * and this is a pointer. Nothing here paraphrases what an instruction *says*: the
 * `governs` line describes the subject so you can tell whether it's the one you
 * want, and stops there.
 */
import { systemUrl } from "./systems.js";

/**
 * Where a directive is actually published.
 *
 * `system` is an id from data/systems.js, so the address lives in exactly one
 * place and a library that moves moves once.
 */
export const LIBRARIES = {
  doni: {
    system: "doni",
    name: "DONI",
    hint: "Search the series number in the all-instructions index.",
  },
  mynavyhr: {
    system: "mynavy-hr",
    name: "MyNavy HR",
    hint: "Under References — instructions, manuals and messages.",
  },
  nrh: {
    system: "nrh",
    name: "Navy Reserve Homeport",
    hint: "Reserve-specific issuances live here rather than on DONI.",
  },
  dod: {
    system: "dod-issuances",
    name: "DoD Issuances",
    hint: "DoDD and DoDI series, by number.",
  },
};

/**
 * @typedef {object} Directive
 * @property {string} id       stable slug — what `refs` cite. Never derived from
 *                             the title, and never carries the revision letter.
 * @property {string} label    durable series number, e.g. "BUPERSINST 1610.10"
 * @property {string} [rev]    revision letter as observed, e.g. "H"
 * @property {string} title    the document's own title
 * @property {string} governs  what subject it covers — enough to recognize it
 * @property {keyof LIBRARIES} library
 * @property {string} group    section id in the topic below
 * @property {string[]} [keywords]
 * @property {string} [parent] id of the manual this is an article of
 */

/** @type {Directive[]} */
export const DIRECTIVES = [
  // --- Reserve participation ------------------------------------------------
  {
    id: "bupersinst-1001-39",
    label: "BUPERSINST 1001.39",
    rev: "F",
    title: "Administrative Procedures for Navy Reservists",
    governs:
      "The core reserve admin instruction — drill participation, point crediting, AT, and the paperwork behind all of it.",
    library: "doni",
    group: "reserve",
    keywords: ["reservist", "selres", "drill", "participation", "points", "idt", "admin"],
  },
  {
    id: "respersman",
    label: "RESPERSMAN",
    title: "Reserve Personnel Manual",
    governs:
      "Article-level reserve policy, maintained by Commander, Navy Reserve Forces Command. Cited by article number, not by revision.",
    library: "nrh",
    group: "reserve",
    keywords: ["respersman", "reserve", "personnel", "manual", "article"],
  },
  {
    id: "respersman-1571-010",
    label: "RESPERSMAN 1571-010",
    title: "Annual Training (AT)",
    governs:
      "AT requirements, the minimum-days rule, and the AT waiver — the article to cite when a year's AT cannot be performed.",
    library: "nrh",
    group: "reserve",
    parent: "respersman",
    keywords: ["annual", "training", "at", "waiver", "12", "days", "orders"],
  },
  {
    id: "dodi-1215-13",
    label: "DoDI 1215.13",
    title: "Reserve Component Member Participation Policy",
    governs:
      "DoD-level participation and retirement-point policy that the Navy instructions implement, including the annual point caps.",
    library: "dod",
    group: "reserve",
    keywords: ["participation", "points", "cap", "reserve", "component", "dod"],
  },
  {
    id: "dodi-1200-15",
    label: "DoDI 1200.15",
    title:
      "Assignment to and Transfer between Reserve Categories, Discharge from Reserve Status, Transfer to the Retired Reserve, and Notification of Eligibility for Retired Pay",
    governs:
      "Moving between SELRES, IRR and the Retired Reserve — and the Notification of Eligibility that follows twenty good years.",
    library: "dod",
    group: "reserve",
    keywords: ["retired", "reserve", "irr", "noe", "notification", "eligibility", "twenty", "gray area"],
  },

  // --- Performance ----------------------------------------------------------
  {
    id: "bupersinst-1610-10",
    label: "BUPERSINST 1610.10",
    rev: "H",
    title: "Navy Performance Evaluation System",
    governs:
      "EVALMAN — the reporting calendar, trait grades, counseling requirements, and who signs what. The authority behind every date on the EVAL/FITREP card.",
    library: "doni",
    group: "performance",
    keywords: ["evalman", "eval", "fitrep", "reporting", "counseling", "trait", "due", "calendar"],
  },

  // --- Advancement ----------------------------------------------------------
  {
    id: "bupersinst-1430-16",
    label: "BUPERSINST 1430.16",
    rev: "H",
    title: "Advancement Manual for Enlisted Personnel",
    governs:
      "Advancement eligibility, the exam cycle, and the Final Multiple Score — including how RSCA PMA is computed from your evaluations.",
    library: "doni",
    group: "advancement",
    keywords: ["advancement", "exam", "fms", "final multiple", "pma", "rsca", "eligibility", "e4", "e7"],
  },
  {
    id: "opnavinst-1040-11",
    label: "OPNAVINST 1040.11",
    rev: "F",
    title: "Navy Enlisted Retention and Career Development Program",
    governs:
      "Career Development Boards, Career Waypoints counselling, and what your Career Counselor is required to do for you and when.",
    library: "doni",
    group: "advancement",
    keywords: ["career", "counselor", "cdb", "development", "board", "retention", "cway"],
  },

  // --- Awards ---------------------------------------------------------------
  {
    id: "secnav-m-1650-1",
    label: "SECNAV M-1650.1",
    title: "Navy and Marine Corps Awards Manual",
    governs:
      "Award eligibility, precedence, and how ribbons and devices are worn — the source for the order the rack builder uses.",
    library: "doni",
    group: "awards",
    keywords: ["awards", "precedence", "ribbon", "medal", "device", "star", "wear", "rack"],
  },

  // --- Physical readiness ---------------------------------------------------
  {
    id: "opnavinst-6110-1",
    label: "OPNAVINST 6110.1",
    rev: "K",
    title: "Physical Readiness Program",
    governs:
      "PFA cycles, the PARFQ screening, BCA and cardio standards, and what a failure to participate means. Cycle dates themselves come by NAVADMIN.",
    library: "doni",
    group: "fitness",
    keywords: ["pfa", "prims", "parfq", "bca", "cardio", "physical", "readiness", "cycle", "cfl"],
  },

  // --- Medical readiness ----------------------------------------------------
  {
    id: "dodi-6025-19",
    label: "DoDI 6025.19",
    title: "Individual Medical Readiness",
    governs:
      "The IMR metrics your command sees — PHA currency, dental class, immunizations, labs and deployability indicators.",
    library: "dod",
    group: "medical",
    keywords: ["imr", "medical", "readiness", "pha", "dental", "immunization", "deployability", "mrrs"],
  },

  // --- Organization & records ----------------------------------------------
  {
    id: "opnavinst-3120-32",
    label: "OPNAVINST 3120.32",
    rev: "D",
    title: "Standard Organization and Regulations of the U.S. Navy",
    governs:
      "The SORM — chain of command, watch organization, and the routine duties a command is built around.",
    library: "doni",
    group: "records",
    keywords: ["sorm", "organization", "regulations", "chain", "command", "watch", "duties"],
  },
  {
    id: "milpersman",
    label: "MILPERSMAN",
    title: "Naval Military Personnel Manual",
    governs:
      "Article-level personnel policy — service records, Page 2 and emergency data, leave, and separations. Cited by article number.",
    library: "mynavyhr",
    group: "records",
    keywords: ["milpersman", "personnel", "manual", "record", "page 2", "leave", "separation", "article"],
  },

  // --- Travel ---------------------------------------------------------------
  {
    id: "jtr",
    label: "Joint Travel Regulations (JTR)",
    title: "Joint Travel Regulations",
    governs:
      "Per diem, allowable expenses, and voucher rules — what DTS will and will not reimburse after AT or a school.",
    library: "dod",
    group: "travel",
    keywords: ["jtr", "travel", "per diem", "voucher", "dts", "reimbursement", "lodging", "mileage"],
  },

  // --- Security & IT --------------------------------------------------------
  {
    id: "secnavinst-5510-30",
    label: "SECNAVINST 5510.30",
    title: "Department of the Navy Personnel Security Program",
    governs:
      "Clearance eligibility, continuous evaluation, and the self-reporting you are required to do rather than wait to be asked about.",
    library: "doni",
    group: "security",
    keywords: ["security", "clearance", "personnel", "diss", "continuous", "evaluation", "self report"],
  },
  {
    id: "opnavinst-5239-1",
    label: "OPNAVINST 5239.1",
    title: "Navy Cybersecurity Program",
    governs:
      "Account authorization and the annual cyber awareness requirement — the authority behind the SAAR-N and behind losing network access when training lapses.",
    library: "doni",
    group: "security",
    keywords: ["cybersecurity", "saar", "account", "access", "cyber", "awareness", "authorization"],
  },
];

export const DIRECTIVE_BY_ID = new Map(DIRECTIVES.map((d) => [d.id, d]));

/**
 * "BUPERSINST 1610.10H" for display, "BUPERSINST 1610.10" when there is no
 * observed revision. The letter is presentation only — never an identity.
 */
export function display(d) {
  if (!d) return "";
  return d.rev ? `${d.label}${d.rev}` : d.label;
}

/** Where to go to read it, resolved through the systems registry. */
export function directiveUrl(d) {
  const lib = LIBRARIES[d?.library];
  return lib ? systemUrl(lib.system) : null;
}

/** The library's short name, for the "find it at …" line under a citation. */
export function libraryName(d) {
  return LIBRARIES[d?.library]?.name ?? null;
}

/** Resolve ref ids to directives, dropping unknowns rather than rendering blanks. */
export function directivesFor(ids) {
  return (ids ?? []).map((id) => DIRECTIVE_BY_ID.get(id)).filter(Boolean);
}

/**
 * One searchable string per directive, used by lib/corpus.js twice: once for the
 * directives topic's own sections, and once to fold a citing section's authority
 * into that section's index. Both call this so a citation is findable from either
 * end — "1610.10" reaches the EVAL card, and "when is my eval due" reaches the
 * instruction.
 */
export function directiveText(d) {
  return [display(d), d.label, d.title, d.governs, (d.keywords ?? []).join(" ")]
    .filter(Boolean)
    .join(" ");
}

const GROUPS = [
  {
    id: "reserve",
    heading: "Reserve participation & retirement",
    keywords: ["reserve", "selres", "participation", "points", "at", "retirement", "noe"],
  },
  {
    id: "performance",
    heading: "Evaluations & FITREPs",
    keywords: ["eval", "fitrep", "evalman", "performance", "counseling"],
  },
  {
    id: "advancement",
    heading: "Advancement & career development",
    keywords: ["advancement", "exam", "fms", "career", "counselor", "cway"],
  },
  {
    id: "awards",
    heading: "Awards & uniform wear",
    keywords: ["awards", "ribbons", "precedence", "devices", "uniform"],
  },
  {
    id: "fitness",
    heading: "Physical readiness",
    keywords: ["pfa", "physical", "readiness", "prims", "parfq"],
  },
  {
    id: "medical",
    heading: "Medical readiness",
    keywords: ["medical", "imr", "pha", "dental", "readiness"],
  },
  {
    id: "records",
    heading: "Organization & personnel records",
    keywords: ["sorm", "milpersman", "records", "page 2", "organization"],
  },
  { id: "travel", heading: "Travel & orders", keywords: ["travel", "jtr", "per diem", "dts", "voucher"] },
  {
    id: "security",
    heading: "Security & cybersecurity",
    keywords: ["security", "clearance", "cyber", "saar", "diss"],
  },
];

export const NOTE =
  "Series numbers and titles are pointers, not the documents. Revision letters " +
  "shown as \"(as of)\" change every few years and article numbers within a " +
  "manual change more often than that — DONI (secnav.navy.mil/doni) and MyNavy " +
  "HR serve the current revision, and a NAVADMIN can modify any of these before " +
  "the instruction itself is reissued. Nothing here paraphrases what an " +
  "instruction says; read the document before relying on it.";

export default {
  id: "directives",
  title: "Instructions & Directives",
  eyebrow: "REF",
  blurb:
    "The BUPERSINST, OPNAVINST, RESPERSMAN, SECNAV and DoD issuances behind the rules on this site — what each one governs, and where to read it.",
  keywords: [
    "instruction",
    "instructions",
    "directive",
    "directives",
    "bupersinst",
    "opnavinst",
    "secnavinst",
    "respersman",
    "milpersman",
    "dodi",
    "regulation",
    "policy",
    "authority",
    "reference",
    "which instruction",
  ],
  note: NOTE,
  systems: ["doni", "navadmin", "mynavy-hr"],
  sections: GROUPS.map((g) => ({
    id: g.id,
    heading: g.heading,
    kind: "directives",
    keywords: g.keywords,
    rows: DIRECTIVES.filter((d) => d.group === g.id),
  })),
};

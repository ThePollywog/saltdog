/**
 * Navy system quick links, condensed to what a SELRES reservist actually uses.
 *
 * Source of truth: guides/military/admin/build_quicklinks.py (SECTIONS).
 * Entities from that HTML-generating source are converted to Unicode here —
 * Vue escapes text interpolation, so a literal "&amp;" would render as "&amp;".
 *
 * THIS FILE IS NOW STRUCTURE, NOT ADDRESSES. Each entry is a system id from
 * data/systems.js plus the category it belongs to, because the readiness
 * checklist links the same systems and two copies of a URL is one copy too
 * many — Navy addresses change often enough that the second copy is guaranteed
 * to go stale. What stays here is what's genuinely directory-specific: the
 * grouping, the ordering, and the handful of labels where this list has always
 * said something different from the system's own name ("MOL / NROWS").
 *
 * `name`/`desc` overrides exist only for those labels. Everything else — url,
 * access string, CAC gate, whether there's a front door at all — comes from the
 * registry.
 */
import { SYSTEM_BY_ID, systemUrl } from "./systems.js";

/**
 * Expand `{ id }` into the row shape the links renderer and the search corpus
 * expect. `url` resolves through the registry, so a portal-only system points
 * at its portal here exactly as it does on the checklist.
 */
function link(entry) {
  const sys = SYSTEM_BY_ID.get(entry.id);
  if (!sys) throw new Error(`quicklinks references unknown system "${entry.id}"`);
  return {
    id: sys.id,
    name: entry.name ?? sys.name,
    desc: entry.desc ?? (sys.full ? `${sys.full} — ${sys.desc}` : sys.desc),
    access: sys.access,
    url: systemUrl(sys.id),
    cac: sys.cac,
    reach: sys.reach,
  };
}

const RAW_CATEGORIES = [
  {
    id: "portals",
    heading: "Portals & Hubs",
    keywords: ["portal", "hub", "sign on", "login", "start here"],
    links: [
      { id: "mynavy-hr" },
      { id: "mnp" },
      { id: "mncc" },
      { id: "navy-mil" },
    ],
  },
  {
    id: "personnel",
    heading: "Personnel / Pay / Records",
    keywords: [
      "pay",
      "paycheck",
      "record",
      "personnel",
      "points",
      "les",
      "drill pay",
      "service record",
    ],
    links: [
      { id: "nsips" },
      { id: "mypay" },
      { id: "ompf", desc: "Official Military Personnel File (record review)" },
      { id: "nsips-esr", desc: "Electronic Service Record (members & reservists) — drill credit and retirement points" },
      { id: "cway" },
      { id: "bol" },
    ],
  },
  {
    id: "readiness",
    heading: "Readiness / Training",
    keywords: [
      "readiness",
      "training",
      "pfa",
      "orders",
      "mobilization",
      "course",
      "at",
      "idt",
    ],
    links: [
      { id: "prims2", desc: "Physical Readiness Information Management System (PFA data)" },
      { id: "nrows", name: "MOL / NROWS", desc: "Reserve mobilization & orders writing (reservists) — build AT/ADT orders here" },
      { id: "nel", name: "NeL / Navy e-Learning" },
      { id: "fltmps", desc: "Fleet Training Management & Planning (training records / quotas)" },
      { id: "cool" },
      { id: "jko", desc: "Joint Knowledge Online (joint training)" },
    ],
  },
  {
    id: "admin",
    heading: "Admin / Evals / Awards",
    keywords: ["eval", "fitrep", "award", "leave", "travel", "voucher", "admin"],
    links: [
      { id: "enavfit", desc: "Evaluations & FITREP preparation/submission" },
      { id: "eleave" },
      { id: "ndaws" },
      { id: "twms", desc: "Total Workforce Management System (civilian / training / EEO)" },
      { id: "dts", desc: "Defense Travel System — travel orders & vouchers" },
    ],
  },
  {
    id: "benefits",
    heading: "Benefits / Health / Transition",
    keywords: [
      "benefit",
      "health",
      "medical",
      "dental",
      "tricare",
      "va",
      "retirement",
      "tsp",
      "deers",
      "id card",
    ],
    links: [
      { id: "milconnect" },
      { id: "tricare" },
      { id: "mhs-genesis" },
      { id: "va" },
      { id: "tap", desc: "Transition Assistance Program" },
      { id: "tsp", desc: "TSP retirement account" },
    ],
  },
  {
    id: "security",
    heading: "Security / IT",
    keywords: ["security", "clearance", "it", "help desk", "access", "account"],
    links: [
      { id: "diss", desc: "Defense Information System for Security (clearances, continuous evaluation)" },
      { id: "saar", desc: "System Authorization Access Request" },
      { id: "nmci-help" },
    ],
  },
];

/** The directory as rendered: same shape as before, addresses now derived. */
export const CATEGORIES = RAW_CATEGORIES.map((cat) => ({
  ...cat,
  links: cat.links.map(link),
}));

export const DISCLAIMER =
  "URLs and portal names change frequently and most require a CAC; this is a " +
  "pointer list, not live links. When in doubt, reach a system through MyNavy HR " +
  "(mynavyhr.navy.mil) or MyNavy Portal (my.navy.mil), or call MNCC " +
  "1-833-330-MNCC. Verify the current address before relying on it.";

/** Topic wrapper so quick links join the same registry/search corpus. */
export default {
  id: "quicklinks",
  title: "Navy System Quick Links",
  eyebrow: "Link",
  blurb:
    "Major personnel, pay, training and admin systems — condensed to the ones a drilling reservist touches.",
  sourcePdf: "navy-quicklinks.pdf",
  keywords: ["quick links", "system", "portal", "website", "where do i go"],
  note: DISCLAIMER,
  sections: CATEGORIES.map((cat) => ({
    id: cat.id,
    heading: cat.heading,
    kind: "links",
    keywords: cat.keywords,
    rows: cat.links,
  })),
};

/**
 * The Navy systems a reservist actually has to log into — one entry per system,
 * one place where its URL lives.
 *
 * WHY THIS FILE EXISTS. The quick-links directory and the readiness checklist
 * both name the same two dozen systems. Before this, only the directory carried
 * URLs, so the checklist could tell you to "build orders in NROWS" without
 * offering a way to get there, and any URL that changed had to be fixed in
 * however many places had copied it. Now both read from here.
 *
 * `reach` is the honest part, and it is the reason this isn't just a name->url
 * map. Plenty of these systems have no public front door: PRIMS-2, eNAVFIT,
 * C-WAY and NDAWS are all reached *through* a portal after you authenticate, and
 * inventing a plausible-looking deep link for one of them would be worse than
 * offering none — it would send someone to a dead URL while looking helpful.
 * So:
 *
 *   direct  — `url` IS the application. Click it and you're there.
 *   portal  — no public entry point. `via` names the system you go through, and
 *             the UI links to THAT, labelled so the indirection is visible.
 *   phone   — a help desk, not a website. `url` is a tel: link.
 *   offline — no URL at all: a paper form, or something only your NOSC can do.
 *
 * VERIFICATION AND ITS LIMITS. Every `url` below resolves in DNS and was
 * requested at least once while writing this file. Most CAC-gated `.mil` hosts
 * refuse or time out from the commercial internet — that is expected and is not
 * evidence the host is wrong, so "resolves and is documented" is the bar, not
 * "returned 200 from my laptop". Two things came out of that pass and are worth
 * knowing, because both had been sitting in the data:
 *
 *   - DTS was recorded as dtsproc.defensetravel.osd.mil, which no longer
 *     resolves at all. The working host is dtsproweb.
 *   - Navy e-Learning, FLTMPS and DISS were all recorded as "CAC required" with
 *     no URL. All three have reachable entry points and are now `direct`.
 *
 * These are pointers, not guarantees. Navy system names and addresses change
 * often, which is exactly why they are centralized here and why every surface
 * that shows one also shows the MyNavy HR / MNCC fallback.
 */

/**
 * @typedef {object} System
 * @property {string} id        stable key — referenced by checklist items and
 *                             quick-links entries. Never derive it from `name`.
 * @property {string} name      short display name, as sailors say it
 * @property {string} [full]    expansion, for the acronym-only names
 * @property {string} desc      what you use it for
 * @property {"direct"|"portal"|"phone"|"offline"} reach
 * @property {string|null} url  the application, or null for portal/offline
 * @property {string} [via]     id of the system you reach this one through
 * @property {string} [then]    what to click once the portal has let you in.
 *                             Landing on the right site is only half of it: NSIPS
 *                             opens on a launch page where the service record is
 *                             behind a link named "ESR", which is not a word
 *                             anyone guesses from "check my drill points". A
 *                             `portal` entry can name its portal and still leave
 *                             someone stranded one click short.
 * @property {string} access    the pointer string shown under the link
 * @property {boolean} cac      does getting in require a CAC
 */

/** @type {System[]} */
export const SYSTEMS = [
  // --- Portals & hubs -------------------------------------------------------
  {
    id: "mynavy-hr",
    name: "MyNavy HR",
    desc: "Personnel / pay / career hub (replaces the NPC site)",
    reach: "direct",
    url: "https://www.mynavyhr.navy.mil/",
    access: "mynavyhr.navy.mil",
    cac: false,
  },
  {
    id: "mnp",
    name: "MyNavy Portal (MNP)",
    desc: "Single sign-on hub to career & admin apps",
    reach: "direct",
    url: "https://my.navy.mil/",
    access: "my.navy.mil (CAC)",
    cac: true,
  },
  {
    id: "mncc",
    name: "MyNavy Coaching / MNCC",
    desc: "MyNavy Career Center help desk",
    reach: "phone",
    url: "tel:+18333306622",
    access: "1-833-330-MNCC",
    cac: false,
  },
  {
    id: "navy-mil",
    name: "Navy.mil",
    desc: "Public Navy news & info",
    reach: "direct",
    url: "https://www.navy.mil/",
    access: "navy.mil",
    cac: false,
  },

  // --- Personnel / pay / records -------------------------------------------
  {
    id: "nsips",
    name: "NSIPS",
    full: "Navy Standard Integrated Personnel System",
    desc: "ESR, training, pay, leave",
    reach: "direct",
    // Moved to the Navy cloud tenancy. The old nsipsapp.nmci.navy.mil no longer
    // resolves in DNS at all — not WAF-blocked, gone — so anything still
    // pointing there is a dead link and not merely a redirect.
    url: "https://www.nsips.cloud.navy.mil/",
    access: "nsips.cloud.navy.mil (CAC)",
    cac: true,
  },
  {
    id: "mypay",
    name: "MyPay (DFAS)",
    desc: "Pay statements, W-2, allotments, tax withholding",
    reach: "direct",
    url: "https://mypay.dfas.mil/",
    access: "mypay.dfas.mil",
    cac: false,
  },
  {
    id: "nsips-esr",
    name: "NSIPS ESR",
    full: "Electronic Service Record",
    desc: "Drill credit and retirement points — the record of truth",
    reach: "portal",
    via: "nsips",
    then: 'select "ESR"',
    url: null,
    access: 'within NSIPS — select "ESR"',
    cac: true,
  },
  {
    id: "ompf",
    name: "OMPF / iPERMS",
    full: "Official Military Personnel File",
    desc: "Your permanent record — evals, awards, orders",
    reach: "portal",
    via: "bol",
    url: null,
    access: "via BOL / MyNavy HR (CAC)",
    cac: true,
  },
  {
    id: "cway",
    name: "Career Waypoints (C-WAY)",
    desc: "Reenlistment / conversion / retention applications",
    reach: "portal",
    via: "mynavy-hr",
    url: null,
    access: "via MyNavy HR",
    cac: true,
  },
  {
    id: "bol",
    name: "BOL",
    full: "BUPERS Online",
    desc: "OSR/PSR, orders, boards",
    reach: "direct",
    url: "https://www.bol.navy.mil/",
    access: "bol.navy.mil (CAC)",
    cac: true,
  },

  // --- Readiness / training ------------------------------------------------
  {
    id: "prims2",
    name: "PRIMS-2",
    full: "Physical Readiness Information Management System",
    desc: "PFA results and cycle status",
    reach: "portal",
    via: "mnp",
    url: null,
    access: "via MyNavy Portal (CAC)",
    cac: true,
  },
  {
    id: "nrows",
    name: "NROWS",
    full: "Navy Reserve Order Writing System",
    desc: "Build and route AT/ADT orders",
    reach: "direct",
    url: "https://nrows.dc3n.navy.mil/",
    access: "nrows.dc3n.navy.mil (CAC)",
    cac: true,
  },
  {
    id: "nel",
    name: "Navy e-Learning (NeL)",
    desc: "Mandatory & skills training courses (GMT, CBTs)",
    reach: "direct",
    url: "https://learning.nel.navy.mil/",
    access: "learning.nel.navy.mil (CAC)",
    cac: true,
  },
  {
    id: "fltmps",
    name: "FLTMPS",
    full: "Fleet Training Management & Planning System",
    desc: "Training records, course completions, quotas",
    reach: "direct",
    url: "https://main.prod.cetars.training.navy.mil/",
    access: "main.prod.cetars.training.navy.mil (CAC)",
    cac: true,
  },
  {
    id: "mrrs",
    name: "MRRS",
    full: "Medical Readiness Reporting System",
    desc: "Individual Medical Readiness (IMR) status, PHA and dental currency",
    reach: "direct",
    url: "https://mrrs.dc3n.navy.mil/",
    access: "mrrs.dc3n.navy.mil (CAC)",
    cac: true,
  },
  {
    id: "cool",
    name: "Navy COOL",
    desc: "Credentialing / certification & education funding",
    reach: "direct",
    url: "https://www.cool.osd.mil/usn/",
    access: "cool.osd.mil/usn",
    cac: false,
  },
  {
    id: "jko",
    name: "JKO",
    full: "Joint Knowledge Online",
    desc: "Joint training courses",
    reach: "direct",
    url: "https://jkodirect.jten.mil/",
    access: "jko.jten.mil",
    cac: false,
  },

  // --- Admin / evals / awards ---------------------------------------------
  {
    id: "enavfit",
    name: "eNAVFIT / NAVFIT98",
    desc: "Evaluations & FITREP preparation and submission",
    reach: "portal",
    via: "mynavy-hr",
    url: null,
    access: "eNAVFIT via MyNavy HR",
    cac: true,
  },
  {
    id: "eleave",
    name: "eLeave / NSIPS Leave",
    desc: "Leave requests & approval routing",
    reach: "portal",
    via: "nsips",
    url: null,
    access: "within NSIPS",
    cac: true,
  },
  {
    id: "ndaws",
    name: "Navy Awards (NDAWS)",
    desc: "Awards record & status",
    reach: "portal",
    via: "mynavy-hr",
    url: null,
    access: "via MyNavy HR",
    cac: true,
  },
  {
    id: "twms",
    name: "TWMS",
    full: "Total Workforce Management System",
    desc: "Civilian / training / EEO records",
    reach: "direct",
    url: "https://twms.navy.mil/",
    access: "twms.navy.mil (CAC)",
    cac: true,
  },
  {
    id: "dts",
    name: "DTS",
    full: "Defense Travel System",
    desc: "Travel orders & vouchers",
    reach: "direct",
    // Recorded as dtsproc.defensetravel.osd.mil until 2026-08; that host no
    // longer resolves. dtsproweb is the working one.
    url: "https://dtsproweb.defensetravel.osd.mil/",
    access: "dtsproweb.defensetravel.osd.mil (CAC)",
    cac: true,
  },

  // --- Benefits / health / transition -------------------------------------
  {
    id: "milconnect",
    name: "milConnect",
    desc: "DEERS, ID cards, benefits, dependents, SGLI/SOES",
    reach: "direct",
    url: "https://milconnect.dmdc.osd.mil/milconnect/",
    access: "milconnect.dmdc.osd.mil",
    cac: false,
  },
  {
    id: "tricare",
    name: "TRICARE",
    desc: "Military health benefits & enrollment (TRICARE Reserve Select)",
    reach: "direct",
    url: "https://www.tricare.mil/",
    access: "tricare.mil",
    cac: false,
  },
  {
    id: "mhs-genesis",
    name: "MHS GENESIS / TOL",
    desc: "Patient portal, appointments, Rx",
    reach: "direct",
    url: "https://patientportal.mhsgenesis.health.mil/",
    access: "patientportal.mhsgenesis.health.mil",
    cac: false,
  },
  {
    id: "va",
    name: "VA.gov",
    desc: "VA benefits, claims, education (GI Bill)",
    reach: "direct",
    url: "https://www.va.gov/",
    access: "va.gov",
    cac: false,
  },
  {
    id: "tap",
    name: "TAP",
    full: "Transition Assistance Program",
    desc: "Separation and retirement transition support",
    reach: "offline",
    url: null,
    access: "via Fleet & Family Support Center / DOL",
    cac: false,
  },
  {
    id: "tsp",
    name: "Thrift Savings Plan",
    desc: "TSP retirement account and contribution elections",
    reach: "direct",
    url: "https://www.tsp.gov/",
    access: "tsp.gov",
    cac: false,
  },

  // --- Security / IT -------------------------------------------------------
  {
    id: "diss",
    name: "DISS",
    full: "Defense Information System for Security",
    desc: "Clearance eligibility and continuous evaluation",
    reach: "direct",
    url: "https://dissportal.nbis.mil/",
    access: "dissportal.nbis.mil (CAC)",
    cac: true,
  },
  {
    id: "saar",
    name: "SAAR-N / SAAR",
    full: "System Authorization Access Request",
    desc: "The form that gets you an account on most of the above",
    reach: "offline",
    url: null,
    access: "OPNAV 5239/14 — through your Security Manager",
    cac: false,
  },
  {
    id: "nmci-help",
    name: "MyNavy Portal IT Help",
    desc: "NMCI / account & access support",
    reach: "phone",
    url: "tel:+18668436624",
    access: "1-866-THE-NMCI",
    cac: false,
  },
];

export const SYSTEM_BY_ID = new Map(SYSTEMS.map((s) => [s.id, s]));

/**
 * Where a link for this system should actually point.
 *
 * A `portal` system resolves to the portal's URL, so "PRIMS-2" is still one
 * click even though PRIMS-2 itself has no address — the caller is expected to
 * label it with `viaLabel()` so the hop is visible rather than implied.
 */
export function systemUrl(id) {
  const sys = SYSTEM_BY_ID.get(id);
  if (!sys) return null;
  if (sys.url) return sys.url;
  return sys.via ? (SYSTEM_BY_ID.get(sys.via)?.url ?? null) : null;
}

/** "via MyNavy HR" for portal-routed systems, null when the link is direct. */
export function viaLabel(id) {
  const sys = SYSTEM_BY_ID.get(id);
  if (!sys || sys.reach !== "portal" || !sys.via) return null;
  return `via ${SYSTEM_BY_ID.get(sys.via)?.name ?? sys.via}`;
}

/** Resolve ids to systems, dropping unknowns rather than rendering blanks. */
export function systemsFor(ids) {
  return (ids ?? []).map((id) => SYSTEM_BY_ID.get(id)).filter(Boolean);
}

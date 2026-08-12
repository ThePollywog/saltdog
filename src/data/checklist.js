/**
 * SELRES annual readiness checklist + step-by-step procedures.
 *
 * Source of truth: guides/military/admin/build_reservist.py (SECTIONS, HOWTO).
 * Entities converted to Unicode.
 *
 * `note` is the ONE field here that intentionally departs from that source. The
 * builder's notes are print captions — "stay current", "notify chain early" —
 * sized for a cell on a one-page card, and they restate the label more often than
 * they add to it. A web page has room, and the reader has a different problem: the
 * label already says what the task is, so the note should say the part that bites,
 * which is the deadline, the quantity, or what breaks if it slips. Class 4 dental
 * just means overdue; an unrecorded PFA counts as a failure to participate rather
 * than a pass; a year that closes under 50 points cannot be topped up afterwards.
 *
 * Two boundaries keep that from turning into an essay. Notes do not repeat the
 * `howto` steps — the procedure is one click away and duplicating it means two
 * copies to keep true. And nothing here states a figure the site does not already
 * hold: 50 points, 15 membership points, 12 AT days and 20 good years all come
 * from lib/points.js or the source card. Anything softer is phrased as "usually"
 * on purpose, because policy detail drifts and this is a pointer, not an
 * instruction.
 *
 * The `id` on every item is HAND-WRITTEN and permanent. It is the localStorage
 * key for that item's completion state. Do NOT slugify from `label` — the first
 * copy-edit to a label would silently wipe that item's saved progress for
 * every existing user.
 *
 * `howto` cross-links an item to a procedure id below, so the interactive
 * checklist can jump straight to the steps.
 *
 * `systems` lists the ids in data/systems.js you actually have to log into to
 * finish that item, so a row can offer "go do it" and not just "here is what to
 * do". URLs deliberately do NOT live here — a system named by four checklist
 * items and a quick-links entry would otherwise carry five copies of an address
 * that changes every couple of years. Items with no `systems` are the ones that
 * genuinely have no application behind them: telling your chain about a conflict
 * and updating your civilian employer are conversations, not websites, and a
 * link there would be an invention.
 *
 * `refs` lists directive ids from data/directives.js — the authority the item's
 * claim rests on. Every figure in the notes above was previously asserted with
 * nothing behind it, which is fine for a wall card and thin for something a
 * sailor might forward to their chief. The ids resolve to a series number and a
 * library, never to a document URL; see data/directives.js on why. Items without
 * `refs` are the ones where a citation would be padding: an LES that looks wrong
 * is a disbursing conversation, and dressing it up with an instruction number
 * would imply a rule that isn't the point.
 *
 * `due` is the descriptor lib/due.js turns into a date, and its absence is a
 * statement. Three bases exist:
 *
 *   completion  — `months` after the date this item was last checked off. The
 *                 honest model for anything recurring: the clock starts when you
 *                 did it, not on 1 January.
 *   anniversary — keyed to the RC anniversary the points tracker stores, because
 *                 a good year is not a calendar year and never has been.
 *   fiscalYear  — a fixed `monthDay` deadline that recurs each fiscal year. Only
 *                 AT works this way.
 *
 * The drill and life-event groups have NO `due` at all, and that is deliberate
 * rather than unfinished. "Muster and sign in" is due at the next drill, whose
 * date this site does not know; "DEERS update after a life event" is due when
 * the life event happens. Attaching a computed date to either would be inventing
 * a deadline and displaying it with the same confidence as a real one — which is
 * exactly the failure mode a readiness tool cannot afford.
 */

export const GROUPS = [
  {
    id: "drill",
    heading: "Every Drill (IDT)",
    cadence: "Each drill weekend",
    keywords: ["drill", "idt", "muster", "sign in", "drill weekend"],
    items: [
      {
        id: "drill.muster",
        label: "Muster & sign in/out",
        note:
          "A standard drill weekend is 4 IDT periods — 4 retirement points, 1 per " +
          "period. Signing in but not out is the usual reason a period never posts, " +
          "and unposted drills are far easier to fix this month than at your " +
          "anniversary date.",
        howto: "nsips-points",
        systems: ["nsips-esr"],
        refs: ["bupersinst-1001-39", "dodi-1215-13"],
      },
      {
        id: "drill.pay",
        label: "Confirm drill pay posted",
        note:
          "Drill pay usually lands within one to two pay cycles after the weekend. " +
          "Pay and points are separate postings from separate systems, so getting " +
          "paid is not proof the points credited — check both.",
        howto: "mypay-les",
        systems: ["mypay"],
        refs: ["bupersinst-1001-39"],
      },
      {
        id: "drill.availability",
        label: "Update availability / conflicts",
        note:
          "Tell your chain before the drill, not after. A rescheduled drill agreed " +
          "in advance can usually be made up; an unexcused absence is what turns " +
          "into a missed point and a paperwork problem.",
        refs: ["bupersinst-1001-39"],
      },
      {
        id: "drill.training",
        label: "Complete assigned drill training",
        note:
          "Save or print the completion certificate as you finish each course. " +
          "Credit posts to FLTMPS separately from the course itself, and a " +
          "certificate is the only proof you hold if it doesn't.",
        howto: "gmt-cbt",
        systems: ["nel", "fltmps"],
        refs: ["opnavinst-5239-1"],
      },
    ],
  },
  {
    id: "monthly",
    heading: "Monthly",
    cadence: "Once a month",
    keywords: ["monthly", "points", "les", "pass-down", "navadmin"],
    items: [
      {
        id: "monthly.points",
        label: "Check NSIPS ESR for credited points",
        note:
          "The Annual Retirement Point Record is the record of truth for both " +
          "retirement credit and a good year. Checking monthly keeps a correction " +
          "to one weekend you still remember, rather than a year you have to " +
          "reconstruct from memory.",
        howto: "nsips-points",
        systems: ["nsips-esr"],
        refs: ["bupersinst-1001-39", "dodi-1215-13"],
        due: { basis: "completion", months: 1 },
      },
      {
        id: "monthly.les",
        label: "Review MyPay LES",
        note:
          "Check the drill days paid, allotments, and tax withholding — and your " +
          "address, since the LES is where a stale one usually shows up first. " +
          "Errors that survive two drill periods need NOSC disbursing, not another " +
          "month of waiting.",
        howto: "mypay-les",
        systems: ["mypay"],
        due: { basis: "completion", months: 1 },
      },
      {
        id: "monthly.passdown",
        label: "Read command / NOSC pass-down",
        note:
          "NAVADMINs and GENADMINs are how policy changes actually reach you — PFA " +
          "cycle changes, advancement quotas, bonus and mobilization news. Nobody " +
          "will re-brief a message you skipped.",
        systems: ["navadmin"],
        due: { basis: "completion", months: 1 },
      },
      {
        id: "monthly.atwindow",
        label: "Track AT / ADT scheduling window",
        note:
          "Orders take weeks to route and fund, so the constraint is almost never " +
          "your availability — it is approval time. Late-fiscal-year AT competes " +
          "with everyone else's for the same funding.",
        howto: "at-adt",
        systems: ["nrows"],
        refs: ["respersman-1571-010"],
        due: { basis: "completion", months: 1 },
      },
    ],
  },
  {
    id: "quarterly",
    heading: "Quarterly",
    cadence: "Every three months",
    keywords: ["quarterly", "good year", "pha", "dental"],
    items: [
      {
        id: "quarterly.goodyear",
        label: "Verify points toward a good year",
        note:
          "50 points minimum, counted over your anniversary year — not the fiscal " +
          "or calendar year. 15 membership points are automatic, so 48 drill " +
          "periods plus AT normally clears it; checking quarterly is what leaves " +
          "time to add correspondence courses if it won't.",
        howto: "good-year",
        systems: ["nsips-esr"],
        refs: ["bupersinst-1001-39", "dodi-1215-13"],
        due: { basis: "completion", months: 3 },
      },
      {
        id: "quarterly.pha",
        label: "Periodic Health Assessment (PHA) status",
        note:
          "Due annually, but track it quarterly because it gates everything else — " +
          "an overdue PHA turns your IMR red, and a red IMR blocks mobilization " +
          "screening, some schools, and orders.",
        howto: "pha-imr",
        systems: ["mrrs", "eha"],
        refs: ["dodi-6025-19"],
        due: { basis: "completion", months: 3 },
      },
      {
        id: "quarterly.dental",
        label: "Dental exam currency (Class 1/2)",
        note:
          "Class 1 or 2 is deployable; Class 3 is not, and Class 4 simply means " +
          "overdue for an exam — the easiest of the four to fall into and the " +
          "easiest to fix. Exams booked through a NOSC or civilian provider can " +
          "take weeks to get.",
        howto: "pha-imr",
        systems: ["mrrs"],
        refs: ["dodi-6025-19"],
        due: { basis: "completion", months: 3 },
      },
      {
        id: "quarterly.plan",
        label: "Review IDT/AT plan with chain",
        note:
          "Map the remaining periods against your anniversary date. No-cost orders " +
          "and RMP (Reserve Management Period) days are the usual ways to cover a " +
          "shortfall or a training requirement your drill weekends can't fit.",
        howto: "at-adt",
        systems: ["nrows", "rfmt"],
        refs: ["respersman-1571-010", "bupersinst-1001-39"],
        due: { basis: "completion", months: 3 },
      },
    ],
  },
  {
    id: "annual",
    heading: "Annual",
    cadence: "Once a year",
    keywords: ["annual", "at", "pfa", "pha", "gmt", "sgli", "mobilization"],
    items: [
      {
        id: "annual.at",
        label: "Annual Training (AT)",
        note:
          "A minimum of 12 days of active duty per fiscal year, and worth 1 " +
          "retirement point per day — the largest single block of points most " +
          "reservists earn. Funded orders in hand before you travel; DTS voucher " +
          "within 5 days of getting back.",
        howto: "at-adt",
        systems: ["nrows"],
        refs: ["respersman-1571-010", "bupersinst-1001-39", "jtr"],
        // The one requirement on this list keyed to the FISCAL year rather than to
        // when you last did it. 30 SEP is the deadline whether or not anything is
        // checked off, so this basis needs no anchor date from the user.
        due: { basis: "fiscalYear", monthDay: "09-30" },
      },
      {
        id: "annual.pfa",
        label: "Physical Fitness Assessment (PFA)",
        note:
          "The PARFQ medical screening comes first — you cannot participate without " +
          "it. Your CFL enters the results in PRIMS-2, so confirm the cycle actually " +
          "shows in your record: an unrecorded PFA counts as a failure to " +
          "participate, not as a pass.",
        howto: "pfa",
        systems: ["prims2"],
        refs: ["opnavinst-6110-1"],
        due: { basis: "completion", months: 12 },
      },
      {
        id: "annual.pha",
        label: "Periodic Health Assessment (PHA)",
        note:
          "Two parts, and the second is the one people forget: you fill out the " +
          "questionnaire, then a provider has to review it to close the PHA out. An " +
          "unreviewed PHA reads as incomplete no matter how early you started it.",
        howto: "pha-imr",
        systems: ["mrrs", "eha"],
        refs: ["dodi-6025-19"],
        due: { basis: "completion", months: 12 },
      },
      {
        id: "annual.dental",
        label: "Dental exam",
        note:
          "One exam a year keeps you Class 1 or 2. Book it well before your PHA or " +
          "mob screening is due — dental is the readiness item most often waiting on " +
          "an appointment rather than on you.",
        howto: "pha-imr",
        systems: ["mrrs"],
        refs: ["dodi-6025-19"],
        due: { basis: "completion", months: 12 },
      },
      {
        id: "annual.gmt",
        label: "Annual training (GMT/CBTs)",
        note:
          "Cyber awareness, SAPR, OPSEC, records management and others assigned by " +
          "your command. Cyber awareness in particular gates network access, so " +
          "letting it lapse can lock you out of the systems you need for everything " +
          "else on this list.",
        howto: "gmt-cbt",
        systems: ["nel", "fltmps"],
        refs: ["opnavinst-5239-1"],
        due: { basis: "completion", months: 12 },
      },
      {
        id: "annual.medreadiness",
        label: "DD Form 2807 / medical readiness",
        note:
          "Individual Medical Readiness is the summary your command actually sees: " +
          "PHA, dental, immunizations, labs and any waivers rolled into one status. " +
          "Green in MRRS is the target, and it is the gate for mobilization.",
        howto: "pha-imr",
        systems: ["mrrs", "nrrm"],
        refs: ["dodi-6025-19"],
        due: { basis: "completion", months: 12 },
      },
      {
        id: "annual.goodyear",
        label: "Verify good year (anniversary)",
        note:
          "At your anniversary date, confirm the year closed with 50 or more points. " +
          "20 good years is the retirement threshold, and a year that closes short " +
          "cannot be topped up afterwards — this is the deadline the quarterly check " +
          "exists to protect.",
        howto: "good-year",
        systems: ["nsips-esr"],
        refs: ["bupersinst-1001-39", "dodi-1215-13"],
        // Anniversary, not calendar or fiscal — the whole point of the item. This
        // basis needs the RC anniversary the points tracker already stores, and
        // reports `needs-anchor` rather than guessing a date when it is missing.
        due: { basis: "anniversary" },
      },
      {
        id: "annual.page2",
        label: "Page 2 / RED — dependents data",
        note:
          "The Record of Emergency Data names who gets notified and who receives " +
          "death gratuity. It is the one record on this list that matters most when " +
          "you are not in a position to correct it, so re-read it rather than " +
          "assuming last year's version is still right.",
        howto: "records-sgli",
        systems: ["nsips", "milconnect"],
        refs: ["milpersman"],
        due: { basis: "completion", months: 12 },
      },
      {
        id: "annual.sgli",
        label: "SGLI / beneficiary review",
        note:
          "Elections are made in SOES through milConnect, not on paper. Coverage and " +
          "beneficiaries do not update themselves after a marriage, divorce or " +
          "birth — an out-of-date beneficiary is legally still the beneficiary.",
        howto: "records-sgli",
        systems: ["milconnect"],
        refs: ["milpersman"],
        due: { basis: "completion", months: 12 },
      },
      {
        id: "annual.mobscreen",
        label: "Screen for mobilization readiness",
        note:
          "Where the rest of the list gets audited at once: IMR green, gear issued " +
          "and fitting, and a current family care plan if you have dependents. " +
          "Anything unresolved here is what delays or disqualifies you from a " +
          "mobilization you have already been told about.",
        systems: ["mrrs", "nrrm"],
        refs: ["dodi-6025-19"],
        due: { basis: "completion", months: 12 },
      },
    ],
  },
  {
    id: "life-events",
    heading: "As Required / Life Events",
    cadence: "When it happens",
    keywords: [
      "life event",
      "marriage",
      "birth",
      "address",
      "deers",
      "clearance",
      "travel claim",
      "employer",
    ],
    items: [
      {
        id: "life.deers",
        label: "DEERS / dependents update",
        note:
          "Do this first after any life event — DEERS is what drives dependent ID " +
          "cards, TRICARE eligibility and BAH. A new spouse or child who isn't in " +
          "DEERS has no coverage, however complete the rest of your paperwork is.",
        howto: "records-sgli",
        systems: ["milconnect", "nfaas"],
        refs: ["milpersman"],
      },
      {
        id: "life.clearance",
        label: "Security clearance / DISS currency",
        note:
          "Continuous Evaluation replaced the old fixed reinvestigation cycle, which " +
          "means self-reporting is now the requirement: foreign travel, financial " +
          "trouble, an arrest. Report it yourself rather than letting CE surface it.",
        howto: "diss",
        systems: ["diss"],
        refs: ["secnavinst-5510-30"],
      },
      {
        id: "life.fitrep",
        label: "Evaluation / FITREP input",
        note:
          "Write your input early in the cycle, not when it's due — your reporting " +
          "senior can only credit what you can document. Check the signed report " +
          "posts to your OMPF; a report that never posts is invisible to selection " +
          "boards.",
        howto: "enavfit",
        systems: ["enavfit", "ompf"],
        refs: ["bupersinst-1610-10"],
      },
      {
        id: "life.cway",
        label: "C-WAY / reenlistment window",
        note:
          "Career Waypoints windows open and close on a fixed timeline tied to your " +
          "EAOS, and missing one narrows your options rather than pausing them. Your " +
          "Career Counselor can tell you the exact dates.",
        howto: "cway",
        systems: ["cway"],
        refs: ["opnavinst-1040-11", "bupersinst-1430-16"],
      },
      {
        id: "life.dts",
        label: "Travel claims (DTS)",
        note:
          "File within 5 days of returning. A late voucher delays reimbursement, and " +
          "an unfiled one on a government travel card becomes a delinquent account " +
          "against you — the money owed does not wait for the claim.",
        howto: "at-adt",
        systems: ["dts", "citi-gtc"],
        refs: ["jtr"],
      },
      {
        id: "life.address",
        label: "Address / contact in NSIPS",
        note:
          "Orders, pay correspondence and tax documents all go to the address of " +
          "record. Updating it in one system does not update the others, so check " +
          "NSIPS, MyPay and milConnect separately after a move.",
        howto: "records-sgli",
        systems: ["nsips", "nfaas"],
        refs: ["milpersman"],
      },
      {
        id: "life.employer",
        label: "Update civilian employer info",
        note:
          "USERRA protects your civilian job across drills, AT and mobilization, but " +
          "it works best with advance notice — give your employer your schedule and " +
          "a copy of your orders. ESGR can mediate if a conflict comes up.",
      },
    ],
  },
  {
    id: "retirement",
    heading: "Retirement / Long-Term",
    cadence: "Career horizon",
    keywords: [
      "retirement",
      "20 years",
      "good years",
      "gray area",
      "tsp",
      "points statement",
      "age 60",
    ],
    items: [
      {
        id: "ret.years",
        label: "Track total qualifying years",
        note:
          "20 good years qualifies you for reserve retired pay. They need not be " +
          "consecutive, so a year that fell short does not restart the count — it " +
          "just doesn't count toward the 20.",
        howto: "good-year",
        systems: ["nsips-esr"],
        refs: ["dodi-1200-15", "dodi-1215-13"],
        due: { basis: "anniversary" },
      },
      {
        id: "ret.statement",
        label: "Annual points statement review",
        note:
          "Dispute errors the year they happen, while your NOSC still holds the " +
          "muster sheets and orders that prove them. Reconstructing a drill weekend " +
          "from years ago is the single hardest correction in this system, and the " +
          "statement is what your retirement is computed from.",
        howto: "nsips-points",
        systems: ["nsips-esr"],
        refs: ["bupersinst-1001-39"],
        due: { basis: "anniversary" },
      },
      {
        id: "ret.grayarea",
        label: "Gray-area / RC retirement planning",
        note:
          "The gray area is the stretch between finishing your 20 years and drawing " +
          "pay — normally at age 60, reduced by qualifying active-duty service after " +
          "January 2008. You keep an ID card and some benefits during it, but not " +
          "retired pay, so plan for the gap.",
        systems: ["mynavy-hr", "evetrecs"],
        refs: ["dodi-1200-15"],
      },
      {
        id: "ret.tsp",
        label: "TSP contributions",
        note:
          "Drill pay is eligible for TSP, and under BRS the government match applies " +
          "to it too — an easy contribution to leave unclaimed for years. Check your " +
          "election and fund allocation annually.",
        systems: ["tsp"],
        due: { basis: "completion", months: 12 },
      },
    ],
  },
];

/** Step-by-step procedures, keyed by the `howto` ids referenced above. */
export const HOWTO = [
  {
    id: "nsips-points",
    refs: ["bupersinst-1001-39"],
    heading: "Verify drill credit & points (NSIPS ESR)",
    systems: ["nsips"],
    steps: [
      "Log in to NSIPS (CAC) → Electronic Service Record.",
      "Open Annual Retirement Point Record / Drill attendance.",
      "Confirm each IDT/AT period posted with the right point value.",
      "Discrepancy? Notify your NOSC/UMUIC admin with the dates & proof.",
    ],
  },
  {
    id: "mypay-les",
    heading: "Check drill pay / LES (MyPay)",
    systems: ["mypay"],
    steps: [
      "Log in to MyPay (mypay.dfas.mil) with CAC or login.gov.",
      "Open the most recent Leave & Earnings Statement (LES).",
      "Verify drill pay days, BAH/allowances, allotments, tax withholding.",
      "Errors persisting >1-2 drills: see your NOSC disbursing.",
    ],
  },
  {
    id: "at-adt",
    refs: ["respersman-1571-010", "jtr"],
    heading: "Schedule Annual Training (AT/ADT)",
    systems: ["nrows", "dts"],
    steps: [
      "Coordinate dates & funding line with your chain / training officer.",
      "Build orders in NROWS; route for approval (NOSC → gaining cmd).",
      "Confirm funded orders in hand before travel; arrange lodging/travel.",
      "After AT: file the DTS voucher within 5 days of return.",
    ],
  },
  {
    id: "pfa",
    refs: ["opnavinst-6110-1"],
    heading: "Physical Fitness Assessment (PFA / PRIMS-2)",
    systems: ["prims2"],
    steps: [
      "Complete the PARFQ / medical screening before participating.",
      "Conduct BCA + cardio (and any alternate) within the cycle window.",
      "Verify the CFL enters results in PRIMS-2.",
      "Confirm the pass/fail and cycle shows in your record.",
    ],
  },
  {
    id: "pha-imr",
    refs: ["dodi-6025-19"],
    heading: "Medical & dental readiness (PHA / IMR)",
    systems: ["mrrs"],
    steps: [
      "Start the annual PHA online (e.g., via MRRS/medical portal).",
      "Complete the provider review portion to close it out.",
      "Get the annual dental exam; keep Class 1/2 (avoid Class 3/4).",
      "Confirm IMR status is GREEN in MRRS before mob screening.",
    ],
  },
  {
    id: "gmt-cbt",
    refs: ["opnavinst-5239-1"],
    heading: "Mandatory training (GMT / CBTs)",
    systems: ["nel", "fltmps"],
    steps: [
      "Log in to Navy e-Learning (via MyNavy Portal) or assigned LMS.",
      "Complete required courses: cyber awareness, SAPR, OPSEC, records, etc.",
      "Print/save completion certificates.",
      "Verify credit posts in FLTMPS/training record.",
    ],
  },
  {
    id: "enavfit",
    refs: ["bupersinst-1610-10"],
    heading: "Evaluation / FITREP input (eNAVFIT)",
    systems: ["enavfit", "ompf"],
    steps: [
      "Draft your brag sheet / input early in the reporting cycle.",
      "Enter via eNAVFIT (through MyNavy HR); route to reporting senior.",
      "Review the signed report; sign & acknowledge.",
      "Confirm it posts to your OMPF (iPERMS).",
    ],
  },
  {
    id: "records-sgli",
    refs: ["milpersman"],
    heading: "Records & beneficiary updates (milConnect / NSIPS)",
    systems: ["milconnect", "nsips"],
    steps: [
      "milConnect (milconnect.dmdc.osd.mil): update DEERS & dependents.",
      "Review SGLI election & beneficiaries (SOES via milConnect).",
      "Update Page 2 / Record of Emergency Data & contact info in NSIPS.",
      "Re-verify after any life event (marriage, birth, move).",
    ],
  },
  {
    id: "cway",
    refs: ["opnavinst-1040-11"],
    heading: "Retention / reenlistment (Career Waypoints)",
    systems: ["cway"],
    steps: [
      "Check your C-WAY window/timeline with the Career Counselor.",
      "Submit the application (reenlist/extend/convert) on time.",
      "Track the decision; complete reenlistment/extension paperwork.",
    ],
  },
  {
    id: "diss",
    refs: ["secnavinst-5510-30"],
    heading: "Security clearance currency (DISS)",
    systems: ["diss"],
    steps: [
      "Confirm your eligibility & investigation status (Security Mgr/DISS).",
      "Enroll/stay in Continuous Evaluation (CE); self-report as required.",
      "Submit periodic reinvestigation paperwork (e-QIP) when notified.",
    ],
  },
  {
    id: "good-year",
    refs: ["bupersinst-1001-39", "dodi-1215-13"],
    heading: "Confirm a good (satisfactory) year",
    systems: ["nsips-esr"],
    steps: [
      "Find your anniversary year (retirement/RC) start-end dates.",
      "Tally retirement points in NSIPS for that year.",
      "Need ≥50 points for a satisfactory ('good') year.",
      "Short? Add points via correspondence courses / extra IDT before close.",
    ],
  },
];

export const NOTE =
  "General SELRES guidance for planning only. Exact requirements, windows, and " +
  "point thresholds vary by NOSC, rate, billet, and current instructions (e.g. " +
  "RESPERSMAN, OPNAV 1001 series). Confirm with your chain of command, NOSC, and " +
  "Career Counselor.";

export const HOWTO_NOTE =
  "Steps are general and system UIs change; most systems are reached via MyNavy " +
  "HR (mynavyhr.navy.mil) or MyNavy Portal (my.navy.mil), CAC required. When " +
  "stuck, contact your NOSC, Career Counselor, or MNCC (1-833-330-MNCC).";

/** Every checklist item id, flattened — used by the tool and by verify-corpus. */
export const ALL_ITEM_IDS = GROUPS.flatMap((g) => g.items.map((i) => i.id));

export default {
  id: "reservist-checklist",
  title: "Navy Reservist Annual Checklist",
  eyebrow: "RES",
  blurb:
    "SELRES readiness by cadence — drill, monthly, quarterly, annual — plus the step-by-step procedure for each system.",
  sourcePdf: "reservist-checklist.pdf",
  keywords: [
    "checklist",
    "selres",
    "reservist",
    "readiness",
    "requirements",
    "what do i need to do",
  ],
  note: NOTE,
  // The topic-level set is deliberately the portals, not all twenty systems:
  // the per-item links below are the specific ones, and repeating them here
  // would be a wall of buttons above the content they belong to.
  systems: ["mynavy-hr", "mnp", "nsips"],
  toolRoute: { name: "tools", params: { tool: "checklist" } },
  toolLabel: "Open the interactive checklist",
  sections: [
    ...GROUPS.map((g) => ({
      id: g.id,
      heading: g.heading,
      kind: "checklist",
      keywords: g.keywords,
      cadence: g.cadence,
      rows: g.items,
      // No section-level `refs` on a cadence group: the items cite individually,
      // and rolling every authority up to the heading would put SECNAVINST 5510.30
      // above a list where only one row is about clearances.
    })),
    ...HOWTO.map((h) => ({
      id: `howto-${h.id}`,
      heading: `How to: ${h.heading}`,
      kind: "steps",
      keywords: ["how to", "steps", "procedure", h.heading.toLowerCase()],
      rows: h.steps,
      // Sits beside the steps rather than inside them: the procedure is the
      // same whether or not the system is reachable from where you're sitting.
      systems: h.systems,
      // A procedure DOES get a section-level citation — unlike a cadence group,
      // every step here serves one requirement, so one authority covers the lot.
      refs: h.refs,
    })),
  ],
};

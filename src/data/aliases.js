/**
 * Acronym and synonym map for the offline retrieval engine.
 *
 * This file — not the scoring formula — is what determines answer quality over
 * a corpus this size. Reservists ask questions in acronyms the reference cards
 * spell out, and vice versa.
 */

/**
 * Stopwords: ordinary English function words only.
 *
 * Deliberately NOT stopwords:
 *   "at"  — Annual Training
 *   "w", "e", "o" — paygrade prefixes (W-2, E-5, O-3)
 *   "no"  — "no-cost orders"
 */
export const STOPWORDS = new Set(
  (
    // Function words.
    "a about an and any are as be been being but by can could did do does " +
    "doing done for from get got had has have how i if in into is it its me " +
    "much must my need of on or our should so some than that the their them " +
    "then there these they this those to was were what when where which who " +
    "whom why will with would you your " +
    // Interrogative scaffolding. People phrase reference lookups as questions
    // ("what does INDOPACOM cover", "how do I see my OMPF"), and the verb is
    // grammar, not content. Every word here was checked against the corpus:
    // none carries domain signal, but each was being scored as a required term,
    // which capped coverage and pushed correct top-ranked answers below the
    // answer threshold. Verbs that DO carry signal here — "check", "verify",
    // "schedule", "update", "submit" — are deliberately absent from this list.
    "cover covers covered mean means meaning many tell tells explain " +
    "see seeing show shows shown list lists give gives " +
    "know knows want wants please just really actually anyone someone " +
    "am been does not dont doesnt whats hows"
  ).split(" "),
);

/**
 * Multi-word rewrites, applied to the RAW query string before tokenizing.
 * Each match appends its expansion terms while leaving the original in place.
 */
export const PHRASE_ALIASES = [
  [/\bgood\s+years?\b/gi, "satisfactory year anniversary 50 fifty retirement points"],
  [/\bdrill\s+weekend\b/gi, "idt drill inactive duty training muster"],
  [/\bpoints?\s+statement\b/gi, "annual retirement point record nsips esr"],
  [/\bhow\s+many\s+points\b/gi, "retirement points 50 fifty satisfactory good year"],
  [/\bwhen\s+is\s+my\s+(eval|fitrep)\b/gi, "reporting month due date paygrade schedule"],
  [/\bwhen\s+is\s+my\s+(pfa|pha)\b/gi, "annual cycle window readiness"],
  [/\bspell\b/gi, "phonetic alphabet voice procedure"],
  [/\bhow\s+do\s+i\b/gi, "steps procedure how to"],
  [/\bwhere\s+do\s+i\s+(go|find|check|look)\b/gi, "system portal link access"],
  [/\bpay\s*check\b/gi, "pay les mypay drill pay"],
  [/\bsign\s+up\b/gi, "enroll schedule submit"],
  [/\btime\s+in\s+service\b/gi, "years service retirement points"],
  [/\bwho\s+signs\b/gi, "adcon administrative control reporting senior chain"],
  [/\bchain\s+of\s+command\b/gi, "adcon opcon authority control"],
  [/\bid\s+card\b/gi, "deers milconnect dependents benefits"],
  [/\bhealth\s+insurance\b/gi, "tricare benefits health enrollment"],
  [/\bgi\s+bill\b/gi, "va education benefits"],
  [/\bboot\s+camp\b/gi, "recruit training"],
  [/\btravel\s+(claim|voucher)\b/gi, "dts defense travel system voucher"],
  [/\bribbon\s+rack\b/gi, "awards precedence ribbons order wear"],
  [/\border\s+of\s+precedence\b/gi, "awards precedence ribbons wear"],
  [/\bwhat\s+order\b/gi, "precedence order"],

  /**
   * "Which reg covers X" — the question the directives topic exists to answer.
   *
   * It needs a rewrite to work at all: "which", "what" and "covers" are all
   * stopwords, so the query reduces to the bare subject ("evals") and lands on
   * the subject-matter card instead of the authority. `reg`, `regs`, `manual`,
   * `authority` and `source` are the words people actually use and none of them
   * is a token alias, which is why the alternation is this wide. It fires on the
   * raw string, before stopword removal — the only stage where the interrogative
   * is still visible.
   *
   * THE EXPANSION IS TWO WORDS, AND THAT IS THE WHOLE FINDING. This started as
   * six rules with five- to seven-term expansions, which measured WORSE than
   * having no rule at all: "which reg covers evals" and "per what regulation do
   * I owe AT" both returned `unknown`. The cause is the coverage factor —
   * `0.4 + 0.6 × covered/groups` — which scores a record on the fraction of
   * query terms it matches. Injecting seven synonyms into a four-word question
   * means every record in the corpus now misses most of the query, so every
   * score collapses and the best answer falls under the threshold. A long
   * expansion in a coverage-weighted scorer doesn't broaden the net, it sinks it.
   *
   * Measured over 17 phrasings against four variants: this rule turns both
   * `unknown` results into answers and costs nothing anywhere else (the full
   * golden suite passes under all four). Adding a third term, or re-adding the
   * `governing …` / `where does it say` / `per what` / `cite` rules, changed not
   * one of the 17 outcomes — so they are not in here.
   */
  [
    /\b(what|which|whats|what's)\s+(instruction|instructions|reg|regs|regulation|manual|directive|reference|authority|source)\b/gi,
    "instruction directive",
  ],
];

/**
 * Single-token expansions.
 *
 * A plain array expands unconditionally. An object with `caseSensitive: true`
 * expands ONLY when the raw query contains the token in uppercase — that keeps
 * "AT" (Annual Training) from firing on "look at my points". Reservists type
 * these acronyms in caps.
 */
export const TOKEN_ALIASES = {
  // people / status
  selres: ["reserve", "reservist", "drilling", "selected"],
  reservist: ["selres", "reserve", "drilling"],
  reserve: ["selres", "reservist"],
  nosc: ["navy", "operational", "support", "center", "reserve", "center"],
  mncc: ["mynavy", "career", "center", "help", "desk"],

  // duty / training
  idt: ["drill", "inactive", "duty", "training", "muster"],
  adt: ["active", "duty", "training", "orders", "nrows"],
  drill: ["idt", "muster", "weekend"],
  gmt: ["general", "military", "training", "cbt", "sapr", "opsec", "cyber", "elearning"],
  cbt: ["gmt", "computer", "based", "training", "course"],
  nel: ["navy", "elearning", "training", "course"],
  jko: ["joint", "knowledge", "online", "training"],
  fltmps: ["fleet", "training", "management", "records", "quota"],
  nrows: ["orders", "reserve", "writing", "at", "adt", "mobilization"],
  mol: ["mobilization", "orders", "nrows"],
  rmp: ["reserve", "management", "period", "idt"],

  // readiness / medical
  pfa: ["physical", "fitness", "assessment", "prims", "bca", "parfq", "cardio"],
  prims: ["pfa", "physical", "readiness", "fitness"],
  parfq: ["pfa", "screening", "questionnaire"],
  bca: ["body", "composition", "pfa"],
  cfl: ["command", "fitness", "leader", "pfa"],
  pha: ["periodic", "health", "assessment", "medical", "imr", "mrrs", "annual"],
  imr: ["individual", "medical", "readiness", "mrrs", "pha", "dental"],
  mrrs: ["medical", "readiness", "reporting", "imr", "pha"],
  dental: ["medical", "readiness", "class", "exam"],

  // records / pay
  nsips: ["esr", "service", "record", "points", "leave", "personnel"],
  esr: ["electronic", "service", "record", "nsips", "points", "drill", "credit"],
  les: ["leave", "earnings", "statement", "mypay", "pay"],
  mypay: ["les", "pay", "dfas", "allotment", "tax"],
  dfas: ["mypay", "pay", "finance"],
  ompf: ["official", "military", "personnel", "file", "iperms", "record"],
  iperms: ["ompf", "record", "personnel", "file"],
  bol: ["bupers", "online", "osr", "psr", "orders", "board"],
  arpr: ["annual", "retirement", "point", "record", "points", "statement"],

  // evals
  fitrep: ["eval", "evaluation", "report", "navfit", "enavfit", "reporting", "officer"],
  eval: ["fitrep", "evaluation", "report", "enavfit", "enlisted", "reporting"],
  enavfit: ["fitrep", "eval", "navfit", "evaluation", "submission"],
  navfit: ["enavfit", "fitrep", "eval"],
  ndaws: ["awards", "award", "record"],

  // awards
  ribbon: ["ribbons", "award", "awards", "rack", "precedence", "medal"],
  ribbons: ["ribbon", "awards", "rack", "precedence", "medals"],
  rack: ["ribbons", "ribbon", "awards", "precedence", "wear", "mount"],
  precedence: ["order", "awards", "ribbons", "wear", "senior"],
  device: ["devices", "star", "cluster", "oak", "leaf", "awards"],
  devices: ["device", "star", "cluster", "oak", "leaf", "awards"],
  nam: ["navy", "marine", "corps", "achievement", "medal", "award"],
  car: ["combat", "action", "ribbon", "award"],
  puc: ["presidential", "unit", "citation", "award"],
  afrm: ["armed", "forces", "reserve", "medal", "hourglass", "award"],
  ndsm: ["national", "defense", "service", "medal", "award"],

  // career
  cway: ["career", "waypoints", "reenlistment", "conversion", "retention"],
  tsp: ["thrift", "savings", "plan", "retirement"],
  tap: ["transition", "assistance", "program"],
  userra: ["employer", "civilian", "employment", "rights"],

  // benefits / records
  deers: ["milconnect", "dependents", "enrollment", "id", "card", "benefits"],
  milconnect: ["deers", "dependents", "sgli", "soes", "benefits", "id", "card"],
  sgli: ["life", "insurance", "beneficiary", "soes", "milconnect"],
  soes: ["sgli", "beneficiary", "election"],
  red: ["record", "emergency", "data", "page", "2", "dependents"],
  tricare: ["health", "benefits", "insurance", "medical", "enrollment"],
  va: ["veterans", "affairs", "benefits", "claims", "gi", "bill"],

  // security / IT
  diss: ["security", "clearance", "eligibility", "investigation", "continuous", "evaluation"],
  ce: ["continuous", "evaluation", "diss", "clearance"],
  saar: ["system", "authorization", "access", "request"],
  cac: ["common", "access", "card", "login", "required"],
  nmci: ["it", "help", "network", "account", "access"],

  // travel
  dts: ["defense", "travel", "system", "voucher", "claim", "orders"],

  // staff / commands
  ccmd: ["combatant", "command", "unified", "cocom"],
  cocom: ["combatant", "command", "authority", "ccdr"],
  opcon: ["operational", "control", "authority"],
  tacon: ["tactical", "control", "authority"],
  adcon: ["administrative", "control", "authority", "man", "train", "equip"],
  dirlauth: ["direct", "liaison", "authorized", "coordination"],
  aor: ["area", "responsibility", "region", "boundary"],
  ccdr: ["combatant", "commander", "cocom"],
  jtf: ["joint", "task", "force"],

  // misc reference
  scpo: ["senior", "chief", "petty", "officer", "e8"],
  mcpo: ["master", "chief", "petty", "officer", "e9"],
  cpo: ["chief", "petty", "officer", "e7"],
  mcpon: ["master", "chief", "petty", "officer", "navy", "senior", "enlisted"],
  cwo: ["chief", "warrant", "officer"],
  paygrade: ["rank", "grade", "e", "o", "w"],
  rate: ["rating", "rank", "enlisted"],
  navadmin: ["message", "passdown", "policy"],

  // Directives. Every issuing authority a reservist is likely to type, mapped
  // toward the subjects it governs so "BUPERSINST" alone lands on the reserve
  // and eval entries rather than on nothing. The series NUMBERS need no aliases:
  // tokenize() already splits "1610.10H" into 1610 / 10h / 10 / h, so the digits
  // are indexed from the labels themselves.
  bupersinst: ["bureau", "naval", "personnel", "instruction", "directive", "authority"],
  opnavinst: ["opnav", "chief", "naval", "operations", "instruction", "directive", "authority"],
  secnavinst: ["secnav", "secretary", "navy", "instruction", "directive", "authority"],
  secnav: ["secretary", "navy", "instruction", "manual", "directive"],
  respersman: ["reserve", "personnel", "manual", "instruction", "directive", "authority"],
  milpersman: ["military", "personnel", "manual", "instruction", "record", "article"],
  bumedinst: ["medical", "instruction", "directive", "health"],
  dodi: ["dod", "defense", "instruction", "directive", "joint", "authority"],
  dodd: ["dod", "defense", "directive", "instruction", "authority"],
  instruction: ["directive", "authority", "policy", "governs", "reference"],
  instructions: ["directive", "authority", "policy", "governs", "reference"],
  directive: ["instruction", "authority", "policy", "governs"],
  regulation: ["instruction", "directive", "authority", "policy"],
  authority: ["instruction", "directive", "governs", "reference"],
  doni: ["directives", "issuances", "instruction", "library", "secnav"],
  evalman: ["eval", "fitrep", "performance", "evaluation", "bupersinst", "1610"],
  sorm: ["standard", "organization", "regulations", "opnavinst", "3120", "chain", "command"],
  jtr: ["joint", "travel", "regulations", "per", "diem", "voucher", "dts"],
  navpers: ["form", "personnel", "record", "page"],
  sead: ["security", "executive", "agent", "directive", "clearance", "reporting"],

  // Case-ambiguous — only expand on an uppercase match in the raw query.
  at: { caseSensitive: true, terms: ["annual", "training", "adt", "orders", "nrows", "12", "days"] },
  ad: { caseSensitive: true, terms: ["active", "duty"] },
  it: { caseSensitive: true, terms: ["information", "technology", "help", "desk", "nmci"] },
  red: { caseSensitive: true, terms: ["record", "emergency", "data", "page", "2"] },
  ce: { caseSensitive: true, terms: ["continuous", "evaluation", "clearance"] },
};

/** Starter questions shown in the chat panel and on the unknown fallback. */
export const STARTER_QUESTIONS = [
  "How many points do I need for a good year?",
  "When is my E6 eval due?",
  "Where do I check my LES?",
  "How do I schedule Annual Training?",
  "What does J4 do?",
  "Which fleet covers the Middle East?",
  "What order do ribbons go in?",
];

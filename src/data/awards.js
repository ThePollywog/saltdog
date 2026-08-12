/**
 * U.S. Navy awards in order of precedence, plus the device legend.
 *
 * Source: guides/military/USN_RIBBONS_AND_DEVICES.pdf (shipped as
 * public/pdf/usn-ribbons.pdf). That chart HAS a text layer, so the names below
 * are transcribed from the embedded text rather than read off a bitmap — unlike
 * the rank charts. The reading order of the chart IS the order of precedence:
 * left to right, top to bottom, 8 per row.
 *
 * The ribbon artwork in public/img/ribbons.png is cut from the same page by
 * tools/extract-ribbons.mjs and is in THIS ORDER. `sprite` is each award's tile
 * index, so the two cannot drift silently:
 *   - the extractor refuses to write a sheet that isn't exactly 68 tiles
 *   - verify-corpus asserts sprite indices are 0..67 with no gaps or repeats
 * Get that wrong and every rack on the site renders the wrong ribbon for the
 * right name, which no build step would notice.
 *
 * NOTE ON THE LAST TWO: the Rifle and Pistol Marksmanship Medals are drawn down
 * in the chart's device-legend block rather than in the ribbon grid, which makes
 * them easy to miss — the first pass at the extractor did miss them and produced
 * a plausible-looking 66. They are ordinary awards and worn last in precedence.
 *
 * TWO SOURCE TYPOS ARE CORRECTED HERE, flagged via `corrected` so the UI can
 * footnote them rather than reproduce them silently (as ranks.js does):
 *   - #55 prints "Presideantial" -> Presidential
 *   - the Silver/Gold Star legend prints "Warn in lieu" -> worn in lieu
 *
 * SCOPE, stated plainly because the tool is a planning aid and people mount
 * real racks from these: this is the precedence list from one chart. It is not
 * SECNAVINST 1650.1 and it does not encode eligibility, so it will happily let
 * you select an award you did not earn. It also predates the awards created
 * after the chart was published, and it is Navy/Marine Corps precedence — not
 * the joint or sister-service order.
 */

/**
 * @param {string} id   stable id — NEVER derived from the title, because
 *                      slugifying display text silently orphans every saved
 *                      rack the first time a label is copy-edited.
 * @param {string} title
 * @param {number} sprite tile index in public/img/ribbons.png
 */
const a = (id, title, sprite, extra) => ({ id, title, sprite, ...extra });

/**
 * Precedence groups, in order. The chart itself doesn't draw group boundaries;
 * these follow the standard categories and exist so the picker is navigable —
 * a flat list of 66 is unusable, and grouping is also how people think about
 * what they have ("I have three campaign medals").
 */
export const GROUPS = [
  { id: "personal", label: "Personal decorations" },
  { id: "unit", label: "Unit awards" },
  { id: "good-conduct", label: "Good conduct & reserve" },
  { id: "campaign", label: "Campaign & service" },
  { id: "service", label: "Service & training" },
  { id: "foreign-unit", label: "Foreign unit awards" },
  { id: "foreign", label: "Foreign & international" },
  { id: "marksmanship", label: "Marksmanship" },
];

/**
 * All 68 awards, in precedence order. `sprite` is the tile index and MUST equal
 * the array index — asserted in the test suite. It is written out explicitly
 * anyway so a reordering mistake is visible in review rather than implied.
 */
export const AWARDS = [
  // --- Personal decorations -------------------------------------------------
  a("moh", "Medal of Honor", 0, { group: "personal", abbr: "MOH" }),
  a("navy-cross", "Navy Cross", 1, { group: "personal" }),
  a("ddsm", "Defense Distinguished Service Medal", 2, { group: "personal", abbr: "DDSM" }),
  a("dsm", "Distinguished Service Medal", 3, { group: "personal", abbr: "DSM" }),
  a("silver-star", "Silver Star", 4, { group: "personal" }),
  a("dssm", "Defense Superior Service Medal", 5, { group: "personal", abbr: "DSSM" }),
  a("lom", "Legion of Merit", 6, { group: "personal", abbr: "LOM" }),
  a("dfc", "Distinguished Flying Cross", 7, { group: "personal", abbr: "DFC" }),
  a("nmcm", "Navy/Marine Corps Medal", 8, { group: "personal" }),
  a("bronze-star", "Bronze Star", 9, { group: "personal" }),
  a("purple-heart", "Purple Heart", 10, { group: "personal", abbr: "PH" }),
  a("dmsm", "Defense Meritorious Service Medal", 11, { group: "personal", abbr: "DMSM" }),
  a("msm", "Meritorious Service Medal", 12, { group: "personal", abbr: "MSM" }),
  a("air-medal", "Air Medal", 13, { group: "personal" }),
  a("jscm", "Joint Service Commendation Medal", 14, { group: "personal", abbr: "JSCM" }),
  a("nmccm", "Navy/Marine Corps Commendation Medal", 15, {
    group: "personal",
    abbr: "NAM/NCM",
  }),
  a("jsam", "Joint Service Achievement Medal", 16, { group: "personal", abbr: "JSAM" }),
  a("nmcam", "Navy/Marine Corps Achievement Medal", 17, { group: "personal", abbr: "NAM" }),
  a("car", "Combat Action Ribbon", 18, { group: "personal", abbr: "CAR" }),

  // --- Unit awards ----------------------------------------------------------
  a("puc", "Presidential Unit Citation", 19, { group: "unit", abbr: "PUC" }),
  a("jmua", "Joint Meritorious Unit Award", 20, { group: "unit", abbr: "JMUA" }),
  a("nuc", "Navy Unit Commendation", 21, { group: "unit", abbr: "NUC" }),
  a("muc", "Meritorious Unit Commendation", 22, { group: "unit", abbr: "MUC" }),
  a("navy-e", "Navy “E” Ribbon", 23, { group: "unit" }),

  // --- Good conduct & reserve ----------------------------------------------
  a("pow", "POW Medal", 24, { group: "good-conduct", abbr: "POW" }),
  a("gcm", "Good Conduct Medal", 25, { group: "good-conduct", abbr: "GCM" }),
  a("nrmsm", "Navy Reserve Meritorious Service Medal", 26, {
    group: "good-conduct",
    abbr: "NRMSM",
  }),

  // --- Campaign & service ---------------------------------------------------
  a("fmf-ribbon", "Navy Fleet Marine Force Ribbon", 27, { group: "campaign" }),
  a("nem", "Navy Expeditionary Medal", 28, { group: "campaign" }),
  a("ndsm", "National Defense Service Medal", 29, { group: "campaign", abbr: "NDSM" }),
  a("ksm", "Korean Service Medal", 30, { group: "campaign" }),
  a("asm-antarctica", "Antarctica Service Medal", 31, { group: "campaign" }),
  a("afem", "Armed Forces Expeditionary Medal", 32, { group: "campaign", abbr: "AFEM" }),
  a("vsm", "Vietnam Service Medal", 33, { group: "campaign" }),
  a("swasm", "Southwest Asia Service Medal", 34, { group: "campaign" }),
  a("kcm", "Kosovo Campaign Medal", 35, { group: "campaign", abbr: "KCM" }),
  a("acm", "Afghanistan Campaign Medal", 36, { group: "campaign", abbr: "ACM" }),
  a("icm", "Iraq Campaign Medal", 37, { group: "campaign", abbr: "ICM" }),
  a("gwotem", "Global War on Terrorism Expeditionary Medal", 38, {
    group: "campaign",
    abbr: "GWOT-E",
  }),
  a("gwotsm", "Global War on Terrorism Service Medal", 39, {
    group: "campaign",
    abbr: "GWOT-S",
  }),
  a("kdsm", "Korea Defense Service Medal", 40, { group: "campaign", abbr: "KDSM" }),
  a("afsm", "Armed Forces Service Medal", 41, { group: "campaign", abbr: "AFSM" }),
  a("hsm", "Humanitarian Service Medal", 42, { group: "campaign", abbr: "HSM" }),
  a("movsm", "Military Outstanding Volunteer Service Medal", 43, {
    group: "campaign",
    abbr: "MOVSM",
  }),

  // --- Service & training ---------------------------------------------------
  a("ssdr", "Sea Service Deployment Ribbon", 44, { group: "service", abbr: "SSDR" }),
  a("nasr", "Navy Arctic Service Ribbon", 45, { group: "service" }),
  a("nrssr", "Navy Reserve Sea Service Ribbon", 46, { group: "service" }),
  a("nmcosr", "Navy/Marine Corps Overseas Service Ribbon", 47, { group: "service" }),
  a("nrsr", "Navy Recruiting Service Ribbon", 48, { group: "service" }),
  a("nrtsm", "Navy Recruit Training Service Medal", 49, { group: "service" }),
  a("afrm", "Armed Forces Reserve Medal", 50, { group: "service", abbr: "AFRM" }),
  a("ncdr", "Navy Ceremonial Duty Ribbon", 51, { group: "service" }),
  a("navy-reserve-medal", "Navy Reserve Medal", 52, { group: "service" }),

  // --- Foreign unit awards --------------------------------------------------
  a("phil-puc", "Philippine Presidential Unit Citation", 53, { group: "foreign-unit" }),
  a("rok-puc", "Republic of Korea Presidential Unit Citation", 54, {
    group: "foreign-unit",
    corrected: 'Source chart prints "Presideantial Unit Citation".',
  }),
  a("rvn-puc", "Republic of Vietnam Presidential Unit Citation", 55, {
    group: "foreign-unit",
  }),
  a("rvn-gallantry", "Republic of Vietnam Gallantry Cross Unit Citation", 56, {
    group: "foreign-unit",
  }),
  a("rvn-civil", "Republic of Vietnam Civil Actions Unit Citation", 57, {
    group: "foreign-unit",
  }),

  // --- Foreign & international ---------------------------------------------
  a("un-service", "United Nations Service Medal", 58, { group: "foreign" }),
  a("un-medal", "United Nations Medal", 59, { group: "foreign" }),
  a("nato", "NATO Medals", 60, { group: "foreign" }),
  a("mfo", "Multinational Force and Observers Medal", 61, { group: "foreign", abbr: "MFO" }),
  a("iadb", "Inter American Defense Board Medal", 62, { group: "foreign", abbr: "IADB" }),
  a("rvn-campaign", "Republic of Vietnam Campaign Medal", 63, { group: "foreign" }),
  a("klm-ksa", "Kuwait Liberation Medal (Kingdom of Saudi Arabia)", 64, {
    group: "foreign",
    abbr: "KLM-SA",
  }),
  a("klm-kuwait", "Kuwait Liberation Medal (Kuwait)", 65, {
    group: "foreign",
    abbr: "KLM-K",
  }),

  // --- Marksmanship ---------------------------------------------------------
  // Drawn in the chart's legend block, not the ribbon grid. Worn last.
  a("rifle-marksmanship", "Rifle Marksmanship Medal", 66, {
    group: "marksmanship",
    devices: ["silver-e", "bronze-s"],
  }),
  a("pistol-marksmanship", "Pistol Marksmanship Medal", 67, {
    group: "marksmanship",
    devices: ["silver-e", "bronze-s"],
  }),
];

/**
 * Source typos corrected here, for the UI footnote. Award-name typos are derived
 * from the `corrected` flags; the legend typo is appended because it isn't
 * attached to an award.
 */
export const CORRECTIONS = [
  ...AWARDS.filter((x) => x.corrected).map((x) => ({
    precedence: AWARDS.indexOf(x) + 1,
    shown: x.title,
    note: x.corrected,
  })),
  {
    shown: "Silver/Gold Star (device legend)",
    note: 'Source chart prints "Silver: Warn in lieu of five gold stars".',
  },
];

export const AWARD_BY_ID = new Map(AWARDS.map((x) => [x.id, x]));

/**
 * Devices, transcribed from the chart's legend.
 *
 * `rule` is the reference text, shown verbatim in the knowledge section. The rest
 * is for the calculator's generated prose:
 *   - `noun`/`plural` — the bare thing ("star", "stars"). `name` is the legend
 *     heading ("Gold / silver star") and reads wrong after a colour word.
 *     Plurals are spelled out rather than suffixed, because "hourglasss".
 *   - `lesserColour` — gold for Navy decorations, bronze for campaign and
 *     service ribbons. Present ONLY on devices that come in two colours; the
 *     hourglass and Battle "E" don't, so calling one "bronze" would be invented.
 *
 * Only devices used for multiple awards carry these; the rest are legend-only.
 */
export const DEVICES = [
  {
    id: "gold-silver-star",
    name: "Gold / silver star",
    noun: "star",
    plural: "stars",
    lesserColour: "gold",
    rule: "Gold denotes subsequent awards of the same Navy decoration. A silver star is worn in lieu of five gold stars.",
  },
  {
    id: "bronze-silver-star",
    name: "Bronze / silver service star",
    noun: "service star",
    plural: "service stars",
    lesserColour: "bronze",
    rule: "Represents participation in campaigns or operations, multiple qualifications, or an additional award of a ribbon on which it is authorized. A silver star is worn in lieu of five bronze stars.",
  },
  {
    id: "oak-leaf",
    name: "Bronze / silver oak leaf cluster",
    noun: "oak leaf cluster",
    plural: "oak leaf clusters",
    lesserColour: "bronze",
    rule: "Represents second and subsequent entitlements of awards. Silver is worn for the 6th and 11th, or in lieu of five bronze oak leaf clusters.",
  },
  {
    id: "v-device",
    name: "“V” device",
    rule: "Authorized for acts or service involving direct participation in combat operations.",
  },
  {
    id: "m-device",
    name: "“M” device",
    rule: "Denotes Naval Reserve mobilization in support of certain operations.",
  },
  {
    id: "hourglass",
    name: "Hourglass",
    noun: "hourglass",
    plural: "hourglasses",
    rule: "Issued for each succeeding award of the Armed Forces Reserve Medal.",
  },
  {
    id: "battle-e",
    name: "Battle “E” device",
    noun: "Battle “E” device",
    plural: "Battle “E” devices",
    rule: "Denotes permanent duty on U.S. ships or squadrons that have won a battle efficiency competition. One device per award up to the third; for the fourth and all subsequent awards a single silver-wreathed “E” is used.",
  },
  {
    id: "silver-e",
    name: "Silver “E”",
    rule: "Denotes Expert Marksman qualification.",
  },
  {
    id: "bronze-s",
    name: "Bronze “S”",
    rule: "Denotes Sharpshooter Marksman qualification.",
  },
  {
    id: "strike-flight",
    name: "Strike/flight numeral",
    rule: "A bronze Arabic numeral denotes the total number of strike/flight awards of the Air Medal earned after 9 April 1962.",
  },
  {
    id: "fmf-combat",
    name: "Fleet Marine Force Combat Operations Insignia",
    rule: "For Navy personnel attached to Fleet Marine Force units participating in combat operations.",
  },
  {
    id: "wintered-over",
    name: "Wintered Over",
    noun: "Wintered Over device",
    plural: "Wintered Over devices",
    rule: "For wintering over on the Antarctic continent — a clasp for the Antarctica Service Medal, and a suspension ribbon and disc for the service ribbon. Bronze for the first winter, gold for the second, silver for the third.",
  },
  {
    id: "palm",
    name: "“3/16” palm",
    rule: "Worn on the Republic of Vietnam Gallantry Cross Unit Citation and Republic of Vietnam Civil Actions Unit Citation ribbons.",
  },
  {
    id: "clasp",
    name: "Europe and Asia clasps",
    rule: "Worn on the suspension ribbon of the Navy Occupation Service Medal.",
  },
  {
    id: "kuwait-cluster",
    name: "Kuwait Liberation cluster",
    rule: "Worn on the Kuwait Liberation Medal.",
  },
];

/**
 * Which multiple-award device an award uses.
 *
 * Navy decorations take gold stars (silver in lieu of five); campaign and
 * service ribbons take bronze service stars (silver in lieu of five); joint
 * awards take oak leaf clusters; the AFRM takes an hourglass. Awards absent
 * from this map are treated as single-award only, so the picker won't offer a
 * count for something that can't carry one.
 */
export const MULTIPLE_DEVICE = {
  // Joint awards use oak leaf clusters, not stars.
  ddsm: "oak-leaf",
  dssm: "oak-leaf",
  dmsm: "oak-leaf",
  jscm: "oak-leaf",
  jsam: "oak-leaf",
  jmua: "oak-leaf",
  // Navy personal decorations: gold star, silver in lieu of five.
  "navy-cross": "gold-silver-star",
  dsm: "gold-silver-star",
  "silver-star": "gold-silver-star",
  lom: "gold-silver-star",
  dfc: "gold-silver-star",
  nmcm: "gold-silver-star",
  "bronze-star": "gold-silver-star",
  "purple-heart": "gold-silver-star",
  msm: "gold-silver-star",
  "air-medal": "gold-silver-star",
  nmccm: "gold-silver-star",
  nmcam: "gold-silver-star",
  car: "gold-silver-star",
  gcm: "gold-silver-star",
  nrmsm: "gold-silver-star",
  // Unit and campaign awards: bronze service star, silver in lieu of five.
  puc: "bronze-silver-star",
  nuc: "bronze-silver-star",
  muc: "bronze-silver-star",
  "navy-e": "battle-e",
  nem: "bronze-silver-star",
  ndsm: "bronze-silver-star",
  ksm: "bronze-silver-star",
  afem: "bronze-silver-star",
  vsm: "bronze-silver-star",
  swasm: "bronze-silver-star",
  kcm: "bronze-silver-star",
  acm: "bronze-silver-star",
  icm: "bronze-silver-star",
  gwotem: "bronze-silver-star",
  kdsm: "bronze-silver-star",
  afsm: "bronze-silver-star",
  hsm: "bronze-silver-star",
  movsm: "bronze-silver-star",
  ssdr: "bronze-silver-star",
  nasr: "bronze-silver-star",
  nrssr: "bronze-silver-star",
  nmcosr: "bronze-silver-star",
  nrsr: "bronze-silver-star",
  ncdr: "bronze-silver-star",
  "navy-reserve-medal": "bronze-silver-star",
  "fmf-ribbon": "bronze-silver-star",
  "asm-antarctica": "wintered-over",
  // The Armed Forces Reserve Medal is the hourglass award.
  afrm: "hourglass",
  // Foreign and international.
  "un-medal": "bronze-silver-star",
  nato: "bronze-silver-star",
  mfo: "bronze-silver-star",
  "rvn-campaign": "bronze-silver-star",
  "klm-ksa": "bronze-silver-star",
  "klm-kuwait": "bronze-silver-star",
};

export const DEVICE_BY_ID = new Map(DEVICES.map((d) => [d.id, d]));

const GROUP_LABEL = new Map(GROUPS.map((g) => [g.id, g.label]));

export default {
  id: "awards",
  title: "Navy Awards & Precedence",
  eyebrow: "Awards",
  blurb:
    "All 68 Navy ribbons in order of precedence, with the devices that go on them.",
  sourcePdf: "usn-ribbons.pdf",
  keywords: [
    "award",
    "awards",
    "ribbon",
    "ribbons",
    "rack",
    "ribbon rack",
    "precedence",
    "order of precedence",
    "medal",
    "medals",
    "device",
    "devices",
    "star",
    "oak leaf",
    "decoration",
    "decorations",
    "wear",
    "mount",
    "nam",
    "car",
    "good conduct",
  ],
  note:
    "Precedence and device rules are transcribed from the Navy ribbons-and-devices chart. " +
    "It is not SECNAVINST 1650.1, carries no eligibility rules, and predates any award created after the chart was published. " +
    "One source typo is corrected here and footnoted.",
  systems: ["ndaws", "nsips"],
  toolRoute: { name: "tools", params: { tool: "ribbons" } },
  toolLabel: "Open the ribbon rack calculator",
  /**
   * ONE precedence section, not one per group.
   *
   * Splitting it by group was the obvious move and it was wrong twice over.
   * Precedence is a single ordered sequence — the answer to "what order do
   * ribbons go in" is the whole list, and a citation that lands on "Campaign &
   * service" answers a question nobody asked. It also broke retrieval: seven
   * sections sharing the topic's keywords and differing only in their award
   * names scored identically, so the scorer returned an arbitrary one of an
   * eight-way tie. Groups survive as a column and as the picker's structure,
   * which is where grouping actually helps.
   */
  sections: [
    {
      id: "precedence",
      heading: "Order of precedence",
      kind: "awards",
      keywords: [
        "precedence",
        "order",
        "order of precedence",
        "senior",
        "junior",
        "list",
        "all",
        ...GROUPS.map((g) => g.label.toLowerCase()),
        ...AWARDS.flatMap((x) => [x.title.toLowerCase(), x.abbr?.toLowerCase()]).filter(Boolean),
      ],
      rows: AWARDS.map((x, i) => ({
        ...x,
        precedence: i + 1,
        groupLabel: GROUP_LABEL.get(x.group),
      })),
    },
    {
      id: "wear",
      heading: "How a rack is worn",
      kind: "steps",
      keywords: [
        "rack",
        "ribbon rack",
        "wear",
        "worn",
        "mount",
        "rows",
        "row",
        "three",
        "top",
        "bottom",
        "build",
        "arrange",
        "layout",
      ],
      rows: [
        "Ribbons are worn in order of precedence, most senior first — top row, inboard (wearer's right) to outboard.",
        "Mount three ribbons per row.",
        "Build the rack from the bottom up. When your total isn't a multiple of three, the short row is the TOP one and it is centred over the row beneath it — so seven ribbons is 1 over 3 over 3, not 3 over 3 over 1.",
        "Multiple awards of the same ribbon are shown with devices on that one ribbon, not by wearing it twice.",
        "A silver star or oak leaf cluster is worn in place of five bronze or gold ones.",
      ],
    },
    {
      id: "devices",
      heading: "Devices",
      kind: "kv",
      keywords: [
        "device",
        "devices",
        "star",
        "gold star",
        "silver star",
        "oak leaf cluster",
        "v device",
        "m device",
        "hourglass",
        "battle e",
        "strike flight",
        "wintered over",
        "palm",
        "clasp",
      ],
      rows: DEVICES.map((d) => ({ k: d.name, v: d.rule })),
    },
  ],
};

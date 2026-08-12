/**
 * Unified Combatant Commands + command authorities.
 * Source of truth: guides/military/cocoms/build_cocoms.py
 * (GEOGRAPHIC, FUNCTIONAL, AUTHORITIES). Entities converted to Unicode.
 *
 * The AUTHORITIES table (COCOM/OPCON/TACON/ADCON/DIRLAUTH) came along with the
 * COCOM source and is the most-asked-about material of the set, so it ships as
 * its own section rather than being dropped.
 */

export const GEOGRAPHIC = [
  {
    command: "USNORTHCOM",
    focus: "North America",
    hq: "Peterson SFB, Colorado Springs, CO",
    fleet: "C2F, C3F",
    aor: "N. America, Mexico, Canada",
  },
  {
    command: "USSOUTHCOM",
    focus: "Cent./S. America",
    hq: "Miami, FL",
    fleet: "C4F",
    aor: "Cent./S. America, Caribbean; Panama Canal",
  },
  {
    command: "USEUCOM",
    focus: "Europe",
    hq: "Patch Barracks, Stuttgart, Germany",
    fleet: "C6F",
    aor: "Europe, Russia; CDR is SACEUR (NATO)",
  },
  {
    command: "USAFRICOM",
    focus: "Africa",
    hq: "Kelley Barracks, Stuttgart, Germany",
    fleet: "C6F",
    aor: "Africa (less Egypt)",
  },
  {
    command: "USCENTCOM",
    focus: "Middle East",
    hq: "MacDill AFB, Tampa, FL",
    fleet: "C5F",
    aor: "Middle East, Egypt, C./SW Asia",
  },
  {
    command: "USINDOPACOM",
    focus: "Indo-Pacific",
    hq: "Camp H.M. Smith, Oahu, HI",
    fleet: "C3F, C7F",
    aor: "Pacific/Indian Oceans, Asia, Australia",
  },
  {
    command: "USSPACECOM",
    focus: "Space",
    hq: "Peterson SFB, Colorado Springs, CO",
    fleet: "C10F",
    aor: "Space domain (≥100 km)",
  },
];

export const FUNCTIONAL = [
  {
    command: "USSOCOM",
    focus: "Special Operations",
    hq: "MacDill AFB, Tampa, FL",
    mission: "Global SOF operations & missions",
  },
  {
    command: "USSTRATCOM",
    focus: "Strategic",
    hq: "Offutt AFB, Omaha, NE",
    mission: "Nuclear deterrence/strike; forces stay under STRATCOM",
  },
  {
    command: "USTRANSCOM",
    focus: "Transportation",
    hq: "Scott AFB, Belleville, IL",
    mission: "Global mobility (AMC + MSC); forces stay under TRANSCOM",
  },
  {
    command: "USCYBERCOM",
    focus: "Cyber",
    hq: "Ft. Meade, MD",
    mission: "Global cyberspace warning & defense",
  },
];

/** Command authorities (legal control relationships). */
export const AUTHORITIES = [
  {
    code: "COCOM",
    name: "Combatant Command (command authority)",
    desc: "Unitary control held by the combatant commander (CCDR) over their geographic or functional CCMD; NOT further delegatable.",
  },
  {
    code: "OPCON",
    name: "Operational Control",
    desc: "Authority to organize forces, assign tasks, designate objectives, and give authoritative direction over all aspects of operations. A standing control over a strike group.",
  },
  {
    code: "TACON",
    name: "Tactical Control",
    desc: "Limited to detailed direction and control of movements/maneuvers within the operational area (e.g., an oiler directing ships during UNREP); more limited in scope/duration than OPCON.",
  },
  {
    code: "ADCON",
    name: "Administrative Control",
    desc: "Authority over administration and support — man, train, equip; control of resources, personnel, logistics. The chain that signs your FITREP.",
  },
  {
    code: "DIRLAUTH",
    name: "Direct Liaison Authorized",
    desc: "NOT an authority — a coordination relationship letting a subordinate coordinate directly with a command inside or outside the granting command (e.g., legal/cyber liaison).",
  },
];

export default {
  id: "combatant-commands",
  title: "Unified Combatant Commands",
  eyebrow: "CCMD",
  blurb:
    "The 11 unified combatant commands — 7 geographic, 4 functional — plus the command authorities that link them to forces.",
  sourcePdf: "combatant-commands.pdf",
  // Topic keywords are merged into EVERY section of the topic, so anything here
  // is worth exactly the same to all four sections and can only break ties by
  // section order. The individual command names therefore live on the sections
  // that actually describe them, below — the names used to be here, which made
  // "what does INDOPACOM cover" a four-way tie resolved by whichever section
  // came first, and adding the map section moved the answer to the map.
  keywords: ["combatant command", "ccmd", "cocom", "unified command", "aor"],
  sections: [
    {
      id: "map",
      heading: "AOR Map",
      kind: "map",
      keywords: [
        "map",
        "boundary",
        "boundaries",
        "which command",
        "who owns",
        "area of responsibility",
        "region",
        "world",
      ],
      map: {
        // "all" rather than a list: the point of this section is that the six
        // geographic AORs tile the globe, so naming a subset would be a claim.
        regions: "all",
        label:
          "World map showing the six geographic combatant command areas of responsibility: NORTHCOM covering North America and the Arctic, SOUTHCOM covering Central and South America, EUCOM covering Europe and Russia, AFRICOM covering Africa less Egypt, CENTCOM covering the Middle East and central Asia, and INDOPACOM covering the Pacific and Indian Oceans.",
        caption:
          "Boundaries from the published AOR polygons; coastlines from Natural Earth. Equirectangular projection. The four functional commands are not drawn — their AOR is global, and USSPACECOM's begins 100 km up.",
        pins: [
          // The two Stuttgart commands share a city, so their pins would print
          // on top of each other; EUCOM's label is nudged up and AFRICOM's down.
          { label: "Peterson SFB (NORTHCOM)", lon: -104.8, lat: 38.8, dx: -108, dy: -4 },
          { label: "Miami (SOUTHCOM)", lon: -80.3, lat: 25.8, dx: -20, dy: 15 },
          { label: "Stuttgart (EUCOM)", lon: 9.2, lat: 48.8, dx: -84, dy: -5 },
          { label: "Stuttgart (AFRICOM)", lon: 9.2, lat: 48.8, dx: -90, dy: 9 },
          { label: "MacDill AFB (CENTCOM)", lon: -82.5, lat: 27.8, dx: -104, dy: -5 },
          { label: "Camp H.M. Smith (INDOPACOM)", lon: -157.9, lat: 21.3, dx: 6, dy: 11 },
        ],
      },
    },
    {
      id: "geographic",
      heading: "Geographic Commands (7)",
      kind: "table",
      // The geographic command names live here rather than on the topic: this
      // table is the best answer to "what does INDOPACOM cover", because it has
      // the AOR, the HQ, and the numbered fleet as fields.
      keywords: [
        "geographic",
        "aor",
        "area of responsibility",
        "hq",
        "fleet",
        "covers",
        "northcom",
        "southcom",
        "eucom",
        "africom",
        "centcom",
        "indopacom",
        "spacecom",
      ],
      columns: [
        { key: "command", title: "Command", mono: true },
        { key: "focus", title: "Focus" },
        { key: "hq", title: "HQ" },
        { key: "fleet", title: "Fleet", mono: true },
        { key: "aor", title: "AOR" },
      ],
      rows: GEOGRAPHIC,
    },
    {
      id: "functional",
      heading: "Functional Commands (4)",
      kind: "table",
      keywords: [
        "functional",
        "special operations",
        "strategic",
        "transportation",
        "cyber",
        "socom",
        "stratcom",
        "transcom",
        "cybercom",
      ],
      columns: [
        { key: "command", title: "Command", mono: true },
        { key: "focus", title: "Focus" },
        { key: "hq", title: "HQ" },
        { key: "mission", title: "Mission" },
      ],
      rows: FUNCTIONAL,
    },
    {
      id: "authorities",
      heading: "Command Authorities",
      kind: "code-cards",
      keywords: [
        "authority",
        "opcon",
        "tacon",
        "adcon",
        "dirlauth",
        "operational control",
        "tactical control",
        "administrative control",
        "chain of command",
        "who controls",
      ],
      rows: AUTHORITIES.map((a) => ({
        code: a.code,
        title: a.name,
        bullets: [a.desc],
      })),
    },
  ],
};

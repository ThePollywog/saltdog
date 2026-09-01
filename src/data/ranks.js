/**
 * Uniformed service rank charts, all six services.
 *
 * Source: the US_*_RANKS.docx.pdf charts in guides/military/ (source: defense.gov).
 * Those PDFs are single flattened bitmaps with no text layer, so this data was
 * transcribed by rendering each page. There is no separately embedded image per
 * rank to extract — but the rendered page puts every insignia in its own table
 * cell, and cells are findable, so tools/extract-ranks.mjs cuts them into
 * public/img/ranks.png and each rank below carries its tile index.
 *
 * Tier gaps are real, not omissions: USCG has only W-2..W-4; the Air Force and
 * Space Force have no warrant tier; the Marine Corps and Space Force charts
 * carry no wartime 5-star grade.
 */

const r = (grade, title, abbr, extra) => ({ grade, title, abbr, ...extra });

/** Chart order, top to bottom. The sprite sheet is cut in this order. */
export const TIERS = ["enlisted", "warrant", "officer"];

/**
 * Sprite geometry. tools/extract-ranks.mjs imports these rather than declaring
 * its own copy, so the sheet it writes and the offsets the UI computes cannot
 * disagree about the tile size.
 */
export const TILE = 96;
export const SPRITE_COLS = 12;

/**
 * The paygrade with no insignia, in every service: the chart cell holds the
 * words "No Insignia". Excluded from the sheet rather than shipped as a blank
 * tile — a blank tile is indistinguishable from a segmentation failure.
 */
const NO_INSIGNIA = "E-1";

export const SERVICES = [
  {
    id: "usn",
    name: "Navy",
    short: "USN",
    sourcePdf: "usn-ranks.pdf",
    seniorEnlisted: "Master Chief Petty Officer of the Navy (MCPON)",
    wartime: "Fleet Admiral (wartime only)",
    enlisted: [
      r("E-1", "Seaman Recruit", "SR"),
      r("E-2", "Seaman Apprentice", "SA"),
      r("E-3", "Seaman", "SN"),
      r("E-4", "Petty Officer Third Class", "PO3"),
      r("E-5", "Petty Officer Second Class", "PO2"),
      r("E-6", "Petty Officer First Class", "PO1"),
      r("E-7", "Chief Petty Officer", "CPO"),
      r("E-8", "Senior Chief Petty Officer", "SCPO"),
      r("E-9", "Master Chief Petty Officer", "MCPO", {
        variants: ["Fleet Master Chief Petty Officer", "Command Master Chief Petty Officer"],
      }),
    ],
    warrant: [
      r("W-1", "Warrant Officer 1", "WO1"),
      r("W-2", "Chief Warrant Officer 2", "CWO2"),
      r("W-3", "Chief Warrant Officer 3", "CWO3"),
      r("W-4", "Chief Warrant Officer 4", "CWO4"),
      r("W-5", "Chief Warrant Officer 5", "CWO5"),
    ],
    officer: [
      r("O-1", "Ensign", "ENS"),
      r("O-2", "Lieutenant Junior Grade", "LTJG"),
      r("O-3", "Lieutenant", "LT"),
      r("O-4", "Lieutenant Commander", "LCDR"),
      r("O-5", "Commander", "CDR"),
      r("O-6", "Captain", "CAPT"),
      r("O-7", "Rear Admiral Lower Half", "RDML"),
      r("O-8", "Rear Admiral Upper Half", "RADM"),
      r("O-9", "Vice Admiral", "VADM"),
      r("O-10", "Admiral", "ADM"),
    ],
  },
  {
    id: "usmc",
    name: "Marine Corps",
    short: "USMC",
    sourcePdf: "usmc-ranks.pdf",
    seniorEnlisted: "Sergeant Major of the Marine Corps (SgtMajMC)",
    wartime: null,
    enlisted: [
      r("E-1", "Private", "Pvt"),
      r("E-2", "Private First Class", "PFC"),
      r("E-3", "Lance Corporal", "LCpl"),
      r("E-4", "Corporal", "Cpl"),
      r("E-5", "Sergeant", "Sgt"),
      r("E-6", "Staff Sergeant", "SSgt"),
      r("E-7", "Gunnery Sergeant", "GySgt"),
      r("E-8", "Master Sergeant", "MSgt", { variants: ["First Sergeant"] }),
      r("E-9", "Master Gunnery Sergeant", "MGySgt", {
        variants: ["Sergeant Major (SgtMaj)"],
      }),
    ],
    warrant: [
      r("W-1", "Warrant Officer 1", "WO1"),
      r("W-2", "Chief Warrant Officer 2", "CWO2"),
      r("W-3", "Chief Warrant Officer 3", "CWO3"),
      r("W-4", "Chief Warrant Officer 4", "CWO4"),
      r("W-5", "Chief Warrant Officer 5", "CWO5"),
    ],
    officer: [
      r("O-1", "Second Lieutenant", "2ndLt"),
      r("O-2", "First Lieutenant", "1stLt"),
      r("O-3", "Captain", "Capt"),
      r("O-4", "Major", "Maj"),
      r("O-5", "Lieutenant Colonel", "LtCol"),
      r("O-6", "Colonel", "Col"),
      r("O-7", "Brigadier General", "BGen"),
      r("O-8", "Major General", "MajGen"),
      r("O-9", "Lieutenant General", "LtGen"),
      r("O-10", "General", "Gen"),
    ],
  },
  {
    id: "usa",
    name: "Army",
    short: "USA",
    sourcePdf: "usa-ranks.pdf",
    seniorEnlisted: "Sergeant Major of the Army (SMA)",
    wartime: "General of the Army (wartime only)",
    enlisted: [
      r("E-1", "Private", "PVT"),
      r("E-2", "Private", "PV2"),
      r("E-3", "Private First Class", "PFC"),
      r("E-4", "Corporal", "CPL", { variants: ["Specialist (SPC)"] }),
      r("E-5", "Sergeant", "SGT"),
      r("E-6", "Staff Sergeant", "SSG"),
      r("E-7", "Sergeant First Class", "SFC"),
      r("E-8", "Master Sergeant", "MSG", { variants: ["First Sergeant (1SG)"] }),
      r("E-9", "Sergeant Major", "SGM", { variants: ["Command Sergeant Major (CSM)"] }),
    ],
    warrant: [
      r("W-1", "Warrant Officer 1", "WO1"),
      r("W-2", "Chief Warrant Officer 2", "CW2"),
      r("W-3", "Chief Warrant Officer 3", "CW3"),
      r("W-4", "Chief Warrant Officer 4", "CW4"),
      r("W-5", "Chief Warrant Officer 5", "CW5"),
    ],
    officer: [
      r("O-1", "Second Lieutenant", "2LT"),
      r("O-2", "First Lieutenant", "1LT"),
      r("O-3", "Captain", "CPT"),
      r("O-4", "Major", "MAJ"),
      r("O-5", "Lieutenant Colonel", "LTC"),
      r("O-6", "Colonel", "COL"),
      r("O-7", "Brigadier General", "BG"),
      r("O-8", "Major General", "MG"),
      r("O-9", "Lieutenant General", "LTG"),
      r("O-10", "General", "GEN"),
    ],
  },
  {
    id: "usaf",
    name: "Air Force",
    short: "USAF",
    sourcePdf: "usaf-ranks.pdf",
    seniorEnlisted: "Chief Master Sergeant of the Air Force (CMSAF)",
    wartime: "General of the Air Force (wartime only)",
    // The Air Force chart has no warrant officer block.
    warrant: [],
    warrantNote: "The Air Force chart shows no warrant officer grades.",
    enlisted: [
      r("E-1", "Airman Basic", "AB"),
      r("E-2", "Airman", "Amn"),
      r("E-3", "Airman First Class", "A1C"),
      r("E-4", "Senior Airman", "SrA"),
      r("E-5", "Staff Sergeant", "SSgt"),
      r("E-6", "Technical Sergeant", "TSgt"),
      r("E-7", "Master Sergeant", "MSgt", { variants: ["First Sergeant"] }),
      r("E-8", "Senior Master Sergeant", "SMSgt", { variants: ["First Sergeant"] }),
      r("E-9", "Chief Master Sergeant", "CMSgt", {
        variants: ["First Sergeant", "Command Chief Master Sergeant"],
      }),
    ],
    officer: [
      r("O-1", "Second Lieutenant", "2d Lt"),
      r("O-2", "First Lieutenant", "1st Lt"),
      r("O-3", "Captain", "Capt"),
      r("O-4", "Major", "Maj"),
      r("O-5", "Lieutenant Colonel", "Lt Col"),
      r("O-6", "Colonel", "Col"),
      r("O-7", "Brigadier General", "Brig Gen"),
      r("O-8", "Major General", "Maj Gen"),
      r("O-9", "Lieutenant General", "Lt Gen"),
      r("O-10", "General", "Gen"),
    ],
  },
  {
    id: "uscg",
    name: "Coast Guard",
    short: "USCG",
    sourcePdf: "uscg-ranks.pdf",
    seniorEnlisted: "Master Chief Petty Officer of the Coast Guard (MCPOCG)",
    wartime: "Fleet Admiral (wartime only)",
    enlisted: [
      r("E-1", "Seaman Recruit", "SR"),
      r("E-2", "Seaman Apprentice", "SA"),
      r("E-3", "Seaman", "SN"),
      r("E-4", "Petty Officer Third Class", "PO3"),
      r("E-5", "Petty Officer Second Class", "PO2"),
      r("E-6", "Petty Officer First Class", "PO1"),
      r("E-7", "Chief Petty Officer", "CPO"),
      r("E-8", "Senior Chief Petty Officer", "SCPO"),
      r("E-9", "Master Chief Petty Officer", "MCPO", {
        variants: ["Fleet Master Chief Petty Officer"],
      }),
    ],
    // Coast Guard warrant grades run W-2 through W-4 only.
    warrant: [
      r("W-2", "Chief Warrant Officer 2", "CW2"),
      r("W-3", "Chief Warrant Officer 3", "CW3"),
      r("W-4", "Chief Warrant Officer 4", "CW4"),
    ],
    warrantNote: "Coast Guard warrant grades run W-2 through W-4 — there is no W-1 or W-5.",
    officer: [
      r("O-1", "Ensign", "ENS"),
      r("O-2", "Lieutenant Junior Grade", "LTJG"),
      r("O-3", "Lieutenant", "LT"),
      r("O-4", "Lieutenant Commander", "LCDR"),
      r("O-5", "Commander", "CDR"),
      r("O-6", "Captain", "CAPT"),
      r("O-7", "Rear Admiral Lower Half", "RDML"),
      r("O-8", "Rear Admiral Upper Half", "RADM"),
      r("O-9", "Vice Admiral", "VADM"),
      r("O-10", "Admiral", "ADM"),
    ],
  },
  {
    id: "ussf",
    name: "Space Force",
    short: "USSF",
    sourcePdf: "ussf-ranks.pdf",
    seniorEnlisted: "Chief Master Sergeant of the Space Force (CMSSF)",
    wartime: null,
    warrant: [],
    warrantNote: "The Space Force chart shows no warrant officer grades.",
    enlisted: [
      r("E-1", "Specialist 1", "Spc1"),
      r("E-2", "Specialist 2", "Spc2"),
      r("E-3", "Specialist 3", "Spc3"),
      r("E-4", "Specialist 4", "Spc4"),
      r("E-5", "Sergeant", "Sgt"),
      r("E-6", "Technical Sergeant", "TSgt"),
      r("E-7", "Master Sergeant", "MSgt"),
      r("E-8", "Senior Master Sergeant", "SMSgt"),
      r("E-9", "Chief Master Sergeant", "CMSgt"),
    ],
    officer: [
      r("O-1", "Second Lieutenant", "2d Lt"),
      r("O-2", "First Lieutenant", "1st Lt"),
      r("O-3", "Captain", "Capt"),
      r("O-4", "Major", "Maj"),
      r("O-5", "Lieutenant Colonel", "Lt Col"),
      r("O-6", "Colonel", "Col"),
      r("O-7", "Brigadier General", "Brig Gen"),
      r("O-8", "Major General", "Maj Gen"),
      r("O-9", "Lieutenant General", "Lt Gen"),
      r("O-10", "General", "Gen"),
    ],
  },
];

export const SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]));

/** Does this rank have insignia on the sheet? False only for E-1. */
export const hasInsignia = (rank) => rank.grade !== NO_INSIGNIA;

/**
 * What the sprite sheet should contain, in order — the contract between this
 * file and tools/extract-ranks.mjs.
 *
 * The extractor asserts the cell grid it segments out of each chart matches this
 * exactly and refuses to write otherwise. That assertion is the only thing
 * standing between a chart revision and every rank on the site quietly showing
 * its neighbour's insignia: a sprite index is a bare number, so an off-by-one
 * renders perfectly and is wrong. The tier gaps make it a live risk rather than
 * a theoretical one — USCG warrant is W-2..W-4, so three columns where the Navy
 * has five, and the Air Force and Space Force charts have no warrant block at
 * all.
 */
export function insigniaPlan() {
  return SERVICES.map((s) => ({
    id: s.id,
    sourcePdf: s.sourcePdf,
    tiers: TIERS.filter((t) => s[t]?.length).map((t) => ({
      tier: t,
      // Chart columns, which is not the same as tiles: the enlisted row also
      // carries an E-1 "No Insignia" cell and a senior-enlisted-advisor cell
      // (MCPON, SMA, ...) that is a billet, not a paygrade, and has no row here.
      columns: s[t].length + (t === "enlisted" ? 1 : 0),
      count: s[t].filter(hasInsignia).length,
    })),
  }));
}

/** Total tiles on the sheet, derived — never typed in two places. */
export const INSIGNIA_COUNT = insigniaPlan().reduce(
  (n, s) => n + s.tiers.reduce((m, t) => m + t.count, 0),
  0,
);

/**
 * Sheet index for one rank, counted the same way the extractor emits tiles.
 *
 * Computed rather than stored on each rank: writing 126 literals by hand is one
 * transcription pass away from a silent mis-mapping, and an index that is derived
 * from the same array the extractor validates against cannot drift from it.
 *
 * @returns {number|null} null for a rank with no insignia (E-1).
 */
export function insigniaIndex(serviceId, rank) {
  if (!hasInsignia(rank)) return null;
  let i = 0;
  for (const s of SERVICES) {
    for (const tier of TIERS) {
      for (const x of s[tier] ?? []) {
        if (!hasInsignia(x)) continue;
        if (s.id === serviceId && x.grade === rank.grade) return i;
        i += 1;
      }
    }
  }
  return null;
}

/** Every correction applied above, for the UI footnote. */
export const CORRECTIONS = SERVICES.flatMap((s) =>
  [...s.enlisted, ...s.warrant, ...s.officer]
    .filter((x) => x.corrected)
    .map((x) => ({
      service: s.short,
      grade: x.grade,
      shown: `${x.title} (${x.abbr})`,
      note: x.corrected,
    })),
);

/** Find every rank matching a paygrade across services, e.g. "E-5". */
export function byPaygrade(grade) {
  const want = String(grade).toUpperCase().replace(/\s+/g, "");
  return SERVICES.flatMap((s) =>
    [...s.enlisted, ...s.warrant, ...s.officer]
      .filter((x) => x.grade.replace(/\s+/g, "") === want)
      .map((x) => ({ service: s.short, serviceName: s.name, ...x })),
  );
}

export default {
  id: "ranks",
  title: "Uniformed Service Rank Charts",
  eyebrow: "Rank",
  blurb:
    "Enlisted, warrant, and officer grades for all six armed services, with paygrade equivalents.",
  sourcePdf: "usn-ranks.pdf",
  keywords: [
    "rank",
    "ranks",
    "paygrade",
    "pay grade",
    "insignia",
    "enlisted",
    "officer",
    "warrant",
    "equivalent",
    "e5",
    "o3",
    "chief",
    "petty officer",
    "sergeant",
    "lieutenant",
    "admiral",
    "general",
  ],
  note:
    "Insignia artwork is cut from the defense.gov source charts; download a chart for the full-size original.",
  toolRoute: { name: "tools", params: { tool: "ranks" } },
  toolLabel: "Open the rank explorer",
  sections: SERVICES.map((s) => ({
    id: s.id,
    heading: `${s.name} (${s.short})`,
    kind: "ranks",
    keywords: [
      s.name.toLowerCase(),
      s.short.toLowerCase(),
      ...s.enlisted.map((x) => x.title.toLowerCase()),
      ...s.officer.map((x) => x.title.toLowerCase()),
    ],
    rows: s,
  })),
};

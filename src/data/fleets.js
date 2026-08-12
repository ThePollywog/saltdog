/**
 * U.S. Navy numbered fleets.
 * Source of truth: guides/military/cocoms/build_fleets.py (FLEETS, NOTES).
 * Entities converted to Unicode.
 */

export const FLEETS = [
  {
    fleet: "2nd Fleet",
    region: "N. Atlantic",
    hq: "Norfolk, VA",
    parent: "U.S. Fleet Forces Command",
    aor: "Atlantic Ocean & Arctic approaches",
  },
  {
    fleet: "3rd Fleet",
    region: "E./Cent. Pacific",
    hq: "San Diego, CA",
    parent: "U.S. Pacific Fleet",
    aor: "Eastern & central Pacific, eastern Pacific approaches",
  },
  {
    fleet: "4th Fleet",
    region: "Caribbean / S. Atl.",
    hq: "Mayport, FL",
    parent: "U.S. Naval Forces Southern Command",
    aor: "Caribbean, Central & South America",
  },
  {
    fleet: "5th Fleet",
    region: "Middle East",
    hq: "Manama, Bahrain",
    parent: "U.S. Naval Forces Central Command",
    aor: "Persian Gulf, Red Sea, Arabian Sea, Gulf of Oman",
  },
  {
    fleet: "6th Fleet",
    region: "Europe / Africa",
    hq: "Naples, Italy",
    parent: "U.S. Naval Forces Europe-Africa",
    aor: "Mediterranean & waters around Europe & Africa",
  },
  {
    fleet: "7th Fleet",
    region: "W. Pacific / Indian",
    hq: "Yokosuka, Japan",
    parent: "U.S. Pacific Fleet",
    aor: "Western Pacific & Indian Ocean (largest forward fleet)",
  },
  {
    fleet: "10th Fleet",
    region: "Cyberspace",
    hq: "Fort Meade, MD",
    parent: "U.S. Fleet Cyber Command",
    aor: "Navy cyberspace, networks, cryptologic & space ops (no geographic AOR)",
  },
];

export const NOTES = [
  {
    k: "Numbered vs. named",
    v: "A 'numbered fleet' is the operational force; it falls under a named fleet/component (Pacific Fleet, Fleet Forces, NAVEUR, NAVCENT).",
  },
  { k: "Pacific Fleet", v: "Provides 3rd and 7th Fleets." },
  { k: "Fleet Forces Command", v: "Provides 2nd Fleet (re-established 2018)." },
  {
    k: "Component link",
    v: "5th = NAVCENT (CENTCOM), 6th = NAVEUR-NAVAF (EUCOM/AFRICOM), 4th = NAVSOUTH (SOUTHCOM).",
  },
  {
    k: "1st Fleet",
    v: "Historical — disestablished 1973 (its role folded into 3rd Fleet); periodically proposed for re-establishment.",
  },
  { k: "10th Fleet", v: "Functional, not geographic — Fleet Cyber Command." },
];

/**
 * Fleet operating areas as approximate ellipses: (centre lon/lat, radius in
 * degrees of lon and lat). Source of truth: build_fleets.py FLEET_ZONES.
 *
 * These are illustrative, not authoritative. Unlike the COCOM AORs there is no
 * published polygon for a numbered fleet's water — the boundaries move with the
 * Unified Command Plan and with whoever is chopped to whom this week. Drawing
 * them as hard outlines would state a precision that does not exist, which is
 * why they are dashed ellipses and the caption says "approximate".
 */
export const FLEET_ZONES = [
  { label: "2ND", lon: -40, lat: 35, rLon: 22, rLat: 22 },
  { label: "3RD", lon: -140, lat: 15, rLon: 30, rLat: 30 },
  { label: "4TH", lon: -75, lat: -10, rLon: 22, rLat: 22 },
  { label: "5TH", lon: 60, lat: 18, rLon: 16, rLat: 16 },
  { label: "6TH", lon: 18, lat: 38, rLon: 20, rLat: 20 },
  { label: "7TH", lon: 150, lat: 5, rLon: 34, rLat: 34 },
];

/** Fleet headquarters. `dx`/`dy` nudge the label clear of the coastline. */
export const FLEET_HQ = [
  { label: "Norfolk (2nd)", lon: -76.3, lat: 36.8, dx: -62, dy: -4 },
  { label: "San Diego (3rd)", lon: -117.2, lat: 32.7, dx: -70, dy: 3 },
  { label: "Mayport (4th)", lon: -81.4, lat: 30.4, dx: 6, dy: 9 },
  { label: "Bahrain (5th)", lon: 50.6, lat: 26.2, dx: 6, dy: -5 },
  { label: "Naples (6th)", lon: 14.3, lat: 40.8, dx: -46, dy: -5 },
  { label: "Yokosuka (7th)", lon: 139.7, lat: 35.3, dx: -58, dy: -5 },
];

export default {
  id: "navy-fleets",
  title: "U.S. Navy Numbered Fleets",
  eyebrow: "USN",
  blurb:
    "Global operating areas, headquarters, and parent commands for the numbered fleets.",
  sourcePdf: "navy-fleets.pdf",
  keywords: [
    "fleet",
    "numbered fleet",
    "2nd fleet",
    "3rd fleet",
    "4th fleet",
    "5th fleet",
    "6th fleet",
    "7th fleet",
    "10th fleet",
    "aor",
    "operating area",
  ],
  sections: [
    {
      id: "map",
      heading: "Operating Areas",
      kind: "map",
      keywords: [
        "map",
        "where",
        "operating area",
        "world",
        "ocean",
        "atlantic",
        "pacific",
        "mediterranean",
        "indian ocean",
        "persian gulf",
      ],
      map: {
        // No AOR fills here. The COCOM polygons are a different fact and would
        // read as fleet boundaries on this page — 5th Fleet is not CENTCOM.
        regions: [],
        label:
          "World map with the approximate operating areas of the numbered fleets marked: 2nd in the North Atlantic, 3rd in the eastern and central Pacific, 4th off Central and South America, 5th in the Persian Gulf and Arabian Sea, 6th in the Mediterranean, and 7th in the western Pacific and Indian Ocean. Headquarters are marked at Norfolk, San Diego, Mayport, Bahrain, Naples, and Yokosuka.",
        caption:
          "Dashed ellipses are approximate operating areas, not published boundaries — a numbered fleet's water shifts with the Unified Command Plan. Filled dots are fleet headquarters. 10th Fleet is cyberspace and has no geographic area.",
        zones: FLEET_ZONES,
        pins: FLEET_HQ,
      },
    },
    {
      id: "fleets",
      heading: "Numbered Fleets",
      kind: "table",
      keywords: ["hq", "headquarters", "parent command", "region", "where"],
      columns: [
        { key: "fleet", title: "Fleet", mono: true },
        { key: "region", title: "Region" },
        { key: "hq", title: "HQ" },
        { key: "parent", title: "Parent Command" },
        { key: "aor", title: "Area of Responsibility" },
      ],
      rows: FLEETS,
    },
    {
      id: "notes",
      heading: "Notes",
      kind: "kv",
      keywords: ["named fleet", "navcent", "naveur", "navsouth", "1st fleet", "cyber"],
      rows: NOTES,
    },
  ],
};

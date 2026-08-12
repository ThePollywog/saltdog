/**
 * Regenerates src/data/geo.js — the world coastline and the six geographic
 * COCOM AOR polygons, as projected SVG path data.
 *
 * Not part of the build. The output is committed, exactly like the two sprite
 * sheets, so the site ships no GeoJSON and does no runtime geometry.
 *
 *   node tools/build-maps.mjs [--check]
 *
 * `--check` verifies the committed file is byte-identical to what the source
 * produces, so stale path data is a test failure rather than a mystery.
 *
 * WHY COMMIT PATHS INSTEAD OF SHIPPING THE GEOJSON:
 *   the sources total 1.9 MB and Douglas-Peucker over 87,000 points is not
 *   something to make a phone do on a knowledge page. Projected and simplified
 *   they are 45 KB of ASCII, ~17 KB over the wire, in a chunk that only the two
 *   map pages fetch.
 *
 * THE ANTIMERIDIAN IS THE WHOLE PROBLEM. Three of these polygons wrap the seam:
 * NORTHCOM and EUCOM close their rings across the top of the world, INDOPACOM
 * spans both sides of 180 and closes across the bottom. A ring like
 * `[179.98, 84] -> [-45, 84]` is a 360-degree jump in longitude, and there are
 * two ways to read it — as a line drawn the long way round, or as a seam
 * crossing that should be split into two pieces. Reading it wrong does not
 * error: it renders a plausible world map with INDOPACOM's fill in the Atlantic.
 * That was the first version of this script.
 *
 * The correct reading here is the literal one, and it is only correct because of
 * a property of these particular files: EVERY seam jump in all seven sources is
 * at constant latitude. A horizontal segment drawn straight across the map at
 * lat -90 or lat 84 closes the ring through the pole, which is exactly the
 * region the polygon means to include, so the even-odd fill comes out right with
 * no unwrapping and no clipping. That property is asserted below rather than
 * assumed, because it is a fact about the data and not about the projection: if
 * a future source file crosses the seam at an angle, this script refuses to
 * write instead of quietly drawing a wrong map.
 *
 * Ported from guides/military/cocoms/geomap.py, which generated the source PDFs
 * — same equirectangular projection, same tolerance, so the site's map and the
 * downloadable card agree.
 *
 * Zero dependencies: the projection is two divisions and Douglas-Peucker is
 * twenty lines. The other extract-* scripts shell out to Python for numpy
 * because they process pixels; there is nothing here Node can't do.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";

const GEODATA = "/home/sogginnt/workspace/general/guides/military/cocoms/geodata";
const OUT = new URL("../src/data/geo.js", import.meta.url).pathname;

/** SVG user units. The viewBox is the whole world, so 1 unit = 0.36 degrees. */
const MAP_W = 1000;
const MAP_H = 500;

/**
 * Douglas-Peucker tolerance in DEGREES, matching geomap.py's AOR setting.
 * 0.25 deg is 0.7 px at this width — below the line width, so the simplification
 * is invisible at the size the map is drawn, and it removes a third of the bytes.
 * 0.4 starts eating the Great Lakes and the smaller Aegean islands.
 */
const EPS = 0.25;

/** Coordinate precision. One decimal is a tenth of a pixel. */
const PREC = 1;

/**
 * The four functional commands have no map polygon: CYBERCOM and SOCOM ship as
 * ~230-byte whole-world boxes (a functional AOR is "everywhere"), STRATCOM and
 * TRANSCOM have no file at all, and SPACECOM's AOR starts at 100 km up. Drawing
 * a whole-world box would say something false about them, so the map shows six
 * and the page says why.
 */
const AORS = [
  "USNORTHCOM",
  "USSOUTHCOM",
  "USEUCOM",
  "USAFRICOM",
  "USCENTCOM",
  "USINDOPACOM",
];

const check = process.argv.includes("--check");
const problems = [];

/** Every linear ring in a Feature or FeatureCollection, in file order. */
function ringsOf(file) {
  const path = `${GEODATA}/${file}`;
  if (!existsSync(path)) {
    problems.push(`missing source file ${path}`);
    return [];
  }
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const features = doc.type === "FeatureCollection" ? doc.features : [doc];
  const rings = [];
  for (const feature of features) {
    const geom = feature.geometry;
    const polys = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
    // ring[0] is the outer boundary and the rest are holes; at this resolution
    // holes are the Caspian and Lake Victoria, which are drawn filled on the
    // source card too, so all rings are treated alike.
    for (const poly of polys) for (const ring of poly) rings.push(ring);
  }
  return rings;
}

/**
 * The invariant that makes the literal projection safe. A seam jump has to be
 * horizontal; anything else means the file uses a convention this script does
 * not implement.
 */
function assertSeamJumpsAreHorizontal(file, rings) {
  let jumps = 0;
  rings.forEach((ring, r) => {
    for (let i = 1; i < ring.length; i++) {
      const [lonA, latA] = ring[i - 1];
      const [lonB, latB] = ring[i];
      if (Math.abs(lonB - lonA) <= 180) continue;
      jumps += 1;
      if (latA !== latB) {
        problems.push(
          `${file} ring ${r} crosses the antimeridian at an angle ` +
            `(${lonA},${latA} -> ${lonB},${latB}). Projecting that literally ` +
            `draws a diagonal line across the whole map; splitting it needs a ` +
            `seam clip this script does not have.`,
        );
      }
    }
  });
  return jumps;
}

/** Equirectangular / plate carree, straight out of geomap.py. */
const projectX = (lon) => ((lon + 180) / 360) * MAP_W;
const projectY = (lat) => ((90 - lat) / 180) * MAP_H;

/**
 * Pin the projection to literal expected outputs before using it for anything.
 *
 * This is not redundant with the city probes below, and finding that out cost an
 * afternoon: flipping projectY to `(90 + lat)` writes an upside-down world and
 * the probes still pass, because they project the test points through the same
 * function they used to build the paths. Any self-consistent error — a sign flip,
 * a swapped axis, a doubled scale — is invisible to a check that shares the
 * projection. So the corners are asserted against numbers typed out by hand:
 * north is y=0, south is y=MAP_H, the antimeridian is x=0 and x=MAP_W, and
 * null island is the centre. Four constants, and a mirrored map cannot get past
 * them.
 */
for (const [what, got, want] of [
  ["lat +90 (north pole) -> y", projectY(90), 0],
  ["lat -90 (south pole) -> y", projectY(-90), MAP_H],
  ["lat 0 (equator) -> y", projectY(0), MAP_H / 2],
  ["lon -180 (antimeridian, west) -> x", projectX(-180), 0],
  ["lon +180 (antimeridian, east) -> x", projectX(180), MAP_W],
  ["lon 0 (prime meridian) -> x", projectX(0), MAP_W / 2],
]) {
  if (got !== want) problems.push(`projection is wrong: ${what} gave ${got}, expected ${want}`);
}

/** Perpendicular distance from p to segment a-b, in the lon/lat plane. */
function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker over a lon/lat ring; eps in degrees. */
function simplify(ring, eps) {
  if (ring.length < 3) return ring;
  let dmax = 0;
  let idx = 0;
  const first = ring[0];
  const last = ring[ring.length - 1];
  for (let i = 1; i < ring.length - 1; i++) {
    const d = perpDist(ring[i], first, last);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps) {
    const left = simplify(ring.slice(0, idx + 1), eps);
    const right = simplify(ring.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

/** Project and simplify one file's rings into a single SVG `d` string. */
function pathFor(file) {
  const rings = ringsOf(file);
  const jumps = assertSeamJumpsAreHorizontal(file, rings);
  let d = "";
  let kept = 0;
  for (const ring of rings) {
    const simplified = simplify(ring, EPS);
    // A ring that survives simplification with fewer than four points enclosed
    // less than a tolerance-sized area, i.e. under a pixel here. Those are the
    // one-point islets; keeping them would add subpaths that draw nothing.
    if (simplified.length < 4) continue;
    kept += 1;
    d +=
      "M" +
      simplified
        .map(([lon, lat]) => `${projectX(lon).toFixed(PREC)} ${projectY(lat).toFixed(PREC)}`)
        .join("L") +
      "Z";
  }
  return { d, rings: kept, dropped: rings.length - kept, jumps };
}

/**
 * Holes must be wound opposite their outer ring — the GeoJSON right-hand rule.
 *
 * The component fills with `fill-rule: evenodd`, which is correct for any
 * winding, so this is not what keeps the map right today. It is what keeps the
 * two renderings agreeing: the Python builder behind the downloadable card draws
 * with matplotlib, which is nonzero-winding, and nonzero fills a hole that
 * happens to be wound the same way as the ring containing it. A source that
 * broke this rule would show the Caspian as water on the site and as land on the
 * PDF, and nothing else in either pipeline would notice.
 */
function assertHolesAreWoundOpposite(file, rings) {
  const signedArea = (r) => {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    }
    return a / 2;
  };
  const inRing = (r, x, y) => {
    let s = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < xi + ((y - yi) / (yj - yi)) * (xj - xi)) s = !s;
    }
    return s;
  };
  const measured = rings.map((r) => ({ r, a: signedArea(r) }));
  for (const inner of measured) {
    // A vertex sits exactly on the boundary, where point-in-polygon is undefined;
    // the mean of the ring's points is interior enough for a containment test.
    const mx = inner.r.reduce((s, p) => s + p[0], 0) / inner.r.length;
    const my = inner.r.reduce((s, p) => s + p[1], 0) / inner.r.length;
    for (const outer of measured) {
      if (inner === outer || Math.abs(inner.a) >= Math.abs(outer.a)) continue;
      if (!inRing(outer.r, mx, my)) continue;
      if (Math.sign(inner.a) === Math.sign(outer.a)) {
        problems.push(
          `${file} has a ring near ${mx.toFixed(1)},${my.toFixed(1)} nested inside ` +
            `a larger ring with the SAME winding. Under nonzero fill that hole ` +
            `fills solid, so the site (even-odd) and the source card (matplotlib, ` +
            `nonzero) would disagree about whether it is land.`,
        );
      }
    }
  }
}

const land = pathFor("ne_110m_land.geojson");
const aors = AORS.map((name) => ({ name, ...pathFor(`${name}.geojson`) }));

for (const file of ["ne_110m_land.geojson", ...AORS.map((n) => `${n}.geojson`)]) {
  assertHolesAreWoundOpposite(file, ringsOf(file));
}

/**
 * A `d` string is opaque — a wrong projection produces a wrong map, not an
 * error. So check the two things that would be off if the maths broke: every
 * coordinate has to land inside the viewBox, and each AOR has to enclose the
 * places it is responsible for. The probes are cheap and they are the only thing
 * standing between a sign error and a map with Africa upside down.
 */
const CITY_PROBES = [
  ["Norfolk, VA", -76.3, 36.8, "USNORTHCOM"],
  ["Mexico City", -99.1, 19.4, "USNORTHCOM"],
  ["Bogota", -74.1, 4.7, "USSOUTHCOM"],
  ["Santiago", -70.6, -33.4, "USSOUTHCOM"],
  ["Berlin", 13.4, 52.5, "USEUCOM"],
  ["Moscow", 37.6, 55.8, "USEUCOM"],
  ["Lagos", 3.4, 6.5, "USAFRICOM"],
  ["Cairo", 31.2, 30.0, "USCENTCOM"],
  ["Manama, Bahrain", 50.6, 26.2, "USCENTCOM"],
  ["Kabul", 69.2, 34.5, "USCENTCOM"],
  ["Tokyo", 139.7, 35.7, "USINDOPACOM"],
  ["Honolulu", -157.9, 21.3, "USINDOPACOM"],
  ["New Delhi", 77.2, 28.6, "USINDOPACOM"],
  ["Sydney", 151.2, -33.9, "USINDOPACOM"],
];

/** Parse an SVG `d` of `M x y L x y ... Z` subpaths back into point rings. */
function parsePath(d) {
  return d
    .split("M")
    .filter(Boolean)
    .map((sub) =>
      sub
        .replace(/Z$/, "")
        .split("L")
        .map((pt) => pt.split(" ").map(Number)),
    );
}

/** Even-odd point-in-polygon over a set of rings, in projected units. */
function contains(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < xi + ((y - yi) / (yj - yi)) * (xj - xi)) inside = !inside;
    }
  }
  return inside;
}

for (const { name, d } of [{ name: "land", d: land.d }, ...aors]) {
  for (const ring of parsePath(d)) {
    for (const [x, y] of ring) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > MAP_W || y < 0 || y > MAP_H) {
        problems.push(`${name} has a point outside the viewBox: ${x} ${y}`);
        break;
      }
    }
  }
}

const parsed = new Map(aors.map((a) => [a.name, parsePath(a.d)]));
for (const [city, lon, lat, want] of CITY_PROBES) {
  const x = projectX(lon);
  const y = projectY(lat);
  const hits = AORS.filter((name) => contains(parsed.get(name), x, y));
  if (hits.length !== 1 || hits[0] !== want) {
    problems.push(
      `${city} should fall in exactly ${want}, but the projected polygons put ` +
        `it in ${hits.join(" + ") || "no AOR at all"}`,
    );
  }
}

if (problems.length) {
  console.error("Refusing to write src/data/geo.js:\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nA map with wrong geometry does not look broken. It looks like a map, " +
      "and every AOR question the page answers is wrong.",
  );
  process.exit(1);
}

const totalRaw = land.d.length + aors.reduce((n, a) => n + a.d.length, 0);

const body = `/**
 * GENERATED FILE — do not edit. Run \`node tools/build-maps.mjs\` to rebuild.
 *
 * Projected SVG path data for the world map: coastlines from Natural Earth
 * (public domain, 110m) and the six geographic COCOM areas of responsibility
 * from the authoritative AOR GeoJSON that shipped with the source dossiers.
 *
 * Equirectangular (plate carree) projection into a ${MAP_W}x${MAP_H} viewBox,
 * Douglas-Peucker simplified at ${EPS} degrees. Same projection and tolerance as
 * the Python builder behind the downloadable cards, so the two agree.
 *
 * This module is a chunk of its own (see vite.config.js) because it is ${(totalRaw / 1024).toFixed(0)} KB of
 * path data that only the two map pages need. Importing it from anything that
 * renders on first paint would put it in the entry chunk.
 */

/** viewBox dimensions in SVG user units. */
export const MAP_W = ${MAP_W};
export const MAP_H = ${MAP_H};

/** Douglas-Peucker tolerance used, in degrees of lon/lat. */
export const MAP_EPS = ${EPS};

/** All land as one path: ${land.rings} rings, ${land.dropped} sub-pixel islets dropped. */
export const LAND_PATH =
  "${land.d}";

/**
 * AOR outlines, keyed by command. Functional commands are absent on purpose —
 * their source polygons are whole-world boxes, which would draw a true-looking
 * rectangle around a command that has no geography.
 */
export const AOR_PATHS = {
${aors.map((a) => `  ${a.name}:\n    "${a.d}",`).join("\n")}
};

/** Commands with a drawable AOR, in the order the source dossier lists them. */
export const AOR_ORDER = [${AORS.map((n) => `"${n}"`).join(", ")}];
`;

const fresh = Buffer.from(body, "utf8");

if (check) {
  const have = existsSync(OUT) ? readFileSync(OUT) : Buffer.alloc(0);
  if (!have.equals(fresh)) {
    console.error("src/data/geo.js is stale or hand-edited — re-run without --check.");
    process.exit(1);
  }
  console.log(`geo.js matches the sources (${land.rings} land rings, ${aors.length} AORs)`);
} else {
  writeFileSync(OUT, fresh);
  const gz = gzipSync(fresh).length;
  console.log(
    `wrote ${OUT}\n` +
      `  land ${land.rings} rings (${land.dropped} islets under a pixel dropped), ` +
      `${(land.d.length / 1024).toFixed(1)} KB of path\n` +
      aors
        .map(
          (a) =>
            `  ${a.name.padEnd(12)} ${String(a.rings).padStart(2)} rings, ` +
            `${(a.d.length / 1024).toFixed(1)} KB, ${a.jumps} seam crossing(s)`,
        )
        .join("\n") +
      `\n  ${(fresh.length / 1024).toFixed(1)} KB total, ${(gz / 1024).toFixed(1)} KB gzipped\n` +
      `  ${CITY_PROBES.length} containment probes passed`,
  );
}

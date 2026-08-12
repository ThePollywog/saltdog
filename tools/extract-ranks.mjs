/**
 * Regenerates public/img/ranks.png from the six source rank charts.
 *
 * Not part of the build — the sheet is committed. This exists so the asset is
 * reproducible and auditable rather than a binary someone dropped in.
 *
 *   node tools/extract-ranks.mjs [--check]
 *
 * `--check` verifies the committed sheet matches what the sources produce
 * (byte-identical), so a stale sheet is a test failure and not a mystery.
 *
 * WHY RASTERISE. data/ranks.js used to state that insignia "cannot be shown
 * per-rank", which conflated two things. There is no separately embedded image
 * per rank to pull out of these PDFs — true, they are single flattened page
 * bitmaps. But the composited page rendered at 300dpi has every insignia sitting
 * in its own table cell, and cells are findable.
 *
 * TILE ORDER IS THE WHOLE PROBLEM. A sprite index is a bare number: if the
 * segmentation returns cells in a different order than the app expects, every
 * rank shows its neighbour's insignia, renders perfectly, and nothing about the
 * image says so. Both sides therefore derive the order from ONE array —
 * `insigniaPlan()` here, `insigniaIndex()` in the UI, both walking SERVICES in
 * the same nesting — and this script refuses to write a sheet whose segmented
 * grid disagrees with that plan by even one column. The tier gaps make that a
 * live risk rather than a theoretical one: USCG warrant is W-2..W-4, three
 * columns where the Navy has five, and the Air Force and Space Force charts have
 * no warrant block at all, so "grades are 10 wide" is wrong on three charts.
 *
 * HOW A CELL IS FOUND — as table structure, not as artwork. Blob-finding is the
 * obvious approach and it breaks immediately: E-8 and E-9 stack TWO insignia in
 * one cell (the First Sergeant / Command variant), which a blob finder splits
 * into two tiles, shifting every index after it. So:
 *
 *   - Tier blocks come from the "Enlisted" / "Warrant Officer" / "Officer" title
 *     bars: solid saturated navy spanning >50% of the page width. Detected by
 *     COLOUR, not by ink density — Navy and Space Force insignia are near-black,
 *     and an ink test reads a row of chevrons as a title bar.
 *   - Row rules are near-continuous dark lines across the table's own x-extent
 *     (taken from a title bar; page margins are not table edges). Threshold 0.85,
 *     not 0.95: USCG collar devices overhang the rule above them and interrupt
 *     it, measuring 0.899, and at 0.95 that block silently comes back with 3
 *     rules instead of 4. Every block has exactly 4 and anything else throws.
 *   - Columns are vertical rules spanning >90% of the block height. Artwork is
 *     the band between rules 3 and 4.
 *
 * The rules are pale lavender, which is "not near-white" — so they are content by
 * the same test that finds Marine Corps red-on-white artwork. Both the rules and
 * their antialiased halo are masked out before taking a cell's bounding box;
 * without the halo a cell's bbox stretches to the gridline and bakes a stray 1px
 * line into the tile.
 *
 * Two cells per chart are dropped by POSITION, not by inspecting them: the first
 * enlisted column is E-1's "No Insignia" text, and the last is the senior
 * enlisted advisor (MCPON, SMA, ...) — a billet, not a paygrade, with no row in
 * SERVICES. Telling text from artwork by pixel statistics is not reliable here:
 * "mostly dark pixels in a small block" also describes the real USN E-2 chevrons.
 *
 * Requires poppler-utils (pdftoppm), numpy, and PIL — acceptable for a
 * maintenance script in a way they would not be in the app.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INSIGNIA_COUNT, SPRITE_COLS, TILE, insigniaPlan } from "../src/data/ranks.js";

const PDF_DIR = new URL("../public/pdf/", import.meta.url).pathname;
const OUT = new URL("../public/img/ranks.png", import.meta.url).pathname;

/**
 * Palette size. Higher than the ribbons' 64: rank insignia are metallic, and gold
 * braid and silver stars carry real gradients where a ribbon is flat stripes. At
 * 64 the flag-officer shoulderboards flatten and the stars lose their edge, for
 * 17 KB — visible at 2x, so not worth the saving.
 */
const PALETTE = 96;

const check = process.argv.includes("--check");
const PLAN = insigniaPlan();

const work = mkdtempSync(join(tmpdir(), "ranks-"));

/** Rasterise every chart first; one Python pass then segments them all. */
const pages = [];
for (const svc of PLAN) {
  const src = join(PDF_DIR, svc.sourcePdf);
  if (!existsSync(src)) {
    console.error(`missing source chart: ${src}`);
    process.exit(2);
  }
  const stem = join(work, svc.id);
  execFileSync("pdftoppm", ["-f", "1", "-l", "1", "-r", "300", "-png", src, stem]);
  if (!existsSync(`${stem}-1.png`)) {
    console.error(`pdftoppm produced no page image for ${svc.sourcePdf}`);
    process.exit(2);
  }
  pages.push(`${stem}-1.png`);
}

const stdout = execFileSync(
  "python3",
  [
    "-c",
    `
import sys, json
import numpy as np
from PIL import Image

out_png = sys.argv[1]
plan = json.loads(sys.argv[2])
pages = sys.argv[3:]
TILE, COLS, PALETTE = ${TILE}, ${SPRITE_COLS}, ${PALETTE}
HALO = 3   # antialiasing skirt on every gridline, at 300dpi

def runs(idx, gap=1):
    """Group sorted indices into (start, end) spans, bridging gaps of <= gap."""
    out = []
    for i in idx:
        if out and i - out[-1][1] <= gap:
            out[-1][1] = i
        else:
            out.append([i, i])
    return [tuple(x) for x in out]

def cells(path):
    """Artwork boxes on one chart, as [[(x0,y0,x1,y1), ...], ...] per tier block."""
    im = Image.open(path).convert("RGB")
    a = np.array(im).astype(int)
    H, W, _ = a.shape
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]

    navy = (b > 90) & (b < 200) & (b - r > 55) & (b - g > 55)
    bars = [x for x in runs([y for y, f in enumerate(navy.sum(axis=1) / W) if f > 0.5], gap=2)
            if x[1] - x[0] >= 12]
    if not bars:
        raise SystemExit(f"{path}: found no tier title bars")

    y0, y1 = bars[0]
    span = np.where(navy[y0:y1].sum(axis=0) > (y1 - y0) * 0.5)[0]
    L, R = int(span[0]), int(span[-1]) + 1

    dark = a.sum(axis=2) < 690
    rules = [x for x in runs([y for y, c in enumerate(dark[:, L:R].sum(axis=1) / (R - L)) if c > 0.85])
             if x[1] - x[0] <= 8]
    content = a.sum(axis=2) < 735

    found = []
    for i, (bar_top, bar_bot) in enumerate(bars):
        nxt = bars[i + 1][0] if i + 1 < len(bars) else H
        ts = [t for t in rules if bar_bot < t[0] < nxt]
        if len(ts) != 4:
            raise SystemExit(
                f"{path}: tier block {i} has {len(ts)} horizontal rules, expected 4. "
                "The chart layout changed; the cell grid can no longer be trusted."
            )
        btop, bbot = ts[0][1] + 1, ts[3][0]
        atop, abot = ts[2][1] + 1, ts[3][0]
        v = runs([x for x, c in enumerate(dark[btop:bbot].sum(axis=0) / (bbot - btop)) if c > 0.9],
                 gap=3)

        # Mask the gridlines and their halo: they are "not near-white" too, and a
        # bbox that reaches one bakes a stray 1px line into the tile.
        clean = content.copy()
        for ra, rb in rules:
            clean[max(0, ra - HALO):rb + 1 + HALO, :] = False
        for ca, cb in v:
            clean[:, max(0, ca - HALO):cb + 1 + HALO] = False

        boxes = []
        for j in range(len(v) - 1):
            xa, xb = v[j][1] + 1, v[j + 1][0]
            sub = clean[atop:abot, xa:xb]
            ys = np.where(sub.sum(axis=1) > 0)[0]
            xs = np.where(sub.sum(axis=0) > 0)[0]
            if len(ys) == 0:
                boxes.append(None)
                continue
            x0, x1 = xa + int(xs[0]), xa + int(xs[-1]) + 1
            top, bot = atop + int(ys[0]), atop + int(ys[-1]) + 1
            # USCG collar devices cross the rule above them. Probe just past the
            # halo and only walk up if something is actually there, so a rank-name
            # line above an ordinary cell is never swept in.
            y = ts[2][0] - 1 - HALO
            if clean[y, x0:x1].any():
                while y > ts[1][1] and clean[y, x0:x1].any():
                    y -= 1
                top = y + 1
            boxes.append((x0, top, x1, bot))
        found.append(boxes)
    return im, found

tiles, report = [], []
for svc, path in zip(plan, pages):
    im, found = cells(path)
    got = []
    for spec, boxes in zip(svc["tiers"], found):
        got.append({"tier": spec["tier"], "columns": len(boxes)})
        if len(boxes) != spec["columns"]:
            continue          # counts are compared in JS, which owns the message
        usable = boxes[1:-1] if spec["tier"] == "enlisted" else boxes
        for box in usable:
            if box is None:
                tiles.append(None)
                continue
            art = im.crop(box).copy()
            art.thumbnail((TILE, TILE), Image.LANCZOS)
            # Centred on a square tile: insignia shapes vary wildly (a chevron is
            # wide, a collar bar tall) and a per-tile aspect would give a rank
            # table rows of different heights.
            canvas = Image.new("RGB", (TILE, TILE), (255, 255, 255))
            canvas.paste(art, ((TILE - art.width) // 2, (TILE - art.height) // 2))
            tiles.append(canvas)
    report.append({"id": svc["id"], "tiers": got})

rows = (len(tiles) + COLS - 1) // COLS if tiles else 0
sheet = Image.new("RGB", (COLS * TILE, max(1, rows) * TILE), (255, 255, 255))
for i, t in enumerate(tiles):
    if t is not None:
        sheet.paste(t, ((i % COLS) * TILE, (i // COLS) * TILE))
sheet.quantize(colors=PALETTE, method=Image.MEDIANCUT, dither=Image.NONE).save(
    out_png, optimize=True
)
print(json.dumps({"count": len(tiles), "report": report,
                  "blank": sum(1 for t in tiles if t is None),
                  "size": [COLS * TILE, max(1, rows) * TILE]}))
`,
    join(work, "ranks.png"),
    JSON.stringify(PLAN),
    ...pages,
  ],
  { encoding: "utf8", maxBuffer: 1 << 28 },
);

const result = JSON.parse(stdout.trim().split("\n").pop());
const fresh = readFileSync(join(work, "ranks.png"));

/**
 * The segmented grid must match the plan column for column. This is the check
 * that matters — see the docblock: a one-column drift produces a sheet that looks
 * entirely normal and mislabels every rank after it.
 */
const problems = [];
for (const svc of PLAN) {
  const got = result.report.find((x) => x.id === svc.id);
  if (!got) {
    problems.push(`${svc.id}: chart was not segmented at all`);
    continue;
  }
  if (got.tiers.length !== svc.tiers.length) {
    problems.push(
      `${svc.id}: found ${got.tiers.length} tier blocks, SERVICES implies ${svc.tiers.length}`,
    );
    continue;
  }
  for (const [i, want] of svc.tiers.entries()) {
    const have = got.tiers[i];
    if (have.tier !== want.tier || have.columns !== want.columns) {
      problems.push(
        `${svc.id} ${want.tier}: chart has ${have.columns} columns, SERVICES implies ${want.columns}`,
      );
    }
  }
}
if (result.blank) problems.push(`${result.blank} cell(s) segmented as empty`);
if (result.count !== INSIGNIA_COUNT) {
  problems.push(`produced ${result.count} tiles, SERVICES implies ${INSIGNIA_COUNT}`);
}

if (problems.length) {
  console.error("the segmented cell grid does not match src/data/ranks.js:");
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "Refusing to write. A sheet with the wrong tile count does not look broken —\n" +
      "it renders each rank with the next rank's insignia, silently, from the\n" +
      "mismatch onward. Fix the segmentation or update SERVICES, not this check.",
  );
  process.exit(1);
}

if (check) {
  const have = existsSync(OUT) ? readFileSync(OUT) : Buffer.alloc(0);
  if (!have.equals(fresh)) {
    console.error(
      "public/img/ranks.png does not match the source charts — it is stale or " +
        "hand-edited. Re-run without --check.",
    );
    process.exit(1);
  }
  console.log(`ranks.png matches the source charts (${result.count} insignia)`);
} else {
  writeFileSync(OUT, fresh);
  console.log(
    `wrote ${OUT} — ${result.count} insignia, ${result.size.join("x")}, ` +
      `${(fresh.length / 1024).toFixed(1)} KB`,
  );
}

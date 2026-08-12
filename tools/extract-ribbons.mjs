/**
 * Regenerates public/img/ribbons.png from the source chart.
 *
 * Not part of the build — the sprite is committed. This exists so the asset is
 * reproducible and auditable rather than a binary someone dropped in.
 *
 *   node tools/extract-ribbons.mjs [--check]
 *
 * `--check` verifies the committed sprite matches what the source produces
 * (byte-identical), so a stale sprite is a test failure and not a mystery.
 *
 * WHY RASTERISE THE PAGE instead of pulling the embedded images:
 *   pdfimages reports 60 ribbon-shaped objects, all `gray` with 1 component.
 *   They are separation plates, not the artwork — extracting them yields
 *   greyscale mush. Rendering the composited page at 300dpi and cutting the
 *   ribbons out of it is what actually produces colour.
 *
 * The ribbon grid is 8 columns x 8 rows (64), plus TWO further rows of 2: the
 * Kuwait pair, and then the Rifle and Pistol Marksmanship Medals. 68 total.
 *
 * THE LAST TWO ROWS ARE DRAWN INSIDE THE DEVICE LEGEND BLOCK. That is the whole
 * difficulty here. Scanning for "bands of content" fuses them with the legend
 * text and glyphs into one 715px band, and an earlier version of this script cut
 * only the top 145px of that band — which silently produced 66 tiles and dropped
 * the two marksmanship ribbons, an award count that looks plausible enough to
 * ship. So rows are NOT found as content bands. They are found as ribbon
 * artwork: runs of rows with >600 non-white pixels (a ribbon row spans the page;
 * a caption line does not) whose height is a ribbon's ~118px at 300dpi. Legend
 * prose and device glyphs fail one test or the other.
 *
 * Requires poppler-utils (pdftoppm) and ImageMagick, both used via the shell —
 * this is a maintenance script, so a system dependency is acceptable here in a
 * way it would not be in the app.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SRC =
  "/home/sogginnt/workspace/general/guides/military/USN_RIBBONS_AND_DEVICES.pdf";
const OUT = new URL("../public/img/ribbons.png", import.meta.url).pathname;

/** Ribbon tile size in the sprite: 2x the 88x28 CSS box, real 11:3.5 aspect. */
const TILE_W = 176;
const TILE_H = 56;
/** Ribbons are wider than this at 300dpi; device glyphs are not. */
const MIN_RIBBON_PX = 300;
const EXPECTED = 68;
/** A ribbon row spans the page; a line of caption text does not. */
const MIN_ROW_INK = 600;
/** A ribbon is ~118px tall at 300dpi. */
const MIN_ROW_H = 100;
const MAX_ROW_H = 150;

const check = process.argv.includes("--check");

function py(script, ...args) {
  return execFileSync("python3", ["-c", script, ...args], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
}

const work = mkdtempSync(join(tmpdir(), "ribbons-"));
const page = join(work, "page");

execFileSync("pdftoppm", ["-f", "1", "-l", "1", "-r", "300", "-png", SRC, page]);
const pagePng = `${page}-1.png`;
if (!existsSync(pagePng)) {
  console.error("pdftoppm produced no page image");
  process.exit(2);
}

// Segmentation + tiling in one Python pass (numpy/PIL are the right tools for
// this and are already present for the other maintenance scripts).
const report = py(
  `
import sys, json
import numpy as np
from PIL import Image

page_png, out_png = sys.argv[1], sys.argv[2]
TILE_W, TILE_H, MIN_W = ${TILE_W}, ${TILE_H}, ${MIN_RIBBON_PX}
MIN_ROW_INK, MIN_ROW_H, MAX_ROW_H = ${MIN_ROW_INK}, ${MIN_ROW_H}, ${MAX_ROW_H}

im = Image.open(page_png).convert("RGB")
a = np.array(im)
nonwhite = a.sum(axis=2) < 720

# Find ribbon ROWS, not content bands.
#
# The last two ribbon rows (Kuwait pair, then the two marksmanship medals) are
# drawn inside the device-legend block, so band detection fuses them with the
# legend into one 715px band and there is no vertical gap to split on. Detect the
# artwork itself instead: a ribbon row is a run of image rows carrying a lot of
# ink (it spans the page width) and is about 118px tall at 300dpi. Legend prose
# is too sparse; device glyphs are too short. This finds all 10 rows.
rows = nonwhite.sum(axis=1)
bands, start = [], None
for y, c in enumerate(rows):
    if c > MIN_ROW_INK and start is None:
        start = y
    elif c <= MIN_ROW_INK and start is not None:
        if MIN_ROW_H <= y - start <= MAX_ROW_H:
            bands.append((start, y))
        start = None
if start is not None and MIN_ROW_H <= len(rows) - start <= MAX_ROW_H:
    bands.append((start, len(rows)))

boxes = []
for top, bot in bands:
    cols = nonwhite[top:bot].sum(axis=0)
    seg, x0 = [], None
    for x, c in enumerate(cols):
        if c > 5 and x0 is None:
            x0 = x
        elif c <= 5 and x0 is not None:
            if x - x0 > MIN_W:
                seg.append((x0, x))
            x0 = None
    if x0 is not None and len(cols) - x0 > MIN_W:
        seg.append((x0, len(cols)))
    for xa, xb in seg:
        # Tighten vertically inside this column so tiles are flush to the border.
        rr = nonwhite[top:bot, xa:xb].sum(axis=1)
        ys = [y for y, c in enumerate(rr) if c > 3]
        if not ys:
            continue
        ya, yb = top + ys[0], top + ys[-1] + 1
        # Ribbons are 11:3.5 (~3.14). Anything far off that is legend art that
        # happened to be wide enough to survive the width test.
        if not 2.6 <= (xb - xa) / (yb - ya) <= 3.7:
            continue
        boxes.append((xa, ya, xb, yb))

tiles = [im.crop(b).resize((TILE_W, TILE_H), Image.LANCZOS) for b in boxes]
sheet = Image.new("RGB", (TILE_W, TILE_H * len(tiles)), (255, 255, 255))
for i, t in enumerate(tiles):
    sheet.paste(t, (0, i * TILE_H))

# Ribbons are flat stripe patterns: a 64-colour palette is visually
# indistinguishable from truecolour here and about a seventh of the bytes.
sheet.quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE).save(
    out_png, optimize=True
)
print(json.dumps({"count": len(tiles), "bands": len(bands)}))
`,
  pagePng,
  join(work, "sprite.png"),
);

const { count, bands } = JSON.parse(report.trim().split("\n").pop());
const fresh = readFileSync(join(work, "sprite.png"));

if (count !== EXPECTED) {
  console.error(
    `expected ${EXPECTED} ribbons, segmented ${count} (from ${bands} bands).\n` +
      "The source chart or the segmentation thresholds changed; do NOT ship a " +
      "sprite with a different count — award N would render as award N+1 " +
      "silently, and every rack on the site would be subtly wrong.",
  );
  process.exit(1);
}

if (check) {
  const have = existsSync(OUT) ? readFileSync(OUT) : Buffer.alloc(0);
  if (!have.equals(fresh)) {
    console.error(
      "public/img/ribbons.png is stale or hand-edited — re-run without --check.",
    );
    process.exit(1);
  }
  console.log(`ribbons.png matches the source (${count} ribbons)`);
} else {
  writeFileSync(OUT, fresh);
  console.log(
    `wrote ${OUT} — ${count} ribbons, ${(fresh.length / 1024).toFixed(1)} KB`,
  );
}

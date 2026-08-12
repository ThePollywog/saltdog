/**
 * Rank insignia sprite offsets.
 *
 * Separate from ribbons.js `spriteStyle()` on purpose: that sheet is a single
 * column, so only Y varies and the helper takes one index. This sheet is a grid,
 * so both axes move, and folding the two would mean a signature where half the
 * arguments are ignored depending on which sheet you meant.
 *
 * Tiles are square and the artwork is centred inside each one with whitespace
 * padding, so a caller asks for a box size rather than a width — insignia are not
 * a uniform shape (a chevron is wide, a collar bar is tall) and letting each set
 * its own aspect would make a rank table's rows different heights.
 */
import { SPRITE_COLS, TILE, insigniaIndex } from "../data/ranks.js";

/**
 * @param {string} serviceId
 * @param {object} rank a member of a service's enlisted/warrant/officer array
 * @param {number} sizePx rendered box size, both axes. The default is set by the
 *   hardest case rather than by taste: Navy officer shoulderboards differ only in
 *   the number of gold stripes, and below about 56px the stripes on O-4 and O-5
 *   merge into one band.
 * @returns {object|null} inline style, or null when the rank has no insignia
 *   (E-1) — callers render nothing rather than an empty box.
 */
export function insigniaStyle(serviceId, rank, sizePx = 60) {
  const index = insigniaIndex(serviceId, rank);
  if (index == null) return null;
  const scale = sizePx / TILE;
  const col = index % SPRITE_COLS;
  const row = Math.floor(index / SPRITE_COLS);
  return {
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    backgroundImage: "url(./img/ranks.png)",
    // Only the width is set; `auto` lets the sheet's own row count scale with it,
    // so adding a service doesn't need this touched.
    backgroundSize: `${SPRITE_COLS * sizePx}px auto`,
    backgroundPosition: `-${col * sizePx}px -${row * sizePx}px`,
    backgroundRepeat: "no-repeat",
    // The sheet is a 300dpi raster shown well below native size. Nearest-neighbour
    // downscaling would alias the thin gold braid on the officer bars into a moiré.
    imageRendering: "auto",
  };
}

/**
 * Parse a retirement point record pasted out of NSIPS into tracker rows.
 *
 * WHY THIS EXISTS INSTEAD OF A LOGIN. The obvious feature request is "log into
 * NSIPS and pull my points automatically." That cannot be built here, and the
 * reasons are structural rather than a matter of effort:
 *
 *   - NSIPS sits behind an F5 BigIP APM portal that answers `/` with a 302 to
 *     `/my.policy` and sets an `MRHSession` cookie. Auth is CAC/PKI — a client
 *     certificate and PIN held by smartcard middleware the browser will not
 *     delegate to a third-party page.
 *   - It sends no `Access-Control-Allow-Origin`. Even with a session, a static
 *     site on another origin cannot read one byte of the response. There is no
 *     documented public API to call instead.
 *   - Routing it through a server would mean this site collecting government
 *     credentials and proxying a `.mil` session. That is a phishing pattern, it
 *     would break the "nothing is transmitted" promise the About page makes, and
 *     it is not ours to authorize. It is not a thing to build carefully; it is a
 *     thing not to build.
 *
 * So the user brings the data. They are already in NSIPS reading the Annual
 * Retirement Point Record — selecting it and copying is a few seconds, and it
 * keeps the record of truth as the source without this site ever touching an
 * account.
 *
 * PARSING STRATEGY. Column order is read from the pasted header when one is
 * present, because that is the only version of this that survives a layout
 * change. Two things follow from not having verified the ARPR's exact column
 * order against a live record:
 *
 *   1. Arithmetic disambiguates rather than assumption. A row's total is
 *      identified as the number equal to the sum of the others, which is a fact
 *      about the numbers and not a guess about their positions.
 *   2. Nothing is applied silently. The caller shows a preview and the user
 *      confirms. A parser that quietly mis-files a column into `at` would corrupt
 *      a 20-year record while looking like it worked.
 */

/** Header keyword -> field. First match wins, so order matters here. */
const COLUMN_PATTERNS = [
  ["total", /\btot(al)?\b/i],
  ["membership", /\bmembership\b|\bmbr\b|\bmem\b/i],
  ["corr", /\bcorr|\bextension\b|\bcourse|\bexam\b/i],
  ["at", /\bactive\b|\bat\/adt\b|\ba[dt]t?\b|\bannual train/i],
  ["idt", /\binactive\b|\bidt\b|\bdrill/i],
  ["label", /\byear\b|\banniv|\bperiod\b|\bdates?\b|\bfrom\b/i],
  ["qualifying", /\bqual|\bsatisfactory\b|\bgood\b/i],
];

const FIELDS = ["idt", "at", "corr", "membership"];

/** Split a pasted row on tabs, pipes, commas, or runs of 2+ spaces. */
const splitCells = (line) =>
  line
    .trim()
    .split(/\t+|\s*\|\s*|,(?=\s)|\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c !== "");

/**
 * Does this line name columns rather than hold data?
 *
 * Checked by absence of standalone numbers, not by keyword count: a header like
 * "FY  IDT  AT  Corr" is only two characters from a data row, and any row that
 * still carries bare integers is data no matter what words are in it.
 */
function asHeader(cells) {
  if (cells.length < 3) return null;
  if (cells.some((c) => /^\d+$/.test(c))) return null;

  const map = cells.map((cell) => {
    for (const [field, re] of COLUMN_PATTERNS) if (re.test(cell)) return field;
    return null;
  });
  // Two identified columns is the floor: one keyword is as easily a stray word
  // in a title line as it is a real header.
  return map.filter(Boolean).length >= 2 ? map : null;
}

/**
 * A year label: FY24, 2024, a date, or a date range. Returned verbatim so the
 * user sees what they pasted rather than a reformatted guess.
 */
function labelFrom(cells) {
  for (const c of cells) {
    if (/^(FY\s*\d{2,4})$/i.test(c)) return c.replace(/\s+/g, "");
    if (/^\d{4}$/.test(c) && Number(c) >= 1950 && Number(c) <= 2100) return c;
    if (/\d{1,4}[/-]\d{1,2}[/-]\d{2,4}/.test(c)) return c;
  }
  return null;
}

const toInt = (c) => {
  // Strip thousands separators; reject decimals, which are not point values.
  const m = /^-?\d{1,3}(?:,\d{3})*$|^-?\d+$/.exec(String(c).replace(/\s/g, ""));
  return m ? Number(m[0].replace(/,/g, "")) : null;
};

/**
 * Pull the total out of a list of numbers using arithmetic.
 *
 * Returns the index of the value that equals the sum of all the others, or -1.
 * This is what makes column order recoverable without a header: whichever cell
 * the ARPR puts the total in, it is the only one that reconciles.
 */
function findTotalIndex(nums) {
  const sum = nums.reduce((a, b) => a + b, 0);
  for (let i = 0; i < nums.length; i++) {
    // nums[i] === sum - nums[i], i.e. it balances the rest.
    if (nums[i] > 0 && nums[i] * 2 === sum) return i;
  }
  return -1;
}

/**
 * @param {string} text  pasted point record
 * @returns {{rows: object[], warnings: string[], usedHeader: boolean}}
 */
export function parsePointRecord(text) {
  const warnings = [];
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  if (!lines.length) return { rows: [], warnings: ["Nothing to parse."], usedHeader: false };

  let header = null;
  const rows = [];

  for (const line of lines) {
    const cells = splitCells(line);

    if (!header) {
      const h = asHeader(cells);
      if (h) {
        header = h;
        continue;
      }
    }

    const label = labelFrom(cells);
    const nums = [];
    const numIdx = [];
    cells.forEach((c, i) => {
      const n = toInt(c);
      // A cell already claimed as the label is not also a data point.
      if (n !== null && c !== label) {
        nums.push(n);
        numIdx.push(i);
      }
    });

    // A usable row needs at least two numbers; one number is a stray footer
    // ("Total points: 812") more often than it is a year.
    if (nums.length < 2) continue;
    if (nums.some((n) => n < 0)) {
      warnings.push(`Skipped a row with a negative value: "${line.trim()}"`);
      continue;
    }

    const row = { label: label ?? "", idt: 0, at: 0, corr: 0, membership: 0 };
    let statedTotal = null;
    let mapped = false;

    if (header) {
      // Header path: assign by column position.
      for (let k = 0; k < numIdx.length; k++) {
        const field = header[numIdx[k]];
        if (field === "total") statedTotal = nums[k];
        else if (FIELDS.includes(field)) {
          row[field] = nums[k];
          mapped = true;
        }
      }
      if (!row.label) {
        const li = header.indexOf("label");
        if (li >= 0 && cells[li]) row.label = cells[li];
      }
    }

    if (!mapped) {
      // No header, or a header that named no point columns. Use arithmetic to
      // find the total, then fill the remaining values in the documented order.
      const ti = findTotalIndex(nums);
      const vals = [...nums];
      if (ti >= 0) statedTotal = vals.splice(ti, 1)[0];
      FIELDS.forEach((f, k) => {
        if (k < vals.length) row[f] = vals[k];
      });
      if (!header) {
        warnings.push(
          "No column header was found, so values were read in order as " +
            "IDT, AT/ADT, correspondence, membership. Check the preview.",
        );
      }
    }

    const sum = FIELDS.reduce((a, f) => a + row[f], 0);

    if (statedTotal !== null) {
      const gap = statedTotal - sum;
      if (gap !== 0 && row.membership === 0 && gap > 0) {
        // The record listed a total and no membership column. Membership points
        // are the component most often folded into the total, and the arithmetic
        // is unambiguous, so it is inferred — and said out loud.
        row.membership = gap;
        warnings.push(
          `${row.label || "A row"}: inferred ${gap} membership point` +
            `${gap === 1 ? "" : "s"} from the stated total of ${statedTotal}.`,
        );
      } else if (gap !== 0) {
        row.mismatch = { statedTotal, parsedTotal: sum };
        warnings.push(
          `${row.label || "A row"}: the columns add to ${sum} but the record ` +
            `states ${statedTotal}. Values are shown as parsed — fix them before applying.`,
        );
      }
    }

    rows.push(row);
  }

  if (!rows.length) {
    warnings.push(
      "No year rows were recognized. Each line needs a year and at least two " +
        "numbers, separated by tabs or by two or more spaces.",
    );
  }

  // Unlabelled rows would all collide in the tracker's year list.
  rows.forEach((r, i) => {
    if (!r.label) r.label = `Row ${i + 1}`;
  });

  return { rows, warnings: [...new Set(warnings)], usedHeader: Boolean(header) };
}

/**
 * Prove the checks can fail.
 *
 * A green test suite is evidence of nothing until each check has been watched
 * failing. This project has already shipped two checks that could not fail —
 * both grepped for a string that survived deleting the code it was guarding —
 * and neither was detectable by reading them. So every check gets a matching
 * MUTATION here: a one-line edit to real source that the check is supposed to
 * catch, applied to a temp copy, verified to make exactly that check fail, and
 * reverted.
 *
 * Run with `node tools/sabotage.mjs`. Not part of `npm test`, because it edits
 * files on disk and takes ~40x as long — it is the thing you run when you ADD a
 * check, to find out whether you actually added one.
 *
 * Each mutation names the test it must break. Two outcomes are failures of the
 * harness itself and both are reported loudly:
 *
 *   SURVIVED — the mutation was applied and the named test still passed. The
 *              check is decorative. This is the whole point of the file.
 *   COLLATERAL — nothing broke anywhere, meaning the mutation didn't apply
 *              (usually a `find` string that no longer exists after a refactor).
 *              A silently-skipped mutation reads as a pass, so it is fatal.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @typedef {object} Edit
 * @property {string} find    exact substring to replace
 * @property {string} repl    what to replace it with
 * @property {number} [count] expected occurrences of `find`; default 1, so a
 *                            mutation that suddenly matches five places is an
 *                            error rather than a broader sabotage than intended
 */

/**
 * @typedef {object} Mutation
 * @property {string} file    repo-relative path to edit
 * @property {string} breaks  substring of the test name that must fail
 * @property {Edit[]} [edits] several edits applied together; use this when a
 *                            behaviour is defended REDUNDANTLY and no single
 *                            edit can break it. That situation is easy to
 *                            mistake for a decorative check, so making it
 *                            expressible is what keeps the distinction visible.
 * @property {string} [find]  sugar for a single-edit mutation
 * @property {string} [repl]
 * @property {number} [count]
 */

/** Normalize either form to a list of edits. */
const editsOf = (m) => m.edits ?? [{ find: m.find, repl: m.repl, count: m.count }];

/** @type {Mutation[]} */
const MUTATIONS = [
  // --- directive registry -------------------------------------------------
  {
    // The headline failure: a typo'd citation renders nothing and says nothing.
    file: "src/data/checklist.js",
    find: `refs: ["bupersinst-1001-39", "dodi-1215-13"],`,
    repl: `refs: ["bupersinst-1001-3", "dodi-1215-13"],`,
    count: 5,
    breaks: "every cited directive id exists",
  },
  {
    file: "src/data/directives.js",
    find: `    id: "milpersman",`,
    repl: `    id: "jtr",`,
    breaks: "directive ids are unique",
  },
  {
    file: "src/data/directives.js",
    find: `label: "BUPERSINST 1610.10",`,
    repl: `label: "BUPERSINST 1610.10H",`,
    breaks: "revision letter is never baked into the label",
  },
  {
    file: "src/data/directives.js",
    find: `  doni: {
    system: "doni",`,
    repl: `  doni: {
    system: "doni-instructions",`,
    breaks: "resolves to a real library and a real address",
  },
  {
    // The rule this module exists to enforce: no addresses here.
    file: "src/data/directives.js",
    find: `export const DIRECTIVES = [`,
    repl: `const STRAY = "https://www.mynavyhr.navy.mil/references/instructions/";\nexport const DIRECTIVES = [`,
    breaks: "holds no document URL of its own",
  },
  {
    file: "src/data/directives.js",
    find: `parent: "respersman",`,
    repl: `parent: "respersman-1571-011",`,
    breaks: "every parent reference resolves",
  },
  {
    // A group that matches no section id: citable, but absent from the page.
    file: "src/data/directives.js",
    find: `group: "travel",`,
    repl: `group: "travel-and-per-diem",`,
    breaks: "appears in exactly one topic section",
  },
  {
    /**
     * The ranking decision, mutated to the plausible wrong choice rather than to
     * nonsense. Folding citations into `keywords` (weight 2.5) instead of the
     * body (1.0) is what a reasonable person would write, and it inverts the
     * result: the documents lose to the sections citing them.
     */
    file: "src/lib/corpus.js",
    find: `const bodyTokens = tokenize(\`\${text} \${keywords.join(" ")} \${citedText(section)}\`);`,
    repl: `const bodyTokens = tokenize(\`\${text} \${keywords.join(" ")}\`);\n  keywords = [...keywords, citedText(section)];`,
    breaks: "outranks the sections that cite it",
  },
  {
    // The other direction: citations dropped from the index entirely. The UI
    // still renders every chip, so nothing looks wrong.
    file: "src/lib/corpus.js",
    find: ` \${citedText(section)}\`);`,
    repl: `\`);`,
    breaks: "makes the citing section findable",
  },
  {
    file: "src/data/directives.js",
    find: `return [display(d), d.label, d.title, d.governs,`,
    repl: `return [display(d), d.label, d.governs,`,
    breaks: "directiveText covers every field",
  },
  {
    file: "src/data/directives.js",
    find: `return (ids ?? []).map((id) => DIRECTIVE_BY_ID.get(id)).filter(Boolean);`,
    repl: `return (ids ?? []).map((id) => DIRECTIVE_BY_ID.get(id) ?? { id, label: id, title: "?" });`,
    breaks: "directivesFor is order-preserving",
  },

  {
    /**
     * The exact defect that shipped in the first draft: one dropped arc segment
     * from the ring. Renders as a plausible anchor with a filled-in shackle.
     */
    file: "public/favicon.svg",
    find: `A1 1 0 0 1 12 6A1 1 0 0 1 11 5A1 1 0 0 1 12 4Z`,
    repl: `A1 1 0 0 1 12 6A1 1 0 0 1 12 4Z`,
    breaks: "favicon draws the real mdiAnchor",
  },
  {
    file: "public/favicon.svg",
    find: `<rect width="24" height="24" fill="#0A2E5C" />`,
    repl: `<rect width="24" height="24" fill="none" />`,
    breaks: "favicon draws the real mdiAnchor",
  },
  {
    // Reintroduce the exact spelling that shipped, in the exact field it
    // shipped in — a section heading, the most visible string in the file.
    file: "src/data/directives.js",
    find: `    heading: "Organization & personnel records",`,
    repl: `    heading: "Organisation & personnel records",`,
    breaks: "no British spellings",
  },

  // --- due dates: parsing and arithmetic ----------------------------------
  {
    /**
     * The one-day-early bug. `new Date(iso)` is UTC midnight, so this is correct
     * in London and wrong in San Diego — and the mutation is shorter and more
     * obvious than the code it replaces, which is why the real code needs a test
     * standing over it.
     */
    file: "src/lib/due.js",
    find: `  const dt = new Date(y, mo - 1, d);`,
    repl: `  const dt = new Date(\`\${m[1]}-\${m[2]}-\${m[3]}\`);`,
    breaks: "parses ISO dates in LOCAL time",
  },
  {
    file: "src/lib/due.js",
    find: `  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;`,
    repl: ``,
    breaks: "rejects malformed and impossible dates",
  },
  {
    file: "src/lib/due.js",
    find: `  const day = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth + 1));`,
    repl: `  const day = date.getDate();`,
    breaks: "adding months clamps",
  },
  {
    file: "src/lib/due.js",
    find: `  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);`,
    repl: `  return Math.floor((b - a) / 86400000);`,
    breaks: "day counts are calendar days",
  },
  {
    // Off by one, on the only day it matters.
    file: "src/lib/due.js",
    find: `  if (daysBetween(from, candidate) >= 0) return candidate;`,
    repl: `  if (daysBetween(from, candidate) > 0) return candidate;`,
    breaks: "still due ON the deadline day",
  },

  // --- due dates: status decisions ----------------------------------------
  {
    /**
     * The mutation that matters most. Treating "never recorded" as "due today"
     * is the natural simplification, it removes a branch, and it paints a new
     * user's entire screen red.
     */
    file: "src/lib/due.js",
    find: `    if (!completed) {
      return {
        ...base,
        intervalMonths,
        warnDays: warnDaysFor(intervalMonths, due.warn),
        status: "needs-anchor",`,
    repl: `    if (!completed) {
      return {
        ...base,
        intervalMonths,
        dueDate: today,
        dueISO: toISO(today),
        daysUntil: 0,
        warnDays: warnDaysFor(intervalMonths, due.warn),
        status: "due-soon",`,
    breaks: "asks for a date instead of inventing one",
  },
  {
    file: "src/lib/due.js",
    find: `const WARN_DAYS = { 1: 7, 3: 21, 12: 60 };`,
    repl: `const WARN_DAYS = { 1: 7, 3: 21, 12: 30 };`,
    breaks: "decided by the interval's own warn window",
  },
  {
    /**
     * The classic reservist-tool bug: a good year anchored to the calendar year
     * instead of to the RC anniversary. Wrong for everyone whose anniversary
     * isn't 1 January, and it looks completely plausible on screen.
     */
    file: "src/lib/due.js",
    find: `    const doneThisYear = completed && daysBetween(win.start, completed) >= 0;`,
    repl: `    const doneThisYear = completed && completed.getFullYear() === today.getFullYear();`,
    breaks: "keyed to the RC year",
  },
  {
    file: "src/lib/due.js",
    find: `    const win = anniversaryWindow(ctx.anniversaryMonthDay, today);
    if (!win) {`,
    repl: `    const win = anniversaryWindow(ctx.anniversaryMonthDay, today)
      ?? { start: new Date(today.getFullYear(), 0, 1) };
    if (false) {`,
    breaks: "no anniversary on file says so",
  },
  {
    // The inverse of the completion rule, applied where it does not belong: a
    // fixed statutory deadline needs no anchor.
    file: "src/lib/due.js",
    find: `      dueDate = nextMonthDay(due.monthDay, today);
      reason = "Fiscal-year deadline`,
    repl: `      dueDate = null;
      reason = "Fiscal-year deadline`,
    breaks: "arrives whether or not anything is checked off",
  },
  {
    file: "src/lib/due.js",
    find: `      status: "unscheduled",
      // The cadence sentence`,
    repl: `      status: "overdue",
      // The cadence sentence`,
    breaks: "event-driven, not overdue",
  },
  {
    // Failing open makes a typo'd basis look like a deliberate omission.
    file: "src/lib/due.js",
    find: `      status: "needs-anchor",
      reason: \`Unknown due basis "\${due.basis}".\`,`,
    repl: `      status: "unscheduled",
      reason: \`Unknown due basis "\${due.basis}".\`,`,
    breaks: "surfaces as a data bug",
  },
  {
    file: "src/data/checklist.js",
    find: `due: { basis: "fiscalYear", monthDay: "09-30" }`,
    repl: `due: { basis: "fiscal-year", monthDay: "09-30" }`,
    breaks: "uses a basis the code implements",
  },
  {
    file: "src/lib/due.js",
    find: `  rows.sort((a, b) => {`,
    repl: `  if (false) rows.sort((a, b) => {`,
    breaks: "sorts by urgency",
  },

  // --- due dates: the .ics ------------------------------------------------
  {
    // Bare LF. Looks identical in an editor; strict parsers reject the file.
    file: "src/lib/due.js",
    find: `  return { ics: lines.map(fold).join("\\r\\n") + "\\r\\n", exported, skipped };`,
    repl: `  return { ics: lines.map(fold).join("\\n") + "\\n", exported, skipped };`,
    breaks: "well-formed RFC 5545",
  },
  {
    /**
     * Character-counted folding. Passes any check that measures `line.length`,
     * and overruns for real clients on every line containing one of this site's
     * em-dashes — which is every SUMMARY.
     */
    file: "src/lib/due.js",
    find: `  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;`,
    repl: `  const bytes = new TextEncoder().encode(line);
  if (line.length <= 75) return line;`,
    breaks: "folds by octet",
  },
  {
    file: "src/lib/due.js",
    find: `    lines.push(\`DTEND;VALUE=DATE:\${icsDate(addDays(row.dueDate, 1))}\`);`,
    repl: `    lines.push(\`DTEND;VALUE=DATE:\${icsDate(row.dueDate)}\`);`,
    breaks: "well-formed RFC 5545",
  },
  {
    file: "src/lib/due.js",
    find: `    .replace(/,/g, "\\\\,")`,
    repl: ``,
    breaks: "escapes text and recurs",
  },
  {
    file: "src/lib/due.js",
    find: `  if (months > 0 && months < 12) return \`FREQ=MONTHLY;INTERVAL=\${months}\`;`,
    repl: `  if (months > 0 && months < 12) return \`FREQ=YEARLY;INTERVAL=\${months}\`;`,
    breaks: "escapes text and recurs",
  },
  {
    file: "src/lib/due.js",
    find: `    if (!row?.dueDate) {
      skipped += 1;
      continue;
    }`,
    repl: `    if (!row?.dueDate) {
      continue;
    }`,
    breaks: "skipped and COUNTED",
  },
  {
    // A UID derived from anything volatile turns re-import into duplication.
    file: "src/lib/due.js",
    find: `    lines.push(\`UID:saltdog-\${row.itemId}@saltdog.invalid\`);`,
    repl: `    lines.push(\`UID:saltdog-\${exported}-\${row.dueISO}@saltdog.invalid\`);`,
    breaks: "well-formed RFC 5545",
  },
  {
    file: "src/components/tools/DueDatesTool.vue",
    find: `const today = ref(new Date());`,
    repl: `const today = ref(new Date());\nconst { state: own } = useLocalStore("due", { version: 1, fallback: () => ({}) });`,
    breaks: "stores nothing of its own",
  },

  // --- golden questions ---------------------------------------------------
  {
    /**
     * The aliases are the reason a natural-language question reaches an
     * authority at all: "which", "what" and "covers" are stopwords, so without
     * the phrase rules "which instruction covers evals" reduces to "evals" and
     * lands on the EVAL card. Deleting them must break the golden rows, not just
     * make them less confident.
     */
    file: "src/data/aliases.js",
    find: `    "instruction directive",`,
    repl: `    "",`,
    breaks: "which reg covers evals",
  },
  {
    /**
     * The `parts` fallback on its own. Removing it leaves the outer split, which
     * still handles "1610.10" — so the series-number rows survive — but the
     * punctuation-free JOIN goes with it, and "PRIMS2" and "E8" stop matching
     * charts that print "PRIMS-2" and "E-8". Aimed at the existing acronym check
     * rather than at anything new, to establish that it guards this and not just
     * the hyphenated spelling it names.
     */
    file: "src/lib/retrieval.js",
    find: `    const parts = raw.match(/[a-z]+|[0-9]+/g);
    if (parts && parts.length > 1) {
      // Both directions: the split parts, and the punctuation-free join.
      for (const p of parts) push(p);
      push(parts.join(""));
    }
`,
    repl: ``,
    breaks: "acronym punctuation variants",
  },
  {
    /**
     * TWO edits, because one cannot do it — and that is the finding, not a
     * workaround.
     *
     * Series-number search is defended twice over: the outer split on
     * `[^a-z0-9]+` turns "1610.10" into `1610` + `10h`, and independently the
     * `parts` regex ignores punctuation and rebuilds the same tokens from the raw
     * form. Disabling either alone changes nothing measurable — which is why the
     * single-edit version of this mutation SURVIVED, and why reading the survival
     * as "the check is decorative" would have been the wrong conclusion.
     *
     * Disabling both takes every series-number query to `unknown`. So the golden
     * rows do have teeth; they are simply guarding a mechanism that is redundant
     * by design, and this mutation is what demonstrates the difference between
     * those two situations.
     */
    file: "src/lib/retrieval.js",
    edits: [
      {
        find: `for (const raw of normalize(text).split(/[^a-z0-9]+/)) {`,
        repl: `for (const raw of normalize(text).split(/[^a-z0-9.-]+/)) {`,
      },
      {
        find: `    const parts = raw.match(/[a-z]+|[0-9]+/g);
    if (parts && parts.length > 1) {
      // Both directions: the split parts, and the punctuation-free join.
      for (const p of parts) push(p);
      push(parts.join(""));
    }
`,
        repl: ``,
      },
    ],
    breaks: "BUPERSINST 1610.10",
  },

  // --- doctrine, customs and courtesies -----------------------------------
  {
    /**
     * The defect the renderer/flattener check exists for. Deleting the branch
     * does not throw and does not fail a build — the template falls through to
     * the unknown-kind alert, so the Sailor's Creed is replaced by a yellow
     * "no renderer" box on the page and in every chat answer that cites it.
     */
    file: "src/components/common/TopicSection.vue",
    find: `    <template v-else-if="section.kind === 'verbatim'">`,
    repl: `    <template v-else-if="section.kind === 'verbatim-disabled'">`,
    breaks: "renderer and a flattener",
  },
  {
    // The other half, and the quieter one: the flatten() arm. Removed, the creed
    // still indexes — via JSON.stringify, quotes and commas included. Nothing
    // visibly breaks, which is why the check covers both files.
    file: "src/lib/corpus.js",
    find: `    case "steps":
    case "verbatim":`,
    repl: `    case "steps":`,
    breaks: "renderer and a flattener",
  },
  {
    // Ten general orders under a heading that says eleven.
    file: "src/data/doctrine.js",
    find: `  "To talk to no one except in the line of duty.",
`,
    repl: ``,
    breaks: "eleven General Orders",
  },
  {
    // A paraphrase that reads fine and is not the order. The `To ` check is what
    // notices; nothing else in the suite reads these strings.
    file: "src/data/doctrine.js",
    find: `  "To quit my post only when properly relieved.",`,
    repl: `  "Never leave your post until you are properly relieved.",`,
    breaks: "eleven General Orders",
  },
  {
    // Rename a core value and the creed one heading above now contradicts it.
    file: "src/data/doctrine.js",
    find: `    k: "Commitment",`,
    repl: `    k: "Dedication",`,
    breaks: "same three values",
  },
  {
    // Two sentences joined into one row. Renders as a paragraph rather than as
    // the creed, and no other check looks at the row split.
    file: "src/data/doctrine.js",
    find: `  "I proudly serve my country's Navy combat team with Honor, Courage and Commitment.",
  "I am committed to excellence and the fair treatment of all.",`,
    repl: `  "I proudly serve my country's Navy combat team with Honor, Courage and Commitment. I am committed to excellence and the fair treatment of all.",`,
    breaks: "quoted as lines",
  },
  {
    /**
     * One digit in the watch table — the exact error the arithmetic check was
     * written for. It leaves a plausible-looking table with a one-hour hole
     * between the morning and forenoon watches.
     */
    file: "src/data/doctrine.js",
    find: `  { watch: "Morning watch", time: "0400 – 0800" },`,
    repl: `  { watch: "Morning watch", time: "0400 – 0700" },`,
    breaks: "24 hours with no gap",
  },
  {
    // The dog watches lengthened to four hours each, which keeps the chain
    // intact and the total at 24 — the gap arithmetic alone would pass. It is
    // the two-hour assertion at the end that catches it, and it matters because
    // the bells section explains the rotation in terms of the short watches.
    file: "src/data/doctrine.js",
    find: `  { watch: "First dog watch", time: "1600 – 1800" },
  { watch: "Second dog watch", time: "1800 – 2000" },`,
    repl: `  { watch: "First dog watch", time: "1200 – 1600" },
  { watch: "Second dog watch", time: "1600 – 2000" },`,
    breaks: "24 hours with no gap",
  },
  {
    // Drop the provenance off the creed. It renders as a quotation with nothing
    // under it — text presented as authoritative with no stated source, which is
    // the one omission this page cannot afford.
    file: "src/data/doctrine.js",
    find: `      note:
        "Adopted in 1993 and revised in 1994. The creed is promulgated by the CNO " +
        "and carried in training material rather than in a numbered instruction, so " +
        "none of the directives indexed on this site is its source.",
`,
    repl: ``,
    breaks: "cites public authorities",
  },
  {
    // The other shape of the same defect, and the one that actually shipped in
    // the first draft: a chip naming a document that does not contain the text.
    // Nothing structural is wrong — `navy-regs` is a real registered directive —
    // so only the rule that the creed's source be stated where it is true
    // catches it. This is why that rule accepts a note and not just `refs`.
    file: "src/data/doctrine.js",
    find: `      refs: ["opnavinst-3120-32"],
      rows: GENERAL_ORDERS,`,
    repl: `      rows: GENERAL_ORDERS,`,
    breaks: "cites public authorities",
  },
  {
    // The book named as a source inside the content, which is the thing this
    // topic was built to avoid.
    file: "src/data/doctrine.js",
    find: `      heading: "Shipboard terminology",`,
    repl: `      heading: "Shipboard terminology (Bluejacket's Manual ch. 3)",`,
    breaks: "cites public authorities",
  },
  {
    // The note trimmed to something that no longer distinguishes the quoted
    // texts from the summaries — the honesty the page rests on, and the easiest
    // thing here to lose during an unrelated edit.
    file: "src/data/doctrine.js",
    find: `  "The Sailor's Creed and the General Orders are quoted exactly; everything else " +
  "on this page is summarized in plain words. Customs, watch bills and ceremony " +`,
    repl: `  "Customs, watch bills and ceremony " +`,
    breaks: "which parts are quoted",
  },
  {
    /**
     * Put a section-naming word back into the TOPIC keywords, which is the state
     * this page shipped in first. corpus.js folds topic keywords into every
     * section, so "salute" up here ties all eight sections and "when do I not
     * salute" answers with the Sailor's Creed. Nothing else in the suite moves.
     */
    file: "src/data/doctrine.js",
    find: `  keywords: ["doctrine", "customs", "courtesies", "bluejacket", "navy regulations"],`,
    repl: `  keywords: ["doctrine", "customs", "courtesies", "bluejacket", "navy regulations", "salute", "saluting"],`,
    breaks: "when do I not salute",
  },
  {
    // The headword list on the terminology section. Without it a one-word
    // question about a defined term scores on body weight alone and falls under
    // the answer threshold.
    file: "src/data/doctrine.js",
    find: `        "ladder",
`,
    repl: ``,
    breaks: "ladder on a ship",
  },

  // --- static reference pages ---------------------------------------------
  //
  // These renderers are a second implementation of TopicSection.vue, so the
  // mutations here are mostly "the copy quietly says less than the original".
  {
    // The failure the SECTION_RENDERERS design exists to make loud: a kind in the
    // data with nothing to render it.
    file: "tools/prerender.mjs",
    find: "  phonetic: (s) =>",
    repl: "  phonetics: (s) =>",
    breaks: "every section kind in the data has a renderer",
  },
  {
    // ...and the same defect with the throw defanged, which is how it would ship
    // as a blank section instead of a red build.
    file: "tools/prerender.mjs",
    find: "  const render = SECTION_RENDERERS[section.kind];",
    repl: "  const render = SECTION_RENDERERS[section.kind] ?? (() => \"\");",
    breaks: "an unknown section kind throws",
  },
  {
    file: "tools/prerender.mjs",
    find: "    ...topics.map((t) => ({",
    repl: "    ...topics.slice(1).map((t) => ({",
    breaks: "emits one page per topic",
  },
  {
    // A table loses a column. The page still renders, still has every row, and
    // reads as complete unless you happen to know the chart.
    file: "tools/prerender.mjs",
    find: '        { key: "abbr", title: "Abbr.", mono: true },',
    repl: "",
    count: 2, // the ranks tables and the awards table
    breaks: "every string in the data reaches the page",
  },
  {
    // A row-level field stops being printed. This is the checklist note, the
    // sentence that says WHY the item is on the list.
    file: "tools/prerender.mjs",
    find: '${i.note ? `          <p class="dim">${esc(i.note)}</p>` : ""}',
    repl: "",
    breaks: "every string in the data reaches the page",
  },
  {
    // A data field is renamed and the exemption that covered it now covers
    // nothing — the state in which the coverage test has a hole and looks fine.
    file: "src/data/checklist.js",
    find: "  cadence:",
    repl: "  cadenceLabel:",
    count: 7,
    breaks: "no exemption in NOT_PRINTED is stale",
  },
  {
    // The other half of an exemption: "not printed, because it is resolved to
    // something that IS printed" — with the resolver emitting nothing.
    file: "tools/prerender.mjs",
    find: "  if (!ds.length) return \"\";",
    repl: "  if (ds.length >= 0) return \"\";",
    breaks: "resolved by a lookup",
  },
  {
    // The real regression this replaced: citations printing `d.label` where
    // DirectiveRefs.vue prints `display(d)`, dropping the revision letter off
    // every instruction cited anywhere on the site.
    file: "tools/prerender.mjs",
    find: "      const label = esc(display(d));",
    repl: "      const label = esc(d.label);",
    breaks: "resolved by a lookup",
  },
  {
    // Print the warrant note unconditionally, which diverges from the app on
    // exactly one of six services.
    file: "tools/prerender.mjs",
    find: "      !svc.warrant?.length && svc.warrantNote",
    repl: "      svc.warrantNote",
    breaks: "warrant note is withheld exactly where the app withholds it",
  },
  {
    file: "tools/prerender.mjs",
    find: "          const value = custom ?? esc(row[c.key] ?? \"\");",
    repl: "          const value = custom ?? esc(row);",
    breaks: "nothing renders as undefined",
  },
  {
    // Stop escaping ampersands. "Awards & Precedence" becomes an invalid entity
    // reference, and nothing about the rendered page looks wrong.
    file: "tools/prerender.mjs",
    find: "    .replace(/&/g, \"&amp;\")\n",
    repl: "",
    breaks: "every ampersand in the markup is a real entity",
  },
  {
    // The inverse, and the more interesting mistake: escaping the JSON-LD, which
    // is raw text, so Google reads the literal characters "&amp;" in the name.
    file: "tools/prerender.mjs",
    find: "        name: `${topic.title} — SALTDOG`,",
    repl: "        name: esc(`${topic.title} — SALTDOG`),",
    breaks: "JSON-LD is NOT entity-escaped",
  },
  {
    file: "tools/prerender.mjs",
    find: '      <h2 id="sec-${esc(section.id)}-h">',
    repl: '      <h3 id="sec-${esc(section.id)}-h">',
    breaks: "headings never skip a level",
  },
  {
    // og:url pointing at the site root instead of the page. Plausible, harmless
    // looking, and it tells every social crawler the wrong URL.
    file: "tools/prerender.mjs",
    find: '    <meta property="og:url" content="${esc(canonical)}" />',
    repl: '    <meta property="og:url" content="${esc(ORIGIN + BASE_PATH)}" />',
    breaks: "canonical, og:url, and the JSON-LD @id",
  },
  {
    // One `../` for every page, which is correct for quick-links/ and wrong for
    // all eleven knowledge pages.
    file: "tools/prerender.mjs",
    find: '  return "../".repeat(pagePath.split("/").length - 1);',
    repl: '  return "../";',
    breaks: "relative prefixes match the depth",
  },
  {
    // Stop rewriting url(./img/…). The sprite sheet then resolves against the
    // document, so every insignia and every ribbon 404s on a nested page.
    file: "tools/prerender.mjs",
    find: "String(v).replace(/url\\(\\.\\//g, `url(${prefix}`)",
    repl: "String(v)",
    breaks: "relative prefixes match the depth",
  },
  {
    file: "tools/prerender.mjs",
    find: '<a href="${prefix}pdf/${esc(svc.sourcePdf)}" download>',
    repl: '<a href="${prefix}pdfs/${esc(svc.sourcePdf)}" download>',
    breaks: "every local reference resolves to something that exists",
  },
  {
    file: "tools/prerender.mjs",
    find: "  return `    <footer>",
    repl: "  return `    <script>console.log(1)</script>\n    <footer>",
    breaks: "the only script on these pages is structured data",
  },
  {
    // The last breadcrumb self-links, which is how a trail ends up in a loop.
    file: "tools/prerender.mjs",
    find: '          { "@type": "ListItem", position: 3, name: topic.title },',
    repl: '          { "@type": "ListItem", position: 3, name: topic.title, item: url },',
    breaks: "breadcrumb is ordered",
  },
  {
    // The hub drops a card. Since the hub is the only path a crawler has into
    // these pages, a card missing from it is a page that will never be found.
    file: "tools/prerender.mjs",
    find: "  const cards = topics\n",
    repl: "  const cards = topics\n    .slice(1)\n",
    breaks: "the hub reaches every card",
  },
  {
    file: "tools/prerender.mjs",
    find: "          <strong>Unofficial.</strong>",
    repl: "          <strong>Note.</strong>",
    breaks: "every page carries the disclaimer",
  },
  {
    // The static URL and the hash route drift apart, so "open the interactive
    // version" lands on the catch-all redirect instead of the page.
    file: "tools/prerender.mjs",
    find: '  return topicId === "quicklinks" ? "#/quick-links" : `#/knowledge/${topicId}`;',
    repl: '  return topicId === "quicklinks" ? "#/quicklinks" : `#/knowledge/${topicId}`;',
    breaks: "hash route each page advertises",
  },
  {
    // The hub is the crawl entry point AND the page most likely to be the first
    // one a reader ever sees, so it is the last one that should be a dead end.
    file: "tools/prerender.mjs",
    find: '          <a class="btn" href="${prefix}#/knowledge">Open the interactive version</a>\n',
    repl: "",
    breaks: "hash route each page advertises",
  },
  {
    file: "tools/prerender.mjs",
    find: "  const title = `${topic.title} — SALTDOG`;",
    repl: "  const title = topic.title;",
    breaks: "titles and descriptions are written to survive",
  },
  {
    // The exact regression the two-gold split exists to prevent: reuse the bright
    // gold in light mode, where it is 2.27:1 on white.
    file: "tools/prerender.mjs",
    find: "          --gold: #8a6d1f;",
    repl: "          --gold: #c8a951;",
    breaks: "palette still matches the Vuetify themes",
  },
  {
    file: "tools/prerender.mjs",
    find: "    `${ORIGIN}${BASE_PATH}knowledge/`,\n",
    repl: "",
    breaks: "sitemap lists exactly the pages emitted",
  },
  {
    // A looser date check, which is how "01/01/2026" ends up in every <lastmod>
    // and Google learns to stop reading the file.
    file: "tools/prerender.mjs",
    find: "  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(lastmod))) {",
    repl: "  if (!/\\d{4}/.test(String(lastmod))) {",
    breaks: "renderAll refuses a lastmod",
  },
  {
    file: "homepage/robots.txt",
    find: "Sitemap: https://thepollywog.github.io/saltdog/sitemap.xml",
    repl: "",
    breaks: "declared to the sibling homepage's crawl entry points",
  },
  {
    file: "homepage/index.html",
    find: '<a href="saltdog/knowledge/">One-page reference cards</a>',
    repl: "One-page reference cards",
    breaks: "declared to the sibling homepage's crawl entry points",
  },
];

// --- harness ---------------------------------------------------------------

/** Run the suite filtered to one test name; return whether that test failed. */
function testFails(namePattern) {
  const res = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap", "--test-name-pattern", namePattern, "tools/verify-corpus.mjs"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const out = `${res.stdout}${res.stderr}`;
  // A pattern that matches nothing "passes", which would read as SURVIVED and
  // hide the real problem, so the match count is checked separately.
  const ran = /^# pass (\d+)/m.exec(out);
  const failed = /^# fail (\d+)/m.exec(out);
  return {
    fails: Number(failed?.[1] ?? 0) > 0,
    ran: Number(ran?.[1] ?? 0) + Number(failed?.[1] ?? 0),
    out,
  };
}

let survived = 0;
let collateral = 0;
let killed = 0;

// Confirm the pattern matching works before trusting any result from it.
for (const m of MUTATIONS) {
  const probe = testFails(m.breaks);
  if (probe.ran === 0) {
    console.log(`  MISNAMED   ${m.breaks} — matches no test`);
    collateral += 1;
    continue;
  }
  if (probe.fails) {
    console.log(`  DIRTY      ${m.breaks} — already failing before mutation`);
    collateral += 1;
    continue;
  }

  const path = join(ROOT, m.file);
  const backup = `${path}.sabotage-backup`;
  const original = readFileSync(path, "utf8");

  // Apply every edit up front, so a stale anchor in the second of two is caught
  // before anything is written rather than leaving a half-mutated file.
  let mutated = original;
  let stale = null;
  for (const e of editsOf(m)) {
    const occurrences = mutated.split(e.find).length - 1;
    const expected = e.count ?? 1;
    if (occurrences !== expected) {
      stale = `\`find\` occurs ${occurrences}x in ${m.file}, expected ${expected}: ${e.find.slice(0, 40).replace(/\n/g, "\\n")}`;
      break;
    }
    mutated = mutated.split(e.find).join(e.repl);
  }
  if (stale) {
    console.log(`  STALE      ${m.breaks} — ${stale}`);
    collateral += 1;
    continue;
  }

  copyFileSync(path, backup);
  try {
    writeFileSync(path, mutated);
    const after = testFails(m.breaks);
    if (after.fails) {
      console.log(`  killed     ${m.breaks}`);
      killed += 1;
    } else {
      const what = editsOf(m)
        .map((e) => e.find.slice(0, 48).replace(/\n\s*/g, " "))
        .join(" + ");
      console.log(`  SURVIVED   ${m.breaks}  <-- the check does not detect ${m.file}: ${what}`);
      survived += 1;
    }
  } finally {
    copyFileSync(backup, path);
    unlinkSync(backup);
  }
}

console.log(`\n${killed} killed, ${survived} survived, ${collateral} harness problems`);
if (survived || collateral) process.exit(1);

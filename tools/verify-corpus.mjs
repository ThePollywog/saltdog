/**
 * Corpus + retrieval verification. Run with `node --test tools/`.
 *
 * Two jobs:
 *
 *  1. GOLDEN QUESTIONS — a tuning instrument, not just a regression net. The
 *     scorer is the one component where a local fix causes distant breakage:
 *     adding `pha -> medical` to fix one question silently re-ranks five others,
 *     and hand-testing the query you just fixed will never show you that.
 *
 *  2. INTEGRITY — the defects that make a static site "look broken in
 *     production": HTML entities rendering literally, a sourcePdf that 404s, a
 *     duplicate section id that makes a citation ambiguous, a checklist id
 *     rename that wipes a user's saved progress.
 *
 * Zero dependencies. node:test is built into Node 22.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { buildCorpus } from "../src/lib/corpus.js";
import { ANSWER_THRESHOLD, ask, search } from "../src/lib/retrieval.js";
import { ALL_ITEM_IDS } from "../src/data/checklist.js";
import { ALL_TOPICS, TOPIC_BY_ID } from "../src/data/index.js";
import {
  CORRECTIONS,
  INSIGNIA_COUNT,
  SERVICES,
  SPRITE_COLS,
  TIERS,
  TILE,
  hasInsignia,
  insigniaIndex,
  insigniaPlan,
} from "../src/data/ranks.js";
import { insigniaStyle } from "../src/lib/insignia.js";
import { AOR_ORDER, AOR_PATHS, LAND_PATH, MAP_H, MAP_W } from "../src/data/geo.js";
import { GEOGRAPHIC } from "../src/data/cocoms.js";
import { COVERED_PAYGRADES, EMPTY_MONTHS, lookupPaygrade } from "../src/lib/evalRules.js";
import { GOOD_YEAR_MIN, anniversaryWindow, summarize, totalYear } from "../src/lib/points.js";
import {
  AWARDS,
  AWARD_BY_ID,
  CORRECTIONS as AWARD_CORRECTIONS,
  DEVICE_BY_ID,
  GROUPS,
  MULTIPLE_DEVICE,
} from "../src/data/awards.js";
import { TOOLS } from "../src/data/tools.js";
import { GROUPS as CHECKLIST_GROUPS, HOWTO } from "../src/data/checklist.js";
import { CATEGORIES } from "../src/data/quicklinks.js";
import { SYSTEMS, SYSTEM_BY_ID, systemUrl, viaLabel } from "../src/data/systems.js";
import { deviceSummary, devicesFor, layoutRack } from "../src/lib/ribbons.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = buildCorpus();

/** Just the device counts, so assertions read as the rule they encode. */
const pick = ({ silver, lesser }) => ({ silver, lesser });

/* ------------------------------------------------------------------ *
 * 1. Golden questions
 * ------------------------------------------------------------------ */

/**
 * Each entry: [question, expected record id].
 *
 * `expected` is matched against the TOP record. Where a question legitimately
 * has two good homes (a "how to" card and the checklist row that links to it),
 * an array accepts either — encoding a false single answer would force the
 * scorer to overfit.
 */
const GOLDEN = [
  // --- points / good year -------------------------------------------------
  ["How many points do I need for a good year?", ["reservist-checklist#howto-good-year", "reservist-checklist#retirement"]],
  ["what is a good year", ["reservist-checklist#howto-good-year", "reservist-checklist#retirement"]],
  ["where is my points statement", ["reservist-checklist#howto-nsips-points", "reservist-checklist#retirement"]],
  ["how do I verify drill credit", "reservist-checklist#howto-nsips-points"],
  ["retirement points record", ["reservist-checklist#howto-nsips-points", "reservist-checklist#retirement", "reservist-checklist#howto-good-year"]],

  // --- eval / fitrep ------------------------------------------------------
  ["When is my E6 eval due?", ["eval-fitrep#schedule", "eval-fitrep#rules"]],
  ["when is my fitrep due", ["eval-fitrep#schedule", "eval-fitrep#rules"]],
  ["what month do O4 fitreps report", ["eval-fitrep#schedule", "eval-fitrep#rules"]],
  ["eNAVFIT submission", ["reservist-checklist#howto-enavfit", "quicklinks#admin"]],
  ["when is counseling due", ["eval-fitrep#rules", "eval-fitrep#schedule"]],
  ["do flag officers have a reporting month", ["eval-fitrep#coverage", "eval-fitrep#schedule"]],

  // --- pay / records ------------------------------------------------------
  ["Where do I check my LES?", ["reservist-checklist#howto-mypay-les", "quicklinks#personnel"]],
  ["mypay drill pay", ["reservist-checklist#howto-mypay-les", "quicklinks#personnel"]],
  ["how do I see my OMPF", ["quicklinks#personnel", "reservist-checklist#howto-records-sgli"]],

  // --- readiness ----------------------------------------------------------
  ["How do I schedule Annual Training?", ["reservist-checklist#howto-at-adt", "quicklinks#readiness"]],
  ["PFA PRIMS", ["reservist-checklist#howto-pfa", "quicklinks#readiness"]],
  ["when is my PHA due", ["reservist-checklist#howto-pha-imr", "reservist-checklist#annual", "quicklinks#benefits"]],
  ["dental readiness IMR", ["reservist-checklist#howto-pha-imr", "quicklinks#readiness", "reservist-checklist#annual"]],
  ["GMT computer based training", ["reservist-checklist#howto-gmt-cbt", "quicklinks#readiness"]],
  ["what do I do at drill weekend", ["reservist-checklist#drill", "reservist-checklist#monthly"]],

  // --- career / security --------------------------------------------------
  ["career waypoints reenlistment", ["reservist-checklist#howto-cway", "quicklinks#admin", "quicklinks#personnel"]],
  ["security clearance DISS", ["reservist-checklist#howto-diss", "quicklinks#security"]],
  ["update SGLI beneficiary", ["reservist-checklist#howto-records-sgli", "quicklinks#benefits"]],
  ["tricare health benefits", ["quicklinks#benefits", "reservist-checklist#howto-pha-imr"]],

  // --- joint staff --------------------------------------------------------
  ["What does J4 do?", "joint-codes#directorates"],
  ["which J code is intelligence", "joint-codes#directorates"],
  ["joint staff personnel directorate", "joint-codes#directorates"],
  ["N4 G4 equivalent", ["joint-codes#equivalents", "joint-codes#directorates"]],

  // --- fleets / cocoms ----------------------------------------------------
  ["Which fleet covers the Middle East?", ["navy-fleets#fleets", "navy-fleets#notes"]],
  ["what is 7th fleet AOR", ["navy-fleets#fleets", "navy-fleets#notes"]],
  ["who owns cyber fleet", ["navy-fleets#fleets", "navy-fleets#notes"]],
  ["what does INDOPACOM cover", ["combatant-commands#geographic", "combatant-commands#functional"]],
  ["difference between OPCON and TACON", "combatant-commands#authorities"],
  ["what is ADCON", ["combatant-commands#authorities", "combatant-commands#geographic"]],
  ["functional combatant commands", ["combatant-commands#functional", "combatant-commands#geographic"]],

  // --- ranks --------------------------------------------------------------
  ["what is an E8 in the Navy", ["ranks#usn", "eval-fitrep#schedule"]],
  ["Marine Corps warrant officer ranks", ["ranks#usmc", "ranks#usn"]],
  ["Space Force enlisted ranks", ["ranks#ussf", "ranks#usaf"]],
  ["Coast Guard officer ranks", ["ranks#uscg", "ranks#usn"]],

  // --- phonetic -----------------------------------------------------------
  ["phonetic alphabet", ["phonetic-alphabet#letters", "phonetic-alphabet#digits"]],
  ["how do I say the letter W", ["phonetic-alphabet#letters", "phonetic-alphabet#digits"]],
  ["how do you pronounce numbers on the radio", ["phonetic-alphabet#digits", "phonetic-alphabet#letters"]],

  // --- awards / ribbons ---------------------------------------------------
  ["What order do ribbons go in?", ["awards#precedence", "awards#wear"]],
  ["order of precedence for navy awards", ["awards#precedence", "awards#wear"]],
  ["how do I build a ribbon rack", ["awards#wear", "awards#precedence"]],
  ["how many ribbons per row", ["awards#wear", "awards#precedence"]],
  ["what is a gold star device", ["awards#devices", "awards#precedence"]],
  ["what does an hourglass on a ribbon mean", ["awards#devices", "awards#precedence"]],
  ["silver star in lieu of five", ["awards#devices", "awards#precedence"]],
  ["where does the combat action ribbon go", ["awards#precedence", "awards#wear"]],
  ["armed forces reserve medal", ["awards#precedence", "awards#devices"]],

  // --- portals ------------------------------------------------------------
  ["MyNavy HR portal", ["quicklinks#portals", "quicklinks#personnel"]],
  ["defense travel system voucher", ["quicklinks#admin", "quicklinks#personnel", "quicklinks#benefits"]],

  // --- answerable only because of the checklist notes ---------------------
  // Measured, not assumed. 87 questions were scored twice — once with the `note`
  // prose in data/checklist.js, once with all 33 notes stubbed — and exactly
  // these four change. Without the notes the first two return `unknown`, the
  // third answers WRONG (it lands on the MyPay/LES how-to, because "check my"
  // outweighs a bare label), and the fourth drifts off the section that actually
  // states the four-periods figure.
  //
  // They differ in how tightly they're coupled, which is worth knowing before
  // trusting one to localize a fault. Stubbing a single note was tried for all
  // 33 items: only `life.employer` breaks anything by itself, taking both USERRA
  // questions with it. The drill question needs the whole `drill` group stubbed,
  // and the clearance question survives every group in isolation and fails only
  // when all 33 go — it is riding on corpus-wide IDF, not on one sentence. So
  // treat that one as a canary for "the notes were reverted", not as a pointer
  // to the note at fault.
  //
  // Pinned because prose is the easiest thing here to trim during an unrelated
  // edit, and an answer lost that way leaves no trace. Two other candidates —
  // "what is class 4 dental" and "gray area retiree" — were tried and NOT added:
  // both still answer correctly with every note stubbed, so they would have
  // tested the labels while appearing to test the notes.
  ["USERRA", "reservist-checklist#life-events"],
  ["does my employer have to hold my job", "reservist-checklist#life-events"],
  ["how do I check my clearance", "reservist-checklist#howto-diss"],
  ["how many points is a drill weekend", "reservist-checklist#drill"],
];

/** Questions the scorer must ADMIT IT CANNOT ANSWER. */
const NEGATIVE = [
  "what is the capital of France",
  "how do I bake sourdough bread",
  "recommend a good science fiction novel",
  "what is the weather tomorrow",
  "python list comprehension syntax",
];

describe("golden questions", () => {
  const ids = new Set(corpus.records.map((r) => r.id));

  it("every expected id exists in the corpus", () => {
    for (const [q, expected] of GOLDEN) {
      for (const id of [expected].flat()) {
        assert.ok(ids.has(id), `golden question "${q}" expects unknown record id "${id}"`);
      }
    }
  });

  for (const [question, expected] of GOLDEN) {
    const accept = [expected].flat();
    it(`answers: ${question}`, () => {
      const res = ask(question, corpus);
      assert.notEqual(res.kind, "unknown", `returned unknown; expected one of ${accept.join(", ")}`);

      // An ambiguous result is acceptable only if an accepted id is offered.
      const got = res.kind === "answer" ? [res.record.id] : res.options.map((o) => o.id);
      const hit = got.some((id) => accept.includes(id));
      assert.ok(
        hit,
        `top result${res.kind === "ambiguous" ? "s" : ""} = ${got.join(", ")}; ` +
          `expected one of ${accept.join(", ")}`,
      );
    });
  }

  for (const question of NEGATIVE) {
    it(`admits ignorance: ${question}`, () => {
      const res = ask(question, corpus);
      assert.equal(
        res.kind,
        "unknown",
        `answered an out-of-scope question with ${res.kind} ` +
          `(${res.kind === "answer" ? res.record.id : "options"}) — ` +
          `a scorer that answers everything is worse than one that admits ignorance`,
      );
    });
  }

  it("empty and punctuation-only queries are unknown, not crashes", () => {
    for (const q of ["", "   ", "???", "!!!", "the and of"]) {
      assert.equal(ask(q, corpus).kind, "unknown", `"${q}" should be unknown`);
    }
  });

  it("confidence of an answer is above the threshold and <= 1", () => {
    const res = ask("How many points do I need for a good year?", corpus);
    assert.equal(res.kind, "answer");
    assert.ok(res.confidence >= ANSWER_THRESHOLD, `confidence ${res.confidence} < threshold`);
    assert.ok(res.confidence <= 1.0001, `confidence ${res.confidence} exceeds 1 — normalization is wrong`);
  });

  it("search() returns a ranked list and respects its limit", () => {
    const hits = search("points", corpus, 3);
    assert.ok(hits.length > 0, "no hits for 'points'");
    assert.ok(hits.length <= 3, "limit not respected");
    for (let i = 1; i < hits.length; i++) {
      assert.ok(hits[i - 1].score >= hits[i].score, "results not sorted by score");
    }
  });

  it("acronym punctuation variants reach the same record", () => {
    for (const q of ["PRIMS-2", "PRIMS2", "PRIMS 2"]) {
      const res = ask(q, corpus);
      assert.notEqual(res.kind, "unknown", `"${q}" found nothing`);
    }
  });

  it("lowercase 'at' does not fire the Annual Training expansion", () => {
    // "look at my points" must not be dragged to the AT/ADT card by the
    // preposition. The case gate is the only thing preventing that.
    const res = ask("look at my points", corpus);
    if (res.kind === "answer") {
      assert.notEqual(res.record.id, "reservist-checklist#howto-at-adt");
    }
  });

  it("uppercase 'AT' DOES fire the Annual Training expansion", () => {
    const res = ask("how do I get AT orders", corpus);
    const got = res.kind === "answer" ? [res.record.id] : (res.options ?? []).map((o) => o.id);
    assert.ok(
      got.some((id) => id.includes("at-adt") || id.includes("readiness")),
      `AT orders landed on ${got.join(", ") || "unknown"}`,
    );
  });
});

/* ------------------------------------------------------------------ *
 * 2. Integrity
 * ------------------------------------------------------------------ */

/** Walk every string in the data tree so no field escapes the entity check. */
function* strings(value, path = "") {
  if (typeof value === "string") {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
  }
}

describe("data integrity", () => {
  it("record ids are unique", () => {
    const seen = new Set();
    for (const r of corpus.records) {
      assert.ok(!seen.has(r.id), `duplicate record id "${r.id}" — citations would be ambiguous`);
      seen.add(r.id);
    }
  });

  it("section ids are unique within each topic", () => {
    for (const topic of ALL_TOPICS) {
      const seen = new Set();
      for (const s of topic.sections ?? []) {
        assert.ok(!seen.has(s.id), `topic "${topic.id}" has duplicate section id "${s.id}"`);
        seen.add(s.id);
      }
    }
  });

  it("every topic has an id, title, and at least one section", () => {
    for (const topic of ALL_TOPICS) {
      assert.ok(topic.id, "topic missing id");
      assert.ok(topic.title, `topic "${topic.id}" missing title`);
      assert.ok((topic.sections ?? []).length > 0, `topic "${topic.id}" has no sections`);
      for (const s of topic.sections) {
        assert.ok(s.id, `topic "${topic.id}" has a section with no id`);
        assert.ok(s.heading, `section "${topic.id}#${s.id}" has no heading`);
        assert.ok(s.kind, `section "${topic.id}#${s.id}" has no kind`);
      }
    }
  });

  it("topic ids in the registry map back to themselves", () => {
    for (const topic of ALL_TOPICS) {
      assert.equal(TOPIC_BY_ID.get(topic.id), topic, `registry lookup broken for "${topic.id}"`);
    }
  });

  it("no HTML entities survived transcription", () => {
    // The Python builders store content pre-escaped. Vue escapes interpolation,
    // so a stray "&amp;" renders literally as "&amp;" on the page.
    const ENTITY = /&(amp|lt|gt|quot|apos|mdash|ndash|nbsp|ge|le|rarr|larr|hellip|deg|#x?\d+);/i;
    for (const topic of ALL_TOPICS) {
      for (const [path, str] of strings(topic, topic.id)) {
        const m = ENTITY.exec(str);
        assert.equal(m, null, `HTML entity "${m?.[0]}" at ${path}: ${JSON.stringify(str.slice(0, 90))}`);
      }
    }
  });

  it("every sourcePdf exists in public/pdf/", () => {
    const referenced = new Set();
    for (const topic of ALL_TOPICS) {
      if (!topic.sourcePdf) continue;
      referenced.add(topic.sourcePdf);
      // Data modules hold a BARE filename; the UI prefixes `pdf/`.
      assert.match(
        topic.sourcePdf,
        /^[a-z0-9-]+\.pdf$/,
        `topic "${topic.id}" sourcePdf should be a bare filename, got "${topic.sourcePdf}"`,
      );
      assert.ok(
        existsSync(join(ROOT, "public", "pdf", topic.sourcePdf)),
        `topic "${topic.id}" references missing PDF "public/pdf/${topic.sourcePdf}"`,
      );
    }
    assert.ok(referenced.size > 0, "no topic references a PDF — the download buttons would all be dead");
  });

  it("every PDF in public/pdf/ is referenced by some topic or service", () => {
    // Catches the reverse drift: a renamed data field leaving an orphan file
    // that quietly ships 200 KB nobody can reach.
    const onDisk = readdirSync(join(ROOT, "public", "pdf")).filter((f) => f.endsWith(".pdf"));
    const refs = new Set();
    for (const [, str] of strings(ALL_TOPICS)) {
      const m = /([a-z0-9-]+\.pdf)/i.exec(str);
      if (m) refs.add(m[1]);
    }
    for (const s of SERVICES) if (s.sourcePdf) refs.add(s.sourcePdf.split("/").pop());
    const orphans = onDisk.filter((f) => !refs.has(f));
    assert.deepEqual(orphans, [], `unreferenced PDFs in public/pdf/: ${orphans.join(", ")}`);
  });

  it("every tool in the registry has a lazy component and a route", () => {
    /**
     * data/tools.js owns the list; ToolsView owns the `import()` calls, because
     * a dynamic import needs a literal specifier to be code-split. That split is
     * the drift risk this test closes: a tool added to the registry but not to
     * COMPONENTS renders `undefined` as its tab body, and the nav drawer links
     * to a blank page. Both lists are read as source text — importing an SFC
     * from plain Node isn't possible without a build step.
     */
    const view = readFileSync(join(ROOT, "src/views/ToolsView.vue"), "utf8");
    const mapped = [...view.matchAll(/^\s{2}([a-z]+): \(\) => import\("(.+?)"\)/gm)];
    assert.deepEqual(
      mapped.map((m) => m[1]),
      TOOLS.map((t) => t.id),
      "data/tools.js and the COMPONENTS map in ToolsView.vue disagree (order matters: it is tab order)",
    );
    for (const [, id, spec] of mapped) {
      const file = join(ROOT, "src/views", spec);
      assert.ok(existsSync(file), `tool "${id}" imports missing component ${spec}`);
    }

    const drawer = readFileSync(join(ROOT, "src/components/shell/NavDrawer.vue"), "utf8");
    assert.match(drawer, /TOOLS\.map/, "NavDrawer stopped deriving its list from data/tools.js");

    for (const t of TOOLS) {
      assert.match(t.id, /^[a-z]+$/, `tool id "${t.id}" must be URL-safe and lowercase`);
      assert.ok(t.title, `tool "${t.id}" has no tab title`);
      assert.ok(t.icon, `tool "${t.id}" has no icon`);
    }
  });

  it("every persisted key has a human label on the About page", () => {
    /**
     * The About page lists stored entries so someone can see what this site keeps
     * on their machine. An unlabelled key falls back to the raw string, so a new
     * tool's storage shows up as "ribbons" — which reads as debug output on the
     * one page whose whole job is being legible about your data.
     */
    const keys = new Set();
    for (const file of readdirSync(join(ROOT, "src/components/tools"))) {
      const src = readFileSync(join(ROOT, "src/components/tools", file), "utf8");
      for (const m of src.matchAll(/useLocalStore\("([a-z]+)"/g)) keys.add(m[1]);
    }
    assert.ok(keys.size >= 3, `found only ${keys.size} persisting tools — did the regex rot?`);

    const about = readFileSync(join(ROOT, "src/views/AboutView.vue"), "utf8");
    // Bounded to the object literal: an unbounded scan would pick up every
    // two-space-indented identifier in the file and pass no matter what.
    const decl = /const LABELS = \{([\s\S]*?)\n\};/.exec(about);
    assert.ok(decl, "could not find the LABELS object in AboutView.vue");
    const labelled = new Set([...decl[1].matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1]));
    for (const key of keys) {
      assert.ok(labelled.has(key), `storage key "${key}" has no entry in AboutView's LABELS`);
    }
  });

  it("checklist item ids are unique and hand-written (never slugified labels)", () => {
    const seen = new Set();
    for (const id of ALL_ITEM_IDS) {
      assert.ok(!seen.has(id), `duplicate checklist id "${id}" — two rows would share saved state`);
      seen.add(id);
      assert.match(id, /^[a-z]+\.[a-z0-9-]+$/, `checklist id "${id}" is not in group.item form`);
    }
    assert.ok(ALL_ITEM_IDS.length >= 20, `only ${ALL_ITEM_IDS.length} checklist items`);
  });

  it("no checklist id has disappeared since the committed snapshot", () => {
    // Saved progress is keyed by these ids. Removing one silently drops a
    // user's checked box; renaming one drops it and adds an empty row.
    const snapshotPath = join(ROOT, "tools", "checklist-ids.json");
    if (!existsSync(snapshotPath)) {
      // First run writes the snapshot rather than failing; it is committed after.
      return;
    }
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
    const now = new Set(ALL_ITEM_IDS);
    const missing = snapshot.filter((id) => !now.has(id));
    assert.deepEqual(missing, [], `checklist ids removed or renamed: ${missing.join(", ")}`);
  });
});

/* ------------------------------------------------------------------ *
 * 2b. The systems registry
 * ------------------------------------------------------------------ */

/**
 * Every place that names a system by id, so a typo can't quietly render nothing.
 * `systemsFor()` drops unknown ids on purpose — an invented id would otherwise
 * throw in the middle of a page — which means a misspelling degrades to a
 * missing button rather than an error. That is the right runtime behaviour and
 * the wrong build-time behaviour, so it is checked here instead.
 */
const SYSTEM_REFS = [
  ...CHECKLIST_GROUPS.flatMap((g) =>
    g.items.flatMap((i) => (i.systems ?? []).map((id) => [id, `checklist item ${i.id}`])),
  ),
  ...HOWTO.flatMap((h) => (h.systems ?? []).map((id) => [id, `procedure ${h.id}`])),
  ...ALL_TOPICS.flatMap((t) => (t.systems ?? []).map((id) => [id, `topic ${t.id}`])),
  ...ALL_TOPICS.flatMap((t) =>
    t.sections.flatMap((s) => (s.systems ?? []).map((id) => [id, `section ${t.id}#${s.id}`])),
  ),
  ...CATEGORIES.flatMap((c) => c.links.map((l) => [l.id, `quick-links ${c.id}`])),
];

describe("systems registry", () => {
  it("every referenced system id exists", () => {
    assert.ok(SYSTEM_REFS.length >= 40, `only ${SYSTEM_REFS.length} system references found — did a field get renamed?`);
    for (const [id, where] of SYSTEM_REFS) {
      assert.ok(SYSTEM_BY_ID.has(id), `${where} references unknown system "${id}"`);
    }
  });

  it("system ids are unique and stable-looking", () => {
    const seen = new Set();
    for (const s of SYSTEMS) {
      assert.ok(!seen.has(s.id), `duplicate system id "${s.id}" — SYSTEM_BY_ID would keep only the last`);
      seen.add(s.id);
      assert.match(s.id, /^[a-z0-9-]+$/, `system id "${s.id}" should be a lowercase slug`);
      assert.ok(s.name, `system "${s.id}" has no name`);
      assert.ok(s.desc, `system "${s.id}" has no desc`);
      assert.ok(s.access, `system "${s.id}" has no access line`);
    }
  });

  it("every reach value resolves to a link or is honestly unlinkable", () => {
    /**
     * The whole point of the `reach` taxonomy is that the UI can tell the
     * difference between "click here" and "there is no here to click". Each case
     * has to hold up or a surface renders a button that goes nowhere:
     *   direct  needs its own https url
     *   portal  needs a `via` that itself resolves to a url
     *   phone   needs a tel: url
     *   offline needs no url — and must not accidentally have one
     */
    for (const s of SYSTEMS) {
      switch (s.reach) {
        case "direct":
          assert.match(s.url ?? "", /^https:\/\//, `direct system "${s.id}" needs an https url`);
          assert.equal(viaLabel(s.id), null, `direct system "${s.id}" should not carry a via label`);
          break;
        case "portal":
          assert.equal(s.url, null, `portal system "${s.id}" must not carry its own url`);
          assert.ok(s.via, `portal system "${s.id}" has no \`via\``);
          assert.ok(
            SYSTEM_BY_ID.has(s.via),
            `portal system "${s.id}" routes via unknown system "${s.via}"`,
          );
          assert.match(
            systemUrl(s.id) ?? "",
            /^https:\/\//,
            `portal system "${s.id}" routes via "${s.via}", which has no url of its own — the link would be dead`,
          );
          assert.ok(viaLabel(s.id), `portal system "${s.id}" produces no via label, so the hop would be invisible`);
          break;
        case "phone":
          assert.match(s.url ?? "", /^tel:\+\d{10,}$/, `phone system "${s.id}" needs a tel: url`);
          break;
        case "offline":
          assert.equal(s.url, null, `offline system "${s.id}" has a url — then it isn't offline`);
          assert.equal(systemUrl(s.id), null, `offline system "${s.id}" still resolves to a url`);
          break;
        default:
          assert.fail(`system "${s.id}" has unknown reach "${s.reach}"`);
      }
    }
  });

  it("a `then` instruction only exists where there is a landing page to act on", () => {
    /**
     * `then` names the click that happens AFTER a portal lets you in — NSIPS
     * opens on a launch page and the service record is behind a link called
     * "ESR", which nobody guesses from "check my drill points".
     *
     * Two ways it goes wrong. On a `direct` system it is a lie by placement: the
     * url IS the application, so there is no second step and the button would
     * invent one. And the string has to survive into the `access` line, because
     * the quick-links directory renders `access` and not `then` — a `then` that
     * only reaches the button leaves the directory one click short, which is the
     * exact gap the field was added to close.
     */
    for (const s of SYSTEMS) {
      if (!s.then) continue;
      assert.equal(
        s.reach,
        "portal",
        `system "${s.id}" is ${s.reach} but carries a \`then\` — a direct link ` +
          `lands on the application itself, so there is no next click to name`,
      );
      assert.ok(
        s.access.includes(s.then),
        `system "${s.id}" tells the button to "${s.then}" but its access line ` +
          `("${s.access}") does not say so, and the quick-links directory shows ` +
          `access rather than then`,
      );
    }
  });

  it("the NSIPS family points at the live host", () => {
    // Not a general URL-shape check — the shape was fine before. This is the one
    // host that moved to the Navy cloud tenancy, and the old nsipsapp.nmci.navy.mil
    // stopped resolving in DNS entirely rather than redirecting. Three systems
    // resolve through it (NSIPS, the ESR, eLeave), so a revert here silently
    // breaks the record of truth for drill points on seven checklist items.
    for (const s of SYSTEMS) {
      assert.doesNotMatch(
        `${s.url ?? ""} ${s.access}`,
        /nmci\.navy\.mil/,
        `system "${s.id}" references the retired NMCI host, which no longer resolves`,
      );
    }
    assert.match(systemUrl("nsips-esr") ?? "", /^https:\/\/www\.nsips\.cloud\.navy\.mil\//);
    assert.match(systemUrl("eleave") ?? "", /^https:\/\/www\.nsips\.cloud\.navy\.mil\//);
  });

  it("no system in the registry is unreachable from any surface", () => {
    // The reverse drift: a system nobody references is dead weight that still
    // has to be maintained, and usually means a rename half-landed.
    const referenced = new Set(SYSTEM_REFS.map(([id]) => id));
    for (const s of SYSTEMS) {
      // `via` targets count as referenced — a portal's hub may only be reached
      // through the systems that route to it.
      if (SYSTEMS.some((o) => o.via === s.id)) referenced.add(s.id);
    }
    const orphans = SYSTEMS.filter((s) => !referenced.has(s.id)).map((s) => s.id);
    assert.deepEqual(orphans, [], `systems defined but never linked anywhere: ${orphans.join(", ")}`);
  });

  it("quick links derive their addresses from the registry", () => {
    // quicklinks.js used to hold its own copy of every URL. This asserts the
    // derivation is still live, not re-hardcoded during some later edit.
    const src = readFileSync(join(ROOT, "src/data/quicklinks.js"), "utf8");
    assert.doesNotMatch(src, /https?:\/\//, "quicklinks.js has a literal URL again — addresses belong in systems.js");
    for (const cat of CATEGORIES) {
      for (const l of cat.links) {
        assert.equal(
          l.url,
          systemUrl(l.id),
          `quick-links entry "${l.id}" disagrees with the registry`,
        );
      }
    }
    const linked = CATEGORIES.flatMap((c) => c.links).filter((l) => l.url);
    assert.ok(linked.length >= 25, `only ${linked.length} quick links have a target`);
  });

  it("most checklist items point at the application that completes them", () => {
    /**
     * Not all of them: "notify your chain about a conflict" and "update your
     * civilian employer" are conversations, and a link there would be invented.
     * The floor is a floor — it catches the `systems` field being dropped or
     * renamed wholesale, which would silently return the checklist to being a
     * list of things you have to go find yourself.
     */
    const items = CHECKLIST_GROUPS.flatMap((g) => g.items);
    const withSystems = items.filter((i) => i.systems?.length);
    assert.ok(
      withSystems.length >= items.length * 0.7,
      `only ${withSystems.length} of ${items.length} checklist items name a system`,
    );
    for (const h of HOWTO) {
      assert.ok(h.systems?.length, `procedure "${h.id}" names no system to do it in`);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 3. Domain rules
 * ------------------------------------------------------------------ */

describe("eval/fitrep rules", () => {
  it("covers E1-E9, W1-W5, O1-O6", () => {
    assert.equal(COVERED_PAYGRADES.length, 20, `covered paygrades: ${COVERED_PAYGRADES.join(",")}`);
    for (const g of ["E1", "E5", "E9", "W1", "W5", "O1", "O6"]) {
      assert.equal(lookupPaygrade(g).status, "ok", `${g} should resolve`);
    }
  });

  it("normalizes paygrade input", () => {
    for (const input of ["E6", "e6", "E-6", " e - 6 ", "e 6"]) {
      const r = lookupPaygrade(input);
      assert.equal(r.status, "ok", `"${input}" failed to normalize`);
      assert.equal(r.grade, "E6");
    }
  });

  it("flag officers get an explanation, not an empty result", () => {
    for (const g of ["O7", "O8", "O9", "O10"]) {
      const r = lookupPaygrade(g);
      assert.equal(r.status, "flag", `${g} should be status "flag"`);
      assert.match(r.message, /different cycle/i);
    }
  });

  it("unknown paygrades explain what IS covered", () => {
    const r = lookupPaygrade("E12");
    assert.equal(r.status, "unknown");
    assert.match(r.message, /E1.E9/);
  });

  it("officer reports are due the last day of the month, enlisted the 15th", () => {
    const o = lookupPaygrade("O4", 2026);
    assert.equal(o.tier, "officer");
    const days = new Date(2026, o.monthIndex + 1, 0).getDate();
    assert.equal(o.reportDue.day, days, "officer due day is not the last of the month");

    const e = lookupPaygrade("E6", 2026);
    assert.equal(e.tier, "enlisted");
    assert.equal(e.reportDue.day, 15);
  });

  it("counseling falls six months before the reporting month", () => {
    const r = lookupPaygrade("E6");
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const want = months[(r.monthIndex + 12 - 6) % 12];
    assert.equal(r.counseling.month, want);
  });

  it("empty months are named explicitly, not left blank", () => {
    assert.ok(EMPTY_MONTHS.length > 0, "no empty months found — the source has two");
    for (const m of EMPTY_MONTHS) assert.ok(typeof m === "string" && m.length > 2);
  });
});

describe("retirement points", () => {
  it("a good year needs 50 points", () => {
    assert.equal(GOOD_YEAR_MIN, 50);
    assert.equal(totalYear({ idt: 24, at: 14, corr: 0 }).total, 24 + 14 + 15);
    assert.equal(totalYear({ idt: 24, at: 14 }).isGood, true);
    assert.equal(totalYear({ idt: 5, at: 0, membership: 15 }).isGood, false);
    assert.equal(totalYear({ idt: 5, at: 0, membership: 15 }).shortBy, 30);
  });

  it("ignores negative and non-numeric input instead of producing NaN", () => {
    const r = totalYear({ idt: -10, at: "abc", corr: null, membership: 15 });
    assert.equal(Number.isFinite(r.total), true);
    assert.equal(r.total, 15);
  });

  it("flags the inactive-duty cap rather than silently clamping the record", () => {
    const r = totalYear({ idt: 200, at: 14, corr: 50, membership: 15 });
    assert.equal(r.overInactiveCap, true);
    assert.equal(r.total, 200 + 14 + 50 + 15, "totals must not be reduced behind the user's back");
  });

  it("counts good years toward 20 and reports the remainder", () => {
    const years = [
      { label: "FY22", idt: 24, at: 14 },
      { label: "FY23", idt: 24, at: 14 },
      { label: "FY24", idt: 2, at: 0 }, // not a good year
    ];
    const s = summarize(years);
    assert.equal(s.goodYears, 2);
    assert.equal(s.yearsTracked, 3);
    assert.equal(s.remainingToRetirement, 18);
    assert.equal(s.retirementEligible, false);
  });

  it("summarize handles empty and undefined input", () => {
    for (const input of [undefined, null, []]) {
      const s = summarize(input);
      assert.equal(s.goodYears, 0);
      assert.equal(s.totalPoints, 0);
    }
  });

  it("anniversary window is anchored to the anniversary, not the fiscal year", () => {
    // Reference date AFTER the anniversary: window starts this year.
    const a = anniversaryWindow("10-01", new Date(2026, 10, 15)); // 15 Nov 2026
    assert.equal(a.start.getFullYear(), 2026);
    assert.equal(a.start.getMonth(), 9);

    // Reference date BEFORE the anniversary: window started last year.
    const b = anniversaryWindow("10-01", new Date(2026, 2, 15)); // 15 Mar 2026
    assert.equal(b.start.getFullYear(), 2025);

    // A window is one year minus a day.
    const days = Math.round((b.end - b.start) / 86400000);
    assert.ok(days >= 363 && days <= 366, `window spans ${days} days`);
  });

  it("rejects malformed anniversary input", () => {
    for (const bad of ["", "13-01", "10-45", "October", "10/01", null, undefined]) {
      assert.equal(anniversaryWindow(bad), null, `"${bad}" should be rejected`);
    }
  });
});

describe("rank data", () => {
  it("covers all six services", () => {
    assert.equal(SERVICES.length, 6);
    const ids = SERVICES.map((s) => s.id).sort();
    assert.deepEqual(ids, ["usa", "usaf", "uscg", "usmc", "usn", "ussf"]);
  });

  it("every rank row has a grade, title, and abbreviation", () => {
    for (const s of SERVICES) {
      for (const tier of ["enlisted", "warrant", "officer"]) {
        for (const r of s[tier] ?? []) {
          assert.ok(r.grade, `${s.id} ${tier}: row missing grade`);
          assert.ok(r.title, `${s.id} ${tier} ${r.grade}: missing title`);
          assert.ok(r.abbr, `${s.id} ${tier} ${r.grade}: missing abbr`);
        }
      }
    }
  });

  it("services with no warrant tier say so instead of showing an empty table", () => {
    for (const s of SERVICES) {
      if ((s.warrant ?? []).length === 0) {
        assert.ok(s.warrantNote, `${s.id} has no warrant ranks and no explanatory note`);
      }
    }
  });

  it("USCG warrant tier is W2-W4 only", () => {
    const uscg = SERVICES.find((s) => s.id === "uscg");
    assert.deepEqual(uscg.warrant.map((r) => r.grade), ["W-2", "W-3", "W-4"]);
  });

  it("USAF and USSF have no warrant tier", () => {
    for (const id of ["usaf", "ussf"]) {
      assert.equal(SERVICES.find((s) => s.id === id).warrant.length, 0, `${id} should have no warrants`);
    }
  });

  it("source-chart typos are corrected and footnoted", () => {
    assert.ok(CORRECTIONS.length >= 2, "expected at least the USN E-8 and USMC W-5 corrections");

    const usn = SERVICES.find((s) => s.id === "usn").enlisted.find((r) => r.grade === "E-8");
    assert.match(usn.title, /^Senior Chief Petty Officer/, "USN E-8 typo not corrected");
    assert.ok(usn.corrected, "USN E-8 correction is not footnoted");

    const usmc = SERVICES.find((s) => s.id === "usmc").warrant.find((r) => r.grade === "W-5");
    assert.equal(usmc.abbr, "CWO5", "USMC W-5 typo not corrected");
    assert.ok(usmc.corrected, "USMC W-5 correction is not footnoted");
  });
});

describe("rank insignia sprites", () => {
  /**
   * These tests exist because a wrong sprite index is invisible. The sheet has no
   * labels, so a rank rendered with its neighbour's insignia looks completely
   * normal — the only way to catch it is to assert that the index the UI computes
   * and the tile the extractor wrote are counted the same way.
   */
  it("indices are dense, unique, and cover every rank with insignia", () => {
    const seen = [];
    for (const s of SERVICES) {
      for (const tier of TIERS) {
        for (const r of s[tier] ?? []) {
          const i = insigniaIndex(s.id, r);
          if (!hasInsignia(r)) {
            assert.equal(i, null, `${s.id} ${r.grade} has no insignia but got index ${i}`);
            continue;
          }
          assert.equal(typeof i, "number", `${s.id} ${r.grade} has no sprite index`);
          seen.push(i);
        }
      }
    }
    // Dense 0..n-1 with no repeats: a repeat means two ranks share a tile, a gap
    // means the extractor emitted a tile nothing points at.
    assert.deepEqual(
      [...seen].sort((a, b) => a - b),
      Array.from({ length: seen.length }, (_, i) => i),
      "sprite indices are not a dense 0-based sequence",
    );
    assert.equal(seen.length, INSIGNIA_COUNT);
  });

  it("only E-1 has no insignia, in every service", () => {
    // The E-1 cell on every chart holds the words "No Insignia". If any other
    // grade ever returns null the sheet and the data have diverged.
    for (const s of SERVICES) {
      for (const tier of TIERS) {
        for (const r of s[tier] ?? []) {
          assert.equal(
            hasInsignia(r),
            r.grade !== "E-1",
            `${s.id} ${r.grade}: insignia presence disagrees with the E-1 rule`,
          );
        }
      }
    }
    assert.equal(SERVICES.filter((s) => s.enlisted.some((r) => r.grade === "E-1")).length, 6);
  });

  it("the plan's column counts describe the real charts", () => {
    // What the extractor asserts against the segmented grid. Stated here too so
    // the arithmetic (enlisted rows + 1 for E-1's cell... but the chart also has
    // the senior-enlisted advisor column) is pinned rather than trusted.
    const plan = insigniaPlan();
    assert.deepEqual(
      plan.map((s) => s.tiers.map((t) => t.columns)),
      [
        [10, 5, 10], // USN
        [10, 5, 10], // USMC
        [10, 5, 10], // USA
        [10, 10], //    USAF — no warrant block
        [10, 3, 10], // USCG — warrant is W-2..W-4
        [10, 10], //    USSF — no warrant block
      ],
    );
    // Enlisted: 10 chart columns yield 8 tiles — E-1 and the advisor are dropped.
    for (const s of plan) {
      const enlisted = s.tiers.find((t) => t.tier === "enlisted");
      assert.equal(enlisted.count, enlisted.columns - 2, `${s.id} enlisted tile count`);
    }
  });

  it("the sprite sheet is exactly the size the plan implies", () => {
    // IHDR read directly, so no image library. A sheet of the wrong size means a
    // stale asset, and every index past the shortfall points off the bottom.
    const png = readFileSync(join(ROOT, "public/img/ranks.png"));
    assert.equal(png.readUInt32BE(16), SPRITE_COLS * TILE, "sheet width changed");
    assert.equal(
      png.readUInt32BE(20),
      Math.ceil(INSIGNIA_COUNT / SPRITE_COLS) * TILE,
      `sheet does not hold ${INSIGNIA_COUNT} tiles. Re-run tools/extract-ranks.mjs.`,
    );
  });

  it("insigniaStyle offsets stay inside the sheet", () => {
    const sheetW = SPRITE_COLS * TILE;
    const rows = Math.ceil(INSIGNIA_COUNT / SPRITE_COLS);
    const size = 48;
    for (const s of SERVICES) {
      for (const tier of TIERS) {
        for (const r of s[tier] ?? []) {
          const style = insigniaStyle(s.id, r, size);
          if (!hasInsignia(r)) {
            assert.equal(style, null, `${s.id} ${r.grade} should render nothing`);
            continue;
          }
          const [x, y] = style.backgroundPosition.split(" ").map((v) => -parseFloat(v));
          assert.ok(x >= 0 && x < SPRITE_COLS * size, `${s.id} ${r.grade} x offset ${x}`);
          assert.ok(y >= 0 && y < rows * size, `${s.id} ${r.grade} y offset ${y}`);
          // The scale factor must be the sheet's, or the offsets land between tiles.
          assert.equal(style.backgroundSize, `${SPRITE_COLS * size}px auto`);
          assert.equal(style.width, `${size}px`);
        }
      }
    }
    assert.equal(sheetW, SPRITE_COLS * TILE);
  });
});

describe("world map geometry", () => {
  /**
   * Rebuild point rings from a committed `d` string. The generator writes
   * `M x y L x y ... Z` and nothing else, which is asserted below before anything
   * relies on the shape of it.
   */
  const parsePath = (d) =>
    d
      .split("M")
      .filter(Boolean)
      .map((sub) =>
        sub
          .replace(/Z$/, "")
          .split("L")
          .map((pt) => pt.split(" ").map(Number)),
      );

  /** The projection, retyped rather than imported — see the test that uses it. */
  const px = (lon) => ((lon + 180) / 360) * MAP_W;
  const py = (lat) => ((90 - lat) / 180) * MAP_H;

  const contains = (rings, x, y) => {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < xi + ((y - yi) / (yj - yi)) * (xj - xi)) inside = !inside;
      }
    }
    return inside;
  };

  const ALL = [["LAND_PATH", LAND_PATH], ...AOR_ORDER.map((n) => [n, AOR_PATHS[n]])];

  it("every path is well-formed and inside the viewBox", () => {
    // A `d` string is opaque: a sign error, a swapped axis, or a stray NaN all
    // render as a map, just the wrong one. Bounds are the cheapest proof the
    // projection ran at all, and NaN in path data makes the browser silently
    // abandon the rest of the subpath — no console error, no thrown exception.
    for (const [name, d] of ALL) {
      assert.ok(d, `${name} is empty`);
      assert.match(d, /^M[\d. L]+Z(M[\d. L]+Z)*$/, `${name} is not plain M/L/Z path data`);
      for (const ring of parsePath(d)) {
        assert.ok(ring.length >= 3, `${name} has a subpath with ${ring.length} points`);
        for (const [x, y] of ring) {
          assert.ok(Number.isFinite(x) && Number.isFinite(y), `${name} has a non-finite point`);
          assert.ok(x >= 0 && x <= MAP_W, `${name} x=${x} is outside 0..${MAP_W}`);
          assert.ok(y >= 0 && y <= MAP_H, `${name} y=${y} is outside 0..${MAP_H}`);
        }
      }
    }
  });

  it("each AOR encloses the places that command is responsible for", () => {
    // The real assertion. Bounds checks pass on a mirrored world; these don't.
    //
    // The projection is deliberately retyped above instead of imported from the
    // component. Importing it would make this test agree with whatever the
    // renderer currently does, including a sign flip — the point is to state
    // independently where Cairo has to land, so that a change to the projection
    // that isn't matched by a rebuild of the path data fails here.
    const PROBES = [
      ["Norfolk, VA", -76.3, 36.8, "USNORTHCOM"],
      ["Bogota", -74.1, 4.7, "USSOUTHCOM"],
      ["Berlin", 13.4, 52.5, "USEUCOM"],
      ["Lagos", 3.4, 6.5, "USAFRICOM"],
      ["Cairo", 31.2, 30.0, "USCENTCOM"],
      ["Manama, Bahrain", 50.6, 26.2, "USCENTCOM"],
      ["Tokyo", 139.7, 35.7, "USINDOPACOM"],
      // Honolulu is the one that catches an antimeridian bug: INDOPACOM's
      // polygon wraps the seam, and reading that wrap as a line drawn the long
      // way round puts its fill in the Atlantic while Hawaii falls out of it.
      ["Honolulu", -157.9, 21.3, "USINDOPACOM"],
      ["Sydney", 151.2, -33.9, "USINDOPACOM"],
    ];
    const rings = new Map(AOR_ORDER.map((n) => [n, parsePath(AOR_PATHS[n])]));
    for (const [place, lon, lat, want] of PROBES) {
      const hits = AOR_ORDER.filter((n) => contains(rings.get(n), px(lon), py(lat)));
      assert.deepEqual(
        hits,
        [want],
        `${place} should be in exactly ${want}, the committed paths put it in ` +
          `${hits.join(" + ") || "no AOR at all"}`,
      );
    }
  });

  it("only the geographic commands have a polygon", () => {
    // CYBERCOM and SOCOM ship as whole-world boxes, because a functional AOR is
    // "everywhere". Drawing that box would put a true-looking rectangle around a
    // command with no geography, so those files are excluded by name and this
    // pins the exclusion.
    assert.deepEqual(AOR_ORDER, [
      "USNORTHCOM",
      "USSOUTHCOM",
      "USEUCOM",
      "USAFRICOM",
      "USCENTCOM",
      "USINDOPACOM",
    ]);
    assert.deepEqual(Object.keys(AOR_PATHS).sort(), [...AOR_ORDER].sort());
    for (const { command } of GEOGRAPHIC.filter((g) => g.command === "USSPACECOM")) {
      assert.equal(AOR_PATHS[command], undefined, "USSPACECOM's AOR starts 100 km up");
    }
  });

  it("the committed path data is what the source GeoJSON produces", () => {
    // Byte-identity against a rebuild, the same contract the two sprite sheets
    // have. Skipped rather than failed when the source tree is absent: this
    // repo is shippable without it, and a checkout on another machine should not
    // report a broken build because a sibling directory isn't there.
    const src = "/home/sogginnt/workspace/general/guides/military/cocoms/geodata";
    if (!existsSync(src)) return;
    const res = spawnSync(process.execPath, [join(ROOT, "tools/build-maps.mjs"), "--check"], {
      encoding: "utf8",
    });
    assert.equal(
      res.status,
      0,
      `src/data/geo.js does not match the source GeoJSON:\n${res.stdout}${res.stderr}`,
    );
  });

  it("both map sections declare what the renderer needs", () => {
    // `kind: "map"` reads section.map, and a missing field there renders an
    // empty figure with no error — the same silent-blank failure mode as a bad
    // system id. An unlabelled role="img" is invisible to a screen reader, so
    // the label is required, not optional.
    const maps = ALL_TOPICS.flatMap((t) =>
      (t.sections ?? []).filter((s) => s.kind === "map").map((s) => [`${t.id}#${s.id}`, s]),
    );
    assert.equal(maps.length, 2, "expected the COCOM and fleets pages to draw a map");
    for (const [id, section] of maps) {
      assert.ok(section.map, `${id} is kind "map" with no map config`);
      assert.ok(section.map.label?.length > 40, `${id} needs a real aria-label, not a stub`);
      assert.ok(section.map.caption, `${id} has no caption saying where the geometry came from`);
      const regions = section.map.regions;
      assert.ok(
        regions === "all" || Array.isArray(regions),
        `${id} regions must be "all" or an array, got ${JSON.stringify(regions)}`,
      );
      if (Array.isArray(regions)) {
        for (const r of regions) {
          assert.ok(AOR_PATHS[r], `${id} asks for region "${r}", which has no path data`);
        }
      }
      for (const marker of [...(section.map.pins ?? []), ...(section.map.zones ?? [])]) {
        assert.ok(marker.label, `${id} has an unlabelled marker`);
        assert.ok(
          marker.lon >= -180 && marker.lon <= 180 && marker.lat >= -90 && marker.lat <= 90,
          `${id} marker "${marker.label}" is not at a real coordinate`,
        );
      }
    }
  });

  it("map sections are searchable by place, and not by path data", () => {
    // The corpus must index the labels — "which fleet covers Bahrain" is a real
    // query — but NOT the geometry. 46 KB of coordinate digits in one record
    // would distort every idf in the corpus, and the record is 300 characters of
    // prose either way, so a size check states the rule exactly.
    const maps = corpus.records.filter((r) => r.section.kind === "map");
    assert.equal(maps.length, 2);
    for (const rec of maps) {
      assert.ok(rec.text.length < 4000, `${rec.id} text is ${rec.text.length} chars — geometry leaked in`);
      assert.ok(!/\d+\.\d \d+\.\d/.test(rec.text), `${rec.id} contains projected coordinates`);
    }
    const fleets = maps.find((r) => r.id === "navy-fleets#map");
    assert.match(fleets.text, /Bahrain/, "fleet HQ names are not searchable");
    assert.match(fleets.text, /Yokosuka/);
    const cocom = maps.find((r) => r.id === "combatant-commands#map");
    assert.match(cocom.text, /Stuttgart/, "COCOM HQ names are not searchable");

    // The aria-label is excluded on purpose (see the `map` case in corpus.js): it
    // describes every region in prose for a screen reader, so indexing it makes
    // the map section compete with the AOR table on the table's own terms. That
    // exclusion is a one-line decision nothing else would notice being undone —
    // the golden question it originally broke passes either way now, because the
    // real fix was moving the command names onto the sections that earn them. So
    // assert the rule itself rather than a symptom of breaking it.
    for (const rec of maps) {
      const label = rec.section.map.label;
      const phrase = label.slice(0, 40);
      assert.ok(
        !rec.text.includes(phrase),
        `${rec.id} indexes its aria-label ("${phrase}…"). An accessible ` +
          `description should not double as search bait.`,
      );
    }
  });
});

describe("awards and ribbon racks", () => {
  it("sprite indices are dense and match array position", () => {
    // The sprite sheet is a single column of tiles cut in precedence order, so
    // award N must point at tile N. A gap or a repeat here renders the wrong
    // ribbon under the right name on every rack, and nothing else would catch it.
    AWARDS.forEach((award, i) => {
      assert.equal(award.sprite, i, `${award.id} has sprite ${award.sprite}, expected ${i}`);
    });
  });

  it("the sprite sheet has exactly one tile per award", () => {
    // 176x56 tiles stacked vertically; the file is a PNG whose IHDR height is
    // read directly so the test needs no image library.
    const png = readFileSync(join(ROOT, "public/img/ribbons.png"));
    assert.equal(png.readUInt32BE(16), 176, "sprite width changed");
    const height = png.readUInt32BE(20);
    assert.equal(
      height,
      AWARDS.length * 56,
      `sprite is ${height}px = ${height / 56} tiles, but there are ${AWARDS.length} awards. ` +
        "Re-run tools/extract-ribbons.mjs.",
    );
  });

  it("award ids are unique and every group is populated", () => {
    assert.equal(new Set(AWARDS.map((a) => a.id)).size, AWARDS.length);
    for (const g of GROUPS) {
      assert.ok(
        AWARDS.some((a) => a.group === g.id),
        `group ${g.id} has no awards`,
      );
    }
    for (const a of AWARDS) {
      assert.ok(
        GROUPS.some((g) => g.id === a.group),
        `${a.id} is in unknown group ${a.group}`,
      );
    }
  });

  it("the marksmanship medals are present", () => {
    // These are drawn in the chart's device legend, not the ribbon grid, and an
    // earlier extractor silently dropped them for a plausible-looking 66.
    assert.equal(AWARDS.length, 68);
    assert.deepEqual(
      AWARDS.slice(-2).map((a) => a.id),
      ["rifle-marksmanship", "pistol-marksmanship"],
    );
  });

  it("every MULTIPLE_DEVICE entry names a real award and a real device", () => {
    for (const [awardId, deviceId] of Object.entries(MULTIPLE_DEVICE)) {
      assert.ok(AWARD_BY_ID.has(awardId), `MULTIPLE_DEVICE has unknown award ${awardId}`);
      assert.ok(DEVICE_BY_ID.has(deviceId), `${awardId} names unknown device ${deviceId}`);
    }
  });

  it("racks are built bottom-up so the short row is on top", () => {
    // 7 ribbons is 1/3/3 with the SENIOR award alone on top — not 3/3/1. Laying
    // out top-down puts the junior awards in the short row, which is the one
    // mistake that makes an otherwise-correct rack wrong every time.
    const ids = AWARDS.slice(0, 7).map((a) => a.id);
    const { rows } = layoutRack(ids);
    assert.deepEqual(rows.map((r) => r.length), [1, 3, 3]);
    assert.equal(rows[0][0].id, "moh", "the most senior award must be top-left");
    assert.equal(rows.at(-1).at(-1).id, ids[6], "the junior award must be bottom-right");
  });

  it("exact multiples of three have no short row", () => {
    for (const n of [3, 6, 9, 12]) {
      const { rows } = layoutRack(AWARDS.slice(0, n).map((a) => a.id));
      assert.deepEqual(rows.map((r) => r.length), Array(n / 3).fill(3), `${n} ribbons`);
    }
  });

  it("selection order does not affect the rack", () => {
    const forward = layoutRack(["moh", "ndsm", "klm-kuwait"]).items.map((i) => i.id);
    const reverse = layoutRack(["klm-kuwait", "ndsm", "moh"]).items.map((i) => i.id);
    assert.deepEqual(forward, ["moh", "ndsm", "klm-kuwait"]);
    assert.deepEqual(reverse, forward);
  });

  it("duplicate selections collapse and unknown ids are reported, not mounted", () => {
    const { items, dropped } = layoutRack(["moh", "moh", "not-an-award"]);
    assert.deepEqual(items.map((i) => i.id), ["moh"]);
    assert.deepEqual(dropped, ["not-an-award"]);
  });

  it("a silver device replaces five lesser ones", () => {
    // 6 awards is 5 devices, and 5 bronze become 1 silver — not 5 bronze plus a
    // silver, and not 6 devices.
    assert.deepEqual(pick(devicesFor("nmcam", 1)), { silver: 0, lesser: 0 });
    assert.deepEqual(pick(devicesFor("nmcam", 2)), { silver: 0, lesser: 1 });
    assert.deepEqual(pick(devicesFor("nmcam", 5)), { silver: 0, lesser: 4 });
    assert.deepEqual(pick(devicesFor("nmcam", 6)), { silver: 1, lesser: 0 });
    assert.deepEqual(pick(devicesFor("nmcam", 7)), { silver: 1, lesser: 1 });
    assert.deepEqual(pick(devicesFor("nmcam", 11)), { silver: 2, lesser: 0 });
  });

  it("awards with no multiple-award device never get one", () => {
    // The Medal of Honor is the clearest case: a second award is not a star.
    for (const n of [1, 2, 9]) {
      const d = devicesFor("moh", n);
      assert.equal(d.deviceId, null);
      assert.equal(d.total, 0);
    }
  });

  it("the Navy E starts with a device and the fourth award replaces the stack", () => {
    // Unlike stars, one Battle "E" is authorized for the FIRST award, and the
    // fourth is a single silver-wreathed "E" rather than a five-for-one swap.
    assert.deepEqual(pick(devicesFor("navy-e", 1)), { silver: 0, lesser: 1 });
    assert.deepEqual(pick(devicesFor("navy-e", 3)), { silver: 0, lesser: 3 });
    assert.deepEqual(pick(devicesFor("navy-e", 4)), { silver: 1, lesser: 0 });
    assert.deepEqual(pick(devicesFor("navy-e", 9)), { silver: 1, lesser: 0 });
  });

  it("the AFRM uses hourglasses, one per succeeding award", () => {
    assert.equal(devicesFor("afrm", 1).total, 0);
    assert.equal(devicesFor("afrm", 3).deviceId, "hourglass");
    assert.equal(devicesFor("afrm", 3).total, 2);
  });

  it("device prose does not invent colours or misspell plurals", () => {
    const say = (id, n) => {
      const devices = devicesFor(id, n);
      const device = devices.deviceId ? DEVICE_BY_ID.get(devices.deviceId) : null;
      return deviceSummary({ devices, device });
    };
    assert.equal(say("nmcam", 3), "2 gold stars");
    assert.equal(say("ndsm", 2), "1 bronze service star");
    assert.equal(say("nmcam", 7), "1 silver star + 1 gold star");
    // The hourglass has no bronze/silver variant, so it must not be coloured,
    // and naive pluralization would say "hourglasss".
    assert.equal(say("afrm", 4), "3 hourglasses");
    assert.equal(say("moh", 2), null);
  });

  it("source-chart typos are corrected and footnoted", () => {
    const rok = AWARD_BY_ID.get("rok-puc");
    assert.match(rok.title, /Presidential/, "ROK PUC typo not corrected");
    assert.ok(rok.corrected, "ROK PUC correction is not footnoted");
    assert.ok(
      AWARD_CORRECTIONS.some((c) => /Warn in lieu/.test(c.note)),
      "the Silver/Gold Star legend typo is not footnoted",
    );
  });
});

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
import { parsePointRecord } from "../src/lib/importPoints.js";
import { BANG_ENTRIES, bangTable, normalizeKey, queryFromLocation, resolveBang } from "../src/lib/bangs.js";
import { extractResolver, renderGoPage } from "./go-page.mjs";
import {
  BASE_PATH,
  ORIGIN,
  RENDERABLE_KINDS,
  canonicalFor,
  hashRouteFor,
  pagePathFor,
  prefixFor,
  renderAll,
  renderSection,
} from "./prerender.mjs";
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
import { SYSTEMS, SYSTEM_BY_ID, systemUrl, systemsFor, viaLabel } from "../src/data/systems.js";
import { deviceSummary, devicesFor, layoutRack } from "../src/lib/ribbons.js";
import {
  DIRECTIVES,
  DIRECTIVE_BY_ID,
  LIBRARIES,
  directiveText,
  directiveUrl,
  directivesFor,
  display,
  libraryName,
} from "../src/data/directives.js";
import doctrine, {
  CORE_VALUES,
  GENERAL_ORDERS,
  SAILORS_CREED,
  WATCHES,
} from "../src/data/doctrine.js";
import {
  ICS_FILENAME,
  addMonths,
  buildIcs,
  buildSchedule,
  daysBetween,
  dueFor,
  nextMonthDay,
  parseISO,
  summarizeSchedule,
  toISO,
} from "../src/lib/due.js";

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

  // --- doctrine, customs and courtesies -----------------------------------
  // One row per section, for the same reason the directive groups get one each:
  // this page is eight independent chunks of memorized material, and a section
  // that stops being reachable is invisible until somebody asks about that one.
  //
  // Three of these are pinned because they measure a specific decision:
  //
  //   "when do I not salute" — was answering with the SAILOR'S CREED. Every word
  //   in it except "salute" is a stopword, and `salute` was listed in the TOPIC
  //   keywords, which corpus.js folds into every section — so all eight sections
  //   tied at 0.875 and array order picked the winner. Fixed by cutting the topic
  //   keywords back to words that name the whole page. Put "salute" back up there
  //   and this row fails while every other doctrine row still passes, which is
  //   exactly the localization you want from it.
  //
  //   "what is a ladder on a ship" — returned `unknown` at 0.250 on body weight
  //   alone. Fixed by listing the terms the section defines as its keywords, so
  //   this row is what proves that list is doing work.
  //
  //   "how do I report aboard a ship" — returned `unknown` at 0.272, one covered
  //   word short. The tokenizer strips plurals but does not stem, so the section's
  //   "reporting aboard" never matched a typed "report".
  ["what is the Sailor's Creed", "doctrine#creed"],
  ["recite the sailors creed", "doctrine#creed"],
  ["what are the navy core values", "doctrine#core-values"],
  ["honor courage commitment", ["doctrine#core-values", "doctrine#creed"]],
  ["what are the 11 general orders", "doctrine#general-orders"],
  ["what are the general orders of the sentry", "doctrine#general-orders"],
  ["do I salute indoors", "doctrine#saluting"],
  ["when do I not salute", "doctrine#saluting"],
  ["how do I report aboard a ship", "doctrine#saluting"],
  ["when is morning colors", "doctrine#colors"],
  ["what does half mast mean", "doctrine#colors"],
  ["what time is the mid watch", "doctrine#watches"],
  ["why are there dog watches", ["doctrine#watches", "doctrine#bells"]],
  ["what is eight bells", "doctrine#bells"],
  ["what is a scuttlebutt", "doctrine#terminology"],
  ["what does geedunk mean", "doctrine#terminology"],
  ["what is a ladder on a ship", "doctrine#terminology"],

  // --- instructions and directives ----------------------------------------
  // Two question shapes, because they exercise different halves of the
  // retriever. A series number ("BUPERSINST 1610.10") tests the TOKENIZER —
  // it only works because `tokenize()` splits `1610.10` into `1610` and `10`.
  // A natural-language ask ("which instruction covers evals") tests the PHRASE
  // ALIASES, since "which", "what" and "covers" are all stopwords and the
  // question would otherwise reduce to the bare topic word and land on the
  // subject-matter card instead of the authority.
  //
  // Coverage is one row per directive group, deliberately: a group whose
  // keywords go stale is invisible until someone asks about that group, and
  // "medical" answering while "travel" silently stopped is exactly the kind of
  // partial rot a single spot-check misses.
  ["BUPERSINST 1610.10", "directives#performance"],
  ["BUPERSINST 1001.39", "directives#reserve"],
  ["RESPERSMAN 1571-010", "directives#reserve"],
  ["reserve personnel manual", "directives#reserve"],
  ["DoDI 1215.13", "directives#reserve"],
  ["what is EVALMAN", ["directives#performance", "eval-fitrep#rules", "eval-fitrep#schedule"]],
  ["which instruction covers evals", "directives#performance"],
  ["which instruction covers advancement", "directives#advancement"],
  ["which instruction covers career development boards", ["directives#advancement", "reservist-checklist#howto-cway"]],
  ["SECNAV M-1650.1", ["directives#awards", "awards#devices"]],
  ["what instruction covers the PFA", ["directives#fitness", "reservist-checklist#howto-pfa"]],
  ["opnavinst 6110.1", "directives#fitness"],
  ["what instruction covers medical readiness", ["directives#medical", "reservist-checklist#howto-pha-imr"]],
  ["what is the SORM", "directives#records"],
  ["milpersman", "directives#records"],
  ["joint travel regulations", "directives#travel"],
  ["governing instruction for security clearance", ["directives#security", "reservist-checklist#howto-diss"]],
  ["navy cybersecurity program instruction", "directives#security"],
  ["which instruction covers annual training", ["directives#reserve", "reservist-checklist#howto-at-adt"]],
  ["cite the instruction for AT waiver", ["directives#reserve", "reservist-checklist#howto-at-adt"]],
  // Says "reg", not "instruction" — the one phrasing in this group that depends
  // on the phrase alias rather than on the `instruction` token alias, and the
  // only measured case where deleting that rule changes an answer. Pinned for
  // exactly that reason: it is what makes the rule's presence observable.
  ["which reg covers evals", "directives#performance"],
  ["which instruction covers customs and courtesies", "directives#customs"],
  ["US Navy Regulations", "directives#customs"],
  ["uniform regulations", ["directives#awards", "awards#wear"]],
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

  it("every section kind a topic uses has a renderer and a flattener", () => {
    /**
     * Two half-silent failure modes, one test.
     *
     * TopicSection.vue ends in a warning alert for an unknown kind, so a missing
     * branch does surface — but only to whoever happens to load that page, and it
     * looks like a data error rather than a missing component. corpus.js is worse:
     * its `default` arm JSON.stringifies the rows, so an unflattened kind is still
     * searchable, just with quotes and commas in the index and no per-kind
     * structure. Nothing anywhere fails. This is how the `verbatim` kind was
     * checked in — both files, not just the template.
     *
     * Read out of the source text rather than by rendering, because mounting
     * Vuetify components in Node is the dependency this suite exists without.
     */
    const view = readFileSync(join(ROOT, "src/components/common/TopicSection.vue"), "utf8");
    const flat = readFileSync(join(ROOT, "src/lib/corpus.js"), "utf8");

    // Single quotes in the template, because the comparison sits inside a
    // double-quoted `v-else-if` attribute. Both forms are accepted so a later
    // edit that normalizes the quoting does not silently empty this set — which
    // is what the `kv` sanity assertion below caught on the first run.
    const rendered = new Set(
      [...view.matchAll(/section\.kind === ['"]([a-z-]+)['"]/g)].map((m) => m[1]),
    );
    const flattened = new Set([...flat.matchAll(/case "([a-z-]+)":/g)].map((m) => m[1]));

    // Sanity on the extraction itself: a regex that silently matches nothing
    // would make this test pass for every kind. `kv` is in both files and has
    // been since the first knowledge topic shipped.
    assert.ok(rendered.has("kv"), "the renderer scan found nothing — the pattern has rotted");
    assert.ok(flattened.has("kv"), "the flattener scan found nothing — the pattern has rotted");

    for (const topic of ALL_TOPICS) {
      for (const s of topic.sections) {
        assert.ok(
          rendered.has(s.kind),
          `section "${topic.id}#${s.id}" has kind "${s.kind}" with no branch in TopicSection.vue`,
        );
        assert.ok(
          flattened.has(s.kind),
          `section "${topic.id}#${s.id}" has kind "${s.kind}" with no case in corpus.js flatten() — ` +
            `it would fall through to JSON.stringify and index punctuation`,
        );
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

  it("the favicon draws the real mdiAnchor path", async () => {
    /**
     * The path in favicon.svg is a COPY of @mdi/js's `mdiAnchor`, so it can rot
     * in both directions: a hand-edit here, or an upstream redraw on the next
     * @mdi/js bump. Neither shows up as a broken icon — an SVG with a subtly
     * wrong path still renders something anchor-shaped at 16px.
     *
     * This is not a hypothetical. The first version of the file was typed out by
     * hand and dropped "11 5A1 1 0 0 1" from the closing arc of the ring, which
     * would have filled the hole in the shackle. It was caught by re-deriving the
     * path from the module rather than by looking at it, and this test is that
     * derivation kept in place.
     */
    const { mdiAnchor } = await import("@mdi/js");
    const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
    assert.ok(
      svg.includes(mdiAnchor),
      "public/favicon.svg does not contain the current mdiAnchor path — regenerate it from @mdi/js rather than editing it by hand",
    );
    // The tile must stay opaque: a transparent icon disappears into whichever
    // browser chrome happens to match the glyph colour.
    assert.match(svg, /<rect[^>]*fill="#0A2E5C"/, "favicon lost its opaque navy tile");
  });

  it("no British spellings in user-visible data", () => {
    /**
     * A US Navy reference that says "Organisation" reads as though it were
     * transcribed from somewhere else, which is exactly the doubt this site
     * cannot afford — and it is invisible to every other check here. Four had
     * shipped before this test existed: "Organisation & personnel records" as a
     * section heading, "watch organisation" and "authorisation" in directive
     * prose, and "centred" in the ribbon-wear rules.
     *
     * WORSE THAN COSMETIC IN ONE CASE: the IMR entry's prose said
     * "immunisations" while its own `keywords` said "immunization", so the word
     * on screen was not the word the retriever indexed.
     *
     * Only unambiguous forms are listed. `analysis` is not British and was in an
     * early draft of this list, where it flagged three correct J-8 bullets. If a
     * legitimate proper noun ever needs one of these spellings — a NATO "Centre"
     * — the fix is an exception here, not deleting the list.
     */
    const BRITISH = [
      "organis", "authoris", "immunis", "recognis", "prioritis", "standardis",
      "utilis", "minimis", "maximis", "analyse", "analysing",
      "defence", "offence", "licence", "centre", "centred", "programme",
      "enrolment", "fulfil", "practise", "catalogue", "judgement",
      "behaviour", "colour", "honour", "favour", "labour", "neighbour",
      "armour", "valour",
      // Doubled-L forms. Added after the first version of this list shipped and
      // "Career Waypoints counselling" slipped past it in a directive's `governs`
      // text, two lines from the word "Counselor" spelled the US way. Only
      // unambiguous ones: "cancelled" and "totalled" are both accepted in US
      // usage and are deliberately absent.
      "counselling", "travelling", "modelling", "labelled", "signalling",
      "marvellous", "skilful", "wilful", "instalment",
    ];
    for (const topic of ALL_TOPICS) {
      for (const [path, str] of strings(topic, topic.id)) {
        const lower = str.toLowerCase();
        for (const brit of BRITISH) {
          const at = lower.indexOf(brit);
          assert.equal(
            at,
            -1,
            `British spelling "${brit}" at ${path}: ${JSON.stringify(str.slice(Math.max(0, at - 30), at + 40))}`,
          );
        }
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
 * 2c. The directive registry and the citations that point into it
 * ------------------------------------------------------------------ */

/**
 * Every `refs` array in the data tree, paired with where it came from.
 *
 * This exists for the same reason SYSTEM_REFS does, and the failure is worse.
 * `directivesFor()` filters out ids it doesn't recognize, so a typo'd citation
 * doesn't throw and doesn't warn — the chip simply isn't rendered. The page looks
 * finished, the claim it was supposed to support is now unsourced, and nothing
 * anywhere says so. A citation that silently disappears is the one defect this
 * whole feature cannot tolerate, since the entire point of it is attribution.
 */
const DIRECTIVE_REFS = [
  ...CHECKLIST_GROUPS.flatMap((g) =>
    g.items.flatMap((i) => (i.refs ?? []).map((id) => [id, `checklist item ${i.id}`])),
  ),
  ...HOWTO.flatMap((h) => (h.refs ?? []).map((id) => [id, `procedure ${h.id}`])),
  ...ALL_TOPICS.flatMap((t) => (t.refs ?? []).map((id) => [id, `topic ${t.id}`])),
  ...ALL_TOPICS.flatMap((t) =>
    t.sections.flatMap((s) => (s.refs ?? []).map((id) => [id, `section ${t.id}#${s.id}`])),
  ),
];

describe("directive registry", () => {
  it("every cited directive id exists", () => {
    assert.ok(
      DIRECTIVE_REFS.length >= 40,
      `only ${DIRECTIVE_REFS.length} citations found — did the \`refs\` field get renamed?`,
    );
    for (const [id, where] of DIRECTIVE_REFS) {
      assert.ok(DIRECTIVE_BY_ID.has(id), `${where} cites unknown directive "${id}"`);
    }
  });

  it("directive ids are unique and stable-looking", () => {
    const seen = new Set();
    for (const d of DIRECTIVES) {
      assert.ok(!seen.has(d.id), `duplicate directive id "${d.id}" — DIRECTIVE_BY_ID keeps only the last`);
      seen.add(d.id);
      assert.match(d.id, /^[a-z0-9-]+$/, `directive id "${d.id}" should be a lowercase slug`);
      assert.equal(DIRECTIVE_BY_ID.get(d.id), d, `registry lookup broken for "${d.id}"`);
      assert.ok(d.label, `directive "${d.id}" has no label`);
      assert.ok(d.title, `directive "${d.id}" has no title`);
      assert.ok(d.governs, `directive "${d.id}" does not say what it governs`);
      assert.ok(d.keywords?.length, `directive "${d.id}" has no keywords — it would be unfindable`);
    }
  });

  it("the revision letter is never baked into the label", () => {
    /**
     * The load-bearing convention of this module. BUPERSINST 1610.10 has been
     * revised to G, then H, and will be revised again; the series number is what
     * a citation means and the letter is a fact about today's edition. Storing
     * "BUPERSINST 1610.10H" in `label` makes every consumer wrong at once when
     * the next revision drops, and — worse — makes the search index wrong in a
     * way nobody notices, because "1610.10" still matches.
     *
     * So: no `label` may end in a revision letter, and `display()` is the only
     * thing allowed to recombine them.
     */
    for (const d of DIRECTIVES) {
      assert.doesNotMatch(
        d.label,
        /\d[A-Z]$/,
        `directive "${d.id}" has a revision letter in its label ("${d.label}") — put it in \`rev\``,
      );
      if (d.rev) {
        assert.match(d.rev, /^[A-Z]$/, `directive "${d.id}" has a non-letter rev "${d.rev}"`);
        assert.equal(display(d), `${d.label}${d.rev}`, `display() dropped the rev for "${d.id}"`);
      } else {
        assert.equal(display(d), d.label, `display() altered a rev-less label for "${d.id}"`);
      }
    }
  });

  it("every directive resolves to a real library and a real address", () => {
    /**
     * The indirection under test: a directive names a LIBRARY, the library names
     * a SYSTEM, and systems.js owns the only copy of the address. Two links in
     * that chain can rot independently, and a break in either renders the chip as
     * plain text with no href — visually almost identical to a working one.
     */
    for (const d of DIRECTIVES) {
      const lib = LIBRARIES[d.library];
      assert.ok(lib, `directive "${d.id}" names unknown library "${d.library}"`);
      assert.ok(SYSTEM_BY_ID.has(lib.system), `library "${d.library}" names unknown system "${lib.system}"`);
      assert.equal(directiveUrl(d), systemUrl(lib.system), `directiveUrl() disagrees with the registry for "${d.id}"`);
      assert.ok(directiveUrl(d), `directive "${d.id}" has no resolvable URL`);
      assert.equal(libraryName(d), lib.name);
    }
    for (const [key, lib] of Object.entries(LIBRARIES)) {
      assert.ok(lib.name, `library "${key}" has no name`);
      assert.ok(lib.hint, `library "${key}" has no hint — the user is left to guess how to search it`);
      assert.ok(
        DIRECTIVES.some((d) => d.library === key),
        `library "${key}" is unused — dead data that still has to be maintained`,
      );
    }
  });

  it("holds no document URL of its own", () => {
    /**
     * The same rule quicklinks.js and bangs.js live under, and the reason this
     * module stores a library instead of a link. A deep path to a PDF on a `.mil`
     * host is the single most rot-prone string in this domain, and the WAF on
     * www.mynavyhr.navy.mil blocks every non-browser client — so a broken deep
     * path there could never be caught by any check, including this suite. The
     * only defence is not to have one.
     */
    const src = readFileSync(join(ROOT, "src/data/directives.js"), "utf8");
    assert.doesNotMatch(src, /https?:\/\//, "directives.js has a literal URL — addresses belong in systems.js");
  });

  it("every parent reference resolves, and no directive parents itself", () => {
    for (const d of DIRECTIVES) {
      if (!d.parent) continue;
      assert.ok(DIRECTIVE_BY_ID.has(d.parent), `directive "${d.id}" names unknown parent "${d.parent}"`);
      assert.notEqual(d.parent, d.id, `directive "${d.id}" is its own parent`);
      const parent = DIRECTIVE_BY_ID.get(d.parent);
      assert.ok(!parent.parent, `"${d.id}" -> "${d.parent}" is a two-level chain; the UI only renders one`);
    }
  });

  it("every directive appears in exactly one topic section", () => {
    /**
     * The topic's sections are derived by filtering DIRECTIVES on `group`, so a
     * directive whose group doesn't match any group id vanishes from the site
     * while remaining perfectly citable — the chip works, the page it links to
     * doesn't list the document.
     */
    const topic = TOPIC_BY_ID.get("directives");
    assert.ok(topic, "the directives topic is not registered");
    const counts = new Map(DIRECTIVES.map((d) => [d.id, 0]));
    for (const s of topic.sections) {
      assert.equal(s.kind, "directives", `section "${s.id}" of the directives topic has kind "${s.kind}"`);
      assert.ok(s.rows.length, `directive group "${s.id}" is empty`);
      for (const d of s.rows) counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
    }
    const orphans = [...counts].filter(([, n]) => n !== 1);
    assert.deepEqual(
      orphans.map(([id, n]) => `${id} (${n}x)`),
      [],
      "directives not listed exactly once on the topic page — check their `group`",
    );
  });

  it("a directive's own entry outranks the sections that cite it", () => {
    /**
     * The ranking decision this feature turns on, asserted rather than assumed.
     *
     * Citations are folded into each record's BODY text at weight 1.0. Folding
     * them into `keywords` (2.5) is the obvious move and it inverts the result:
     * BUPERSINST 1001.39 is cited from eight places, so those eight sections
     * would collectively outweigh the one record that actually describes it, and
     * searching a series number would return everything except the document.
     *
     * Checked over every directive that is cited at least once, because the
     * effect scales with citation count — the two or three most-cited documents
     * are the ones that break first, and they are also the most likely searches.
     */
    const cited = new Set(DIRECTIVE_REFS.map(([id]) => id));
    const topic = TOPIC_BY_ID.get("directives");
    const home = new Map();
    for (const s of topic.sections) for (const d of s.rows) home.set(d.id, `directives#${s.id}`);

    for (const d of DIRECTIVES) {
      if (!cited.has(d.id)) continue;
      const hits = search(display(d), corpus, 1);
      assert.equal(
        hits[0]?.rec.id,
        home.get(d.id),
        `searching "${display(d)}" returned ${hits[0]?.rec.id} instead of the document's own entry ` +
          `— citations are outweighing the thing they cite`,
      );
    }
  });

  it("a citation makes the citing section findable by the instruction number", () => {
    /**
     * The other half of the same trade-off. The check above guarantees citations
     * don't dominate; this one guarantees they aren't inert. If `citedText()`
     * were dropped from the body entirely both would look fine in the UI and the
     * "what covers this" questions would keep working off the directives topic
     * alone — while "1610.10" stopped reaching the EVAL cards it authorizes.
     */
    const ids = search("BUPERSINST 1610.10H", corpus, 6).map((h) => h.rec.id);
    assert.ok(
      ids.some((id) => id.startsWith("eval-fitrep#")),
      `no EVAL section surfaced for BUPERSINST 1610.10H; got ${ids.join(", ")}`,
    );
    const awards = search("SECNAV M-1650.1", corpus, 6).map((h) => h.rec.id);
    assert.ok(
      awards.some((id) => id.startsWith("awards#")),
      `no awards section surfaced for SECNAV M-1650.1; got ${awards.join(", ")}`,
    );
  });

  it("directiveText covers every field a search would land on", () => {
    for (const d of DIRECTIVES) {
      const text = directiveText(d);
      assert.ok(text.includes(d.label), `directiveText dropped the label of "${d.id}"`);
      assert.ok(text.includes(d.title), `directiveText dropped the title of "${d.id}"`);
      for (const k of d.keywords) {
        assert.ok(text.includes(k), `directiveText dropped keyword "${k}" of "${d.id}"`);
      }
    }
  });

  it("directivesFor is order-preserving and drops unknowns without throwing", () => {
    // The runtime behaviour the build-time check above compensates for. Pinned
    // so a future "throw on unknown id" refactor can't turn a typo into a blank
    // page mid-render.
    const got = directivesFor(["milpersman", "not-a-real-directive", "jtr"]);
    assert.deepEqual(got.map((d) => d.id), ["milpersman", "jtr"]);
    assert.deepEqual(directivesFor(undefined), []);
    assert.deepEqual(directivesFor([]), []);
    assert.equal(directiveUrl(undefined), null);
    assert.equal(display(null), "");
  });

  it("the authorities a reservist meets most are all present", () => {
    /**
     * A spot-check on content rather than shape. The registry could satisfy every
     * structural rule above while having quietly lost the four documents that
     * actually govern a SELRES's year, and no other test here would notice.
     */
    for (const id of ["bupersinst-1001-39", "respersman", "bupersinst-1610-10", "dodi-1215-13"]) {
      assert.ok(DIRECTIVE_BY_ID.has(id), `the registry has lost "${id}"`);
    }
    assert.ok(DIRECTIVES.length >= 15, `only ${DIRECTIVES.length} directives registered`);
  });
});

describe("doctrine, customs and courtesies", () => {
  /**
   * THE HONEST LIMIT ON THIS WHOLE BLOCK, up front: none of it can verify that the
   * Sailor's Creed or the General Orders are quoted CORRECTLY. There is no local
   * copy of either to diff against — they were written from memory, which is
   * exactly why the topic's `note` says the page is orientation and points at the
   * authorities. A test that compared the data to itself and reported "verbatim
   * text verified" would be worse than no test, because it would retire the doubt
   * without earning it.
   *
   * What these DO catch is the internal contradiction: a heading that promises a
   * count the rows don't deliver, a creed that names values the values section
   * doesn't list, a watch table with a hole in it. Those are the defects that
   * would be introduced by a later edit to one place and not the other, and they
   * are the ones that make a reference look unreliable even when every individual
   * sentence is right.
   */
  const sectionOf = (id) => doctrine.sections.find((s) => s.id === id);

  it("the eleven General Orders are eleven, and the heading says so", () => {
    // Both directions, because the heading and the array are edited separately:
    // the number word in the heading has to match the row count, and the count
    // has to be 11. Dropping an order while fixing the heading to "ten" would
    // satisfy the first check alone.
    assert.equal(GENERAL_ORDERS.length, 11, "there are eleven General Orders of the Sentry");
    const heading = sectionOf("general-orders").heading;
    assert.match(heading, /\beleven\b/i, `heading "${heading}" no longer states the count`);

    for (const [i, order] of GENERAL_ORDERS.entries()) {
      // Each is a duty, phrased as an infinitive, and ends in a period. The
      // `steps` renderer numbers them, so an order that arrived as a fragment
      // would still display as "7." with something ungrammatical after it.
      assert.match(order, /^To /, `general order ${i + 1} does not begin "To ": ${order}`);
      assert.match(order, /\.$/, `general order ${i + 1} is not a full sentence: ${order}`);
    }
  });

  it("the creed and the core values name the same three values", () => {
    /**
     * The creed's fourth line lists Honor, Courage and Commitment, and the next
     * section defines them. Two copies of one fact, in two exports, and nothing
     * makes them agree — so this derives the values out of the creed's own text
     * and requires the keys to match. Retitle "Commitment" without touching the
     * creed and the page contradicts itself one heading apart.
     */
    const keys = CORE_VALUES.map((v) => v.k);
    assert.deepEqual(keys, ["Honor", "Courage", "Commitment"]);

    const creed = SAILORS_CREED.join(" ");
    for (const k of keys) {
      assert.ok(creed.includes(k), `the creed no longer names "${k}"`);
    }
    // And nothing extra: a fourth core value would have to appear in the creed
    // too, or one of the two is wrong.
    assert.equal(CORE_VALUES.length, 3, "the Navy has three core values");
    for (const v of CORE_VALUES) {
      assert.ok(v.v?.length > 40, `"${v.k}" has no real description`);
    }
  });

  it("the creed is quoted as lines, not reflowed into a paragraph", () => {
    // The `verbatim` renderer emits one <p> per row, so the row split IS the line
    // break a reader sees. Five sentences, one per row, each ending in a period —
    // a row holding two sentences means someone joined lines and the creed will
    // render as prose.
    assert.equal(SAILORS_CREED.length, 5, "the creed is five lines");
    assert.match(SAILORS_CREED[0], /^I am a United States Sailor\.$/);
    for (const line of SAILORS_CREED) {
      assert.match(line, /\.$/, `creed line does not end a sentence: ${line}`);
      assert.equal(
        (line.match(/\. /g) ?? []).length,
        0,
        `two sentences share one creed line, which will render as one paragraph: ${line}`,
      );
    }
    assert.equal(sectionOf("creed").kind, "verbatim");
  });

  it("the watch rotation covers all 24 hours with no gap and no overlap", () => {
    /**
     * A derived check, and the only test in this block with real arithmetic in it.
     * A single mistyped digit in the table — "0400 – 0900" — is invisible to
     * inspection and to every other check here, and it is the kind of error a
     * reader would trust. So the times are parsed and chained: each watch has to
     * start where the previous one ended, the sequence has to close the loop, and
     * the durations have to sum to a day.
     *
     * The list starts at the first watch (2000) and wraps through midnight, which
     * is why "2400" and "0000" both appear and why the chain is checked modulo a
     * day rather than as a sorted range.
     */
    const mins = (t) => {
      const m = /^(\d{2})(\d{2})$/.exec(t);
      assert.ok(m, `unparseable watch time "${t}"`);
      return Number(m[1]) * 60 + Number(m[2]);
    };

    let total = 0;
    for (const [i, w] of WATCHES.entries()) {
      const parts = w.time.split("–").map((s) => s.trim());
      assert.equal(parts.length, 2, `watch "${w.watch}" has no start–end range: ${w.time}`);
      const [start, end] = parts.map(mins);

      // Duration, wrapped: the mid watch runs 0000–0400 and the first watch
      // 2000–2400, so an end at or before the start means it crossed midnight.
      const span = end > start ? end - start : end + 1440 - start;
      assert.ok(span > 0 && span <= 240, `"${w.watch}" spans ${span} minutes: ${w.time}`);
      total += span;

      const next = WATCHES[(i + 1) % WATCHES.length];
      const nextStart = mins(next.time.split("–")[0].trim());
      assert.equal(
        end % 1440,
        nextStart % 1440,
        `"${w.watch}" ends at ${w.time.split("–")[1].trim()} but "${next.watch}" starts at ` +
          `${next.time.split("–")[0].trim()} — the rotation has a gap`,
      );
    }
    assert.equal(total, 1440, `the watches sum to ${total} minutes, not a 24-hour day`);

    // Two dog watches, and they are the short ones — that is the whole reason the
    // rotation shifts, and the bells section explains it in prose. If the dog
    // watches became four hours long, that explanation would be wrong.
    const dogs = WATCHES.filter((w) => /dog/i.test(w.watch));
    assert.equal(dogs.length, 2, "there are two dog watches");
    for (const d of dogs) {
      const [s, e] = d.time.split("–").map((x) => mins(x.trim()));
      assert.equal(e - s, 120, `"${d.watch}" is not a two-hour watch`);
    }
  });

  it("cites public authorities and never the copyrighted manual as a source", () => {
    /**
     * The reason this topic exists in the shape it does. The obvious way to build
     * it is to transcribe the Bluejacket's Manual, which is Naval Institute Press
     * material rather than a public-domain government work — so every section's
     * authority has to resolve to something in the directive registry, and the
     * book must not be presented as one.
     *
     * "bluejacket" IS allowed to appear in the topic keywords, because people
     * search for the book by name and this page is the right answer to that
     * search. What is not allowed is the word turning up in a `refs`, a heading,
     * or a source citation.
     */
    const cited = doctrine.sections.flatMap((s) => s.refs ?? []);
    assert.ok(cited.length > 0, "no section cites an authority");
    for (const id of new Set(cited)) {
      assert.ok(DIRECTIVE_BY_ID.has(id), `doctrine cites unknown directive "${id}"`);
    }
    for (const id of ["navy-regs", "navpers-15665", "opnavinst-3120-32"]) {
      assert.ok(cited.includes(id), `nothing on the doctrine page cites "${id}"`);
    }

    /**
     * And the two QUOTED sections each state a provenance of their own.
     *
     * The page-level assertion above is not enough, and a mutation proved it:
     * stripping the source off the Sailor's Creed SURVIVED, because another
     * section cited the same document and the page total still looked right. A
     * verbatim quotation with nothing under it is the one omission here that
     * cannot be shrugged off — it is text presented as authoritative with no
     * stated source.
     *
     * `refs` OR a `note`, because for the creed the honest answer is a note. It is
     * not in any of the eighteen registered directives; it was CNO-promulgated and
     * lives in training material. The first draft cited Navy Regulations for it
     * and that was simply false. So the rule this encodes is "say where it came
     * from", not "produce a chip" — a check that demanded `refs` would have been
     * satisfied by exactly the wrong citation it was meant to prevent.
     *
     * Terminology is deliberately excluded from all of this: shipboard slang has
     * no governing instruction, and inventing one to satisfy a test would be worse
     * than the blank.
     */
    for (const id of ["creed", "general-orders"]) {
      const s = sectionOf(id);
      assert.ok(
        (s.refs ?? []).length > 0 || (s.note ?? "").length > 40,
        `"${id}" quotes a fixed text and says nothing about where it came from`,
      );
    }

    assert.equal(doctrine.sourcePdf, undefined, "the doctrine topic must not claim a source PDF");
    for (const s of doctrine.sections) {
      assert.match(
        JSON.stringify(s).toLowerCase(),
        /^(?!.*bluejacket).*$/s,
        `section "${s.id}" names the Bluejacket's Manual in its content`,
      );
    }
    assert.ok(
      doctrine.keywords.includes("bluejacket"),
      "the page should still be findable by the name people search for",
    );
  });

  it("says out loud which parts are quoted and which are summarized", () => {
    // The note is the honesty this page rests on: two sections are quotations and
    // six are plain-language summaries of conventions that vary by command. A note
    // trimmed during an unrelated edit would leave the summaries looking like
    // policy.
    const note = doctrine.note ?? "";
    assert.match(note, /quoted/i, "the note no longer distinguishes the quoted texts");
    assert.match(note, /summariz/i, "the note no longer says the rest is summarized");
    assert.match(note, /command/i, "the note no longer points at the local command");
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

/* ------------------------------------------------------------------ *
 * Pasted point-record import
 * ------------------------------------------------------------------ */

/**
 * The parser exists because NSIPS cannot be read from a browser on another
 * origin (CAC/PKI behind an F5 portal, no CORS) and proxying a government login
 * is not something this site will do. So the data arrives as a paste, and the
 * risk moves from "can we fetch it" to "did we put the numbers in the right
 * columns" — which is what these cover.
 *
 * The most valuable case is the LAST one. Silently mis-filing AT points as
 * correspondence still produces a plausible-looking total, so the parser must
 * report a disagreement rather than average it away.
 */
describe("pasted point-record import", () => {
  it("reads a tab-separated record with a header", () => {
    const { rows, usedHeader } = parsePointRecord(
      ["Year\tInactive\tActive\tCorresp\tMembership\tTotal", "FY24\t48\t14\t0\t15\t77"].join("\n"),
    );
    assert.equal(usedHeader, true);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { label: "FY24", idt: 48, at: 14, corr: 0, membership: 15 });
  });

  it("honours header ORDER rather than a fixed column layout", () => {
    // Same numbers, columns transposed. A positional parser would swap AT and IDT.
    const { rows } = parsePointRecord(
      ["Year\tActive\tInactive\tMembership\tCorresp", "FY24\t14\t48\t15\t3"].join("\n"),
    );
    assert.equal(rows[0].at, 14, "AT must follow its header, not its position");
    assert.equal(rows[0].idt, 48);
    assert.equal(rows[0].corr, 3);
  });

  it("recovers the total column by arithmetic when there is no header", () => {
    /**
     * 48 + 14 + 0 + 15 = 77, so the 77 is identifiable as the total from the
     * numbers alone — no header, no assumption about where NSIPS puts it.
     *
     * The total is placed in EVERY position, and that is the point of the loop.
     * The first version of this test only tried it last, which is the one spot
     * where the total harmlessly falls off the end of a four-field list: deleting
     * the arithmetic detection entirely still passed. A check that only exercises
     * the benign case is decoration. With the total first or in the middle, losing
     * detection shifts every subsequent column and silently corrupts the row.
     */
    const parts = ["48", "14", "0", "15"];
    for (let at = 0; at <= parts.length; at++) {
      const cells = [...parts];
      cells.splice(at, 0, "77");
      const line = `FY24\t${cells.join("\t")}`;
      const { rows, usedHeader } = parsePointRecord(line);
      assert.equal(usedHeader, false, line);
      assert.deepEqual(
        { idt: rows[0].idt, at: rows[0].at, corr: rows[0].corr, membership: rows[0].membership },
        { idt: 48, at: 14, corr: 0, membership: 15 },
        `total at index ${at} was not recognized: "${line}"`,
      );
      assert.equal(totalYear(rows[0]).total, 77, line);
    }
  });

  it("splits on runs of spaces and on pipes, not just tabs", () => {
    for (const line of ["FY24   48   14   0   15", "FY24 | 48 | 14 | 0 | 15"]) {
      const { rows } = parsePointRecord(line);
      assert.equal(rows.length, 1, `failed to parse: ${line}`);
      assert.equal(rows[0].idt, 48, `wrong IDT for: ${line}`);
    }
  });

  it("keeps multiple years and their labels", () => {
    const { rows } = parsePointRecord(
      ["FY22\t24\t14\t0\t15", "FY23\t36\t14\t6\t15", "FY24\t48\t0\t0\t15"].join("\n"),
    );
    assert.deepEqual(rows.map((r) => r.label), ["FY22", "FY23", "FY24"]);
    assert.equal(summarize(rows).goodYears, 3);
  });

  it("infers membership points from a stated total that omits them", () => {
    // Columns add to 62; record says 77. The 15-point gap is membership.
    const { rows, warnings } = parsePointRecord(
      ["Year\tInactive\tActive\tCorresp\tTotal", "FY24\t48\t14\t0\t77"].join("\n"),
    );
    assert.equal(rows[0].membership, 15);
    assert.equal(totalYear(rows[0]).total, 77);
    assert.match(warnings.join(" "), /inferred 15 membership/i);
  });

  it("ignores blank lines, page furniture, and single-number footers", () => {
    /**
     * Footers are TAB-separated here on purpose. Written as "Total points: 812"
     * with single spaces, the line collapses to one cell and never reaches the
     * "needs two numbers" guard — so relaxing that guard left this test passing
     * and the test proved nothing. A real paste out of a table carries tabs.
     */
    for (const footer of ["Total points:\t812", "Grand Total\t812", "Career total   812"]) {
      const { rows } = parsePointRecord(
        [
          "ANNUAL RETIREMENT POINT RECORD",
          "",
          "Year\tInactive\tActive\tCorresp\tMembership",
          "FY24\t48\t14\t0\t15",
          "",
          footer,
        ].join("\n"),
      );
      assert.equal(rows.length, 1, `"${footer}" became a year row`);
      assert.equal(rows[0].label, "FY24");
    }
  });

  it("does not mistake a data row for the header and swallow it", () => {
    /**
     * Header detection keys on the ABSENCE of standalone numbers, not on counting
     * keywords, and this is the case that forces it. "IDT 48 / AT 14 / 0 / 15"
     * has two header-ish cells, so a keyword-counting detector consumes the line
     * as column names — and the row does not merely land wrong, it disappears
     * entirely. A year of points silently missing from a 20-year record is the
     * worst outcome available to this parser, and it looks like nothing happened.
     *
     * What survives is asserted, not the exact mapping: cells like "IDT 48" are
     * not integers, so the values read imperfectly. That is fine — an imperfect
     * row is visible in the preview and fixable in two clicks. A vanished one is
     * neither.
     */
    for (const line of ["IDT 48\tAT 14\t0\t15", "Drill\t48\tAnnual\t14"]) {
      const { rows, usedHeader } = parsePointRecord(line);
      assert.equal(usedHeader, false, `"${line}" was misread as a column header`);
      assert.equal(rows.length, 1, `"${line}" produced no row — the data was swallowed`);
    }
  });

  it("returns no rows, and says so, for input that is not a record", () => {
    for (const junk of ["", "   ", "hello world", "see your NOSC"]) {
      const { rows, warnings } = parsePointRecord(junk);
      assert.equal(rows.length, 0, `parsed rows out of "${junk}"`);
      assert.ok(warnings.length, `"${junk}" produced no explanation`);
    }
  });

  it("reports a total it cannot reconcile instead of adjusting the numbers", () => {
    /**
     * The one that matters. If the columns disagree with the stated total and
     * membership is already accounted for, the parser has mis-mapped something —
     * and the failure is invisible, because every individual number looks fine.
     * It must surface the disagreement and leave the values untouched, so the
     * user fixes them in the preview rather than discovering it 20 years later.
     */
    const { rows, warnings } = parsePointRecord(
      ["Year\tInactive\tActive\tCorresp\tMembership\tTotal", "FY24\t48\t14\t0\t15\t91"].join("\n"),
    );
    assert.deepEqual(
      { idt: rows[0].idt, at: rows[0].at, corr: rows[0].corr, membership: rows[0].membership },
      { idt: 48, at: 14, corr: 0, membership: 15 },
      "values were altered to force the stated total to reconcile",
    );
    assert.ok(rows[0].mismatch, "an unreconcilable total was not flagged");
    assert.match(warnings.join(" "), /add to 77 but the record states 91/i);
  });

  it("never emits NaN, negative, or non-integer point values", () => {
    const messy = [
      "Year\tInactive\tActive\tCorresp\tMembership",
      "FY24\tn/a\t14\t-\t15",
      "FY23\t1,024\t14\t0\t15",
      "FY22\t12.5\t14\t0\t15",
    ].join("\n");
    for (const row of parsePointRecord(messy).rows) {
      for (const f of ["idt", "at", "corr", "membership"]) {
        assert.ok(
          Number.isInteger(row[f]) && row[f] >= 0,
          `${row.label}.${f} = ${row[f]} — points must be non-negative integers`,
        );
      }
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

describe("due dates", () => {
  /**
   * The date math behind the Due Dates tool.
   *
   * This is the only feature on the site that renders a number nobody entered and
   * asks the user to act on it, so it is tested at a different level of paranoia
   * than the reference tables. Two classes of failure matter here and they are not
   * equally bad:
   *
   *   A WRONG date is worse than NO date. Every "needs-anchor" / "unscheduled"
   *   assertion below is really asserting that the code declined to guess, and
   *   those are the ones to keep if this suite ever has to be cut down.
   *
   * All of it runs against injected `today` values. A test that called new Date()
   * would pass for a while and then start failing on a specific calendar day,
   * which is the worst possible way to learn about a bug in date code.
   */
  const d = (iso) => parseISO(iso);

  it("parses ISO dates in LOCAL time, not UTC", () => {
    /**
     * `new Date("2026-08-12")` is UTC midnight, which renders as the 11th
     * anywhere west of Greenwich. Every date in the tool would be one day early
     * for most of the United States — visible only to users in those zones, and
     * invisible in CI if CI runs at UTC.
     *
     * Asserting on the local getters is what makes this test independent of the
     * TZ the suite happens to run under.
     */
    const dt = parseISO("2026-08-12");
    assert.equal(dt.getFullYear(), 2026);
    assert.equal(dt.getMonth(), 7);
    assert.equal(dt.getDate(), 12);
    assert.equal(dt.getHours(), 0, "not local midnight — an ISO string reached the Date constructor");
    // Round-trip: the pair has to be inverse, or a stored completion date drifts
    // by a day every time it is read and written.
    assert.equal(toISO(dt), "2026-08-12");
    for (const iso of ["2024-02-29", "2026-01-01", "2026-12-31", "2000-02-29"]) {
      assert.equal(toISO(parseISO(iso)), iso, `round-trip failed for ${iso}`);
    }
  });

  it("rejects malformed and impossible dates instead of rolling them over", () => {
    // 2026-02-31 as a Date is 3 March. Accepting it would silently move a due
    // date into the next month.
    for (const bad of ["2026-02-31", "2026-13-01", "2026-00-10", "2025-02-29", "2026-2-3", "not a date", "", null, undefined, "20260812"]) {
      assert.equal(parseISO(bad), null, `parseISO accepted ${JSON.stringify(bad)}`);
    }
    assert.equal(toISO(null), null);
    assert.equal(toISO(new Date(NaN)), null);
  });

  it("adding months clamps to the end of a short month", () => {
    // 31 Jan + 1 month is 28/29 Feb, not 3 March. This is what "monthly" means
    // to a person, and the naive setMonth() gets it wrong.
    assert.equal(toISO(addMonths(d("2026-01-31"), 1)), "2026-02-28");
    assert.equal(toISO(addMonths(d("2024-01-31"), 1)), "2024-02-29", "leap year not handled");
    assert.equal(toISO(addMonths(d("2026-03-31"), 1)), "2026-04-30");
    assert.equal(toISO(addMonths(d("2026-08-31"), 6)), "2027-02-28");
    // Ordinary cases, including the year roll and a full 12 months.
    assert.equal(toISO(addMonths(d("2026-08-12"), 12)), "2027-08-12");
    assert.equal(toISO(addMonths(d("2026-11-15"), 3)), "2027-02-15");
    assert.equal(toISO(addMonths(d("2026-08-12"), 0)), "2026-08-12");
    // Negative months are not used by the tool but must not silently corrupt.
    assert.equal(toISO(addMonths(d("2026-01-15"), -1)), "2025-12-15");
  });

  it("day counts are calendar days, including across a DST boundary", () => {
    /**
     * US spring-forward 2026 is 8 March. The week containing it is 167 hours
     * long, so any millisecond-difference implementation returns 6 for it. That
     * is a one-day error that appears twice a year and only in some time zones —
     * exactly the bug that gets closed as "cannot reproduce".
     */
    assert.equal(daysBetween(d("2026-03-05"), d("2026-03-12")), 7, "spring-forward week counted short");
    assert.equal(daysBetween(d("2026-10-29"), d("2026-11-05")), 7, "fall-back week counted long");
    assert.equal(daysBetween(d("2026-08-12"), d("2026-08-12")), 0);
    assert.equal(daysBetween(d("2026-08-12"), d("2026-08-11")), -1, "past dates must count negative");
    assert.equal(daysBetween(d("2026-01-01"), d("2027-01-01")), 365);
    assert.equal(daysBetween(d("2024-01-01"), d("2025-01-01")), 366, "leap year miscounted");
  });

  it("a fiscal-year deadline is still due ON the deadline day", () => {
    // On-or-after, not strictly after. Rolling on the day itself would tell
    // someone with an unmet AT requirement that they have twelve months left,
    // on the one day it matters most.
    assert.equal(toISO(nextMonthDay("09-30", d("2026-09-30"))), "2026-09-30");
    assert.equal(toISO(nextMonthDay("09-30", d("2026-09-29"))), "2026-09-30");
    assert.equal(toISO(nextMonthDay("09-30", d("2026-10-01"))), "2027-09-30");
    assert.equal(toISO(nextMonthDay("01-01", d("2026-12-31"))), "2027-01-01");
    for (const bad of ["13-01", "09-32", "0930", "", null, "09"]) {
      assert.equal(nextMonthDay(bad, d("2026-08-12")), null, `nextMonthDay accepted "${bad}"`);
    }
  });

  it("a completion-based item counts forward from the date it was done", () => {
    const item = { id: "annual.pfa", due: { basis: "completion", months: 12 } };
    const r = dueFor(item, { completions: { "annual.pfa": "2026-05-01" }, today: d("2026-08-12") });
    assert.equal(r.dueISO, "2027-05-01");
    assert.equal(r.daysUntil, daysBetween(d("2026-08-12"), d("2027-05-01")));
    assert.equal(r.status, "ok");
    assert.equal(r.intervalMonths, 12);
    assert.match(r.reason, /2026-05-01/, "the reason does not say where the date came from");
  });

  it("an item never completed asks for a date instead of inventing one", () => {
    /**
     * The single most important assertion in this block. With no completion date
     * there is no honest answer, and the tempting fallback — treat "never" as
     * "due now" — paints a brand-new user's screen entirely red on first visit
     * and teaches them to ignore the colour permanently.
     */
    const item = { id: "annual.pfa", due: { basis: "completion", months: 12 } };
    const r = dueFor(item, { completions: {}, today: d("2026-08-12") });
    assert.equal(r.status, "needs-anchor");
    assert.equal(r.dueISO, null, "produced a due date with nothing to compute it from");
    assert.equal(r.dueDate, null);
    assert.equal(r.daysUntil, null, "a null due date must not yield a day count");
    assert.match(r.reason, /check this off/i, "the reason does not tell the user how to fix it");
    // A malformed stored date is the same situation, not a crash and not a guess.
    const bad = dueFor(item, { completions: { "annual.pfa": "not-a-date" }, today: d("2026-08-12") });
    assert.equal(bad.status, "needs-anchor");
    assert.equal(bad.completedISO, null);
  });

  it("overdue, due-soon and ok are decided by the interval's own warn window", () => {
    /**
     * One global warn window is wrong at both ends: 60 days on a monthly task
     * means it is permanently amber, and 7 days on a PHA is useless when the
     * appointment takes three weeks to get. So the window scales with the
     * interval, and the boundaries are pinned exactly — off-by-one here is a
     * status that flips a day early or late, which reads as flakiness.
     */
    const annual = { id: "x", due: { basis: "completion", months: 12 } };
    const at = (today) => dueFor(annual, { completions: { x: "2026-01-01" }, today: d(today) }).status;
    assert.equal(at("2026-06-01"), "ok", "far from due");
    assert.equal(at("2026-11-01"), "ok", "61 days out is not yet due-soon");
    assert.equal(at("2026-11-02"), "due-soon", "60 days out is the start of the warn window");
    assert.equal(at("2026-12-31"), "due-soon", "the day before is still due-soon");
    assert.equal(at("2027-01-01"), "due-soon", "the due date itself is due, not overdue");
    assert.equal(at("2027-01-02"), "overdue");

    // Monthly gets a 7-day window; quarterly 21. Same code, different answer.
    const monthly = { id: "y", due: { basis: "completion", months: 1 } };
    const my = (today) => dueFor(monthly, { completions: { y: "2026-08-01" }, today: d(today) });
    assert.equal(my("2026-08-24").status, "ok");
    assert.equal(my("2026-08-25").status, "due-soon");
    assert.equal(my("2026-08-01").warnDays, 7);
    const quarterly = dueFor({ id: "z", due: { basis: "completion", months: 3 } }, { completions: { z: "2026-08-01" }, today: d("2026-08-12") });
    assert.equal(quarterly.warnDays, 21);
  });

  it("an anniversary item is keyed to the RC year, not the calendar year", () => {
    /**
     * The classic reservist-tool bug, in date form. A good year runs from the
     * anniversary date; anchoring it to January or to 1 October produces a
     * confidently wrong deadline for almost everybody.
     */
    const item = { id: "annual.goodyear", due: { basis: "anniversary" } };
    const ctx = { anniversaryMonthDay: "10-01", today: d("2026-08-12") };

    // Nothing recorded: the anniversary that already opened is the deadline, and
    // it reads as overdue — which it is.
    const none = dueFor(item, { ...ctx, completions: {} });
    assert.equal(none.dueISO, "2025-10-01");
    assert.equal(none.status, "overdue");

    // Done inside the current RC year: the next anniversary is the deadline.
    const done = dueFor(item, { ...ctx, completions: { "annual.goodyear": "2026-02-15" } });
    assert.equal(done.dueISO, "2026-10-01");
    assert.notEqual(done.status, "overdue");

    // Done LAST RC year: still owed for this one.
    const stale = dueFor(item, { ...ctx, completions: { "annual.goodyear": "2025-06-01" } });
    assert.equal(stale.dueISO, "2025-10-01");
    assert.equal(stale.status, "overdue");

    /**
     * THE CASES THAT SEPARATE "RC YEAR" FROM "CALENDAR YEAR", added because the
     * three above do not: with a 1 October anniversary, a completion in February
     * 2026 and one in June 2025 fall on the same side of both boundaries, so a
     * calendar-year implementation passes all three. It was mutated in and it did.
     *
     * The two below straddle. With an autumn anniversary, an October–December
     * completion is in the NEXT RC year but the SAME calendar year; with a spring
     * anniversary, a January completion is in the PREVIOUS RC year but the same
     * calendar year. The second is the dangerous direction — a calendar-year bug
     * reports "on track" to someone who is actually overdue.
     */
    const autumn = dueFor(item, { ...ctx, completions: { "annual.goodyear": "2025-11-20" } });
    assert.equal(autumn.dueISO, "2026-10-01", "November 2025 is inside the RC year that opened 2025-10-01");
    assert.notEqual(autumn.status, "overdue");

    const spring = dueFor(item, {
      anniversaryMonthDay: "03-01",
      today: d("2026-08-12"),
      completions: { "annual.goodyear": "2026-01-15" },
    });
    assert.equal(spring.dueISO, "2026-03-01", "January 2026 precedes the RC year that opened 2026-03-01");
    assert.equal(spring.status, "overdue", "a calendar-year reading would call this on track");
  });

  it("an anniversary item with no anniversary on file says so", () => {
    const item = { id: "annual.goodyear", due: { basis: "anniversary" } };
    for (const anniversaryMonthDay of ["", null, undefined, "garbage", "13-40"]) {
      const r = dueFor(item, { anniversaryMonthDay, completions: {}, today: d("2026-08-12") });
      assert.equal(r.status, "needs-anchor", `anniversary "${anniversaryMonthDay}" produced ${r.status}`);
      assert.equal(r.dueISO, null, "guessed a good-year deadline with no anniversary date");
      assert.match(r.reason, /anniversary/i);
    }
  });

  it("a fiscal-year item arrives whether or not anything is checked off", () => {
    // AT is the only item that works this way: 30 September is the deadline
    // regardless of history, so unlike a completion item it must NOT fall back
    // to needs-anchor when nothing is recorded.
    const item = { id: "annual.at", due: { basis: "fiscalYear", monthDay: "09-30" } };
    const fresh = dueFor(item, { completions: {}, today: d("2026-08-12") });
    assert.equal(fresh.dueISO, "2026-09-30");
    assert.equal(fresh.status, "due-soon");
    assert.notEqual(fresh.status, "needs-anchor", "a fixed deadline needs no anchor");

    // Completed inside FY26 satisfies FY26; the deadline moves to FY27.
    const met = dueFor(item, { completions: { "annual.at": "2026-07-04" }, today: d("2026-08-12") });
    assert.equal(met.dueISO, "2027-09-30");
    assert.equal(met.status, "ok");

    /**
     * The fiscal-year boundary itself, both sides, because the intuitive reading
     * is wrong and this test caught it being written wrong: a completion in
     * NOVEMBER 2025 is in FY26, not FY25. FY26 runs 1 Oct 2025 -> 30 Sep 2026, so
     * an AT performed in November has already satisfied the September deadline
     * that is still ten months away on the calendar.
     */
    const novemberIsThisFy = dueFor(item, { completions: { "annual.at": "2025-11-15" }, today: d("2026-08-12") });
    assert.equal(novemberIsThisFy.dueISO, "2027-09-30", "November 2025 is FY26 and satisfies it");
    // Genuinely last fiscal year: still owed for this one.
    const lastFy = dueFor(item, { completions: { "annual.at": "2025-06-01" }, today: d("2026-08-12") });
    assert.equal(lastFy.dueISO, "2026-09-30", "an FY25 completion must not satisfy FY26");
    assert.equal(lastFy.status, "due-soon");
  });

  it("an item with no `due` is event-driven, not overdue", () => {
    /**
     * The drill and life-event groups carry no `due` at all, and that absence is
     * a decision. "Update DEERS after a life event" has no computable deadline,
     * and rendering an invented one in the same red as a real PHA date would
     * discredit both.
     */
    const r = dueFor({ id: "life.deers" }, { completions: {}, today: d("2026-08-12"), cadence: "When it happens" });
    assert.equal(r.status, "unscheduled");
    assert.equal(r.dueISO, null);
    assert.match(r.reason, /When it happens/, "the group's own cadence is the honest explanation");
    // And with no cadence to fall back on it still explains itself.
    assert.match(dueFor({ id: "x" }, {}).reason, /\S/);
  });

  it("an unrecognized basis surfaces as a data bug, not as 'no schedule'", () => {
    // Failing open here would make a typo'd basis indistinguishable from a
    // deliberately undated item, and the item would quietly stop being tracked.
    const r = dueFor({ id: "x", due: { basis: "quarterlyish" } }, { today: d("2026-08-12") });
    assert.equal(r.status, "needs-anchor");
    assert.notEqual(r.status, "unscheduled");
    assert.match(r.reason, /quarterlyish/);
  });

  it("every `due` in the checklist uses a basis the code implements", () => {
    /**
     * The data-side half of the check above. `dueFor` handles three bases; a
     * fourth invented in checklist.js would render every affected row as "Needs a
     * date" with a message about an unknown basis, which is legible in a test and
     * baffling on the page.
     */
    const KNOWN = new Set(["completion", "anniversary", "fiscalYear"]);
    let dated = 0;
    for (const g of CHECKLIST_GROUPS) {
      for (const i of g.items) {
        if (!i.due) continue;
        dated += 1;
        assert.ok(KNOWN.has(i.due.basis), `checklist item "${i.id}" has unknown due basis "${i.due.basis}"`);
        if (i.due.basis === "completion") {
          assert.ok(Number.isInteger(i.due.months) && i.due.months > 0, `item "${i.id}" has a bad interval`);
        }
        if (i.due.basis === "fiscalYear") {
          assert.ok(nextMonthDay(i.due.monthDay, d("2026-08-12")), `item "${i.id}" has a bad monthDay`);
        }
      }
    }
    assert.ok(dated >= 15, `only ${dated} checklist items are dated — did the \`due\` field get renamed?`);
  });

  it("the schedule sorts by urgency and every row keeps its item", () => {
    const rows = buildSchedule(CHECKLIST_GROUPS, {
      completions: { "annual.pfa": "2024-01-01", "monthly.les": "2026-08-10" },
      anniversaryMonthDay: "10-01",
      today: d("2026-08-12"),
    });
    assert.equal(rows.length, ALL_ITEM_IDS.length, "the schedule lost or duplicated a checklist item");

    const ORDER = ["overdue", "due-soon", "ok", "needs-anchor", "unscheduled"];
    let last = -1;
    for (const r of rows) {
      const rank = ORDER.indexOf(r.status);
      assert.ok(rank >= 0, `row "${r.itemId}" has unknown status "${r.status}"`);
      assert.ok(rank >= last, `status ${r.status} appeared after a later group — sort is wrong`);
      last = rank;
      assert.ok(r.item, `row "${r.itemId}" lost its item reference`);
      assert.ok(r.groupHeading, `row "${r.itemId}" lost its group heading`);
    }
    // Within a status, soonest first.
    const overdue = rows.filter((r) => r.status === "overdue");
    for (let i = 1; i < overdue.length; i++) {
      assert.ok(overdue[i - 1].daysUntil <= overdue[i].daysUntil, "overdue rows are not soonest-first");
    }
    // A PFA two and a half years stale must be in that first group.
    assert.equal(rows.find((r) => r.itemId === "annual.pfa").status, "overdue");

    const sum = summarizeSchedule(rows);
    assert.equal(sum.total, rows.length);
    assert.equal(
      sum.overdue + sum["due-soon"] + sum.ok + sum["needs-anchor"] + sum.unscheduled,
      rows.length,
      "the summary counts do not add up to the row count",
    );
    assert.equal(sum.scheduled, sum.overdue + sum["due-soon"] + sum.ok);
  });

  it("the empty-state schedule invents nothing", () => {
    // What a first-time visitor sees: no completions, no anniversary. Not one
    // date may be produced from that.
    const rows = buildSchedule(CHECKLIST_GROUPS, { completions: {}, anniversaryMonthDay: "", today: d("2026-08-12") });
    for (const r of rows) {
      if (r.basis === "fiscalYear") continue; // a fixed deadline is knowable
      assert.equal(r.dueISO, null, `"${r.itemId}" produced a date from an empty profile`);
      assert.ok(
        r.status === "needs-anchor" || r.status === "unscheduled",
        `"${r.itemId}" is ${r.status} on a blank profile`,
      );
    }
    assert.equal(summarizeSchedule(rows).overdue, 0, "a brand-new user was shown overdue items");
  });

  it("the .ics is well-formed RFC 5545 that a strict parser will accept", () => {
    const rows = buildSchedule(CHECKLIST_GROUPS, {
      completions: { "annual.pfa": "2026-01-15", "monthly.points": "2026-08-01" },
      anniversaryMonthDay: "10-01",
      today: d("2026-08-12"),
    });
    const { ics, exported, skipped } = buildIcs(rows, { stamp: new Date(Date.UTC(2026, 7, 12, 13, 45, 30)) });

    assert.ok(exported > 0, "nothing was exported");
    assert.equal(exported + skipped, rows.length, "the export accounting does not add up");
    assert.equal(exported, rows.filter((r) => r.dueISO).length, "a dated row was skipped");

    // Structure.
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"), "no VCALENDAR opening");
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"), "missing the trailing CRLF the spec requires");
    assert.match(ics, /^VERSION:2\.0\r$/m);
    assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, exported);
    assert.equal((ics.match(/END:VEVENT/g) ?? []).length, exported);

    // CRLF everywhere. A bare LF is the classic hand-rolled-ics defect: it looks
    // right in an editor and some clients reject the whole file.
    assert.equal(ics.split("\n").length - 1, ics.split("\r\n").length - 1, "a bare LF is present");

    // The 75-OCTET fold, counted in bytes. Em-dashes in the labels are three
    // bytes each, so a character-counted fold passes a naive check and still
    // overruns for real clients.
    for (const line of ics.split("\r\n")) {
      const bytes = new TextEncoder().encode(line).length;
      assert.ok(bytes <= 75, `line exceeds 75 octets (${bytes}): ${line.slice(0, 40)}...`);
    }
    // And the fold must be reversible — unfolding has to restore the original
    // text, or the fold has eaten or added characters.
    assert.match(ics.replace(/\r\n /g, ""), /SUMMARY:.+ — due/, "unfolding did not restore a SUMMARY");

    // All-day events are half-open: DTEND is the day AFTER DTSTART. Equal dates
    // give a zero-length event that some clients drop and others misplace.
    const starts = [...ics.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].map((m) => m[1]);
    const ends = [...ics.matchAll(/DTEND;VALUE=DATE:(\d{8})/g)].map((m) => m[1]);
    assert.equal(starts.length, exported);
    assert.equal(ends.length, exported);
    for (let i = 0; i < starts.length; i++) {
      assert.notEqual(ends[i], starts[i], "DTEND equals DTSTART — the event has zero length");
      const s = starts[i];
      const expected = toISO(new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + 1)).replace(/-/g, "");
      assert.equal(ends[i], expected, "DTEND is not the day after DTSTART");
    }

    // DTSTAMP is UTC and comes from the injected stamp, not from the clock.
    assert.match(ics, /DTSTAMP:20260812T134530Z/);

    // Stable UIDs, so re-importing updates rather than duplicates.
    const uids = [...ics.matchAll(/UID:(.+)\r/g)].map((m) => m[1]);
    assert.equal(new Set(uids).size, uids.length, "duplicate UIDs — a re-import would collide");
    for (const uid of uids) assert.match(uid, /^saltdog-[a-z]+\.[a-z0-9-]+@saltdog\.invalid$/);
    // Deterministic across runs, given the same inputs — the property that makes
    // re-import an update.
    const again = buildIcs(rows, { stamp: new Date(Date.UTC(2026, 7, 12, 13, 45, 30)) });
    assert.equal(again.ics, ics, "the export is not deterministic");

    assert.match(ICS_FILENAME, /\.ics$/);
  });

  it("the .ics folds by octet, not by character", () => {
    /**
     * Added because the check above SURVIVED the mutation it was written for.
     * Replacing `bytes.length <= 75` with `line.length <= 75` in `fold()` left
     * every real checklist label passing, because none of them happens to land in
     * the gap between the two counts — so the assertion was correct, watching the
     * right property, and completely unable to fail.
     *
     * The em-dash this site's copy is full of is one character and three octets.
     * The fixture below is built to sit in that gap on purpose, and it asserts its
     * own preconditions: if a future edit moves it back out of the gap, this says
     * so instead of quietly going toothless again.
     *
     * The padding sweep is what tests the multi-byte BACKOFF specifically. Folding
     * at a fixed 75th octet will land mid-em-dash for some lengths and not others,
     * so one fixture can't reach it; sweeping shifts the boundary through the
     * character and a fold that splits a UTF-8 sequence produces U+FFFD, which
     * the round-trip catches.
     */
    const enc = (s) => new TextEncoder().encode(s).length;

    for (let pad = 0; pad <= 8; pad++) {
      // 65 characters, 81 octets — inside the gap, with room for the sweep.
      const label = `PHA — dental — IMR — labs — HIV — DNA — MRRS — NOSC${"x".repeat(pad)}`;
      const summaryLine = `SUMMARY:${label} — due`;
      if (pad === 0) {
        assert.ok(
          summaryLine.length <= 75,
          `fixture no longer sits under the CHARACTER limit (${summaryLine.length}) — it cannot detect a char-counted fold`,
        );
        assert.ok(
          enc(summaryLine) > 75,
          `fixture no longer exceeds the OCTET limit (${enc(summaryLine)}) — it cannot detect a char-counted fold`,
        );
      }

      const { ics } = buildIcs(
        [{ itemId: "test.item", dueDate: d("2026-09-30"), intervalMonths: 12, warnDays: 60, reason: "r", item: { label } }],
        { stamp: new Date(Date.UTC(2026, 0, 1)) },
      );

      for (const line of ics.split("\r\n")) {
        assert.ok(enc(line) <= 75, `pad=${pad}: line is ${enc(line)} octets: ${line}`);
      }
      // Unfolding must restore the label byte-for-byte. A fold that split a
      // multi-byte sequence leaves U+FFFD here, which no octet-length check sees.
      const unfolded = ics.replace(/\r\n /g, "");
      assert.ok(!unfolded.includes("�"), `pad=${pad}: the fold split a UTF-8 sequence`);
      assert.ok(
        unfolded.includes(`SUMMARY:${label} — due`),
        `pad=${pad}: unfolding did not restore the summary`,
      );
    }
  });

  it("the .ics escapes text and recurs at the right interval", () => {
    const rows = [
      {
        itemId: "test.item",
        dueDate: d("2026-09-30"),
        dueISO: "2026-09-30",
        intervalMonths: 12,
        warnDays: 60,
        reason: "Because; of, a\\ reason",
        item: { id: "test.item", label: "Semi; colon, and\\ backslash", note: "line one\nline two" },
      },
    ];
    const { ics } = buildIcs(rows, { stamp: new Date(Date.UTC(2026, 0, 1)) });
    const unfolded = ics.replace(/\r\n /g, "");

    // `;` and `,` are RFC 5545 STRUCTURED separators. Unescaped, a comma in a
    // label makes the parser read the rest of the SUMMARY as a second value and
    // the event title is silently truncated.
    assert.match(unfolded, /SUMMARY:Semi\\; colon\\, and\\\\ backslash — due\r/);
    assert.match(unfolded, /line one\\nline two/, "a newline was not escaped to \\n");
    assert.doesNotMatch(unfolded.replace(/\\[;,\\n]/g, ""), /^SUMMARY:[^\r]*[;,]/m, "an unescaped separator survived");

    assert.match(ics, /RRULE:FREQ=YEARLY/);
    assert.match(ics, /TRIGGER:-P60D/, "the alarm does not match the page's warn window");

    const monthly = buildIcs([{ ...rows[0], intervalMonths: 1 }], { stamp: new Date(Date.UTC(2026, 0, 1)) }).ics;
    assert.match(monthly, /RRULE:FREQ=MONTHLY\r/);
    const quarterly = buildIcs([{ ...rows[0], intervalMonths: 3 }], { stamp: new Date(Date.UTC(2026, 0, 1)) }).ics;
    assert.match(quarterly, /RRULE:FREQ=MONTHLY;INTERVAL=3/);

    // Alarms are opt-out, and opting out must remove the whole VALARM block
    // rather than leave an empty one.
    const silent = buildIcs(rows, { stamp: new Date(Date.UTC(2026, 0, 1)), alarms: false }).ics;
    assert.doesNotMatch(silent, /VALARM/);
  });

  it("undated rows are skipped and COUNTED, never quietly dropped", () => {
    /**
     * Exporting 14 of 31 items in silence reads as "it's all on your calendar
     * now", which is the one impression this feature must not create. The count
     * is what the UI puts in the snackbar, so it is part of the contract.
     */
    const rows = [
      { itemId: "a", dueDate: d("2026-09-30"), intervalMonths: 12, warnDays: 60, item: { label: "A" } },
      { itemId: "b", dueDate: null, status: "needs-anchor", item: { label: "B" } },
      { itemId: "c", dueDate: null, status: "unscheduled", item: { label: "C" } },
    ];
    const r = buildIcs(rows, { stamp: new Date(Date.UTC(2026, 0, 1)) });
    assert.equal(r.exported, 1);
    assert.equal(r.skipped, 2);
    assert.doesNotMatch(r.ics, /SUMMARY:B/, "an undated row was exported anyway");

    // Nothing at all is still a valid, empty calendar rather than a crash.
    const empty = buildIcs([], {});
    assert.equal(empty.exported, 0);
    assert.match(empty.ics, /^BEGIN:VCALENDAR\r\n[\s\S]*END:VCALENDAR\r\n$/);
    assert.equal(buildIcs(null, {}).exported, 0);
    assert.equal(buildSchedule(null, {}).length, 0);
    assert.equal(summarizeSchedule(null).total, 0);
  });

  it("the tool stores nothing of its own", () => {
    /**
     * The Due Dates tool reads the `checklist` and `points` stores and must never
     * open a third. A `due:` key of its own would immediately disagree with the
     * two screens it derives from, and "which of these is right about my PHA" is
     * a worse problem than not having the page.
     */
    const src = readFileSync(join(ROOT, "src/components/tools/DueDatesTool.vue"), "utf8");
    const keys = [...src.matchAll(/useLocalStore\("([a-z]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(keys, ["checklist", "points"], "DueDatesTool opened an unexpected store");
    // And it must not do date math locally — that is what makes lib/due.js
    // testable at all, and a component is not testable in this project.
    assert.doesNotMatch(src, /setMonth|setDate|getTime\(\)|86400000/, "date arithmetic leaked into the component");
  });
});

describe("go shortcuts", () => {
  /**
   * The /go redirector turns an address-bar query into a navigation, which makes
   * it the one feature here that can send someone to the WRONG `.mil` host. So
   * these tests care much less about "does nsips resolve" than about the two ways
   * this breaks badly:
   *
   *   1. A miss that guesses. `unknown` must stay unknown — a scorer-style
   *      near-match would forward a browser somewhere plausible and wrong.
   *   2. A portal that gets treated as direct. NSIPS ESR resolves to the NSIPS
   *      portal, so a regression collapsing `handoff` into `external` looks
   *      perfect in a browser and silently drops the "select ESR" step that is
   *      the only reason the user could find the page.
   */
  const table = bangTable();

  it("every bang names a real system and resolves to a real target", () => {
    // BANG_ENTRIES is built at import; a bad system id throws before this runs.
    assert.ok(BANG_ENTRIES.length >= 1, "no bangs are registered");
    for (const e of BANG_ENTRIES) {
      assert.ok(SYSTEM_BY_ID.has(e.system), `bang target "${e.system}" is not a system`);
      assert.equal(e.url, systemUrl(e.system), `bang "${e.system}" disagrees with the registry`);
      assert.ok(e.keys.length, `bang "${e.system}" has no keys`);
      for (const k of e.keys) {
        assert.equal(k, normalizeKey(k), `key "${k}" is not in normalized form`);
      }
    }
  });

  it("holds no literal URL of its own", () => {
    // Same rule as quicklinks.js: addresses live in systems.js and nowhere else.
    // A bang table with its own copy of an address is the copy that goes stale,
    // and a stale redirect is worse than a missing one because it looks like it
    // worked.
    const src = readFileSync(join(ROOT, "src/data/bangs.js"), "utf8");
    assert.doesNotMatch(src, /https?:\/\//, "bangs.js has a literal URL — addresses belong in systems.js");
  });

  it("resolves the registered shortcut to the real NSIPS address", () => {
    const r = resolveBang("nsips");
    assert.equal(r.kind, "external");
    assert.equal(r.url, systemUrl("nsips"));
    // Pinned to the host, not just to the registry, so that a systems.js edit
    // that breaks NSIPS fails HERE with a legible message rather than only in
    // the registry's own suite.
    assert.match(r.url, /^https:\/\/www\.nsips\.cloud\.navy\.mil\//);
  });

  it("only a direct system is allowed to auto-redirect", () => {
    /**
     * The invariant, stated over the whole registry rather than over the one
     * bang that exists today: whatever the table grows to, `external` implies
     * `reach === "direct"`. Written this way because the failure it guards
     * against arrives with a future data edit, not with a code change — adding
     * `{ keys: ["esr"], system: "nsips-esr" }` must not start forwarding people
     * into a portal launch page with no instruction.
     */
    for (const s of SYSTEMS) {
      const fake = [{ keys: ["x"], system: s.id, name: s.name, full: s.full ?? null,
        desc: s.desc, reach: s.reach, url: systemUrl(s.id), via: viaLabel(s.id),
        then: s.then ?? null, access: s.access, cac: s.cac, note: null }];
      const r = resolveBang("x", fake);
      if (s.reach === "direct") {
        assert.equal(r.kind, "external", `direct system "${s.id}" should redirect`);
        assert.ok(r.url, `direct system "${s.id}" redirected with no url`);
      } else {
        assert.equal(r.kind, "handoff", `${s.reach} system "${s.id}" must not auto-redirect`);
      }
    }
  });

  it("hands off a portal system with the click that follows it", () => {
    const esr = SYSTEM_BY_ID.get("nsips-esr");
    const fake = [{ keys: ["esr"], system: "nsips-esr", name: esr.name, full: esr.full,
      desc: esr.desc, reach: esr.reach, url: systemUrl("nsips-esr"), via: viaLabel("nsips-esr"),
      then: esr.then, access: esr.access, cac: esr.cac, note: null }];
    const r = resolveBang("esr", fake);
    assert.equal(r.kind, "handoff");
    // The url still resolves (it's the portal) — which is exactly why `kind`
    // alone is the thing under test. A handoff carrying a usable url is correct;
    // a redirect to that same url is not.
    assert.equal(r.url, systemUrl("nsips"));
    assert.match(r.then ?? "", /ESR/, "the portal's follow-up click was dropped");
    assert.match(r.via ?? "", /NSIPS/);
  });

  it("admits a miss instead of guessing a target", () => {
    for (const miss of ["xyzzy", "capital of france", "nsipsx", "zz", "!!!", "   "]) {
      const r = resolveBang(miss);
      assert.equal(r.kind, "unknown", `"${miss}" should not resolve to anything`);
      assert.ok(!("url" in r), `"${miss}" produced a redirect target`);
    }
  });

  it("matches on identity, not on spelling", () => {
    // "NSIPS", "nsips ", "N.S.I.P.S." are one request. Punctuation and case fall
    // out in normalization, which is what lets a user type the way they talk.
    for (const spelling of ["NSIPS", " nsips ", "N.S.I.P.S.", "Nsips", "ns ips"]) {
      assert.equal(resolveBang(spelling).kind, "external", `"${spelling}" did not resolve`);
    }
  });

  it("resolves a prefix, but never over an exact match", () => {
    /**
     * Prefix matching is a convenience ("go nsi") and a hazard: without the
     * exact-match pass, a table containing both "at" and "atlas" would make the
     * fully-typed "at" ambiguous, so the more precisely a user typed the worse
     * the result would get. Tested with a synthetic pair because the real table
     * has one entry and cannot exhibit it.
     */
    const fake = [
      { keys: ["at"], system: "a", name: "A", reach: "direct", url: "https://a.example/", keysOnly: 1 },
      { keys: ["atlas"], system: "b", name: "B", reach: "direct", url: "https://b.example/" },
    ];
    assert.equal(resolveBang("at", fake).system, "a", "an exact key lost to a longer one");
    assert.equal(resolveBang("atl", fake).system, "b", "a unique prefix did not resolve");
    const amb = resolveBang("a", fake);
    assert.equal(amb.kind, "ambiguous", "a shared prefix should ask, not pick");
    assert.equal(amb.candidates.length, 2);
  });

  it("reads the query from every shape a browser might send", () => {
    /**
     * Browsers disagree about where `%s` goes, and the person who set the
     * shortcut up will not debug it. `?q=` is what Chrome's "Add search engine"
     * produces; the bare and hash forms come from `…/go/?%s` and `…/go/#%s`,
     * which are both things people register.
     */
    const cases = [
      [{ search: "?q=nsips" }, "nsips"],
      [{ search: "?query=nsips" }, "nsips"],
      [{ search: "?nsips" }, "nsips"],
      [{ hash: "#nsips" }, "nsips"],
      [{ search: "?q=my+drill+points" }, "my drill points"],
      [{ search: "?q=my%20drill%20points" }, "my drill points"],
      [{ hash: "#my+drill+points" }, "my drill points"],
      [{ search: "", hash: "" }, ""],
      [{}, ""],
      // A real search string that happens to contain "=" must not be mistaken
      // for a key/value pair and silently dropped.
      [{ search: "?q=a%3Db" }, "a=b"],
    ];
    for (const [loc, expect] of cases) {
      assert.equal(queryFromLocation(loc), expect, `parsing ${JSON.stringify(loc)}`);
    }
  });

  it("the inlined copy on the static page resolves exactly like the module", () => {
    /**
     * go/index.html cannot import an ES module — it has to carry the resolver as
     * classic script text, and that copy is the one users actually hit. This
     * evaluates the extracted source in a bare Function scope and re-runs every
     * case above through it, so a drift between the tested resolver and the
     * shipped one fails here.
     *
     * Extraction is by brace balance over named declarations, which is why
     * `normalizeKey` is a function and not an arrow, and why
     * `queryFromLocation` reads its argument's properties instead of
     * destructuring in the signature. Both were arrows/destructured first and
     * both produced a page that parsed and silently misbehaved.
     */
    const source = readFileSync(join(ROOT, "src/lib/bangs.js"), "utf8");
    const inlined = extractResolver(source);
    const make = new Function(`${inlined}\nreturn { normalizeKey, queryFromLocation, resolveBang };`);
    const copy = make();

    for (const q of ["nsips", "NSIPS", "N.S.I.P.S.", "xyzzy", "ns", "", "nsipsx", "capital of france"]) {
      assert.deepEqual(
        copy.resolveBang(q, table),
        resolveBang(q, table.map((t) => ({ ...t }))),
        `inlined resolver disagrees on "${q}"`,
      );
    }
    for (const loc of [{ search: "?q=nsips" }, { search: "?nsips" }, { hash: "#nsips" }, {}]) {
      assert.equal(copy.queryFromLocation(loc), queryFromLocation(loc));
    }
  });

  it("the emitted page redirects from an inline script and pulls in nothing else", () => {
    /**
     * The point of a hand-written page is that it beats the app to the redirect.
     * If it ever grows a <script src>, a module import, or a stylesheet request,
     * it has stopped being that and nobody would notice from the behaviour —
     * it would just be slower.
     */
    const html = renderGoPage(table, extractResolver(readFileSync(join(ROOT, "src/lib/bangs.js"), "utf8")));
    assert.doesNotMatch(html, /<script[^>]*\ssrc=/i, "the go page loads an external script");
    assert.doesNotMatch(html, /<link[^>]*rel=["']?stylesheet/i, "the go page loads a stylesheet");
    assert.doesNotMatch(html, /\bimport\s|\bfrom\s+["']/, "the go page imports a module");
    // The table has to be present as data, not merely referenced.
    assert.match(html, /"nsips"/, "the bang table was not inlined");
    assert.match(html, /nsips\.cloud\.navy\.mil/, "the target url was not inlined");
    // Small enough to be free. The whole justification for not using the router
    // is weight, so the weight is asserted.
    assert.ok(html.length < 12000, `go page is ${html.length} bytes — it was meant to be tiny`);
  });

  it("the emitted page actually navigates, per query shape", () => {
    /**
     * RUN, don't grep. The first version of this asserted that the HTML
     * *contained* `location.replace` and `../#/go`, and both survived sabotage:
     * deleting the real redirect left the string in the fallback branch, and
     * deleting the fallback left `../#/go` in the noscript <a href>. Two checks
     * that could not fail, guarding the two things most worth guarding.
     *
     * So the page's script is executed here with a fake `location`, and what it
     * asks for is compared against where it should go. `location.replace` and
     * not `assign`, too — the redirector must not sit in history between the
     * address bar and the destination, or Back bounces forward again.
     */
    const html = renderGoPage(table, extractResolver(readFileSync(join(ROOT, "src/lib/bangs.js"), "utf8")));
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    assert.ok(script, "the go page has no inline script at all");

    /** Run the page's script against a stub location; return what it navigated to. */
    const navigate = (loc) => {
      const calls = [];
      const fake = {
        ...loc,
        search: loc.search ?? "",
        hash: loc.hash ?? "",
        replace: (u) => calls.push(["replace", u]),
        assign: (u) => calls.push(["assign", u]),
      };
      new Function("location", script)(fake);
      assert.equal(calls.length, 1, `expected exactly one navigation, got ${calls.length}`);
      assert.equal(calls[0][0], "replace", "the redirector used assign() and will poison the Back button");
      return calls[0][1];
    };

    const nsips = systemUrl("nsips");
    assert.equal(navigate({ search: "?q=nsips" }), nsips, "?q= form did not reach NSIPS");
    assert.equal(navigate({ search: "?nsips" }), nsips, "bare ? form did not reach NSIPS");
    assert.equal(navigate({ hash: "#nsips" }), nsips, "# form did not reach NSIPS");

    // A miss must land in the app WITH the query intact, so the view can offer it
    // to the assistant. Dropping the query is the quiet version of this failure.
    assert.equal(navigate({ search: "?q=xyzzy" }), "../#/go?q=xyzzy");
    assert.equal(navigate({ search: "?q=good%20year" }), "../#/go?q=good%20year");
    // No query at all: the setup page, not a redirect to nowhere.
    assert.equal(navigate({}), "../#/go");
  });

  it("the shortcut is documented where a user can find it", () => {
    // A redirector nobody knows how to register is dead code. The view carries
    // the setup steps, so this asserts the docs exist rather than that they are
    // beautiful: the `%s` placeholder, and the browser that needs the caveat.
    const view = readFileSync(join(ROOT, "src/views/GoView.vue"), "utf8");
    assert.match(view, /%s/, "the search URL template is not shown");
    assert.match(view, /Firefox/, "Firefox setup is undocumented");
    assert.match(view, /Safari/, "Safari's lack of keyword search is not mentioned");
    const router = readFileSync(join(ROOT, "src/router.js"), "utf8");
    assert.match(router, /name: "go"/, "no /go route is registered for the page to hand off to");
  });
});

/* ------------------------------------------------------------------ *
 * 12. Static reference pages
 * ------------------------------------------------------------------ */

/**
 * These tests exist because the static pages are a SECOND implementation of
 * TopicSection.vue. That duplication is unavoidable — a Vue template cannot run
 * in Node without dragging Vuetify through SSR — so instead of pretending
 * otherwise, it is made detectable from two directions:
 *
 *  1. A section `kind` with no entry in SECTION_RENDERERS throws at build time.
 *     Adding a kind to TopicSection.vue and forgetting this file fails the build
 *     instead of quietly emitting a page missing a whole section.
 *  2. Every string in the data must appear on the page it belongs to, with a
 *     named exemption for each field that is deliberately not printed. A renderer
 *     that drops rows, or a table that loses a column, fails — which is what
 *     makes "the static page says the same thing as the app" a test rather than a
 *     claim.
 *
 * The rest is agreement between copies that cannot be deduplicated because the
 * specs demand absolute URLs: canonical, og:url, JSON-LD @id, sitemap <loc>.
 */

const LASTMOD = "2026-01-01";
const RENDERED = renderAll({ lastmod: LASTMOD });
const PAGE_BY_NAME = new Map(RENDERED.map((p) => [p.fileName, p.source]));
const HTML_PAGES = RENDERED.filter((p) => p.fileName.endsWith(".html"));

/** The page's text as a reader sees it: no markup, no entities, one space. */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every string leaf of a data object, with a stable dotted path. */
function* leafStrings(value, path = "") {
  if (typeof value === "string") {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (const v of value) yield* leafStrings(v, `${path}[]`);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* leafStrings(v, path ? `${path}.${k}` : k);
  }
}

/**
 * Fields whose text is deliberately NOT printed on the static page, each with the
 * reason. A path not listed here and not on the page is a dropped fact.
 *
 * A trailing `.*` exempts a subtree. Every entry is asserted to still match
 * something, so a field that gets renamed or deleted surfaces as a stale
 * exemption rather than silently widening the hole.
 */
const NOT_PRINTED = new Map([
  ["id", "the section anchor — emitted as id=\"sec-…\", not as text"],
  ["kind", "selects the renderer"],
  ["keywords[]", "search index only; corpus.js weights them 2.5x and printing them would be keyword stuffing"],
  ["refs[]", "directive ids, resolved to their labels by refs()"],
  ["systems[]", "system ids, resolved to names and URLs by systemLinks()"],
  ["cadence", "consumed by lib/due.js as the due-date reason line; TopicSection does not print it either"],
  ["columns[].key", "the row property name, not a caption"],
  ["map.label", "the map SVG's aria-label, and these pages do not draw the map"],
  ["rows[].id", "stable key for persistence and citations"],
  ["rows[].group", "resolved to the group label, which IS printed"],
  ["rows[].refs[]", "directive ids, resolved by refs()"],
  ["rows[].keywords[]", "search index only"],
  ["rows[].systems[]", "system ids, resolved to names and URLs by systemLinks()"],
  ["rows[].devices[]", "device ids; the rack builder resolves them, the reference table does not"],
  ["rows[].howto", "id of the how-to section the checklist tool links to"],
  ["rows[].library", "resolved to a human name by libraryName()"],
  ["rows[].parent", "resolved to \"article of RESPERSMAN\""],
  ["rows[].url", "emitted as the href, not as text"],
  ["rows[].reach", "selects how the row is reached (web/phone/CAC), not a label"],
  ["rows[].due.*", "consumed by lib/due.js; the static page is not a deadline calculator"],
  ["rows.id", "the service id in a ranks section"],
  ["rows.sourcePdf", "linked as a download, not printed"],
  ["rows.warrantNote", "printed ONLY where the app prints it — see the dedicated test below"],
  ["rows.enlisted[].variants[]", "alternate titles for search; neither view prints them"],
]);

function isExempt(path) {
  if (NOT_PRINTED.has(path)) return true;
  for (const key of NOT_PRINTED.keys()) {
    if (key.endsWith(".*") && path.startsWith(key.slice(0, -1))) return true;
  }
  return false;
}

/**
 * Every field path the data actually has, collected once at load rather than as a
 * side effect of the coverage test below.
 *
 * This started out as a Set the coverage test filled in as it walked, which made
 * the stale-exemption test pass only when it ran second — invisible under `npm
 * test` and a false failure the moment sabotage ran that test on its own. A test
 * whose result depends on another test having run is not a check.
 */
const DATA_PATHS = new Set(
  ALL_TOPICS.flatMap((t) =>
    (t.sections ?? []).flatMap((s) => [...leafStrings(s)].map(([path]) => path)),
  ),
);

/** Contrast ratio, so the palette claims are recomputed rather than trusted. */
function contrast(a, b) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("static reference pages", () => {
  it("every section kind in the data has a renderer, and no renderer is dead", () => {
    const inData = [...new Set(ALL_TOPICS.flatMap((t) => (t.sections ?? []).map((s) => s.kind)))].sort();
    // Both directions on purpose. A kind with no renderer throws the build; a
    // renderer with no kind is dead code that will rot untested, and the only
    // moment anyone would notice is now.
    assert.deepEqual(
      inData.filter((k) => !RENDERABLE_KINDS.includes(k)),
      [],
      "these section kinds exist in the data with no renderer in tools/prerender.mjs",
    );
    assert.deepEqual(
      RENDERABLE_KINDS.filter((k) => !inData.includes(k)),
      [],
      "these renderers in tools/prerender.mjs are no longer used by any section",
    );
  });

  it("an unknown section kind throws, naming the section and the file to fix", () => {
    // The failure mode this prevents: a renderer keyed off an object lookup that
    // returns undefined, `?? ""`-ed into a page that then indexes as thin
    // content. A build failure is the only outcome that gets noticed.
    assert.throws(
      () => renderSection({ id: "x", heading: "X", kind: "sparklines", rows: [] }, { prefix: "" }),
      (err) => {
        assert.match(err.message, /sparklines/);
        assert.match(err.message, /"x"/);
        assert.match(err.message, /prerender\.mjs/);
        return true;
      },
    );
  });

  it("emits one page per topic, plus the hub and the sitemap", () => {
    assert.deepEqual(
      RENDERED.map((p) => p.fileName),
      [
        "knowledge/index.html",
        ...ALL_TOPICS.map((t) => pagePathFor(t.id)),
        "sitemap.xml",
      ],
      "the emitted set drifted from the topic registry",
    );
    assert.equal(new Set(RENDERED.map((p) => p.fileName)).size, RENDERED.length, "duplicate fileName");
  });

  it("every string in the data reaches the page it belongs to", () => {
    const dropped = [];
    for (const topic of ALL_TOPICS) {
      const text = visibleText(PAGE_BY_NAME.get(pagePathFor(topic.id)));
      for (const section of topic.sections ?? []) {
        for (const [path, raw] of leafStrings(section)) {
          const value = raw.replace(/\s+/g, " ").trim();
          if (!value || isExempt(path)) continue;
          if (!text.includes(value)) {
            dropped.push(`${topic.id}#${section.id} (${section.kind}) ${path}: ${JSON.stringify(value.slice(0, 60))}`);
          }
        }
      }
    }
    assert.deepEqual(
      dropped,
      [],
      "the static page does not say what the app says — either fix the renderer or add a named exemption to NOT_PRINTED",
    );
  });

  it("no exemption in NOT_PRINTED is stale", () => {
    // Without this, a data refactor that renames `rows[].url` leaves an
    // exemption matching nothing, and the next field to go missing is covered by
    // an entry that was written about something else entirely.
    const matches = (key) =>
      key.endsWith(".*")
        ? [...DATA_PATHS].some((p) => p.startsWith(key.slice(0, -1)))
        : DATA_PATHS.has(key);
    assert.deepEqual(
      [...NOT_PRINTED.keys()].filter((k) => !matches(k)),
      [],
      "these exemptions no longer match any field — delete them",
    );
  });

  it("every id exempted as \"resolved by a lookup\" actually resolved on the page", () => {
    // The exemptions above are the load-bearing part of the coverage test, and
    // half of them say some variant of "not printed, because it is resolved to
    // something that IS printed". That claim needs proving: an exemption for
    // `systems[]` whose renderer silently emitted nothing would read as covered
    // and be the largest hole in the file.
    for (const topic of ALL_TOPICS) {
      const page = visibleText(PAGE_BY_NAME.get(pagePathFor(topic.id)));
      for (const section of topic.sections ?? []) {
        const rows = Array.isArray(section.rows) ? section.rows : [];

        const systemIds = [...new Set([...(section.systems ?? []), ...rows.flatMap((r) => r?.systems ?? [])])];
        for (const sys of systemsFor(systemIds)) {
          assert.ok(
            page.includes(sys.name),
            `${topic.id}#${section.id} cites the ${sys.id} system and the page never names it`,
          );
        }

        const refIds = [...new Set([...(section.refs ?? []), ...rows.flatMap((r) => r?.refs ?? [])])];
        for (const d of directivesFor(refIds)) {
          assert.ok(
            page.includes(display(d)),
            `${topic.id}#${section.id} cites ${d.id} and the page never names it`,
          );
        }

        for (const d of rows.filter((r) => r?.library)) {
          assert.ok(
            page.includes(libraryName(d)),
            `${topic.id}#${section.id}: ${d.id} says where to find it and the page does not`,
          );
        }
      }
    }
  });

  it("the warrant note is withheld exactly where the app withholds it", () => {
    // TopicSection.vue renders warrantNote only when the service has no warrant
    // tier: `v-if="!rows.warrant?.length && rows.warrantNote"`. The Coast Guard
    // has W-2 through W-4 AND a note explaining the missing W-1/W-5, so a
    // renderer that just prints the note whenever it exists diverges on exactly
    // one of six services — the kind of gap nobody finds by looking.
    const page = visibleText(PAGE_BY_NAME.get(pagePathFor("ranks")));
    const withNote = TOPIC_BY_ID.get("ranks").sections.filter((s) => s.rows?.warrantNote);
    assert.ok(withNote.length >= 3, "no service carries a warrantNote — this test stopped testing anything");
    for (const s of withNote) {
      const hasWarrantTier = Boolean(s.rows.warrant?.length);
      assert.equal(
        page.includes(s.rows.warrantNote),
        !hasWarrantTier,
        `${s.id}: warrantNote should be ${hasWarrantTier ? "withheld (the service HAS warrant grades)" : "printed"}`,
      );
    }
  });

  it("nothing renders as undefined, NaN, or [object Object]", () => {
    for (const { fileName, source } of HTML_PAGES) {
      for (const tell of ["undefined", "NaN", "[object Object]", "null"]) {
        assert.ok(
          !visibleText(source).includes(tell),
          `${fileName} prints "${tell}" — a field the renderer read that the data does not have`,
        );
      }
    }
  });

  it("every ampersand in the markup is a real entity", () => {
    // "Awards & Precedence" reaching the markup as a bare `&` is the single most
    // likely escaping defect here, and it is invisible in a browser.
    //
    // Script content is excluded because the rule inverts there — see the next
    // test. Getting THAT backwards is the more interesting mistake, so it is
    // asserted rather than left to this exclusion to imply.
    for (const { fileName, source } of RENDERED) {
      const markup = source.replace(/<script[\s\S]*?<\/script>/g, "");
      const bad = markup.match(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,8}|#\d{1,6}|#x[0-9a-fA-F]{1,6});)/g);
      assert.equal(bad, null, `${fileName} contains a raw & outside an entity`);
    }
  });

  it("the JSON-LD is NOT entity-escaped, and cannot break out of its script", () => {
    // A `<script>` element's content is raw text, not markup. Escaping the JSON
    // means Google reads the literal characters "&amp;" as part of the name —
    // which is exactly the fix someone would apply after reading the test above.
    //
    // The other side of raw text: the only sequence that ends the element is
    // `</script`, so a `</` anywhere in the payload is the one real injection
    // route. The data is ours, which is why nobody would think to check.
    for (const { fileName, source } of HTML_PAGES) {
      const payload = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(source)[1];
      assert.doesNotMatch(payload, /&(?:amp|lt|gt|quot|#\d+);/, `${fileName} has entity-escaped JSON-LD`);
      assert.doesNotMatch(payload, /<\//, `${fileName} JSON-LD can terminate its own script element`);
      // And the escaping really is being exercised: at least one page must carry
      // a character the markup has to escape, or this test is vacuous.
      JSON.parse(payload);
    }
    const escaped = HTML_PAGES.filter(({ source }) => source.includes("&amp;"));
    assert.ok(escaped.length >= 3, "no page contains an escaped & any more — reread both of these tests");
  });

  it("one h1 per page, and headings never skip a level", () => {
    for (const { fileName, source } of HTML_PAGES) {
      const levels = [...source.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
      assert.equal(levels.filter((l) => l === 1).length, 1, `${fileName} does not have exactly one <h1>`);
      assert.equal(levels[0], 1, `${fileName} opens with an h${levels[0]}`);
      for (let i = 1; i < levels.length; i++) {
        assert.ok(
          levels[i] <= levels[i - 1] + 1,
          `${fileName} jumps from h${levels[i - 1]} to h${levels[i]}`,
        );
      }
    }
  });

  it("canonical, og:url, and the JSON-LD @id all name one origin and one URL", () => {
    // Five specs, five absolute URLs, no way to deduplicate them. A canonical
    // pointing at the wrong URL is the most expensive mistake available here: it
    // explicitly instructs Google to index something else instead.
    let seen = 0;
    for (const { fileName, source } of HTML_PAGES) {
      const expected = canonicalFor(fileName);
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(source);
      const ogUrl = /<meta property="og:url" content="([^"]+)"/.exec(source);
      assert.ok(canonical && ogUrl, `${fileName} is missing a canonical or an og:url`);
      assert.equal(canonical[1], expected, `${fileName} canonical`);
      assert.equal(ogUrl[1], expected, `${fileName} og:url`);

      const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(source)[1]);
      const nodes = ld["@graph"] ?? [ld];
      assert.equal(nodes[0]["@id"], expected, `${fileName} JSON-LD @id`);
      assert.equal(nodes[0].url, expected, `${fileName} JSON-LD url`);
      assert.equal(nodes[0].dateModified, LASTMOD, `${fileName} JSON-LD dateModified`);

      for (const url of source.match(/https?:\/\/[^"'\s<)]*pollywog[^"'\s<)]*/g) ?? []) {
        assert.ok(url.startsWith(ORIGIN), `${fileName} references ${url}, which is not ${ORIGIN}`);
        seen++;
      }
    }
    // Rot guard, in the shape the sibling homepage uses: a rename that made the
    // pattern match nothing would otherwise make this test pass by finding zero.
    assert.ok(seen > 40, `only ${seen} absolute URLs found — the pattern has stopped matching`);
  });

  it("relative prefixes match the depth of the page they sit on", () => {
    // These pages are two directories deep and the app's base is `./`, so every
    // path is relative and the count of `../` is load-bearing. Get it wrong and
    // the page still renders — with a broken favicon, missing insignia sprites,
    // and a sibling nav that 404s.
    for (const { fileName, source } of HTML_PAGES) {
      const prefix = prefixFor(fileName);
      assert.equal(prefix, "../".repeat(fileName.split("/").length - 1), `${fileName} prefix`);
      const refs = [
        ...[...source.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
        ...[...source.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]),
      ];
      for (const ref of refs) {
        if (/^(?:https?:|tel:|mailto:|data:|#)/.test(ref)) continue;
        assert.ok(ref.startsWith(prefix), `${fileName} references "${ref}", which is not relative to its own depth`);
        assert.ok(
          !ref.slice(prefix.length).includes("../"),
          `${fileName} references "${ref}" — a stray ../ past the site root`,
        );
      }
      // Both insigniaStyle and spriteStyle return url(./img/…), which resolves
      // against the DOCUMENT, so leaving one unrewritten means every sprite on a
      // nested page 404s while the page itself looks fine.
      assert.ok(!/url\(\.\//.test(source), `${fileName} has an unrewritten url(./ …) — see styleAttr()`);
    }
  });

  it("every local reference resolves to something that exists", () => {
    const generated = new Set(RENDERED.map((p) => p.fileName));
    for (const { fileName, source } of HTML_PAGES) {
      const prefix = prefixFor(fileName);
      const ids = new Set([...source.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
      const refs = [
        ...[...source.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
        ...[...source.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]),
      ];
      for (const ref of refs) {
        if (/^(?:tel:|mailto:)/.test(ref)) continue;
        if (/^https?:/.test(ref)) {
          assert.ok(ref.startsWith("https://"), `${fileName} links ${ref} over plain http`);
          continue;
        }
        if (ref.startsWith("#")) {
          assert.ok(ids.has(ref.slice(1)), `${fileName} links ${ref}, and no element has that id`);
          continue;
        }
        let rest = ref.slice(prefix.length).split("#")[0].split("?")[0];
        if (rest === "") continue; // the app root — index.html, emitted by vite
        if (rest.endsWith("/")) rest += "index.html";
        assert.ok(
          generated.has(rest) || existsSync(join(ROOT, "public", rest)),
          `${fileName} references "${ref}" — neither generated nor present in public/`,
        );
      }
    }
  });

  it("the only script on these pages is structured data", () => {
    // The whole point of a static copy is that it paints from one request with no
    // JS. Something "harmless" added here also means the page can now break.
    for (const { fileName, source } of HTML_PAGES) {
      for (const tag of source.match(/<script[^>]*>/g) ?? []) {
        assert.equal(tag, '<script type="application/ld+json">', `${fileName} carries ${tag}`);
      }
      assert.ok(!/\son[a-z]+="/.test(source), `${fileName} has an inline event handler`);
    }
  });

  it("the breadcrumb is ordered and every JSON-LD @id is unique", () => {
    for (const { fileName, source } of HTML_PAGES) {
      const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(source)[1]);
      const nodes = ld["@graph"] ?? [ld];
      const ids = nodes.map((n) => n["@id"]).filter(Boolean);
      assert.equal(new Set(ids).size, ids.length, `${fileName} repeats an @id`);
      const crumbs = nodes.find((n) => n["@type"] === "BreadcrumbList");
      if (!crumbs) continue;
      const positions = crumbs.itemListElement.map((i) => i.position);
      assert.deepEqual(positions, [1, 2, 3], `${fileName} breadcrumb positions`);
      // The last crumb carries no `item` — it is the page you are already on, and
      // giving it a self-link is how a breadcrumb trail ends up with a loop.
      assert.equal(crumbs.itemListElement.at(-1).item, undefined, `${fileName} last crumb self-links`);
    }
  });

  it("the hub reaches every card and every card reaches the hub", () => {
    // This is the entire crawl path. The app's own nav is rendered by JavaScript,
    // so a crawler arriving at the origin root gets into this content through
    // knowledge/ and nowhere else.
    const hub = PAGE_BY_NAME.get("knowledge/index.html");
    for (const topic of ALL_TOPICS) {
      const href = `${prefixFor("knowledge/index.html")}${pagePathFor(topic.id).replace(/index\.html$/, "")}`;
      assert.ok(hub.includes(`href="${href}"`), `the hub does not link ${topic.id} (expected ${href})`);
      const page = PAGE_BY_NAME.get(pagePathFor(topic.id));
      assert.ok(
        page.includes(`href="${prefixFor(pagePathFor(topic.id))}knowledge/"`),
        `${topic.id} does not link back to the hub`,
      );
    }
  });

  it("every page carries the disclaimer and offers the interactive version", () => {
    for (const { fileName, source } of HTML_PAGES) {
      const text = visibleText(source);
      assert.match(text, /Unofficial\./, `${fileName} does not say it is unofficial`);
      assert.match(text, /not a system of record|Nothing here is a system of record/i, `${fileName}`);
      assert.match(text, /1-833-330-MNCC/, `${fileName} does not offer MNCC`);
    }
    for (const topic of ALL_TOPICS) {
      const page = PAGE_BY_NAME.get(pagePathFor(topic.id));
      const href = `${prefixFor(pagePathFor(topic.id))}${hashRouteFor(topic.id)}`;
      assert.ok(page.includes(`href="${href}"`), `${topic.id} does not link its own route (expected ${href})`);
    }
  });

  it("the hash route each page advertises is a route the router has", () => {
    // A static page whose "Open the interactive version" button lands on the
    // catch-all redirect is worse than no button: it looks like the app lost the
    // page the crawler just indexed.
    const router = readFileSync(join(ROOT, "src/router.js"), "utf8");
    assert.match(router, /path: "\/knowledge"/, "the /knowledge index route the hub advertises is gone");
    assert.ok(
      PAGE_BY_NAME.get("knowledge/index.html").includes(
        `href="${prefixFor("knowledge/index.html")}#/knowledge"`,
      ),
      "the hub does not offer the interactive version of itself",
    );
    for (const topic of ALL_TOPICS) {
      const route = hashRouteFor(topic.id).slice(1);
      if (route.startsWith("/knowledge/")) {
        assert.match(router, /path: "\/knowledge\/:topicId"/, "the /knowledge/:topicId route is gone");
        assert.ok(TOPIC_BY_ID.get(topic.id), `${topic.id} is not in the registry the route resolves against`);
      } else {
        assert.ok(
          router.includes(`path: "${route}"`),
          `${topic.id} advertises ${route}, which the router does not declare`,
        );
      }
    }
  });

  it("titles and descriptions are written to survive a result list", () => {
    for (const { fileName, source } of HTML_PAGES) {
      const title = /<title>([^<]*)<\/title>/.exec(source)[1];
      const desc = /name="description" content="([^"]*)"/.exec(source)[1];
      assert.ok(title.length >= 20 && title.length <= 65, `${fileName} title is ${title.length} chars`);
      assert.match(title, / — SALTDOG$/, `${fileName} title does not end with the brand`);
      assert.ok(desc.length >= 60 && desc.length <= 165, `${fileName} description is ${desc.length} chars`);
      assert.match(
        source,
        /<meta name="robots" content="index, follow/,
        `${fileName} is not asking to be indexed — which is the whole point of the file`,
      );
    }
  });

  it("the static stylesheet's palette still matches the Vuetify themes", () => {
    // The app's theme is CSS-in-JS and these pages are hand-written CSS. The only
    // place the two are ever seen together is a user following a search result
    // into the app, which is the least likely place to notice they have drifted.
    const src = readFileSync(join(ROOT, "tools/prerender.mjs"), "utf8");
    const style = src.slice(src.indexOf("const STYLE"), src.indexOf("const DISCLAIMER"));
    const theme = readFileSync(join(ROOT, "src/plugins/vuetify.js"), "utf8");
    const tokensOf = (name) => {
      const body = new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\};`).exec(theme);
      assert.ok(body, `${name} is no longer an object literal in vuetify.js — reread this test`);
      return Object.fromEntries(
        [...body[0].matchAll(/"?([\w-]+)"?:\s*"(#[0-9A-Fa-f]{6})"/g)].map((m) => [m[1], m[2].toUpperCase()]),
      );
    };
    const dark = tokensOf("saltDark");
    const light = tokensOf("saltLight");
    const blocks = style.split("prefers-color-scheme: light");
    const varOf = (block, name) => {
      const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block);
      assert.ok(m, `--${name} is missing from the stylesheet`);
      return m[1].toUpperCase();
    };
    for (const [scheme, block, tokens, goldToken] of [
      ["dark", blocks[0], dark, "primary"],
      ["light", blocks[1], light, "secondary"],
    ]) {
      assert.equal(varOf(block, "bg"), tokens.background, `${scheme} --bg`);
      assert.equal(varOf(block, "surface"), tokens.surface, `${scheme} --surface`);
      assert.equal(varOf(block, "line"), tokens["border-color"], `${scheme} --line`);
      assert.equal(varOf(block, "text"), tokens["on-background"], `${scheme} --text`);
      assert.equal(varOf(block, "dim"), tokens["on-surface-variant"], `${scheme} --dim`);
      assert.equal(varOf(block, "gold"), tokens[goldToken], `${scheme} --gold`);

      // Recomputed rather than trusted. The bright gold #C8A951 is 2.27:1 on
      // white, which is exactly how a navy-and-gold theme goes non-compliant, and
      // "just use the same gold in both themes" is the obvious simplification
      // that would break the light one.
      const gold = varOf(block, "gold");
      const bg = varOf(block, "bg");
      const onGold = varOf(block, "on-gold");
      assert.ok(contrast(gold, bg) >= 4.5, `${scheme}: gold ${gold} on ${bg} is ${contrast(gold, bg).toFixed(2)}:1`);
      assert.ok(
        contrast(onGold, gold) >= 4.5,
        `${scheme}: button label ${onGold} on ${gold} is ${contrast(onGold, gold).toFixed(2)}:1`,
      );
      assert.ok(contrast(varOf(block, "dim"), bg) >= 4.5, `${scheme}: dim text fails on the background`);
    }
    assert.notEqual(varOf(blocks[0], "gold"), varOf(blocks[1], "gold"), "both themes now share one gold");
  });

  it("the sitemap lists exactly the pages emitted, and nothing outside /saltdog/", () => {
    const xml = PAGE_BY_NAME.get("sitemap.xml");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(
      locs,
      [
        `${ORIGIN}${BASE_PATH}`,
        `${ORIGIN}${BASE_PATH}knowledge/`,
        ...ALL_TOPICS.map((t) => canonicalFor(pagePathFor(t.id))),
      ],
      "the sitemap drifted from the emitted pages",
    );
    // A sitemap may only list URLs at or below its own path; one that reaches
    // outside is ignored for those URLs, silently.
    for (const loc of locs) {
      assert.ok(loc.startsWith(`${ORIGIN}${BASE_PATH}`), `${loc} is outside the sitemap's own path`);
    }
    assert.equal(new Set(locs).size, locs.length, "the sitemap repeats a URL");
    for (const mod of [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1])) {
      assert.equal(mod, LASTMOD, "lastmod is not the date it was built with");
    }
    assert.ok(!/<changefreq>|<priority>/.test(xml), "changefreq and priority are ignored by Google");
  });

  it("renderAll refuses a lastmod it cannot vouch for", () => {
    // Google reads <lastmod> only while it stays honest. A build that silently
    // wrote "undefined" or a US-format date into every entry would teach it to
    // stop reading this file at all.
    for (const bad of [undefined, null, "", "2026-1-1", "01/01/2026", "2026-01-01T00:00:00Z", "today"]) {
      assert.throws(() => renderAll({ lastmod: bad }), /lastmod must be YYYY-MM-DD/, `accepted ${bad}`);
    }
    assert.doesNotThrow(() => renderAll({ lastmod: "2026-01-01" }));
  });

  it("the pages are declared to the sibling homepage's crawl entry points", () => {
    // The reference pages exist to be found, and nothing at the origin root
    // points at them unless these two lines are there. Both live in homepage/,
    // which deploys from a different repository — so the coupling is exactly the
    // kind that rots without a test naming it.
    const hp = join(ROOT, "homepage");
    if (!existsSync(hp)) return;
    const robots = readFileSync(join(hp, "robots.txt"), "utf8");
    assert.ok(
      robots.includes(`Sitemap: ${ORIGIN}${BASE_PATH}sitemap.xml`),
      "homepage/robots.txt does not name the app's own sitemap",
    );
    // Relative, not absolute: every path in homepage/index.html is relative by
    // that folder's own rule, and its check.mjs enforces it. So the link a
    // crawler follows is `saltdog/knowledge/` from the origin root.
    const index = readFileSync(join(hp, "index.html"), "utf8");
    const relative = `${BASE_PATH.slice(1)}knowledge/`; // "/saltdog/" -> "saltdog/knowledge/"
    assert.ok(
      index.includes(`href="${relative}"`),
      `homepage/index.html does not link ${relative}, so nothing at the origin root reaches these pages`,
    );
  });
});

/**
 * Offline retrieval. No API, no network, no model — keyword scoring over the
 * local corpus, which is why it works on an air-gapped network and why the UI
 * says "not an AI" out loud.
 *
 * Pipeline: normalize -> phrase aliases -> tokenize -> token aliases -> score.
 */
import {
  PHRASE_ALIASES,
  STARTER_QUESTIONS,
  STOPWORDS,
  TOKEN_ALIASES,
} from "../data/aliases.js";

/** Answer threshold. Scores are normalized 0..1, so this is corpus-independent. */
export const ANSWER_THRESHOLD = 0.28;

/** If the runner-up is this close to the winner, ask instead of guessing. */
export const AMBIGUITY_RATIO = 0.85;

const FIELD_WEIGHTS = { heading: 3.0, keywords: 2.5, body: 1.0 };

export const normalize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Strip a trailing plural so "CBTs" and "CBT" are the same term.
 *
 * Deliberately crude — no Porter stemmer. It only removes a final "s"/"es" from
 * words long enough that the result is still meaningful, and never from words
 * ending in "ss" ("class") or containing a digit ("e5s" isn't a word). A real
 * stemmer would also fold "training"/"train", which over-merges on a corpus
 * this small.
 */
function singular(t) {
  if (t.length < 4 || /\d/.test(t) || t.endsWith("ss") || t.endsWith("us")) return null;
  if (t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s")) return t.slice(0, -1);
  return null;
}

/**
 * Tokenize, emitting the joined form, the split parts, AND the singular of an
 * alphanumeric run, so all of these reach the same tokens:
 *
 *   "PRIMS-2" / "PRIMS2" / "PRIMS 2"   -> prims, 2, prims2
 *   "E-8" / "E8" / "e 8"               -> e, 8, e8
 *   "CBTs" / "CBT"                     -> cbts, cbt
 *
 * Single-character parts are KEPT when the run mixes letters and digits. That
 * is the whole paygrade case — dropping them is why "E8" could never match a
 * chart that prints "E-8", despite w/e/o being held out of the stopword list.
 */
export function tokenize(text) {
  const out = [];
  const push = (t) => {
    if (t && !STOPWORDS.has(t)) out.push(t);
  };

  for (const raw of normalize(text).split(/[^a-z0-9]+/)) {
    if (!raw || STOPWORDS.has(raw)) continue;
    push(raw);

    const parts = raw.match(/[a-z]+|[0-9]+/g);
    if (parts && parts.length > 1) {
      // Both directions: the split parts, and the punctuation-free join.
      for (const p of parts) push(p);
      push(parts.join(""));
    }

    push(singular(raw));
  }
  return [...new Set(out)];
}

/**
 * Weight of an alias-derived term relative to a term the user actually typed.
 *
 * Aliases are supporting evidence, not equal evidence. This matters twice: it
 * keeps a ten-way synonym fan-out from outvoting the user's own words, and —
 * because `selfScore` uses the same weights — it stops that fan-out from
 * inflating the normalizer and deflating every score in the corpus. Before this
 * was weighted, "how do I see my OMPF" peaked at 0.175 and fell below the
 * answer threshold purely because `ompf` expanded into six extra terms.
 */
const ALIAS_WEIGHT = 0.4;

/**
 * Expand a raw query into scoring terms.
 *
 * `core` holds only the user's own tokens — coverage is measured against those,
 * so a big alias fan-out can't inflate the apparent match quality.
 * `weights` maps every term to its evidence weight (1 for typed, 0.4 for alias).
 *
 * `groups` is one entry per WORD THE USER TYPED, holding that word's token
 * variants. Coverage must be measured per group, not per token: "covers"
 * tokenizes to both `covers` and `cover`, so counting tokens made one typed
 * word look like two requirements and permanently capped coverage at 50% for
 * any query containing a plural. That alone pushed several correct top-ranked
 * answers below the threshold.
 */
export function expandQuery(raw) {
  let s = String(raw ?? "");
  for (const [re, sub] of PHRASE_ALIASES) {
    s = s.replace(re, (m) => `${m} ${sub}`);
  }

  // One group per typed word, each holding that word's token variants.
  const groups = [];
  for (const word of normalize(raw).split(/[^a-z0-9]+/)) {
    if (!word || STOPWORDS.has(word)) continue;
    const variants = tokenize(word);
    if (variants.length) groups.push(new Set(variants));
  }

  const coreTokens = groups.flatMap((g) => [...g]);
  const expandedTokens = tokenize(s);
  const extra = [];

  for (const t of expandedTokens) {
    const alias = TOKEN_ALIASES[t];
    if (!alias) continue;
    if (Array.isArray(alias)) {
      extra.push(...alias);
    } else if (alias.caseSensitive) {
      // Only fire when the user actually typed it in caps — keeps the
      // preposition "at" from becoming Annual Training.
      if (new RegExp(`\\b${t.toUpperCase()}\\b`).test(String(raw))) {
        extra.push(...alias.terms);
      }
    } else if (Array.isArray(alias.terms)) {
      extra.push(...alias.terms);
    }
  }

  const core = new Set(coreTokens);
  const toks = [...new Set([...expandedTokens, ...extra])];

  const weights = new Map();
  for (const t of toks) weights.set(t, core.has(t) ? 1 : ALIAS_WEIGHT);

  return { toks, core, groups, weights, phrase: normalize(raw) };
}

/**
 * Best achievable score for this query, used to normalize so the threshold is
 * independent of corpus size.
 *
 * The reference record matches every term in the body and in ONE strong field,
 * not in all three at once. Assuming all three is unreachable in practice and
 * pushes every real score toward zero, which is how a normalized threshold
 * silently becomes unsatisfiable.
 *
 * CRITICAL: words the user typed that the corpus has never seen must still
 * count toward the normalizer. Skipping them — the obvious reading of "sum the
 * idf of the query terms" — means a question normalizes as though the unknown
 * words were never typed. That is exactly how "recommend a good science fiction
 * novel" scored 0.845 against the good-year card: `recommend`, `science`,
 * `fiction` and `novel` were invisible, so matching `good` alone looked like a
 * perfect match. An unmatchable term contributes to the denominator and never
 * to the numerator, which is the honest encoding of "this site doesn't cover
 * what you asked".
 */
function selfScore(q, idf, oovIdf) {
  const perField = FIELD_WEIGHTS.body + FIELD_WEIGHTS.heading;
  let s = 0;

  // Typed words: once per WORD, using its best-scoring variant. Summing every
  // variant would charge a plural twice in the denominator.
  for (const g of q.groups ?? []) {
    let best = 0;
    let known = false;
    for (const t of g) {
      const w = idf[t];
      if (w !== undefined) {
        known = true;
        if (w > best) best = w;
      }
    }
    s += (known ? best : oovIdf) * perField;
  }

  // Alias terms, at their reduced weight.
  for (const t of q.toks) {
    if (q.core.has(t)) continue;
    s += (idf[t] || 0) * perField * ALIAS_WEIGHT;
  }

  return s || 1;
}

/**
 * Nominal idf for a term absent from the corpus, cached per corpus object.
 * An unseen term is maximally rare, so it takes the largest idf present.
 */
function oovIdfFor(corpus) {
  if (corpus.__oovIdf === undefined) {
    let max = 0;
    for (const v of Object.values(corpus.idf)) if (v > max) max = v;
    Object.defineProperty(corpus, "__oovIdf", { value: max || 1, enumerable: false });
  }
  return corpus.__oovIdf;
}

export function scoreRecord(rec, q, idf, self) {
  let s = 0;
  const hitTokens = new Set();

  for (const t of q.toks) {
    const w = idf[t] || 0;
    if (!w) continue;

    let sub = 0;
    const tf = rec.tf[t] || 0;
    if (tf) sub += FIELD_WEIGHTS.body * (1 + Math.log(tf));
    if (rec.headTokens.has(t)) sub += FIELD_WEIGHTS.heading;
    if (rec.keyTokens.has(t)) sub += FIELD_WEIGHTS.keywords;

    if (sub > 0) {
      s += sub * w * (q.weights?.get(t) ?? 1);
      hitTokens.add(t);
    }
  }

  if (s === 0) return 0;

  // Exact phrase present in the section text is a strong signal ("good year").
  if (q.phrase.length > 6 && rec.normText.includes(q.phrase)) s *= 1.6;

  // Coverage, counted PER TYPED WORD: a word counts as covered if any of its
  // variants matched. Matching one rare term out of six shouldn't beat four.
  const groups = q.groups ?? [];
  let covered = 0;
  for (const g of groups) {
    for (const t of g) {
      if (hitTokens.has(t)) {
        covered++;
        break;
      }
    }
  }
  const coverage = groups.length ? covered / groups.length : 1;
  s *= 0.4 + 0.6 * coverage;

  return s / self;
}

/**
 * Rank the corpus against a question.
 * @returns {{kind:'answer'|'ambiguous'|'unknown', ...}}
 */
export function ask(question, corpus) {
  const text = String(question ?? "").trim();
  if (!text) return { kind: "unknown", reason: "empty", suggestions: STARTER_QUESTIONS };

  const q = expandQuery(text);
  if (q.toks.length === 0) {
    return { kind: "unknown", reason: "no-terms", suggestions: STARTER_QUESTIONS };
  }

  const self = selfScore(q, corpus.idf, oovIdfFor(corpus));
  const ranked = corpus.records
    .map((rec) => ({ rec, score: scoreRecord(rec, q, corpus.idf, self) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < ANSWER_THRESHOLD) {
    return { kind: "unknown", reason: "below-threshold", suggestions: STARTER_QUESTIONS };
  }

  // Raw scores can exceed 1: the exact-phrase bonus is per-record while the
  // normalizer is query-level, so a record containing the whole phrase
  // legitimately beats the reference. Ranking uses the raw score; anything
  // user-facing gets the clamped value, because "105% confident" is nonsense.
  const confidence = Math.min(1, best.score);

  // Ambiguity is only worth asking about ACROSS topics. Two sections of the
  // same page ("Letters" vs "Numerals" on the phonetic card) tie constantly,
  // and asking the user to choose between two halves of one page they're about
  // to see anyway is a non-choice that just adds a click.
  const second = ranked.find((x) => x.rec.topicId !== best.rec.topicId);
  if (second && second.score > best.score * AMBIGUITY_RATIO) {
    const options = [];
    const topics = new Set();
    for (const { rec } of ranked) {
      if (topics.has(rec.topicId)) continue;
      topics.add(rec.topicId);
      options.push(rec);
      if (options.length === 3) break;
    }
    return { kind: "ambiguous", options, confidence };
  }

  return {
    kind: "answer",
    record: best.rec,
    confidence,
    related: ranked.slice(1, 4).map((x) => x.rec),
  };
}

/** Plain ranked list, for the site-wide search box. */
export function search(question, corpus, limit = 10) {
  const q = expandQuery(question);
  if (!q.toks.length) return [];
  const self = selfScore(q, corpus.idf, oovIdfFor(corpus));
  return corpus.records
    .map((rec) => ({ rec, score: scoreRecord(rec, q, corpus.idf, self) }))
    .filter((x) => x.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

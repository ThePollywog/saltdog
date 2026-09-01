/**
 * Derives the flat search index from the topic registry.
 *
 * One record per SECTION, not per topic, because a citation has to land on an
 * anchor the user can actually see.
 *
 * `text` is DERIVED by flattening the section's own rows — it is never retyped.
 * That is the no-duplication guarantee: the chat answer renders the same
 * `section` object the knowledge page renders, so the two cannot drift.
 */
import { ALL_TOPICS, topicHomeLabel, topicRoute } from "../data/index.js";
import { directiveText, directivesFor } from "../data/directives.js";
import { tokenize } from "./retrieval.js";

/**
 * Column-driven rows to text. Shared by the `table` and `map` kinds — a map
 * section can carry a table, and it has to be searchable the same way.
 */
function flattenTable(section) {
  return (section.rows ?? [])
    .map((row) =>
      (section.columns ?? Object.keys(row).map((key) => ({ key })))
        .map((c) => row[c.key])
        .filter(Boolean)
        .join(" "),
    )
    .join(" \n ");
}

/** Collapse a section's rows into one searchable string, by kind. */
function flatten(section) {
  const rows = section.rows ?? [];
  switch (section.kind) {
    case "links":
      return rows.map((l) => `${l.name} ${l.desc} ${l.access}`).join(" \n ");

    case "checklist":
      return rows.map((i) => `${i.label} ${i.note ?? ""}`).join(" \n ");

    // Both are an array of plain strings. Shared arm rather than two identical
    // ones, and NOT left to the `default` — that stringifies, which would put
    // JSON's quotes and commas into the indexed text.
    case "steps":
    case "verbatim":
      return rows.join(" \n ");

    case "kv":
      return rows.map((x) => `${x.k} ${x.v}`).join(" \n ");

    case "code-cards":
      return rows.map((c) => `${c.code} ${c.title} ${c.bullets.join(" ")}`).join(" \n ");

    case "eval-schedule":
      return rows
        .map((m) => {
          const o = m.officer.length ? m.officer.join(" ") : "no officer reports";
          const e = m.enlisted.length ? m.enlisted.join(" ") : "no enlisted reports";
          return `${m.month} ${o} ${e}`;
        })
        .join(" \n ");

    case "phonetic":
      return rows.map((p) => `${p.letter} ${p.word}`).join(" ");

    case "ranks": {
      const s = rows; // a service object, not an array
      const tiers = [...(s.enlisted ?? []), ...(s.warrant ?? []), ...(s.officer ?? [])];
      return [
        s.name,
        s.short,
        tiers.map((x) => `${x.grade} ${x.title} ${x.abbr}`).join(" "),
        (s.warrant?.length ? "" : s.warrantNote) ?? "",
        s.seniorEnlisted ?? "",
        s.wartime ?? "",
      ]
        .filter(Boolean)
        .join(" \n ");
    }

    case "awards":
      return rows
        .map((x) => `${x.precedence} ${x.title} ${x.abbr ?? ""} ${x.groupLabel}`)
        .join(" \n ");

    // A map section's searchable text is its marker labels, not its geometry:
    // place names are what someone types ("which fleet covers Bahrain"), and the
    // path data is 46 KB of digits that would swamp every term frequency in the
    // corpus. Its table, if it has one, flattens as usual.
    //
    // `map.label` — the aria-label — is deliberately NOT indexed. It has to
    // describe the whole map in prose for a screen reader, which means restating
    // what each region covers, which made the map section outrank the actual
    // AOR table for "what does INDOPACOM cover". The table is the better answer
    // to that question: it has the HQ, the fleet, and the AOR in fields. An
    // accessible description should not double as search bait.
    case "map": {
      const m = section.map ?? {};
      const marks = [...(m.pins ?? []), ...(m.zones ?? [])].map((p) => p.label);
      return [
        m.caption ?? "",
        (m.regions === "all" ? [] : (m.regions ?? [])).join(" "),
        marks.join(" "),
        flattenTable(section),
      ]
        .filter(Boolean)
        .join(" \n ");
    }

    case "directives":
      return rows.map((d) => directiveText(d)).join(" \n ");

    case "table":
      return flattenTable(section);

    default:
      return typeof rows === "string" ? rows : JSON.stringify(rows);
  }
}

/**
 * The instruction text a section is entitled to be found by.
 *
 * Every `refs` on the section plus every `refs` on its rows, resolved through
 * data/directives.js and flattened. This is what makes "which instruction covers
 * AT waivers" reach the AT checklist item AND the RESPERSMAN 1571-010 entry, from
 * one data field.
 *
 * It is folded into the BODY, not into `keywords`, and that placement is the
 * whole design. Keywords carry a 2.5x field weight, so citing an instruction from
 * six places would make those six sections outrank the directive's own entry for
 * its own series number — the citation would bury the thing it cites. At body
 * weight the directives topic still wins "BUPERSINST 1610.10" (the label is in its
 * heading, keywords and body) while the citing sections stay findable.
 */
function citedText(section) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const ids = [...(section.refs ?? []), ...rows.flatMap((r) => r?.refs ?? [])];
  if (!ids.length) return "";
  // Deduped: the same authority cited by eight rows should not get eight times
  // the term frequency of one cited by a single row.
  return directivesFor([...new Set(ids)])
    .map((d) => directiveText(d))
    .join(" \n ");
}

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

/** Term-frequency map for an array of tokens. */
function termFreq(tokens) {
  const tf = Object.create(null);
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

let cached = null;

/**
 * Build (and memoize) the corpus. Pure over the data modules, so the test
 * harness can call it directly in Node with no DOM.
 */
export function buildCorpus() {
  if (cached) return cached;

  const records = [];
  for (const topic of ALL_TOPICS) {
    for (const section of topic.sections ?? []) {
      const text = flatten(section);
      const keywords = [...(topic.keywords ?? []), ...(section.keywords ?? [])];
      // `text` is what gets RENDERED-equivalent flattening; citations are indexed
      // but deliberately not part of `normText`, which the exact-phrase bonus
      // reads — a phrase hit on a shared citation string would fire on every
      // section citing the same instruction.
      const bodyTokens = tokenize(`${text} ${keywords.join(" ")} ${citedText(section)}`);

      records.push({
        id: `${topic.id}#${section.id}`,
        topicId: topic.id,
        topicTitle: topic.title,
        topicEyebrow: topic.eyebrow,
        sectionId: section.id,
        heading: section.heading,
        keywords,
        text,
        normText: norm(text),
        sourcePdf: topic.sourcePdf,
        note: topic.note ?? null,
        toolRoute: topic.toolRoute ?? null,
        toolLabel: topic.toolLabel ?? null,
        route: topicRoute(topic.id, section.id),
        // What the answer card calls that destination. Derived here rather than
        // branched on the topic id in the template, which was already wrong for
        // any topic that is neither Knowledge nor Quick Links.
        homeLabel: topicHomeLabel(topic.id),
        section,
        tf: termFreq(bodyTokens),
        headTokens: new Set(tokenize(`${section.heading} ${topic.title}`)),
        keyTokens: new Set(tokenize(keywords.join(" "))),
      });
    }
  }

  // Inverse document frequency, smoothed.
  const N = records.length;
  const df = Object.create(null);
  for (const rec of records) {
    const seen = new Set([
      ...Object.keys(rec.tf),
      ...rec.headTokens,
      ...rec.keyTokens,
    ]);
    for (const t of seen) df[t] = (df[t] || 0) + 1;
  }
  const idf = Object.create(null);
  for (const [t, n] of Object.entries(df)) {
    idf[t] = Math.log(1 + (N - n + 0.5) / (n + 0.5));
  }

  cached = { records, idf, size: N };
  return cached;
}

/** Test hook — drop the memo so a modified data module is picked up. */
export function resetCorpus() {
  cached = null;
}

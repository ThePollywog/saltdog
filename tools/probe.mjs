/**
 * Scoring probe — not a test. `node tools/probe.mjs "some question"`
 * Prints the expanded query terms and the top-scoring records with their
 * component scores, so retrieval can be tuned by evidence instead of guesswork.
 */
import { buildCorpus } from "../src/lib/corpus.js";
import { ANSWER_THRESHOLD, ask, expandQuery } from "../src/lib/retrieval.js";
import { search } from "../src/lib/retrieval.js";

const corpus = buildCorpus();
const queries = process.argv.slice(2);

for (const q of queries) {
  const e = expandQuery(q);
  const res = ask(q, corpus);
  console.log(`\n=== ${JSON.stringify(q)}`);
  console.log(`core:     ${[...e.core].join(" ")}`);
  console.log(`expanded: ${e.toks.join(" ")}`);
  console.log(`idf=0 (unknown to corpus): ${e.toks.filter((t) => !corpus.idf[t]).join(" ") || "none"}`);
  console.log(`outcome:  ${res.kind}${res.confidence ? ` (${res.confidence.toFixed(3)}, threshold ${ANSWER_THRESHOLD})` : ""}`);
  for (const { rec, score } of search(q, corpus, 6)) {
    console.log(`  ${score.toFixed(3)}  ${rec.id.padEnd(42)} ${rec.heading}`);
  }
}

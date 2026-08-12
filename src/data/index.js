/**
 * Topic registry — the spine of routing, rendering, and the search corpus.
 *
 * Adding a knowledge topic means adding one data module and one line here.
 * No new components, no new routes.
 *
 * A topic module default-exports `{ id, title, eyebrow, blurb, sourcePdf,
 * keywords, sections[] }` plus three optional fields: `note` (the caveat alert),
 * `toolRoute`/`toolLabel` (the interactive version of the same material), and
 * `systems` — ids from data/systems.js for the applications this topic is about,
 * rendered as a link row under the header. Omit `systems` when there is nothing
 * to log into: the phonetic alphabet and the fleet list are reference, not tasks,
 * and a button there would have to point somewhere invented.
 */
import quicklinks from "./quicklinks.js";
import checklist from "./checklist.js";
import evalCalendar from "./evalCalendar.js";
import ranks from "./ranks.js";
import cocoms from "./cocoms.js";
import fleets from "./fleets.js";
import jointCodes from "./jointCodes.js";
import phonetic from "./phonetic.js";
import awards from "./awards.js";
import doctrine from "./doctrine.js";
import directives from "./directives.js";

/**
 * Knowledge topics, in the order they appear in nav and on the index page.
 *
 * Directives is last on purpose. It is the topic people arrive at from a
 * citation chip rather than by browsing, and putting the authorities above the
 * material they authorize would front-load the driest page on the site.
 *
 * Doctrine sits next to ranks, because the two answer the same kind of question —
 * things you are expected to have memorized rather than things you look up — and
 * keeping them together leaves the three organizational topics (COCOMs, fleets,
 * J-codes) as one unbroken run.
 */
export const TOPICS = [
  checklist,
  evalCalendar,
  ranks,
  doctrine,
  cocoms,
  fleets,
  jointCodes,
  phonetic,
  awards,
  directives,
];

/** Quick links is a topic for search/citation purposes but has its own view. */
export const QUICKLINKS_TOPIC = quicklinks;

/** Everything the search corpus indexes. */
export const ALL_TOPICS = [quicklinks, ...TOPICS];

export const TOPIC_BY_ID = new Map(ALL_TOPICS.map((t) => [t.id, t]));

export function getTopic(id) {
  return TOPIC_BY_ID.get(id) ?? null;
}

/** Route for a topic — quick links lives at its own path. */
export function topicRoute(topicId, sectionId) {
  const query = sectionId ? { a: sectionId } : undefined;
  if (topicId === "quicklinks") return { name: "quicklinks", query };
  return { name: "knowledge", params: { topicId }, query };
}

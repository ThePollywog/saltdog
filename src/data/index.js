/**
 * Topic registry — the spine of routing, rendering, and the search corpus.
 *
 * Adding a knowledge topic means adding one data module and one line here.
 * No new components, no new routes.
 *
 * A topic module default-exports `{ id, title, eyebrow, blurb, sourcePdf,
 * keywords, sections[] }` plus three optional fields: `note` (the caveat alert),
 * `systems` — ids from data/systems.js for the applications this topic is about,
 * rendered as a link row under the header — and `home`/`homeLabel`, for a topic
 * that is indexed for search but rendered somewhere other than a knowledge page.
 *
 * There is no longer a `toolRoute`/`toolLabel` pair. It meant "the same material
 * also exists as a tool", and every topic that could say that has since moved to
 * the tool outright — the field described a duplication rather than a feature.
 * Omit `systems` when there is nothing to log into: the phonetic alphabet and the
 * fleet list are reference, not tasks, and a button there would have to point
 * somewhere invented.
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
import uniform from "./uniform.js";
import doctrine from "./doctrine.js";
import directives from "./directives.js";
import prt from "./prt.js";

/**
 * Knowledge topics, in the order they appear in nav and on the index page.
 *
 * What is left here is the material with nothing to interact with: things you
 * read, not things you compute. Every topic that had a tool doing the same job
 * moved to TOOL_TOPICS below, because two URLs for one body of facts is a
 * maintenance burden that buys no second audience.
 *
 * Doctrine leads: it is the "things you are expected to have memorized" topic,
 * and it reads as an introduction to the three organizational topics (COCOMs,
 * fleets, J-codes) that follow it as one unbroken run.
 *
 * Directives is last on purpose. It is the topic people arrive at from a
 * citation chip rather than by browsing, and putting the authorities above the
 * material they authorize would front-load the driest page on the site.
 */
export const TOPICS = [
  doctrine,
  cocoms,
  fleets,
  jointCodes,
  directives,
];

/** Quick links is a topic for search/citation purposes but has its own view. */
export const QUICKLINKS_TOPIC = quicklinks;

/**
 * Topics rendered by a tool rather than by a knowledge page.
 *
 * The test for membership is not "does a tool exist" but "does the tool already
 * show all of this". Awards was the first: precedence, the wear rules and the
 * device legend are things you want in front of you WHILE building a rack, not
 * on a separate page you have to hold in your head, and the calculator renders
 * every one of its sections — so a knowledge page was the same material at a
 * second URL. Uniform lands on the same tool for the same reason.
 *
 * The other four followed once their tools rendered every section they own:
 * the checklist's how-to procedures, the eval calendar's coverage caveats, the
 * six rank charts behind the explorer's selector, and the speller's two tables.
 * Each of those was a knowledge page whose entire content the tool already
 * duplicated or has since absorbed.
 *
 * They are indexed and citable exactly like a knowledge topic; the only
 * difference is `home`, which sends every route and citation to the tool.
 */
export const TOOL_TOPICS = [checklist, evalCalendar, ranks, phonetic, awards, uniform, prt];

/**
 * Topics that get a page of their own — the nav, the knowledge index, and the
 * static pages tools/prerender.mjs emits.
 *
 * Distinct from ALL_TOPICS because a tool topic must be searched but must NOT
 * be given a second home; generating a page for one would put the calculator's
 * own content at a URL the app never links to.
 */
export const PAGE_TOPICS = [quicklinks, ...TOPICS];

/** Everything the search corpus indexes. */
export const ALL_TOPICS = [...PAGE_TOPICS, ...TOOL_TOPICS];

export const TOPIC_BY_ID = new Map(ALL_TOPICS.map((t) => [t.id, t]));

export function getTopic(id) {
  return TOPIC_BY_ID.get(id) ?? null;
}

/**
 * Route for a topic.
 *
 * `home` is a data field rather than a chain of id checks here, because the
 * list of topics that live somewhere other than /knowledge/:id only grows —
 * quick links has its own view, awards is rendered by the ribbon rack
 * calculator, and the next one will be neither.
 */
export function topicRoute(topicId, sectionId) {
  const query = sectionId ? { a: sectionId } : undefined;
  const home = TOPIC_BY_ID.get(topicId)?.home;
  return home ? { ...home, query } : { name: "knowledge", params: { topicId }, query };
}

/** What to call a topic's home in a link — "Open in ___". */
export function topicHomeLabel(topicId) {
  return TOPIC_BY_ID.get(topicId)?.homeLabel ?? "Knowledge";
}

/**
 * Browser-search shortcuts ("bangs") for the /go redirector.
 *
 * Register SALTDOG as a search engine with the keyword `go`, and typing
 * "go nsips" in the address bar lands you on NSIPS. See lib/bangs.js for how a
 * query resolves and tools/go-page.mjs for the static page that does it.
 *
 * KEYWORDS MAP TO SYSTEM IDS, NEVER TO URLS. data/systems.js is the one place a
 * Navy address is written down, and verify-corpus already asserts that
 * quicklinks.js contains no literal `http` for the same reason: these hosts
 * change (DTS and NSIPS both moved during this project), and the second copy of
 * an address is the one that goes stale. A bang resolves through `systemUrl()`
 * at build time, so a registry edit reaches the redirector for free.
 *
 * DELIBERATELY ONE ENTRY. This is the trial run of the whole mechanism, and one
 * keyword is enough to prove it: the omnibox hand-off, the query-shape parsing,
 * the static page, the hand-back into the app. Adding the other thirty systems
 * is a data edit against machinery that will have been tested, which is the
 * cheap half. Doing it now would mean debugging thirty redirects at once and not
 * knowing whether a miss was the table or the plumbing.
 *
 * Nothing is auto-derived from the registry, either. Deriving keywords from
 * system ids would have quietly registered all thirty-five systems on the first
 * commit — the opposite of starting small — and it would mint shortcuts nobody
 * chose, like `mhs-genesis` or `nmci-help`. Every bang here is opted in by hand.
 */

/**
 * @typedef {object} Bang
 * @property {string[]} keys    what the user types after the search keyword.
 *                              Normalized by lib/bangs.js, so case and
 *                              punctuation don't matter here.
 * @property {string} system    id from data/systems.js
 * @property {string} [note]    shown in the shortcut list on the /go page
 */

/** @type {Bang[]} */
export const BANGS = [
  {
    keys: ["nsips"],
    system: "nsips",
    note: "Service record, training, pay and leave. CAC required.",
  },
];

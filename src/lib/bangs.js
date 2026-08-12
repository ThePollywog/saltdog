/**
 * Resolve a browser-search query into a redirect target.
 *
 * Pure functions, no DOM and no Vue: the static /go page inlines the compiled
 * table and calls `resolveBang`, the in-app /go route calls the same function,
 * and node:test exercises it directly. One resolver, so the page a user lands on
 * cannot disagree with the redirect that sent them there.
 *
 * WHY THIS IS A LOOKUP AND NOT THE RETRIEVER. The site already has a scorer
 * (lib/retrieval.js) that would happily rank "nsips" against 47 section records,
 * and using it here would be wrong twice over. It would pull the search chunk
 * into a page whose entire job is to redirect before Vue boots — vite.config.js
 * works to defer that chunk — and more importantly, a TF-IDF score of 0.31 vs
 * 0.29 is not an acceptable way to decide which `.mil` host somebody's browser
 * opens. A table lookup either matches or says it didn't. Where it doesn't
 * match, the query is handed to the retriever inside the app, which is the right
 * tool for a question and the wrong one for a destination.
 *
 * FOUR OUTCOMES, AND ONLY ONE OF THEM REDIRECTS:
 *
 *   external   `reach: "direct"` — the url IS the application. Go there.
 *   handoff    portal / phone / offline. There is either nothing to open, or
 *              nothing that lands you where you asked for. Show a card instead.
 *   ambiguous  the query prefix-matched more than one bang. Ask.
 *   unknown    no match. Say so; don't guess a plausible `.mil` address.
 *
 * `handoff` is the outcome most likely to look like a missing feature, so: a
 * `portal` system such as `nsips-esr` resolves through `systemUrl()` to the
 * NSIPS portal, and redirecting there would feel instant and leave the user
 * hunting a launch page for a link named "ESR". The `then` field in the registry
 * exists precisely because landing on the portal is only half the trip, and an
 * instruction cannot be shown to someone you have already navigated away from.
 * `phone` doesn't auto-dial: a `tel:` from an address bar is startling and, on a
 * phone, not obviously recoverable. `offline` has no URL by definition.
 */
import { BANGS } from "../data/bangs.js";
import { SYSTEM_BY_ID, systemUrl, viaLabel } from "../data/systems.js";

/**
 * Fold a raw query to a match key.
 *
 * Punctuation goes because "PRIMS-2" and "prims2" are the same request, and
 * internal whitespace collapses to nothing so "my pay" can key `mypay`. This is
 * the same instinct as the retrieval tokenizer's joined-acronym form, kept
 * separate on purpose: that one serves scoring, this one serves identity, and
 * coupling them would mean a tokenizer tweak silently re-pointing a redirect.
 */
export function normalizeKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Pull the query out of a URL, accepting every shape a browser might produce.
 *
 * Browsers disagree about where `%s` belongs in a registered search URL, and the
 * user who set it up is not going to debug it, so all three are read:
 *
 *   ?q=nsips   the documented form, and what Chrome's "Add search engine" makes
 *   ?nsips     a bare search string, if someone registers `…/go/?%s`
 *   #nsips     hash form, if someone registers `…/go/#%s`
 *
 * The bare and hash forms are decoded manually rather than through
 * URLSearchParams: `new URLSearchParams("nsips").get(...)` has no key to ask
 * for, and a "+" in a hash is a literal plus, not a space.
 */
export function queryFromLocation(loc) {
  // Read off the object rather than destructured in the signature: this function
  // is extracted verbatim into the /go page as classic script text, and a
  // destructured default in the parameter list defeats the brace-balance slicer
  // that does the extracting. Plain property reads cost nothing and stay
  // sliceable. See tools/go-page.mjs.
  const s = String(loc?.search ?? "").replace(/^\?/, "");
  const h = String(loc?.hash ?? "").replace(/^#/, "");

  if (s) {
    const params = new URLSearchParams(s);
    for (const key of ["q", "query", "s"]) {
      const v = params.get(key);
      if (v) return v.trim();
    }
    // No recognized key. A bare `?nsips` arrives as a valueless param, so it is
    // the whole string with `+` treated as a space, the way a query string does.
    if (!s.includes("=")) return decodeURIComponent(s.replace(/\+/g, " ")).trim();
  }

  if (h) return decodeURIComponent(h.replace(/\+/g, " ")).trim();
  return "";
}

/**
 * Compile the bang table into match entries.
 *
 * Resolved eagerly so a bang naming a system that does not exist throws at
 * import — during the build, in the test run — rather than rendering a redirect
 * page whose one button goes nowhere.
 */
function compile() {
  return BANGS.map((bang) => {
    const sys = SYSTEM_BY_ID.get(bang.system);
    if (!sys) throw new Error(`bang [${bang.keys.join(", ")}] references unknown system "${bang.system}"`);

    const keys = bang.keys.map(normalizeKey).filter(Boolean);
    if (!keys.length) throw new Error(`bang for system "${bang.system}" has no usable keys`);

    return {
      keys,
      system: sys.id,
      name: sys.name,
      full: sys.full ?? null,
      desc: sys.desc,
      note: bang.note ?? null,
      reach: sys.reach,
      url: systemUrl(sys.id),
      via: viaLabel(sys.id),
      then: sys.then ?? null,
      access: sys.access,
      cac: sys.cac,
    };
  });
}

export const BANG_ENTRIES = compile();

/** Every registered keyword, for the shortcut list and for the tests. */
export const BANG_KEYS = BANG_ENTRIES.flatMap((e) => e.keys).sort();

/** The shape the static page inlines. Kept small — it ships in the HTML. */
export function bangTable() {
  return BANG_ENTRIES.map((e) => ({
    keys: e.keys,
    system: e.system,
    name: e.name,
    reach: e.reach,
    url: e.url,
  }));
}

/**
 * What should happen for this query?
 *
 * @param {string} raw           what the user typed after the search keyword
 * @param {object[]} [entries]   compiled table; overridable for tests
 * @returns {{kind: "external"|"handoff"|"ambiguous"|"unknown", ...}}
 */
export function resolveBang(raw, entries = BANG_ENTRIES) {
  const query = String(raw ?? "").trim();
  const key = normalizeKey(query);
  if (!key) return { kind: "unknown", query, reason: "empty" };

  // Exact first. A prefix search alone would let a longer key shadow a shorter
  // one that the user typed in full.
  const exact = entries.filter((e) => e.keys.includes(key));
  const matches = exact.length
    ? exact
    : entries.filter((e) => e.keys.some((k) => k.startsWith(key)));

  if (!matches.length) return { kind: "unknown", query, reason: "no-match" };

  if (matches.length > 1) {
    return {
      kind: "ambiguous",
      query,
      candidates: matches.map((e) => ({ system: e.system, name: e.name, keys: e.keys })),
    };
  }

  const hit = matches[0];

  // Only a system that IS its url gets an automatic redirect. Everything else
  // needs a sentence the user can read, which means a page, not a Location.
  if (hit.reach === "direct" && hit.url) {
    return { kind: "external", query, system: hit.system, name: hit.name, url: hit.url };
  }

  return {
    kind: "handoff",
    query,
    system: hit.system,
    name: hit.name,
    full: hit.full,
    desc: hit.desc,
    reach: hit.reach,
    url: hit.url,
    via: hit.via,
    then: hit.then,
    access: hit.access,
    cac: hit.cac,
  };
}

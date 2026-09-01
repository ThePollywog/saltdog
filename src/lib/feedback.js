/**
 * Where to send a correction or a request, and how to get there in one click.
 *
 * ONE QUEUE FOR THREE SITES. Issues for SALTDOG, WEBNAVFIT and the homepage are
 * all filed against thepollywog.github.io. Someone who finds a dead NSIPS link
 * should not have to work out which of three repositories owns it, and a single
 * correction often touches two sites at once — so the routing decision lives in
 * a required "Which site" field on the form rather than in the reporter's head.
 * This repository's own .github/ISSUE_TEMPLATE/config.yml redirects there too;
 * this module is the same destination reached from inside the app, where the
 * person who noticed the problem actually is.
 *
 * The URL is a literal here rather than an entry in data/systems.js on purpose.
 * That registry is the Navy systems a Sailor logs into, and every consumer of it
 * — the quick-links table, the CAC chips, the `go` shortcuts, the "via" chain —
 * treats its entries as things you need an account for. A project bug tracker
 * would be the one row in it that means something completely different.
 *
 * `where` carries `location.href`, not a route name. A report that says which
 * page it came from is worth several rounds of "which one?", and the honest
 * value is the address the reporter was actually looking at — including when
 * that is a local copy, since `base: './'` means this app legitimately runs from
 * anywhere and knowing it was a local build is itself useful.
 */
const REPO = "https://github.com/ThePollywog/thepollywog.github.io";

/** This app's value in the forms' "Which site" dropdown, prefilled by id. */
export const SITE = "SALTDOG";

/**
 * The issue forms, by the file name GitHub addresses them by.
 *
 * Keyed rather than inlined at the call sites so the set is enumerable: the test
 * suite asserts these are exactly the templates this repo's issue-chooser
 * redirect offers, which is the one way the footer and the redirect can drift
 * apart without anyone noticing until a link 404s.
 */
export const FORMS = {
  correction: "content-correction.yml",
  feature: "feature-request.yml",
  bug: "bug.yml",
};

/**
 * A prefilled new-issue URL.
 *
 * @param {keyof FORMS} kind
 * @param {string} where  the address the reporter is on
 */
export function reportUrl(kind, where = "") {
  const template = FORMS[kind];
  if (!template) throw new Error(`feedback: unknown form "${kind}"`);
  const q = new URLSearchParams({ template, site: SITE });
  // Omitted rather than sent empty: an empty `where` overrides the form field's
  // placeholder with a blank, which loses the example URL that tells someone
  // what to paste.
  if (where) q.set("where", where);
  return `${REPO}/issues/new?${q}`;
}

/** The links offered in the app footer, most-used first. */
export const FOOTER_LINKS = [
  { kind: "correction", label: "Report something wrong" },
  { kind: "feature", label: "Suggest a change" },
];

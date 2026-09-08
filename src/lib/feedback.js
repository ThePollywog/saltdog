/**
 * Where to send a correction or a request, and how to get there in one click.
 *
 * MAILTO, NOT AN ISSUE TRACKER. These links used to open a prefilled GitHub
 * issue on thepollywog.github.io. That queue still exists and the repo's own
 * .github/ISSUE_TEMPLATE/config.yml still redirects there — but GitHub answers
 * /issues/new with a 302 to /login for anyone not signed in, and no repository
 * setting changes that. A reservist who spots a dead NSIPS link on a government
 * machine is exactly the person who has no GitHub account and often cannot reach
 * github.com at all, so the one route that works for everyone is email.
 *
 * The address is a literal here rather than an entry in data/systems.js on
 * purpose. That registry is the Navy systems a Sailor logs into, and every
 * consumer of it — the quick-links table, the CAC chips, the `go` shortcuts, the
 * "via" chain — treats its entries as things you need an account for. A project
 * mailbox would be the one row in it that means something completely different.
 *
 * `where` carries `location.href`, not a route name. A report that says which
 * page it came from is worth several rounds of "which one?", and the honest
 * value is the address the reporter was actually looking at — including when
 * that is a local copy, since `base: './'` means this app legitimately runs from
 * anywhere and knowing it was a local build is itself useful.
 */
const CONTACT = "thepollywog@proton.me";

/** This app's name, in the subject line: one mailbox serves three sites. */
export const SITE = "SALTDOG";

/**
 * The kinds of report, by the key the footer names them by.
 *
 * Keyed rather than inlined at the call sites so the set is enumerable, and each
 * carries its own subject and opening prompt. An empty message body gets an
 * empty message back; the prompt is the cheapest way to ask for the two facts
 * that otherwise cost a round trip.
 */
export const FORMS = {
  correction: {
    subject: `${SITE}: something is wrong`,
    prompt: "What is wrong, and what should it say instead?",
  },
  feature: {
    subject: `${SITE}: suggested change`,
    prompt: "What would you like added or changed?",
  },
};

/**
 * A prefilled mailto: URL.
 *
 * @param {keyof FORMS} kind
 * @param {string} where  the address the reporter is on
 */
export function reportUrl(kind, where = "") {
  const form = FORMS[kind];
  if (!form) throw new Error(`feedback: unknown form "${kind}"`);
  // Omitted rather than sent empty: a trailing "Page:" with nothing after it
  // reads as something the reporter forgot to fill in.
  const body = where ? `${form.prompt}\n\n\n---\nPage: ${where}\n` : `${form.prompt}\n`;
  // encodeURIComponent, not URLSearchParams. The latter is form encoding, where
  // a space is "+" — mail clients do not decode that, so every subject line
  // would arrive as "SALTDOG:+something+is+wrong".
  const q = `subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${CONTACT}?${q}`;
}

/** The links offered in the app footer, most-used first. */
export const FOOTER_LINKS = [
  { kind: "correction", label: "Report something wrong" },
  { kind: "feature", label: "Suggest a change" },
];

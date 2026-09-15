# SALTDOG

A condensed quick-reference desk for Sailors: the systems directory, the
one-page reference cards, and the readiness math — as a single static site that
runs entirely in the browser. Most of it is service-wide; the reserve-only
pieces — the annual checklist, points and good years — are labelled where they
appear rather than in the site's name.

**Unofficial.** Not a Department of the Navy publication. Nothing here is a
system of record; verify anything you act on against the official source, your
NOSC, or MNCC (1-833-330-MNCC).

## What's in it

| Surface | Contents |
| --- | --- |
| **Quick Links** (`#/quick-links`) | 30 systems across 6 categories — pay, records, readiness, training, benefits, support — each marked CAC-required or open, with a filter |
| **Knowledge** (`#/knowledge`) | 5 topics / 28 reference sections: doctrine and customs, combatant commands, Navy fleets, joint staff codes, and the instructions behind all of it. The COCOM and fleet pages carry a projected world map |
| **Tools** (`#/tools`) | Reservist readiness checklist (the one reserve-scoped tool), due-date planner with `.ics` export, EVAL/FITREP due-date lookup, retirement-points tracker, phonetic speller, uniform information with a ribbon rack builder, six-service rank explorer — each carrying the reference material it works from, not just the calculator |
| **Reference assistant** | Offline keyword search over all 70 cards (the 28 knowledge sections, the 9 quick-links categories, and the 33 sections the tools render), with a WebGL orb. Not an AI, no network calls |
| **Go shortcuts** (`#/go`) | Register the site as a browser search engine and `go nsips` in the address bar lands on NSIPS. Resolves client-side from a table built out of the systems registry |
| **About** (`#/about`) | What's stored in your browser, with export / import / delete |
| **Report / suggest** | Footer links on every page open a prefilled email to the project mailbox, carrying the page you were on |
| **Static reference pages** (`/knowledge/`, `/quick-links/`) | The same reference sections again as 7 plain HTML files with no JavaScript at all, generated at build time — the only form a search engine can index |

The 14 source PDFs ship in `public/pdf/` and every page links its own original,
so any transcription can be checked against the chart it came from.

## Running it

```bash
npm install
npm run dev        # http://localhost:8773
npm run build      # -> dist/
npm run preview    # serve the built output
```

Or through the Makefile, which installs first if `node_modules` is missing or
older than the lockfile (matching `../webnavfit`):

```bash
make start     # npm run dev
```

`build`, `preview`, `test`, `smoke`, `verify`, and `sabotage` are targets too.

### Deploying

`dist/` is position-independent: `base: './'` plus hash-history routing means it
works from a subdirectory, an S3 prefix, GitHub Pages, or a file share with **no
rewrite rules and no server config**. Copy the folder and you're done.

The one host-specific thing is `dist/go/`, which needs the server to resolve a
directory request to `index.html` — GitHub Pages, S3 with an index document and
`vite preview` all do. On a bare file share the shortcut URL is
`…/go/index.html?q=%s` instead and nothing else is affected.

## Verification

```bash
npm test        # 304 tests: golden questions, corpus integrity, domain rules
npm run smoke   # builds, serves, drives real Chrome over 62 checks
npm run verify  # both

node tools/sabotage.mjs   # 120 mutations to real source; every one must be caught
```

`npm test` is `node --test` with zero dependencies. `npm run smoke` drives the
installed Chrome over CDP — no Puppeteer, no Playwright, no jsdom — and checks
the things a build cannot prove: that every route mounts with no console error,
that the chat's citation deep-links to the cited section with focus moved there,
that the ribbon rack and the world maps draw real artwork, and that saved state
survives a reload.

One rule governs all of it: **a check you have never watched fail is a
decoration.** `tools/sabotage.mjs` breaks the real source 120 ways and asserts
the suite notices each one; every check here was confirmed to fail before it was
kept, and that practice has repeatedly caught checks that were quietly proving
nothing. `node tools/probe.mjs "your question"` prints the tokenization and the
top scored records, for when the retriever ranks something oddly.

Why the code is shaped the way it is — routing, prerendering, the data registry,
retrieval scoring, the audience rule, and a long list of decisions that look
arbitrary and aren't — is in [docs/design-notes.md](docs/design-notes.md).

## Content caveats

- The awards chart has two typographical errors — "Presideantial" and "Warn in
  lieu of five gold stars" — corrected here and footnoted on the page rather than
  reproduced silently. The rank charts have two more (USN E-8 prints "Second
  Chief Petty Officer", USMC W-5 prints "CWOS"); those are corrected in the data
  but **not** footnoted, so the site shows the right title with no note saying the
  chart was wrong. Both corrections are independently confirmed against a second
  source and pinned by a test, so the typos cannot come back unnoticed.
- **No measurement from the Uniform Regulations appears anywhere on this site**,
  and that is enforced by a test rather than by care. The uniform page says which
  chapter specifies each piece of insignia and stops there.
- The awards material is the precedence list from one chart. It is the order
  ribbons are worn in and the devices that go on them — **not** SECNAVINST 1650.1,
  and it encodes no eligibility criteria. The rack calculator arranges what you
  tell it you have; it does not decide what you have earned.
- **The doctrine page has no local source, and it says so on the page.** The
  obvious source — *The Bluejacket's Manual* — is copyrighted Naval Institute
  Press material, not a public-domain government work, so it is not transcribed
  here. The page cites U.S. Navy Regulations, the SORM and NAVPERS 15665 instead,
  marks its two quoted texts as quotations, and tells the reader to follow their
  command's own instruction. Those quotations were written from memory with
  nothing local to check them against: the tests verify the page's internal
  consistency and explicitly do **not** claim the wording is verified.
- The Sailor's Creed and the three core values carry **no** authority chip, which
  is deliberate. The first draft cited Navy Regulations for both and neither text
  is in it — they're CNO-promulgated and carried in training material. A chip
  naming a document that doesn't contain the text is worse than no chip, since
  the only reason to print an authority is so a reader can go and check it.
- Rank tier gaps are stated as sentences, not left as empty tables: the Air Force
  and Space Force have no warrant officers, and the Coast Guard runs W-2 through
  W-4 only.
- The EVAL/FITREP lookup covers E1–E9, W1–W5, and O1–O6. Flag officers are absent
  from the source card, so the tool says so instead of returning nothing. August
  and December have no scheduled reports and render an explicit "no reports due".
- The six rank PDFs are flattened bitmaps with no text layer, so the rank *text*
  is a visual transcription. The insignia are cut out of the same rendered pages
  by script; download a chart for the full-size original.
- The Navy public quick-links page this condenses is no longer reachable, so the
  directory is rebuilt from a systems list of its own rather than scraped.
- 29 of the 31 systems open in one click; two have no application to open at all
  (the SAAR account-request form goes through your Security Manager, and TAP runs
  through a Fleet & Family Support Center). Those two render as text. Names and
  addresses change often, which is why every surface that shows one also shows
  the MyNavy HR / MNP / MNCC fallback.

## Privacy

No backend, no accounts, no analytics, no network requests after load. Checklist
progress, points entries, your saved ribbon rack, and your theme choice live in
this browser's
`localStorage` under the `saltdog:` prefix. Clearing site data erases them —
which is why the About page has a JSON export, the only backup a no-backend app
can offer someone tracking twenty years of points.

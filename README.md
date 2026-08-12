# SALTDOG

A condensed quick-reference desk for Navy reservists: the systems directory, the
one-page reference cards, and the readiness math — as a single static site that
runs entirely in the browser.

**Unofficial.** Not a Department of the Navy publication. Nothing here is a
system of record; verify anything you act on against the official source, your
NOSC, or MNCC (1-833-330-MNCC).

## What's in it

| Surface | Contents |
| --- | --- |
| **Quick Links** (`#/quick-links`) | 30 systems across 6 categories — pay, records, readiness, training, benefits, support — each marked CAC-required or open, with a filter |
| **Every checklist item links its application** | 30 of 33 items and all 11 procedures name the system that completes them, as a button. The three that don't are conversations, not websites |
| **Knowledge** (`#/knowledge`) | 8 topics / 41 reference sections: annual checklist, EVAL–FITREP calendar, ranks for all six services, awards precedence, combatant commands, Navy fleets, joint staff codes, phonetic alphabet. Ranks show the real insignia; the COCOM and fleet pages carry a projected world map |
| **Tools** (`#/tools`) | Readiness checklist, EVAL/FITREP due-date lookup, retirement-points tracker, phonetic speller, ribbon rack calculator, six-service rank explorer |
| **Reference assistant** | Offline keyword search over all 47 cards (the 41 knowledge sections plus the 6 quick-links categories), with a WebGL orb. Not an AI, no network calls |
| **About** (`#/about`) | What's stored in your browser, with export / import / delete |

The 14 source PDFs ship in `public/pdf/` and every page links its own original,
so any transcription can be checked against the chart it came from.

## Running it

```bash
npm install
npm run dev        # http://localhost:8773
npm run build      # -> dist/
npm run preview    # serve the built output
```

### Deploying

`dist/` is position-independent: `base: './'` plus hash-history routing means it
works from a subdirectory, an S3 prefix, GitHub Pages, or a file share with **no
rewrite rules and no server config**. Copy the folder and you're done.

## Verification

```bash
npm test      # 134 tests: golden questions, corpus integrity, domain rules
npm run smoke # builds, serves, drives real Chrome over 38 checks
npm run verify  # both
```

`npm test` is `node --test` with zero dependencies. It covers the two things
unit-testing actually repays here:

- **57 golden questions → expected record**, plus 5 negative cases that must come
  back `unknown`. The scorer is the one component where a local fix silently
  re-ranks distant answers — adding one synonym to fix one question can break
  five others, and hand-testing the query you just fixed will never show you
  that. A retriever that answers everything is worse than one that admits
  ignorance, so `"recommend a good science fiction novel"` is a test case.
  The last four exist because **prose is searchable**: the checklist's `note`
  text is body copy that also feeds the index, so expanding those notes bought
  four answers the site did not previously have — including `"USERRA"`, which
  returned `unknown` before. Prose is also the easiest thing here to trim during
  an unrelated edit, and an answer lost that way leaves no trace, so the
  questions the prose earned are pinned to it.
- **Corpus integrity** — unique ids, every `sourcePdf` present in `public/pdf/`
  and no orphans, checklist ids matching a committed snapshot, and no HTML
  entities anywhere in the data (the source builders stored `&amp;` and friends
  pre-escaped; Vue would render them literally).
- **The systems registry** — every id referenced by a checklist item, a
  procedure, a topic, or a quick-links entry resolves; every `portal` system's
  `via` resolves to something that actually has a URL; no system is defined and
  never linked; and `quicklinks.js` contains no literal `http` at all, which is
  what stops the addresses drifting back into two files.

`npm run smoke` drives the installed Chrome over CDP — no Puppeteer, no
Playwright, no jsdom. It checks that all 20 routes mount without a single console
error or Vue warning, and then the behaviours a build can't prove: the chat widget
answers a golden question and its citation deep-links to the cited section *with
focus moved there*, the orb renders and is hidden from assistive tech, the ribbon
rack draws real artwork in the right order, the world maps resolve to real
geometry at the right scale, tool state survives a reload, the theme choice
persists, the drawer's one outbound link still resolves to the exact external URL
rather than a router path, and the search engine stays out of the first-paint
waterfall.

Four checks exist because a real defect got past everything else. The build, the
tests, and the DOM-structural assertions were all green while the chat button
rendered as an empty gold square (a bare `icon` attribute beating `:icon`), the
orb painted an opaque block (a `display: none` canvas measured 0 and locked in a
1×1 drawing buffer), and an empty progress bar rendered as a *full* one (Vuetify
paints the unfilled track at `--v-border-opacity`, which both themes raise to ~1
for crisp table rules), and a ribbon rack could render 68 correctly-sized, utterly
blank rectangles (a CSS `background-image` 404s silently — the elements are all
present and the artwork simply isn't), and a world map could render inside a
correct-looking `<svg>` with the continents scaled entirely off-frame (a viewBox
one dimension short — see the design notes). Nothing was wrong in the DOM in any
of the five cases — only in the pixels.

Every check here was confirmed to fail against deliberately broken code before
being kept, which is the only thing that makes a regression test worth having,
and the practice keeps paying: the map checks were sabotaged fourteen ways, and
two of those runs came back green. One exposed a check that could not catch a
mirrored world; the other exposed a stylesheet comment asserting something
measurably false. Both are fixed. A check you have never seen fail is a
decoration.

The same practice audits the *claims* a check makes, not just its coverage. The
four pinned checklist-note questions were first justified with six; the other two
were dropped after stubbing every note showed they answered correctly regardless,
which would have tested the labels while appearing to test the prose. And a
per-item sweep found the four are coupled at different granularities — one note
breaks two of them alone, one needs its whole group, and one rides on corpus-wide
IDF and only fails when all thirty-three go. That last one is a canary, not a
pointer, and the test comment says so.

`node tools/probe.mjs "your question"` prints the tokenization, the OOV terms,
and the top six scored records. Use it before tuning anything in the retriever —
it's the difference between diagnosing a ranking problem and guessing at one.

## Design notes

Things that look like arbitrary choices but aren't:

**Section anchors ride in a query param** (`#/knowledge/eval-fitrep?a=rules`),
not a second hash. Double-hash URLs get mangled by Outlook, Teams, and chat
link-scrubbers — which is exactly how this audience shares links.

**Data is authored once and derived twice.** `src/data/*.js` are the single
source of truth; `src/lib/corpus.js` derives one search record *per section* (so
a citation lands on an anchor, not a page top) holding the section **by
reference**. The answer card renders that section through the same
`<TopicSection>` the knowledge page uses, so chat answers and pages cannot drift
apart.

**The retriever admits ignorance.** Field-weighted TF-IDF, normalized by the
query's own self-score so the threshold is corpus-size independent — and
crucially, out-of-vocabulary terms count toward that normalizer. Skipping them
was a bug that let "capital of France" score 0.85 by normalizing as though only
"of" had been typed. Three outcomes: an answer, a disambiguation offer, or an
honest "I don't have that" pointing at MyNavy HR / MNP / MNCC.

**Capability and motion preference are independent axes.** The orb has four
cells, not two: WebGL + motion → animated; WebGL + reduced motion → *one static
WebGL frame*; no WebGL + motion → CSS keyframes; no WebGL + reduced → static
gradient. The middle cell is the one that usually gets skipped. `createOrb()`
returns `null` on any failure (no context, shader compile, link, throw) and the
component falls back silently. RAF pauses on `document.hidden` and via
IntersectionObserver.

**A ribbon rack is built from the bottom up.** The senior award goes top-left, but
when the count isn't a multiple of three the *short row is the top one*, centred
over the rows beneath it — so seven ribbons is 1 over 3 over 3, not 3 over 3 over
1. Laying the rows out top-down produces the right number of ribbons in the right
number of rows with the junior awards in the short row, which is why `layoutRack`
builds bottom-up and reverses, and why the smoke check asserts the split rather
than the count.

**The ribbon artwork is cut from the source chart by script, and the count is
asserted three times.** `tools/extract-ribbons.mjs` rasterises the PDF page and
segments 68 tiles into one 52 KB sprite sheet; `data/awards.js` stores each
award's tile index. Two of those awards — the Rifle and Pistol Marksmanship
Medals — are drawn *inside the chart's device-legend block* rather than in the
ribbon grid, so the obvious "find bands of content" heuristic fuses them with the
legend prose and silently yields 66. That is a plausible-looking number, and it
would have made every rack wrong from award #66 down. Rows are therefore found as
ribbon *artwork* (a run 100–150 px tall with >600 non-white pixels per row, which
legend text fails), the extractor refuses to write a sheet that isn't exactly 68
tiles, and the test suite checks the PNG's height header against
`AWARDS.length` — no image library needed, just `readUInt32BE(20)`.

**The rank insignia were supposed to be impossible, and the count is derived
rather than typed.** `data/ranks.js` used to state that insignia "cannot be shown
per-rank" — which conflated two things. There is no separately embedded image per
rank in those PDFs, true; but the composited page rendered at 300dpi puts every
insignia in its own table cell, and cells are findable.
`tools/extract-ranks.mjs` finds them as *table structure*, not as artwork: tier
blocks from the navy title bars (by colour — Navy and Space Force insignia are
near-black, so an ink-density test reads a row of chevrons as a title bar), four
horizontal rules per block, columns from full-height vertical rules. Blob-finding
fails immediately, because E-8 and E-9 stack two insignia in one cell (the First
Sergeant / Command variant) and a blob finder splits them, shifting every later
index.

A sprite index is a bare number, so an off-by-one renders perfectly and mislabels
every rank after it. Nothing about the image would say so. Both sides therefore
count from one array — `insigniaPlan()` for the extractor, `insigniaIndex()` for
the UI — and the extractor refuses to write a sheet whose segmented grid disagrees
by one column. That is not hypothetical: the Coast Guard's warrant tier is
W-2..W-4, three columns where the Navy has five, and the Air Force and Space Force
charts have no warrant block at all, so "grades are ten wide" is wrong on three of
the six charts. Two cells per chart are dropped by position, not by inspection —
E-1's "No Insignia" text and the senior enlisted advisor, which is a billet rather
than a paygrade — because telling text from artwork by pixel statistics also
misfires on the real USN E-2 chevrons. 126 tiles, 191 KB at a 96-colour palette;
64 colours saves 17 KB and visibly flattens the flag-officer shoulderboards.

The rendered check earns its keep on the part the data tests can't see. A CSS
`background-image` that 404s does not fail the page, does not log, and leaves a
correctly-sized empty box, so a missing sheet looks exactly like "this rank has no
insignia". Distinct offsets alone aren't enough either: `background-size: cover`
keeps all 126 offsets distinct while cropping every tile to the same visible
region, which is why the smoke check asserts the *scale* separately — one tile has
to equal one element box.

**The antimeridian is the whole of the map problem, and reading it wrong does not
look like an error.** `tools/build-maps.mjs` projects the Natural Earth coastline
and the six geographic AOR polygons into committed SVG path data (46 KB, 18 KB
gzipped, in a `geo` chunk of its own — the sources are 1.9 MB and Douglas-Peucker
over 87,000 points is not something to make a phone do on a knowledge page).
Three of those polygons wrap the seam: NORTHCOM and EUCOM close their rings
across the top of the world, INDOPACOM spans both sides of 180° and closes across
the bottom. A segment like `[179.98, 84] → [-45, 84]` is a 360° jump readable two
ways, and four different readings were prototyped before one was kept — because
every one of them renders a plausible world map. Unwrapping plus Sutherland-Hodgman
clipping put Norfolk, Berlin, Moscow, Cairo and Kabul *inside USINDOPACOM* while
leaving Tokyo and Sydney out. A subtler "seam connector" variant passed all
fourteen city probes and silently lost every polygon above 84°N.

The literal projection is the correct one, and only because of a property of
these particular files: **every seam jump in all seven sources is at constant
latitude**, so the closing segment runs along a pole and encloses exactly the
region the polygon means to include. That is a fact about the data, not about the
projection, so the generator asserts it rather than assuming it and refuses to
write if a future source ever crosses the seam at an angle. Correctness is
established by containment — fourteen cities that must each land in exactly one
AOR — not by looking at the picture.

**A check that shares code with the thing it checks proves nothing.** Flipping
`projectY` to `(90 + lat)` writes an upside-down world and the city probes still
pass, because they project their test points through the same function that built
the paths. Any self-consistent error is invisible that way. So the generator
first pins the projection against six hand-typed constants (north is `y=0`, the
antimeridian is `x=0` and `x=MAP_W`, null island is the centre), and the test
suite retypes the projection instead of importing it — importing it would make
the test agree with whatever the renderer currently does, sign flip included.
Two invariants are proven by deliberately corrupting a copy of the source data
rather than by argument: tilt one seam jump half a degree, or reverse the winding
of one hole, and the generator names the offending coordinate and exits non-zero.

**`getBBox()` measures what the renderer resolved; it does not measure what you
see.** It is the reason the map check runs in a browser at all — a `d` attribute
the browser rejects still reads back perfectly from the DOM while `getBBox()`
returns zero. But it is in *user space*, which makes it blind to the viewBox, the
one attribute deciding how user space lands on the screen. A viewBox of
`0 0 1000 0` yields a flawless 1000×482 bbox, passes every user-space assertion,
and renders an empty rectangle with the world scaled off-frame. So the same path
is measured twice, the second time in CSS pixels as a fraction of its own
`<svg>`. Inline SVG fails quietly in more ways than an `<img>` does: an
unparseable `d` renders an empty `<path>` with no console error, and a failed
async chunk leaves the `<figure>` mounted and empty. All three look identical in
the DOM.

**Adding a section to a topic can silently steal an existing answer.** Topic
keywords are merged into *every* section of that topic, so they are worth the
same to all of them and can only break ties by section order. Putting the six
command names on the COCOM topic made "what does INDOPACOM cover" an exact
four-way tie at 0.875, invisible until the new map section landed at the top and
took it. The fix was to push discriminating keywords down onto the sections that
earn them — the AOR table has the coverage, the HQ and the fleet in fields — and
the reasoning is recorded in `cocoms.js` where the next person adding a section
will read it. `node tools/probe.mjs` prints the ties; nothing else would.

Relatedly, a map section's aria-label is deliberately **not** indexed. It has to
describe every region in prose for a screen reader, which is the same prose the
AOR table competes with, so indexing it made the map outrank the real answer. An
accessible description should not double as search bait, and a test asserts the
exclusion rather than the symptom — the golden question it originally broke now
passes either way, so nothing else would notice the rule being undone.

**The numbered-fleet operating areas are dashed ellipses, not outlines.** Unlike
the COCOM AORs there is no published polygon for a numbered fleet's water. Hard
boundaries would state a precision that does not exist, so they are drawn as
approximations, labelled as approximate, and the fleet page draws **no AOR fills
at all** — the COCOM polygons are a different fact and would read as fleet
boundaries on that page. 5th Fleet is not CENTCOM.

**Every URL lives in one file, and the ones that can't be linked say so.**
`src/data/systems.js` holds all 31 systems; the directory, every checklist item,
and every tool read from it, so an address that changes is fixed once. The reason
it isn't a plain name→URL map is the `reach` field: seven of these systems have
**no public front door**. PRIMS-2, eNAVFIT, C-WAY, NDAWS and the NSIPS
sub-applications are reached *through* a portal after you authenticate, and
inventing a plausible deep link for one of them would be worse than offering
none — it would send someone to a dead URL while looking helpful. So a `portal`
system carries its portal's address and the label "via MyNavy HR" inside the
button's accessible name; a `phone` entry is a `tel:` link with no `_blank` (on
desktop that leaves a dead blank tab behind the dialer); and an `offline` entry —
the SAAR form, TAP — renders as a sentence about where it actually happens,
because a button that can't do anything is worse than a sentence telling you to
see your Security Manager.

Centralizing them also surfaced two defects that had been sitting in the shipped
data. DTS was recorded as `dtsproc.defensetravel.osd.mil`, which **no longer
resolves at all**; the working host is `dtsproweb`. And Navy e-Learning, FLTMPS
and DISS were each recorded as "CAC required" with no URL — all three have
reachable entry points and are now direct links. Worth stating the verification
bar, because it is not the obvious one: a `403` or a timeout from the commercial
internet on a `.mil` host means WAF-blocked or CAC-gated, **not** wrong hostname.
"Resolves in DNS and is documented" is the bar; "returned 200 from my laptop"
would have deleted most of the correct entries in this file.

**Checklist ids are hand-written, never slugified from labels.** Deriving them
from display text is the tempting shortcut, and it silently wipes everyone's
progress the first time somebody fixes a typo in a label. A committed id
snapshot in the tests makes that regression loud.

**The points tracker persists raw inputs only** and derives totals at render, so
a formula correction heals old saved data instead of leaving a baked-in wrong
number. Years are anniversary years, not fiscal years — binning by fiscal year is
the classic bug in reservist tools, and it mis-files everything earned near the
boundary.

**Gold never carries body text in light mode.** `#C8A951` on the dark navy is
8.05:1 (AAA); on white it is 2.27:1 and fails outright, so the light theme uses a
darkened `#8A6D1F` (4.86:1). This is the standard way a navy-and-gold theme goes
non-compliant.

**No webfont, no icon font.** System UI stack for body, system monospace for
paygrades and URLs, and `@mdi/js` + `vuetify/iconsets/mdi-svg` for icons —
tree-shaken SVG paths instead of the ~3.6 MB of `.eot`/`.ttf`/`.woff`/`.woff2`
that `@mdi/font` emits to render a handful of glyphs.

Initial payload is **203 KB gzipped**, just over the 200 KB target — 128 KB of
that is the Vuetify + Vue runtime and 47 KB is Vuetify's stylesheet, so the app's
own code and CSS are about 16 KB. Trimming further means dropping Vuetify's
utility-class layer, which isn't worth the churn here; the number is recorded
honestly rather than rounded down to the budget.

The map geometry defers the same way, and needed its own manual chunk to do it.
`src/data/geo.js` is 18 KB gzipped for two of the site's forty-seven sections, and
`TopicSection.vue` — which *is* in the entry chunk, because the chat answer card
renders it — reaches `WorldMap.vue` through `defineAsyncComponent`. Grouping the
geometry with the other reference data would have quietly undone that, since
`refdata` is fetched on first paint.

What *else* defers is the search engine (~5 KB): the scorer, corpus builder, and
alias table load when the widget first opens, not on first paint. That is a
sharper edge than it looks — `AppShell` mounts `ChatWidget` on every page, so one
static `import { ask }` anywhere in the chat's dependency chain drags the whole
engine into the entry chunk while the chat keeps working perfectly. `npm run
smoke` asserts against the real network waterfall that it stays deferred.

The 4.9 MB of PDFs sit in `public/pdf/` and transfer only when someone clicks one —
half of that is the ribbons chart alone. The ribbon sprite sheet (`public/img/`,
52 KB for all 68 ribbons, 64-colour quantized because flat stripe artwork loses
nothing to it) loads only on the two pages that draw ribbons.

## Layout

```
src/
├── data/          authoring source of truth (ES modules, so they can carry
│                  the typo-correction footnotes as comments). systems.js is
│                  every URL on the site; tools.js is every tool
├── lib/           pure functions — corpus, retrieval, persist, evalRules,
│                  points, orb. No Vue, no DOM, testable in plain Node
├── composables/   the reactive wrappers around lib/
├── components/    shell/ common/ chat/ tools/
└── views/         Home, QuickLinks, KnowledgeIndex, Knowledge, Tools, About
tools/
├── verify-corpus.mjs   node --test suite
├── smoke.mjs           headless-Chrome route + interaction checks
├── probe.mjs           retrieval diagnostic
├── extract-ribbons.mjs cuts the 68-ribbon sprite sheet from the source PDF
├── extract-ranks.mjs   cuts the 126-insignia sheet from the six rank charts
├── build-maps.mjs      projects the coastline + six AOR polygons to SVG paths
└── checklist-ids.json  id snapshot guarding stored progress
```

One generic `KnowledgeView` driven by `/knowledge/:topicId` against the registry
replaces what would have been seven near-identical views — and seven places to
fix a rendering bug. Every section is a `kind` (`links`, `checklist`, `steps`,
`kv`, `code-cards`, `eval-schedule`, `phonetic`, `ranks`, `awards`, `map`,
`table`) dispatched by `TopicSection.vue`.

The interactive tools are listed once, in `src/data/tools.js`, because the tab bar,
the nav drawer, and the About page's count were three hardcoded copies — and the
About page was already claiming five tools while six existed. Only the lazy
`import()` calls stay in `ToolsView.vue`, since a dynamic import needs a literal
specifier to be code-split; a test asserts the two lists agree.

`SystemLinks.vue` is the one component that renders a "go do it" row, used by the
checklist tool, the knowledge sections, the home page, four tools, and the chat's
no-answer fallback. Its failure mode is worth knowing: `systemsFor()` drops ids it
doesn't recognize, so a typo produces an **empty row that looks like a deliberate
design choice**. That is the right behaviour at runtime — better a missing button
than a crashed page — and useless at build time, so `verify-corpus` proves every
id resolves and `smoke.mjs` proves the buttons reached the DOM on four separate
surfaces. The knowledge-page check earned its place immediately: the row shipped
before any topic declared `systems`, rendering nothing on all eight topics.

## Content caveats

- Three source charts have typographical errors, corrected here with visible
  footnotes rather than reproduced silently: USN E-8 prints "Second Chief Petty
  Officer" (→ Senior Chief Petty Officer), USMC W-5 prints "CWOS" (→ CWO5), and
  the awards chart prints "Presideantial" and "Warn in lieu of five gold stars".
- The awards topic is the precedence list from one chart. It is the order ribbons
  are worn in and the devices that go on them — **not** SECNAVINST 1650.1, and it
  encodes no eligibility criteria. The rack calculator arranges what you tell it
  you have; it does not decide what you have earned.
- Rank tier gaps are stated as sentences, not left as empty tables: the Air Force
  and Space Force have no warrant officers, and the Coast Guard runs W-2 through
  W-4 only.
- The EVAL/FITREP lookup covers E1–E9, W1–W5, and O1–O6. Flag officers are absent
  from the source card, so the tool says so instead of returning nothing. August
  and December have no scheduled reports and render an explicit "no reports due".
- The six rank PDFs are flattened bitmaps with no text layer, so the rank *text*
  is a visual transcription. The insignia are cut out of the same rendered pages by
  script (see below); download a chart for the full-size original.
- The Navy public quick-links page this condenses is no longer reachable, so the
  directory is rebuilt from a reservist-scoped systems list rather than scraped.
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

# SALTDOG design notes

Moved out of the README, which had grown to ~750 lines of codebase reasoning in
front of the twenty that tell you what the project is. Nothing here is required
to run, deploy or use the site; it is the record of why the code is shaped the
way it is, kept so the same arguments are not relitigated from scratch.

## Design notes

Things that look like arbitrary choices but aren't:

**Section anchors ride in a query param** (`#/knowledge/eval-fitrep?a=rules`),
not a second hash. Double-hash URLs get mangled by Outlook, Teams, and chat
link-scrubbers — which is exactly how this audience shares links.

**The reference content is published twice, because a fragment is not a URL.**
Hash routing is what makes `dist/` position-independent, and the price is that
every one of the 68 reference sections — ~44,000 characters of transcribed charts
— lives behind the single URL `/saltdog/`. A crawler sees one page. None of this
content can rank for the questions it answers: *"navy warrant officer
paygrades"*, *"what does J4 do"*, *"how many points is a good year"*.

So `tools/prerender.mjs` emits a plain HTML file per topic at a real path
(`/saltdog/knowledge/ranks/`) at build time, plus a hub at `/knowledge/` and
`sitemap.xml`. No JavaScript on them at all; each links the interactive version
and the source PDF.

It emits from `PAGE_TOPICS`, not from everything the corpus indexes. Awards is
rendered entirely by the Uniform Information tool and has no page in the app, so
generating one here would publish a static URL nothing links to — a page a
crawler can reach and a reader cannot.

Switching to history routing and prerendering the app instead was the obvious
alternative and it is worse: it needs the 404-based SPA fallback, it costs
`base: './'`, and it orphans every hash link already shared — including the one in
the sibling homepage's FAQ. Static siblings *alongside* the hash app cost none of
that.

What is duplicated is the **presentation**, not the data: these renderers are a
second implementation of `TopicSection.vue`, because a Vue template can't run in
Node without dragging Vuetify through SSR. That's the real risk in the file, so it
is guarded rather than promised. `SECTION_RENDERERS` is keyed by `section.kind`
and a kind with no entry **throws the build** instead of emitting an empty section
that would then be indexed as thin content; and the test described above requires
every string in the data to reach the page, with a named exemption and a reason for
each field deliberately withheld.

`<lastmod>` is the git commit date of `src/data/`, not the build date. Google reads
that field only while it stays honest, and a sitemap claiming every page changed on
every deploy is one it learns to ignore.

**Data is authored once and derived twice.** `src/data/*.js` are the single
source of truth; `src/lib/corpus.js` derives one search record *per section* (so
a citation lands on an anchor, not a page top) holding the section **by
reference**. The answer card renders that section through the same
`<TopicSection>` the knowledge page uses, so chat answers and pages cannot drift
apart.

**A topic knows where it lives, and it is usually not a knowledge page.** Seven
of the twelve topics render somewhere other than `/knowledge/:id`: quick links
has its own view, and six are rendered end to end by the tool that uses them.
Each says so with a `home` field, and `topicRoute()` reads it — one data field
instead of a growing chain of `if (topicId === …)` in the router, the corpus, and
the answer card's button label.

**The merge rule is "does the tool already show all of this", not "does a tool
exist".** A knowledge page beside a tool covering the same ground is the same
facts at two URLs, and the page is the copy that goes stale — so the page goes
and the tool absorbs whatever it was not already rendering. That cost real work
rather than a registry edit: the checklist's how-to procedures were only on the
page (its rows *linked out* to them), and the EVAL calendar's coverage caveats
were not on the tool at all. Both now render through `<TopicSection>`, the same
component the chat answer card uses, against the same section objects.

Ranks is the awkward one and worth reading before adding a seventh. Its six
sections are the six services, and the explorer shows *one at a time behind a
selector* — so a citation to `ranks#usmc` cannot be honoured by scrolling: the
Marine Corps chart is not in the document until the selector says so. The
citation therefore changes the selection, resolved by `lib/rankSelection.js`
during setup rather than in `onMounted`, because `useCitedSection` looks for
`#sec-usmc` one tick after mount and on a cold load that element only exists if
the right service was already chosen.

Six topics no longer having a page cost six static pages — the prerendered set
went from 11 files to 7, and the rank charts were among the richest of them.
That is a real SEO loss, taken deliberately: a second URL that exists only for
crawlers is a page the app never links to and nobody maintains, which is the
duplication this merge was removing. `/knowledge/<moved-topic>` still resolves —
`KnowledgeView` redirects on `home` — so links shared while those pages existed
land on the tool rather than on the catch-all.

Awards moved there because precedence, the wear rules and the device legend are
what you want in front of you *while* building a rack. Split across two URLs they
were the same material twice, so the knowledge page was deleted rather than
cross-linked. The calculator renders the wear rules and the device legend with
the same `<TopicSection>` the chat card uses, against the same section objects,
so folding them in did not fork them; the picker is the precedence list, each row
carrying its precedence number, because a 68-row table above a 68-row checkbox
list would have re-created the duplication inside one page. The topic stays in
the corpus, so `awards#wear` is still citable — the citation just opens the tool,
and the tool honours `?a=` the way a knowledge page does.

**The uniform page is a locator, and says so.** Asked to add insignia
measurements, the honest answer turned out to be that this site cannot carry
them. The current publication is NAVPERS 15665J; it is served from MyNavy HR,
which WAF-blocks every non-browser client, so nothing here could transcribe it
and no build step could ever check a transcription against it. A superseded
revision is downloadable — the January 1998 15665I is public domain and has a
full text layer — and transcribing dimensions from it would have produced the
most authoritative-looking and least trustworthy lines on the site. Measurements
also vary by uniform and by sex, so a single number lifted out of context is
wrong more often than it is right.

So `src/data/uniform.js` maps the seven sections of chapters four and five to
what each one covers, and hands over. Chapter and section, never article
numbers: article numbering drifts fastest between revisions — the same call
`data/directives.js` makes for the same reason — while the chapter structure is
how the document is actually navigated. A test asserts that no string in that
topic ever states a dimension, so the absence stays deliberate rather than
becoming something a future edit quietly fills in.

**The tool tabs are data, not markup.** `src/lib/uniformTabs.js` owns which tab
renders which section, because that is what decides whether an arriving citation
is rendered at all: `?a=devices` has to select the tab holding the device legend
or the section never mounts, and the reader lands on a page that does not contain
what was cited with nothing logged anywhere. Every hosted section must belong to
exactly one tab — none is unrenderable-but-citable, none makes the resolver
depend on declaration order — and an arriving `?a=` beats a `?tab=` carried along
in the same shared URL.

**The site is for Sailors; one tool is for reservists.** It was branded "Navy
Reservist" end to end — title, meta description, home page, quick-links blurb —
while most of what it holds is service-wide: ranks, awards, COCOMs, EVAL dates,
uniform placement, the phonetic alphabet, and all but a handful of the systems.
The checklist is the real exception, because its cadence is drill weekends, AT
and the anniversary year, so an active-duty Sailor reading it as their own annual
list would be reading the wrong list. It therefore carries "Reservist" in the tab
label, the drawer label, its heading, and the chat's "Open in ___".

Both halves of that are pinned, because they pull against each other: the chrome
may not name an audience narrower than the Navy, and the checklist must name its
audience in every label a reader sees before opening it. The near miss is the
points tracker — good years genuinely are a reserve construct — but a label that
every tool carries stops distinguishing anything, so that one stays in the body
copy where it already is.

**The footer reports by email, not by GitHub issue.** GitHub answers
`/issues/new` with a 302 to `/login` for anyone not signed in, and no repository
setting changes that — the target repo is already public with Issues enabled and
still bounces logged-out reporters. A reservist who spots a dead NSIPS link on a
government machine is exactly the person with no GitHub account, and often on a
network that cannot reach github.com at all, so the footer links `mailto:` and
the reports arrive from everyone rather than from the subset that already has an
account. The links carry no `target="_blank"`: a mailto handed to a new tab
strands an empty one, and on a machine with no mail client registered it leaves a
blank page and no explanation.

The URL is built with `encodeURIComponent`, not `URLSearchParams`. The latter is
the obvious choice and is wrong — it is form encoding, where a space is `+`, and
mail clients hand that over literally, so every subject would arrive as
`SALTDOG:+something+is+wrong`.

**GitHub issues for all three sites still land in one queue.** SALTDOG, WEBNAVFIT
and the homepage all report to `ThePollywog/thepollywog.github.io`; this repo's
`.github/ISSUE_TEMPLATE/config.yml` turns blank issues off and offers only links
there, which is GitHub's supported way to say "not here". Disabling Issues in
repository settings would be the blunter version and is worse — it removes the
tab, so there is nothing left to redirect *from* and the reporter simply leaves.

The reason is the reporter, not the maintainer: someone who finds a dead NSIPS
link should not have to work out which of three repositories owns it, and one
correction often touches two sites. Centralizing moves that routing decision into
a required "Which site" field on the form, which is why every form has one and
why the central repo asserts it. The mailto carries the same information in its
subject line.

`src/lib/feedback.js` builds the same links for the app footer, prefilled with
`location.href` so a report says which page it came from without being asked.
The test suite asserts the footer and the redirect name the same three templates
— two files edited months apart that 404 for a real person if they drift. What
it deliberately does *not* check is whether those templates exist over there: a
test reaching into a sibling working copy passes on one machine and silently
skips everywhere else, which is exactly the homepage crawl check that was
deleted for that reason. The central repo validates its own templates in its own
`tools/check.mjs`.

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

It then happened a second time, on a page written after that paragraph existed.
The doctrine topic listed "salute", "colors", "watch" and "creed" as topic
keywords *as well as* on the sections that own them, which tied all eight
sections at 0.875 and answered "when do I not salute" with the Sailor's Creed.
Worth recording as a recurrence rather than a repeat of the same note: knowing
the rule was not enough, because the duplication looks like thoroughness while
you are typing it. What catches it is a golden question phrased so that every
word but one is a stopword — that is the shape that has nothing left to break a
tie with.

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

**The `/go` redirector is a generated file, and only `direct` systems redirect.**
Register `…/saltdog/go?q=%s` as a browser search engine with the keyword `go`, and
`go nsips` in the address bar lands on NSIPS. GitHub Pages has no rewrite rules
and cannot issue a redirect of its own, so this looked impossible until it was
measured: Pages *does* do the directory-slash redirect, and it **preserves the
query string** across it (`/saltdog/go?q=nsips` → `301` → `/saltdog/go/?q=nsips`).
That one fact is what makes a shortcut possible on a static host.

`dist/go/index.html` is emitted by a Vite plugin — not committed — because it
carries a copy of both the bang table and the resolver, and a committed copy would
drift from `systems.js` the first time an address changed. A stale redirect is
worse than a missing one: it looks like it worked. The same renderer backs a dev
middleware, so `npm run dev` serves byte-identical output (verified by diff), and
the resolver is *extracted from* `lib/bangs.js` rather than retyped, with a test
that runs both copies over every key.

It is a lookup and not the retriever, deliberately. The scorer would have to be
loaded into a page whose entire job is to redirect before Vue boots — the vite
config works to defer that chunk — and more to the point, a TF-IDF margin of 0.31
vs 0.29 is not an acceptable way to choose which `.mil` host somebody's browser
opens. A table either matches or says it didn't. Where it doesn't, the query is
handed to the assistant inside the app, which is the right tool for a *question*
and the wrong one for a *destination*; `go how many points for a good year` misses
the table and gets a cited answer.

Only `reach: "direct"` auto-redirects, and the rest hand off to a card. This is
the part that will look like a missing feature, so: `nsips-esr` resolves through
`systemUrl()` to the NSIPS portal, and forwarding there would feel instant while
leaving someone hunting a launch page for a link named "ESR". The registry's
`then` field exists precisely because landing on the portal is half the trip, and
an instruction cannot be shown to somebody you have already navigated away from.
A `phone` bang doesn't auto-dial, and an `offline` one has nothing to dial. The
invariant is asserted over the whole registry rather than over the single
registered bang, so it holds for bangs that don't exist yet.

**One bang is registered on purpose.** `nsips`, and nothing else. The mechanism —
omnibox hand-off, three query shapes, the static page, the hand-back into the
app — is the part that can be wrong in ways nobody notices; adding the other
thirty systems is a data edit against machinery that has been tested. Doing both
at once would have meant debugging thirty redirects without knowing whether a
miss was the table or the plumbing. The `/go` page says so out loud, because a
table headed "Registered shortcuts" with one row in it otherwise reads as broken.

**Checklist ids are hand-written, never slugified from labels.** Deriving them
from display text is the tempting shortcut, and it silently wipes everyone's
progress the first time somebody fixes a typo in a label. A committed id
snapshot in the tests makes that regression loud.

**The points tracker persists raw inputs only** and derives totals at render, so
a formula correction heals old saved data instead of leaving a baked-in wrong
number. Years are anniversary years, not fiscal years — binning by fiscal year is
the classic bug in reservist tools, and it mis-files everything earned near the
boundary.

**The points tracker imports by paste, and will not offer a NSIPS login.** The
obvious request is "sign into NSIPS and pull my points." It cannot be built here,
for reasons that are structural rather than a matter of effort. NSIPS sits behind
an F5 BigIP portal that answers `/` with a 302 to `/my.policy`; auth is CAC/PKI, a
client certificate and PIN held by smartcard middleware no browser will delegate
to a third-party page. It sends no `Access-Control-Allow-Origin`, so even with a
valid session a page on another origin cannot read one byte of the response, and
there is no documented public API. The only way around that is a server of ours
collecting government credentials and proxying a `.mil` session — a phishing
pattern, a violation of the "nothing is transmitted" promise on the About page,
and not ours to authorize. So the user pastes the record they are already looking
at, `lib/importPoints.js` reads the columns from the pasted header, and the panel
says all of this out loud rather than leaving a dead "Connect" button as an
explanation. Column order falls back to arithmetic — the total is the number equal
to the sum of the others — and nothing is ever applied without a preview, because
a silent mis-mapping would corrupt a 20-year record while looking like it worked.

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
├── sabotage.mjs        breaks real source 120 ways, asserts the suite notices
├── prerender.mjs       the 7 static, crawlable reference pages + sitemap.xml
├── go-page.mjs         the static /go bang redirector
├── probe.mjs           retrieval diagnostic
├── extract-ribbons.mjs cuts the 68-ribbon sprite sheet from the source PDF
├── extract-ranks.mjs   cuts the 126-insignia sheet from the six rank charts
├── build-maps.mjs      projects the coastline + six AOR polygons to SVG paths
└── checklist-ids.json  id snapshot guarding stored progress
```

One generic `KnowledgeView` driven by `/knowledge/:topicId` against the registry
replaces what would have been seven near-identical views — and seven places to
fix a rendering bug. Every section is a `kind` (`links`, `checklist`, `steps`,
`verbatim`, `kv`, `code-cards`, `eval-schedule`, `phonetic`, `ranks`, `awards`,
`map`, `directives`, `table`) dispatched by `TopicSection.vue`. The static pages
dispatch the same way through `SECTION_RENDERERS` in `tools/prerender.mjs`, where
a kind with no entry fails the build — and where a renderer with no kind is
deleted, which is what happened to `awards` when that topic stopped having a
page.

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

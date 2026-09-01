/**
 * Renders the static, crawlable copy of every reference topic.
 *
 * WHY THIS EXISTS. The app is hash-routed (`createWebHashHistory`, paired with
 * `base: "./"` so dist/ is position-independent). A fragment is not part of a URL
 * as far as a crawler is concerned, so every reference page in this site —
 * 68 sections, ~44,000 characters of transcribed charts — collapses into the one
 * URL `/saltdog/`. None of it can rank for the queries it answers: "navy warrant
 * officer paygrades", "what does J4 do", "how many points is a good year".
 *
 * So: at build time, one plain HTML file per topic at a REAL path
 * (`/saltdog/knowledge/ranks/`), generated from the same data modules the app
 * renders. Google indexes those; a reader who lands on one gets the full chart
 * immediately and a link into the interactive version.
 *
 * WHY NOT SWITCH TO HISTORY ROUTING AND PRERENDER THE APP. It would need the
 * 404-based SPA fallback, it would cost `base: "./"` portability, and it would
 * orphan every hash link already shared — including the one in the sibling
 * homepage's FAQ. Static siblings alongside the hash app cost none of that.
 *
 * WHAT IS AND IS NOT DUPLICATED. The data is not: every fact comes from
 * `src/data/*.js` through `PAGE_TOPICS` — every topic with a page of its own,
 * which is deliberately not every topic the search corpus indexes: awards is
 * rendered by the ribbon rack calculator and has no page to mirror. The
 * PRESENTATION is — these renderers are
 * a second implementation of what TopicSection.vue does, because a Vue template
 * cannot run in Node without dragging Vuetify through SSR, and because a static
 * page genuinely wants simpler markup than the app's.
 *
 * That duplication is the risk this file carries, so it is guarded two ways in
 * tools/verify-corpus.mjs rather than by discipline:
 *
 *   1. `SECTION_RENDERERS` is keyed by `section.kind`, and a topic carrying a kind
 *      with no entry THROWS. Adding a kind to TopicSection.vue without adding one
 *      here fails the build instead of silently emitting an empty page.
 *   2. Every string in the data must appear on the page it belongs to, with a
 *      NAMED exemption for each field deliberately not printed and a reason for
 *      it. A renderer that drops rows, or a table that loses a column, fails —
 *      which is what makes "the static page says the same thing as the app" a test
 *      rather than a claim. It has already caught one: citations here were
 *      printing `d.label` where DirectiveRefs.vue prints `display(d)`, losing the
 *      revision letter off every instruction cited on every page.
 */

import { PAGE_TOPICS } from "../src/data/index.js";
import { viaLabel, systemsFor } from "../src/data/systems.js";
import { directiveUrl, directivesFor, display, libraryName } from "../src/data/directives.js";
import { insigniaStyle } from "../src/lib/insignia.js";

/** Absolute origin, for canonicals and the sitemap. Nothing else may hardcode it. */
export const ORIGIN = "https://thepollywog.github.io";

/** Where the app is deployed under that origin. */
export const BASE_PATH = "/saltdog/";

const NO_REPORTS = "— no reports due —";

// ---------------------------------------------------------------------------
// escaping and small helpers
// ---------------------------------------------------------------------------

/**
 * HTML-escape. Applied to EVERY interpolated data value without exception.
 *
 * The data modules hold real Unicode — em-dashes, ≥, → — deliberately (see the
 * de-entitize note in verify-corpus), and several transcribed titles contain
 * ampersands: "Awards & Precedence", "Personnel / Pay / Records". Vue escaped
 * those for free. Here nothing does, so an unescaped `&` in a title is an invalid
 * entity reference and an unescaped one in an attribute can end the attribute.
 */
export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const lines = (...xs) => xs.filter(Boolean).join("\n");

/**
 * An inline style object from insigniaStyle, as a CSS declaration
 * string, with the sprite sheet's URL re-based.
 *
 * Both helpers return `url(./img/…)`, which is correct for a document at the app
 * root and wrong for one at `knowledge/ranks/` — `./` is relative to the
 * DOCUMENT, so it would resolve to `knowledge/ranks/img/ranks.png`. The sprite
 * maths stays in lib/ where the app's own copy lives; only the prefix moves.
 */
export function styleAttr(styleObject, prefix) {
  return Object.entries(styleObject)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return `${prop}: ${String(v).replace(/url\(\.\//g, `url(${prefix}`)}`;
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------

/**
 * Output path for a topic, mirroring the app's own route so the static URL and
 * the hash URL read the same. Quick links has its own route in the app and keeps
 * it here.
 */
export function pagePathFor(topicId) {
  return topicId === "quicklinks" ? "quick-links/index.html" : `knowledge/${topicId}/index.html`;
}

/** The in-app hash route for a topic — the interactive version of the same page. */
export function hashRouteFor(topicId) {
  return topicId === "quicklinks" ? "#/quick-links" : `#/knowledge/${topicId}`;
}

/**
 * `../`-per-directory prefix back to the app root, DERIVED from the output path
 * rather than written per page. `quick-links/` is one deep and
 * `knowledge/<id>/` is two, and hardcoding either is how a page ends up with
 * a stylesheet-less, favicon-less, sprite-less render that still returns 200.
 */
export function prefixFor(pagePath) {
  return "../".repeat(pagePath.split("/").length - 1);
}

/** The canonical URL of a generated page. Directory form, no `index.html`. */
export function canonicalFor(pagePath) {
  return `${ORIGIN}${BASE_PATH}${pagePath.replace(/index\.html$/, "")}`;
}

// ---------------------------------------------------------------------------
// section renderers, one per section.kind
// ---------------------------------------------------------------------------

/**
 * A column-driven table. Shared by `table` and by any `map` carrying one.
 *
 * `caption` may be null, and several kinds pass null deliberately. The app's
 * RefTable always has one because it renders in the chat answer card too, where
 * there is no heading above it — here there always is, so a caption repeating it
 * would be read out twice by a screen reader and add a line of noise for
 * everyone else. When there is no caption the table is labelled by the section's
 * own <h2> instead, which is the same information without the duplication.
 */
function table(columns, rows, caption, cell = () => null, labelledBy = null) {
  const cols = columns ?? Object.keys(rows[0] ?? {}).map((key) => ({ key, title: key }));
  const head = cols.map((c) => `<th scope="col">${esc(c.title ?? c.key)}</th>`).join("");
  const body = rows
    .map((row) => {
      const tds = cols
        .map((c) => {
          const custom = cell(c.key, row);
          const value = custom ?? esc(row[c.key] ?? "");
          return `<td${c.mono ? ' class="mono"' : ""}>${value}</td>`;
        })
        .join("");
      return `        <tr>${tds}</tr>`;
    })
    .join("\n");

  // The wrapper scrolls instead of the page: the awards table is five columns and
  // the rank tables are five, and on a phone one of them has to give.
  return `      <div class="scroll">
        <table${!caption && labelledBy ? ` aria-labelledby="${esc(labelledBy)}"` : ""}>
${caption ? `          <caption>${esc(caption)}</caption>\n` : ""}          <thead><tr>${head}</tr></thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>`;
}

/** Link rows out to the systems a checklist item or procedure is carried out in. */
function systemLinks(ids) {
  const systems = systemsFor(ids ?? []);
  if (!systems.length) return "";
  const items = systems
    .map((s) =>
      s.url
        ? `<a href="${esc(s.url)}" rel="noopener noreferrer nofollow">${esc(s.name)}</a>`
        : `<span>${esc(s.name)}</span>`,
    )
    .join(" ");
  return `<p class="sys">${items}</p>`;
}

/** The instructions a section or row rests on. */
function refs(ids) {
  const ds = directivesFor(ids ?? []);
  if (!ds.length) return "";
  const items = ds
    .map((d) => {
      // display(), not d.label: a CITATION carries the revision letter, exactly
      // as DirectiveRefs.vue renders it. The directives topic page splits the
      // letter off into a parenthetical instead, and that difference is
      // deliberate — see the note on the `directives` renderer below.
      const label = esc(display(d));
      const url = directiveUrl(d);
      const link = url
        ? `<a href="${esc(url)}" rel="noopener noreferrer nofollow">${label}</a>`
        : label;
      return `<li>${link} — ${esc(d.title)}</li>`;
    })
    .join("");
  return `<div class="refs"><p class="eyebrow">Authority</p><ul class="plain">${items}</ul></div>`;
}

const SECTION_RENDERERS = {
  links: (s) =>
    `      <ul class="rows">
${(s.rows ?? [])
  .map((l) => {
    const via = viaLabel(l.id);
    const name = l.url
      ? `<a href="${esc(l.url)}" rel="noopener noreferrer nofollow">${esc(l.name)}</a>`
      : `<span class="strong">${esc(l.name)}</span>`;
    return `        <li>
          <p class="row-head">${name}${via ? ` <span class="dim">${esc(via)}</span>` : ""}${
            l.cac ? ' <span class="tag">CAC</span>' : ""
          }</p>
          <p>${esc(l.desc)}</p>
          <p class="url">${esc(l.access)}</p>
        </li>`;
  })
  .join("\n")}
      </ul>`,

  // Read-only here, exactly as in the app: the tickable version is a tool, and a
  // checkbox on a static page would be a control that forgets.
  checklist: (s) =>
    `      <ul class="rows">
${(s.rows ?? [])
  .map(
    (i) => `        <li>
          <p><span class="box" aria-hidden="true">▢</span> ${esc(i.label)}</p>
${i.note ? `          <p class="dim">${esc(i.note)}</p>` : ""}
${i.systems?.length ? `          ${systemLinks(i.systems)}` : ""}
${i.refs?.length ? `          ${refs(i.refs)}` : ""}
        </li>`,
  )
  .join("\n")}
      </ul>`,

  steps: (s) =>
    `      <ol>
${(s.rows ?? []).map((step) => `        <li>${esc(step)}</li>`).join("\n")}
      </ol>
${s.systems?.length ? `      ${systemLinks(s.systems)}` : ""}`,

  // A blockquote of one <p> per line, not a <ul>: the Creed is prose that happens
  // to be line-broken, and the line breaks have to survive a copy-paste into the
  // Word document someone is building a quarters brief in.
  verbatim: (s) =>
    `      <blockquote>
${(s.rows ?? []).map((line) => `        <p>${esc(line)}</p>`).join("\n")}
      </blockquote>`,

  kv: (s) =>
    `      <dl>
${(s.rows ?? [])
  .map((p) => `        <dt>${esc(p.k)}</dt>\n        <dd>${esc(p.v)}</dd>`)
  .join("\n")}
      </dl>`,

  "code-cards": (s) =>
    `      <div class="cards">
${(s.rows ?? [])
  .map(
    (c) => `        <div class="card">
          <p class="card-head"><span class="code">${esc(c.code)}</span> ${esc(c.title)}</p>
          <ul>${(c.bullets ?? []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
        </div>`,
  )
  .join("\n")}
      </div>`,

  // Months with no reports are named, never left blank — a blank cell reads as
  // missing data rather than as a fact about the month.
  "eval-schedule": (s) =>
    table(
      [
        { key: "month", title: "Month", mono: true },
        { key: "officer", title: "Officer (FITREP)" },
        { key: "enlisted", title: "Enlisted (EVAL)" },
      ],
      s.rows ?? [],
      "Reporting month by paygrade",
      (key, row) => {
        if (key !== "officer" && key !== "enlisted") return null;
        const v = row[key];
        return v.length ? `<span class="mono">${esc(v.join(", "))}</span>` : esc(NO_REPORTS);
      },
    ),

  phonetic: (s) =>
    table(
      [
        { key: "letter", title: "Char", mono: true },
        { key: "word", title: "Code word" },
      ],
      s.rows ?? [],
      "Phonetic code words",
    ),

  /**
   * One service, all tiers. `rows` is a service OBJECT here, not an array —
   * the one section kind where that is true.
   *
   * The insignia sprite is decoration and carries no alt text: the grade and the
   * title are in the neighbouring cells, so describing it would make a screen
   * reader read every rank twice. E-1 gets an em-dash, because the source chart's
   * own answer is the words "No Insignia" and an empty cell would read as a hole
   * in the transcription.
   */
  ranks: (s, { prefix }) => {
    const svc = s.rows ?? {};
    const flat = [];
    for (const [tier, label] of [
      ["officer", "Officer"],
      ["warrant", "Warrant"],
      ["enlisted", "Enlisted"],
    ]) {
      for (const r of svc[tier] ?? []) flat.push({ ...r, tier: label });
    }

    const t = table(
      [
        { key: "tier", title: "Tier" },
        { key: "grade", title: "Grade", mono: true },
        { key: "insignia", title: "Insignia" },
        { key: "title", title: "Title" },
        { key: "abbr", title: "Abbr.", mono: true },
      ],
      flat,
      // Not "<service> ranks by paygrade": the <h2> directly above already says
      // the service, and the ordering is the one thing about this table that is
      // not obvious — it runs officer, warrant, enlisted, which is not the order
      // the paygrade numbers suggest.
      "Officer, then warrant, then enlisted — ascending within each tier",
      (key, row) => {
        if (key === "insignia") {
          const style = insigniaStyle(svc.id, row, 44);
          return style
            ? `<span class="insignia" style="${esc(styleAttr(style, prefix))}" role="presentation"></span>`
            : '<span class="dim" aria-hidden="true">—</span>';
        }
        if (key === "title" && row.corrected) {
          return `${esc(row.title)} <sup title="${esc(row.corrected)}">†</sup>`;
        }
        return null;
      },
    );

    return lines(
      t,
      !svc.warrant?.length && svc.warrantNote
        ? `      <p class="note">${esc(svc.warrantNote)}</p>`
        : "",
      svc.seniorEnlisted
        ? `      <p><span class="eyebrow">Senior enlisted advisor</span> ${esc(svc.seniorEnlisted)}</p>`
        : "",
      svc.wartime
        ? `      <p><span class="eyebrow">Wartime / special grade</span> ${esc(svc.wartime)}</p>`
        : "",
      ...flat
        .filter((r) => r.corrected)
        .map((r) => `      <p class="dim small">† ${esc(r.grade)}: ${esc(r.corrected)}</p>`),
      // The topic-level PDF button offers usn-ranks.pdf only, which on a page
      // showing all six services names the wrong chart five times out of six.
      // Each service carries the chart it was transcribed from, so link it here.
      svc.sourcePdf
        ? `      <p class="small"><a href="${prefix}pdf/${esc(svc.sourcePdf)}" download>Download the ${esc(s.heading)} chart (PDF)</a></p>`
        : "",
    );
  },

  /**
   * The map itself is NOT drawn here. It is 46 KB of projected path data behind an
   * async component, it is an orientation aid rather than the reference, and
   * inlining it would make the one page a crawler is meant to read quickly the
   * heaviest file in the folder.
   *
   * Its CONTENT still ships, because the marker labels are the part someone
   * searches for — "which fleet covers Bahrain" is answered by a pin, not by a
   * coastline. Caption, markers, and the table if the section has one; the link to
   * the interactive version above the section is where the drawing lives.
   */
  map: (s) => {
    const m = s.map ?? {};
    const marks = [...(m.pins ?? []), ...(m.zones ?? [])].map((p) => p.label);
    return lines(
      marks.length
        ? `      <p class="eyebrow">Marked on the interactive map</p>
      <ul class="inline">${marks.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
        : "",
      m.caption ? `      <p class="dim small">${esc(m.caption)}</p>` : "",
      s.columns ? table(s.columns, s.rows ?? [], null, undefined, `sec-${s.id}-h`) : "",
    );
  },

  /**
   * The instruction is the row: number, title, what it governs, where to read it.
   * The revision letter is a parenthetical rather than part of the number — see
   * data/directives.js on why a letter is not an identity.
   */
  directives: (s) =>
    `      <ul class="rows">
${(s.rows ?? [])
  .map((d) => {
    const url = directiveUrl(d);
    const label = url
      ? `<a class="mono" href="${esc(url)}" rel="noopener noreferrer nofollow">${esc(d.label)}</a>`
      : `<span class="mono strong">${esc(d.label)}</span>`;
    const qualifiers = [
      d.rev ? `(rev ${esc(d.rev)} as transcribed)` : "",
      d.parent ? `article of ${esc(d.parent === "respersman" ? "RESPERSMAN" : d.parent)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `        <li>
          <p class="row-head">${label}${qualifiers ? ` <span class="dim">${qualifiers}</span>` : ""}</p>
          <p class="strong">${esc(d.title)}</p>
          <p>${esc(d.governs)}</p>
          <p class="url">Find it at ${esc(libraryName(d))}</p>
        </li>`;
  })
  .join("\n")}
      </ul>`,

  table: (s) => table(s.columns, s.rows ?? [], null, undefined, `sec-${s.id}-h`),
};

/** Every kind this file can render. Exported so a test can compare it to the data. */
export const RENDERABLE_KINDS = Object.freeze(Object.keys(SECTION_RENDERERS).sort());

/** One section, heading and all. */
export function renderSection(section, opts) {
  const render = SECTION_RENDERERS[section.kind];
  // Throws rather than emitting a placeholder. A page that silently renders an
  // empty section is a page that gets indexed empty, and indexing thin content is
  // worse than not being indexed at all.
  if (!render) {
    throw new Error(
      `prerender: no renderer for section kind "${section.kind}" (section "${section.id}"). ` +
        `Add one to SECTION_RENDERERS in tools/prerender.mjs.`,
    );
  }
  return `    <section id="sec-${esc(section.id)}" aria-labelledby="sec-${esc(section.id)}-h">
      <h2 id="sec-${esc(section.id)}-h">${esc(section.heading)}</h2>
${render(section, opts)}
${section.refs?.length ? `      ${refs(section.refs)}` : ""}
${section.note ? `      <p class="dim small">${esc(section.note)}</p>` : ""}
    </section>`;
}

// ---------------------------------------------------------------------------
// the page
// ---------------------------------------------------------------------------

/**
 * The stylesheet, inlined.
 *
 * Inlined rather than shared for the same reason the sibling homepage inlines
 * its own: it is small enough that one request beats two, and a shared file would
 * be a render-blocking fetch on twelve pages to save a few hundred bytes on each.
 * These pages carry NO JAVASCRIPT — not the app, not a snippet, nothing — so a
 * crawler and a reader both get a finished page from a single request.
 *
 * Colours are the app's own theme tokens from src/plugins/vuetify.js, and
 * verify-corpus asserts they still match it. The one rule that matters: gold
 * (#C8A951) is 2.27:1 on white and FAILS, so light mode uses the darkened
 * #8A6D1F (4.86:1) for anything gold-toned that carries text.
 */
const STYLE = `      :root {
        color-scheme: dark light;
        --bg: #0a1628;
        --surface: #10203a;
        --line: #2a4266;
        --text: #e8edf4;
        --dim: #b8c6d9;
        --gold: #c8a951;
        --on-gold: #0a1628;
      }
      @media (prefers-color-scheme: light) {
        :root {
          --bg: #f4f6fa;
          --surface: #ffffff;
          --line: #c3cddb;
          --text: #141a22;
          --dim: #3c4b60;
          --gold: #8a6d1f;
          --on-gold: #ffffff;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .wrap { max-width: 62rem; margin: 0 auto; padding: 0 20px; }
      .skip {
        position: absolute; left: -9999px; top: 0; z-index: 9;
        background: var(--gold); color: var(--on-gold); padding: 10px 16px;
      }
      .skip:focus { left: 0; }
      a { color: var(--text); text-decoration-color: var(--gold); text-underline-offset: 3px; }
      a:focus-visible, summary:focus-visible {
        outline: 2px solid var(--gold);
        outline-offset: 2px;
      }
      header.masthead { border-bottom: 1px solid var(--line); padding: 14px 0; }
      .masthead .wrap { display: flex; flex-wrap: wrap; gap: 12px; align-items: baseline; justify-content: space-between; }
      .brand { font-weight: 700; letter-spacing: 0.12em; text-decoration: none; }
      .crumbs { color: var(--dim); font-size: 0.85rem; }
      .crumbs a { color: var(--dim); }
      main { padding: 28px 0 8px; }
      h1 { font-size: clamp(1.55rem, 1.1rem + 1.8vw, 2.2rem); line-height: 1.2; margin: 0 0 12px; }
      h2 { font-size: 1.2rem; margin: 0 0 12px; }
      .lede { color: var(--dim); max-width: 68ch; margin: 0 0 20px; }
      .eyebrow {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase;
        color: var(--dim); display: inline-block; margin: 0 6px 0 0;
      }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 24px; }
      .btn {
        display: inline-block; background: var(--gold); color: var(--on-gold);
        text-decoration: none; font-weight: 600; padding: 9px 16px; border-radius: 2px;
      }
      .btn.ghost { background: transparent; color: var(--text); border: 1px solid var(--line); }
      .notice {
        border-inline-start: 3px solid var(--gold); padding: 2px 0 2px 16px;
        margin: 0 0 24px; max-width: 70ch;
      }
      .notice p { margin: 0 0 8px; }
      .notice p:last-child { margin-bottom: 0; color: var(--dim); }
      section { margin: 0 0 34px; }
      p { margin: 0 0 10px; }
      .dim { color: var(--dim); }
      .small { font-size: 0.86rem; }
      .strong { font-weight: 600; }
      .mono, .code, .url {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .url { font-size: 0.8rem; color: var(--dim); word-break: break-all; }
      .note {
        border-inline-start: 3px solid var(--line);
        padding-inline-start: 14px;
        color: var(--dim);
        margin-bottom: 20px;
      }
      ul.rows { list-style: none; padding: 0; margin: 0; }
      ul.rows > li { border-bottom: 1px solid var(--line); padding: 12px 0; }
      ul.rows > li > p:last-child { margin-bottom: 0; }
      .row-head { font-weight: 600; }
      .box { opacity: 0.5; }
      .tag {
        font-size: 0.65rem; letter-spacing: 0.08em; border: 1px solid var(--line);
        padding: 1px 6px; border-radius: 2px; color: var(--dim); vertical-align: 1px;
      }
      ol { padding-inline-start: 22px; margin: 0 0 12px; }
      ol li { margin-bottom: 6px; }
      blockquote { border-inline-start: 3px solid var(--gold); padding-inline-start: 16px; margin: 0; }
      dl { margin: 0; }
      dt { font-weight: 600; margin-top: 12px; }
      dd { margin: 2px 0 0; color: var(--dim); }
      ul.plain, ul.inline { list-style: none; padding: 0; margin: 0 0 10px; }
      ul.inline li { display: inline; }
      ul.inline li:not(:last-child)::after { content: " · "; color: var(--dim); }
      .sys a { margin-inline-end: 12px; font-size: 0.9rem; }
      .refs { margin-top: 10px; font-size: 0.86rem; }
      .cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
      .card { border: 1px solid var(--line); background: var(--surface); padding: 14px; }
      .card ul { padding-inline-start: 20px; margin: 0; }
      .card-head { font-weight: 600; margin-bottom: 8px; }
      .code { color: var(--gold); font-weight: 700; }
      .scroll { overflow-x: auto; margin: 0 0 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 0.92rem; }
      caption {
        text-align: start; color: var(--dim); font-size: 0.8rem;
        padding-bottom: 8px;
      }
      th, td { text-align: start; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
      th { color: var(--dim); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
      tbody tr:hover { background: var(--surface); }
      .insignia { display: inline-block; }
      nav.siblings { border-top: 1px solid var(--line); padding: 22px 0 0; margin-top: 8px; }
      nav.siblings ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px 20px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      footer { border-top: 1px solid var(--line); margin-top: 26px; padding: 20px 0 40px; color: var(--dim); font-size: 0.88rem; }
      sup { cursor: help; }`;

/** Site-wide caveat. These pages are search entry points, so it is not a footnote. */
const DISCLAIMER = `      <aside class="notice" role="note">
        <p>
          <strong>Unofficial.</strong> SALTDOG is an independent project, not affiliated with,
          endorsed by, or a publication of the U.S. Department of the Navy. Nothing here is a
          system of record.
        </p>
        <p>
          Transcribed from the published charts and instructions cited on each page. Verify
          anything you act on against the official source, your NOSC, or MyNavy Career Center at
          <a href="tel:+18333306622">1-833-330-MNCC</a>.
        </p>
      </aside>`;

/**
 * Structured data: a WebPage inside the site, with a breadcrumb.
 *
 * BreadcrumbList is the one node here that earns its place — Google does render
 * breadcrumbs in results, and unlike the sibling homepage's FAQPage there is now
 * real depth to describe. Deliberately absent: `Article` (these are transcribed
 * reference tables, not authored articles) and `HowTo`, which Google stopped
 * showing entirely in 2023 and which the `steps` sections would otherwise invite.
 */
function jsonLd(topic, pagePath, lastmod) {
  const url = canonicalFor(pagePath);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: `${topic.title} — SALTDOG`,
        description: topic.blurb,
        inLanguage: "en-US",
        dateModified: lastmod,
        isPartOf: { "@type": "WebSite", "@id": `${ORIGIN}${BASE_PATH}#website` },
        publisher: { "@type": "Organization", "@id": `${ORIGIN}/#organization` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}${BASE_PATH}#website`,
        url: `${ORIGIN}${BASE_PATH}`,
        name: "SALTDOG",
        inLanguage: "en-US",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "SALTDOG", item: `${ORIGIN}${BASE_PATH}` },
          { "@type": "ListItem", position: 2, name: "Reference", item: `${ORIGIN}${BASE_PATH}knowledge/` },
          { "@type": "ListItem", position: 3, name: topic.title },
        ],
      },
    ],
  };
  return JSON.stringify(graph, null, 2)
    .split("\n")
    .map((l) => `      ${l}`)
    .join("\n");
}

/** Shared <head>. `title` and `desc` are already plain text, not escaped. */
function head({ title, desc, pagePath, prefix, extra = "" }) {
  const canonical = canonicalFor(pagePath);
  return `  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0A1628" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F6FA" />
    <link rel="icon" type="image/svg+xml" href="${prefix}favicon.svg" />
    <link rel="icon" type="image/x-icon" href="${prefix}favicon.ico" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="SALTDOG" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta name="twitter:card" content="summary" />
${extra}    <style>
${STYLE}
    </style>
  </head>`;
}

/** Masthead and breadcrumb trail. */
function masthead(prefix, here) {
  return `    <header class="masthead">
      <div class="wrap">
        <a class="brand" href="${prefix}">SALTDOG</a>
        <p class="crumbs">
          <a href="${prefix}">Home</a> ›
          <a href="${prefix}knowledge/">Reference</a>${here ? ` › ${esc(here)}` : ""}
        </p>
      </div>
    </header>`;
}

function footer(prefix) {
  return `    <footer>
      <div class="wrap">
        <p>
          <strong>SALTDOG</strong> — unofficial, independent, and not a Department of the Navy
          publication. Nothing here is a system of record.
        </p>
        <p>
          This is the static, printable copy of a reference card.
          <a href="${prefix}">Open the full SALTDOG app</a> for search, readiness tools, and
          the interactive version of this page.
        </p>
      </div>
    </footer>`;
}

/** Links to every other static reference page — the crawl path between them. */
function siblings(topics, currentId, prefix) {
  const items = topics
    .filter((t) => t.id !== currentId)
    .map((t) => {
      const href = `${prefix}${pagePathFor(t.id).replace(/index\.html$/, "")}`;
      return `          <li><a href="${esc(href)}">${esc(t.title)}</a></li>`;
    })
    .join("\n");
  return `      <nav class="siblings" aria-labelledby="more-h">
        <p class="eyebrow" id="more-h">Other reference cards</p>
        <ul>
${items}
        </ul>
      </nav>`;
}

/**
 * One topic, as a standalone page.
 *
 * @param {object} topic     from PAGE_TOPICS
 * @param {object} opts
 * @param {object[]} opts.topics  every topic, for the sibling nav
 * @param {string} opts.lastmod   ISO date (YYYY-MM-DD)
 */
export function renderTopicPage(topic, { topics, lastmod }) {
  const pagePath = pagePathFor(topic.id);
  const prefix = prefixFor(pagePath);
  const title = `${topic.title} — SALTDOG`;
  const sections = (topic.sections ?? [])
    .map((s) => renderSection(s, { prefix }))
    .join("\n\n");

  const pdf = topic.sourcePdf
    ? `        <a class="btn ghost" href="${prefix}pdf/${esc(topic.sourcePdf)}" download>Download the source PDF</a>`
    : "";

  return `<!doctype html>
<!--
  GENERATED FILE — do not edit. Written by tools/prerender.mjs at build time from
  the topic registry in src/data/index.js. Edit the data module it points at.

  This is the crawlable copy of a page the app serves at ${hashRouteFor(topic.id)}.
  The app is hash-routed, and a fragment is not a URL to a crawler, so without
  this file the content below could not be indexed or ranked at all.
-->
<html lang="en">
${head({ title, desc: topic.blurb, pagePath, prefix, extra: `    <script type="application/ld+json">\n${jsonLd(topic, pagePath, lastmod)}\n    </script>\n` })}
  <body>
    <a class="skip" href="#main">Skip to content</a>
${masthead(prefix, topic.title)}

    <main id="main" tabindex="-1">
      <div class="wrap">
        <p class="eyebrow">${esc(topic.eyebrow ?? "Reference")}</p>
        <h1>${esc(topic.title)}</h1>
        <p class="lede">${esc(topic.blurb)}</p>

        <div class="actions">
          <a class="btn" href="${prefix}${hashRouteFor(topic.id)}">Open the interactive version</a>
${pdf}
        </div>

${topic.note ? `        <p class="note">${esc(topic.note)}</p>\n` : ""}${DISCLAIMER}

${sections}

${siblings(topics, topic.id, prefix)}
      </div>
    </main>

${footer(prefix)}
  </body>
</html>
`;
}

/**
 * `knowledge/index.html` — the hub the sibling homepage links to and the one page
 * that reaches every other. Without it a crawler arriving at the origin root has
 * no path into any of this: the app's own nav is rendered by JavaScript.
 */
export function renderIndexPage({ topics, lastmod }) {
  const pagePath = "knowledge/index.html";
  const prefix = prefixFor(pagePath);
  // Both written to a length that survives a result list rather than to fit the
  // page: ~60 for the title, ~155 for the description, past which Google
  // truncates and the last clause is spent on nothing.
  const title = "Navy Reference Cards — Ranks, Awards, COCOMs — SALTDOG";
  const desc =
    "Free, no-account reference cards for Sailors and Navy Reservists: rank and insignia " +
    "charts for all six services, award precedence, COCOMs, and joint staff codes.";

  const cards = topics
    .map((t) => {
      const href = `${prefix}${pagePathFor(t.id).replace(/index\.html$/, "")}`;
      const count = (t.sections ?? []).length;
      return `        <li>
          <p class="row-head"><a href="${esc(href)}">${esc(t.title)}</a></p>
          <p>${esc(t.blurb)}</p>
          <p class="dim small">${count} section${count === 1 ? "" : "s"}${
            t.sourcePdf ? " · source PDF available" : ""
          }</p>
        </li>`;
    })
    .join("\n");

  const ld = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": canonicalFor(pagePath),
      url: canonicalFor(pagePath),
      name: title,
      description: desc,
      inLanguage: "en-US",
      dateModified: lastmod,
      isPartOf: { "@type": "WebSite", "@id": `${ORIGIN}${BASE_PATH}#website` },
      hasPart: topics.map((t) => ({
        "@type": "WebPage",
        "@id": canonicalFor(pagePathFor(t.id)),
        name: t.title,
        description: t.blurb,
      })),
    },
    null,
    2,
  )
    .split("\n")
    .map((l) => `      ${l}`)
    .join("\n");

  return `<!doctype html>
<!--
  GENERATED FILE — do not edit. Written by tools/prerender.mjs from the topic
  registry in src/data/index.js.
-->
<html lang="en">
${head({ title, desc, pagePath, prefix, extra: `    <script type="application/ld+json">\n${ld}\n    </script>\n` })}
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header class="masthead">
      <div class="wrap">
        <a class="brand" href="${prefix}">SALTDOG</a>
        <p class="crumbs"><a href="${prefix}">Home</a> › Reference</p>
      </div>
    </header>

    <main id="main" tabindex="-1">
      <div class="wrap">
        <p class="eyebrow">Reference</p>
        <h1>Navy reference cards</h1>
        <p class="lede">
          ${esc(desc)} Every card is transcribed from a published chart or instruction, cites it,
          and links the original. These pages are static and carry no JavaScript; the
          <a href="${prefix}">SALTDOG app</a> adds search and the readiness tools.
        </p>

        <div class="actions">
          <a class="btn" href="${prefix}#/knowledge">Open the interactive version</a>
        </div>

${DISCLAIMER}

        <ul class="rows">
${cards}
        </ul>
      </div>
    </main>

${footer(prefix)}
  </body>
</html>
`;
}

/**
 * `sitemap.xml`, scoped to this app.
 *
 * A sitemap may only list URLs at or below its own path, so this one covers
 * `/saltdog/` and nothing else — which is exactly right: the app's build knows
 * what pages it just generated, and the sibling homepage's root sitemap cannot.
 * The root `robots.txt` names both.
 *
 * No `<changefreq>` and no `<priority>`: Google ignores both. `<lastmod>` is read,
 * but only when it is honest, so it comes from the build rather than from a
 * hand-typed date that would rot the moment the data changed.
 */
export function renderSitemap({ topics, lastmod }) {
  const urls = [
    `${ORIGIN}${BASE_PATH}`,
    `${ORIGIN}${BASE_PATH}knowledge/`,
    ...topics.map((t) => canonicalFor(pagePathFor(t.id))),
  ];
  const body = urls
    .map((u) => `  <url>\n    <loc>${esc(u)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  GENERATED FILE — written by tools/prerender.mjs at build time.

  Scoped to /saltdog/, because a sitemap may only list URLs at or below its own
  path. The root sitemap at the origin lists the three sites; this one lists the
  static reference pages inside this app, which only this build knows about.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/**
 * Everything to emit, as `{ fileName, source }`. One function so the vite plugin
 * and the test harness enumerate the same set — a page the tests do not know
 * about is a page nobody checked.
 */
export function renderAll({ lastmod, topics = PAGE_TOPICS } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lastmod))) {
    throw new Error(`prerender: lastmod must be YYYY-MM-DD, got "${lastmod}"`);
  }
  return [
    { fileName: "knowledge/index.html", source: renderIndexPage({ topics, lastmod }) },
    ...topics.map((t) => ({
      fileName: pagePathFor(t.id),
      source: renderTopicPage(t, { topics, lastmod }),
    })),
    { fileName: "sitemap.xml", source: renderSitemap({ topics, lastmod }) },
  ];
}

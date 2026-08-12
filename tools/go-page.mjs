/**
 * Renders `go/index.html` — the static bang redirector.
 *
 * Used by both hooks of the vite plugin in vite.config.js: `generateBundle`
 * emits it into dist/, and `configureServer` serves the same bytes under
 * `npm run dev`. One renderer, because a redirector that behaves differently in
 * dev than in production is worse than not having one.
 *
 * WHY A HAND-WRITTEN HTML STRING AND NOT A VUE ROUTE. This page's whole job is
 * to stop existing. The app entry is ~130 KB of Vuetify plus the router before
 * it can read `location.search`, and every millisecond of that is spent on a
 * page the user will never see. So: one file, one request, no imports, table
 * inlined, redirect issued from a synchronous inline script in <head>. It never
 * touches Vue, the router, or the retrieval chunk.
 *
 * WHY IT DOESN'T IMPORT lib/bangs.js AT RUNTIME. It can't — that's an ES module
 * in src/, and importing it would mean a second request and a module graph. So
 * the resolver is inlined as source text, taken from the real module rather than
 * retyped, and `assertGoPageMatchesResolver` in verify-corpus checks that the
 * copy still agrees with the original on every registered key. A hand-written
 * duplicate of resolution logic is exactly the kind of thing that drifts.
 *
 * GITHUB PAGES MECHANICS, measured against the live host rather than assumed:
 *
 *   GET /saltdog/go?q=nsips  -> 301 Location: /saltdog/go/?q=nsips
 *
 * Pages does the directory-slash redirect and PRESERVES the query string, so
 * `…/saltdog/go?q=%s` is a legal thing to register even though Pages has no
 * rewrite rules and cannot issue a redirect of its own. Paths are also
 * case-sensitive there (/webnavfit/ resolves, /WEBNAVFIT/ 404s), so this is
 * emitted lowercase and documented lowercase.
 */

/** `../#/go?q=…` — the in-app route, relative so it works under any base path. */
const APP_FALLBACK = "../#/go";

/**
 * The redirect page.
 *
 * @param {object[]} table  from `bangTable()` — keys, system, name, reach, url
 * @param {string} resolverSource  inlined text of the resolver functions
 */
export function renderGoPage(table, resolverSource) {
  const json = JSON.stringify(table);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Redirecting… — SALTDOG</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0; min-height: 100vh;
        display: flex; align-items: center; justify-content: center;
        font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #0a1628; color: #e8edf5;
      }
      main { padding: 24px; max-width: 60ch; }
      p { opacity: 0.8; }
      a { color: #c8a951; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    </style>
    <script>
      // Inlined from src/lib/bangs.js. Do not edit here — verify-corpus asserts
      // this copy still resolves every registered key the same way the module
      // does, and a divergence fails the build's test run.
      var TABLE = ${json};
${resolverSource}

      (function () {
        var q = queryFromLocation(location);
        var r = resolveBang(q, TABLE);

        // replace(), not assign(): the redirector should not sit in history
        // between the address bar and the destination, or Back returns here and
        // immediately bounces forward again.
        if (r.kind === "external") {
          location.replace(r.url);
          return;
        }
        // Everything else needs a sentence, and sentences need the app.
        location.replace(${JSON.stringify(APP_FALLBACK)} + (q ? "?q=" + encodeURIComponent(q) : ""));
      })();
    </script>
  </head>
  <body>
    <!--
      Shown only if the script did not run (JS disabled, or a parse error). The
      redirect is the feature, so this is a dead end by nature — it links onward
      rather than pretending to resolve anything.
    -->
    <main>
      <p>
        This page forwards browser-search shortcuts to the right Navy system.
        It needs JavaScript to read your query.
      </p>
      <p><a href="../#/go">Open the SALTDOG shortcut list</a></p>
    </main>
  </body>
</html>
`;
}

/**
 * Extract the two resolver functions from lib/bangs.js as plain source text.
 *
 * Pulled out of the real module by name so the inlined copy cannot be edited
 * independently of the tested one. The extraction is deliberately strict — a
 * rename that makes a marker unfindable throws at build time instead of emitting
 * a page whose script is silently missing a function.
 */
export function extractResolver(moduleSource) {
  const wanted = ["normalizeKey", "queryFromLocation", "resolveBang"];
  const out = [];

  for (const name of wanted) {
    const src = sliceDeclaration(moduleSource, name);
    if (!src) throw new Error(`go-page: could not find "${name}" in lib/bangs.js`);
    out.push(src);
  }

  return (
    out
      .join("\n\n")
      // `export` is invalid in a classic <script>, and the default parameter
      // `entries = BANG_ENTRIES` refers to a module binding that isn't inlined —
      // the page passes TABLE explicitly, so the default is dropped.
      .replace(/^export\s+/gm, "")
      .replace(/entries = BANG_ENTRIES/g, "entries")
      .replace(/^/gm, "      ")
  );
}

/**
 * Slice one top-level `const name =` or `function name(` declaration out of a
 * module by brace/paren balance.
 *
 * Braces are counted rather than regex-matched because these functions contain
 * both nested blocks and object literals; a non-greedy match to the first `}`
 * would truncate `resolveBang` at its first return statement, and the resulting
 * page would still parse.
 */
function sliceDeclaration(source, name) {
  const re = new RegExp(`^export\\s+(?:const\\s+${name}\\s*=|function\\s+${name}\\b)`, "m");
  const m = re.exec(source);
  if (!m) return null;

  const start = m.index;
  let i = source.indexOf("{", start);
  if (i === -1) return null;

  let depth = 0;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        // Arrow-function consts need their terminating semicolon.
        const end = source[i + 1] === ";" ? i + 2 : i + 1;
        return source.slice(start, end);
      }
    }
  }
  return null;
}

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { extractResolver, renderGoPage } from "./tools/go-page.mjs";
import { renderAll } from "./tools/prerender.mjs";
import { bangTable } from "./src/lib/bangs.js";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * Emit `go/index.html`, the static bang redirector.
 *
 * A generated file rather than one committed under public/, because it carries a
 * copy of the bang table and of the resolver. Committed, both copies would drift
 * from data/systems.js the moment a URL changed — and a stale redirect is worse
 * than a missing one, since it looks like it worked. Generating it means the
 * registry is still the only place an address is written down.
 *
 * Both hooks call the same renderer: `generateBundle` for the build, and a dev
 * middleware so `npm run dev` serves identical bytes at /go/. Diverging dev and
 * prod behaviour in a redirector would mean testing something nobody ships.
 */
function goRedirector() {
  const build = () => {
    const source = readFileSync(new URL("./src/lib/bangs.js", import.meta.url), "utf8");
    return renderGoPage(bangTable(), extractResolver(source));
  };

  return {
    name: "saltdog-go-redirector",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "go/index.html", source: build() });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Both spellings: vite's dev server does not do the directory-slash
        // redirect that GitHub Pages does, so /go and /go/ must both answer here
        // or the dev experience differs from the deployed one.
        const path = (req.url || "").split("?")[0];
        if (path !== "/go" && path !== "/go/" && path !== "/go/index.html") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        // No caching in dev: the table is regenerated per request so a bangs.js
        // edit shows up on reload without restarting the server.
        res.setHeader("Cache-Control", "no-store");
        res.end(build());
      });
    },
  };
}

/**
 * The date the reference CONTENT last changed, as YYYY-MM-DD.
 *
 * Sitemap `<lastmod>` is the one crawl hint here that Google actually reads, and
 * it reads it only while it stays honest — a file that claims every page changed
 * on every deploy is one it learns to ignore. So this is the commit date of the
 * last change to src/data/, not the date of the build.
 *
 * Two fallbacks, because both failure modes are real: a shallow CI clone
 * (`fetch-depth: 1`) can have no commit touching src/data/ in its history, and a
 * tarball export has no git at all. Falling back to HEAD's date and then to today
 * degrades the precision of the claim without making it false.
 */
function contentLastModified() {
  const git = (args) => {
    try {
      const out = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return /^\d{4}-\d{2}-\d{2}$/.test(out.trim()) ? out.trim() : "";
    } catch {
      return "";
    }
  };
  return (
    git(["log", "-1", "--format=%cs", "--", "src/data"]) ||
    git(["log", "-1", "--format=%cs"]) ||
    new Date().toISOString().slice(0, 10)
  );
}

/**
 * Emit the static, crawlable copy of every reference topic, plus the app's own
 * sitemap. See tools/prerender.mjs for why this exists at all — in short, the app
 * is hash-routed, and a fragment is not a URL to a crawler, so all 68 reference
 * sections are otherwise invisible behind the single URL /saltdog/.
 *
 * Build-only, unlike the go redirector: these pages have no behaviour to get
 * wrong in dev, `npm run dev` already serves the live app at the same content,
 * and adding a dozen middleware routes would only give the dev server a second
 * way to render the same data. `npm run smoke` walks the built files instead.
 */
function referencePages() {
  return {
    name: "saltdog-reference-pages",
    generateBundle() {
      const lastmod = contentLastModified();
      for (const { fileName, source } of renderAll({ lastmod })) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}

// Build stamp. CI exports GITHUB_RUN_NUMBER (a counter that increments every
// run) and GITHUB_SHA, so each deployment gets a distinct build number without
// committing a bump. Locally these are unset and the version reads "1.0.0-dev".
const runNumber = process.env.GITHUB_RUN_NUMBER || "";
const sha = (process.env.GITHUB_SHA || "").slice(0, 7);
const version = runNumber ? `${pkg.version}.${runNumber}` : `${pkg.version}-dev`;

// Relative base so dist/ is position-independent: GitHub Pages, S3, or a plain
// file share all work with no rewrite rules (paired with hash-history routing).
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true }), goRedirector(), referencePages()],
  base: "./",
  server: { port: 8773 },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          // The search engine is chat-only, so it genuinely defers: nothing on
          // first paint imports it, and useChat() dynamic-imports it when the
          // panel opens.
          //
          // The reference DATA does not defer and is deliberately not grouped
          // with it. NavDrawer, Home, and About all read topic titles at first
          // paint, so a "knowledge" chunk holding the data is fetched
          // immediately anyway — naming it lazy would only have made the
          // waterfall a step deeper for the same bytes.
          if (id.includes("/src/lib/corpus") || id.includes("/src/lib/retrieval") || id.includes("/src/data/aliases")) {
            return "search";
          }
          // The map geometry is 46 KB of path data for two of forty-seven
          // sections, and it is the one data module that genuinely defers:
          // nothing outside those two sections imports it, and TopicSection
          // reaches it through an async component. Grouping it with "refdata"
          // would undo that, because refdata IS fetched on first paint.
          if (id.includes("/src/data/geo")) return "geo";
          // The rest of the data needs its OWN chunk, not just "not search".
          // Left unassigned it gets absorbed into whichever chunk claims it
          // first — which was "search", making the entry depend on the search
          // chunk and preloading the engine it was supposed to defer.
          if (id.includes("/src/data/")) return "refdata";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(sha),
  },
});

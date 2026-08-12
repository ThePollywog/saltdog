import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Build stamp. CI exports GITHUB_RUN_NUMBER (a counter that increments every
// run) and GITHUB_SHA, so each deployment gets a distinct build number without
// committing a bump. Locally these are unset and the version reads "1.0.0-dev".
const runNumber = process.env.GITHUB_RUN_NUMBER || "";
const sha = (process.env.GITHUB_SHA || "").slice(0, 7);
const version = runNumber ? `${pkg.version}.${runNumber}` : `${pkg.version}-dev`;

// Relative base so dist/ is position-independent: GitHub Pages, S3, or a plain
// file share all work with no rewrite rules (paired with hash-history routing).
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
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

<script setup>
/**
 * About + stored-data management.
 *
 * Export/import is ~30 lines and it's the only backup a no-backend app can
 * offer someone who has been tracking retirement points for fifteen years.
 * Without it, "clear site data" — something browsers do on their own, for
 * privacy sweeps and profile resets — is unrecoverable data loss.
 *
 * Clear-all is type-to-confirm rather than a yes/no dialog, because a
 * click-through confirm on a destructive action is decoration.
 */
import { computed, ref } from "vue";
import {
  mdiAlertOutline,
  mdiDeleteOutline,
  mdiDownloadOutline,
  mdiRefresh,
  mdiUploadOutline,
} from "@mdi/js";
import { ALL_TOPICS, TOPICS } from "../data/index.js";
import { CATEGORIES } from "../data/quicklinks.js";
import { CORRECTIONS as AWARD_CORRECTIONS } from "../data/awards.js";
import { CORRECTIONS as RANK_CORRECTIONS, SERVICES } from "../data/ranks.js";
import { TOOLS } from "../data/tools.js";
import { SYSTEMS, systemUrl } from "../data/systems.js";
import { clearAll, exportAll, importAll, inspect } from "../lib/persist.js";

const version = __APP_VERSION__;
const commit = __APP_COMMIT__;

const entries = ref(inspect());
const confirmText = ref("");
const fileInput = ref(null);
const notice = ref(null); // { type, text }

const totalBytes = computed(() => entries.value.reduce((n, e) => n + e.bytes, 0));

/** Human labels for the raw storage keys — "points" means nothing on its own. */
const LABELS = {
  chat: "Assistant panel size",
  checklist: "Readiness checklist progress",
  points: "Retirement points entries",
  ribbons: "Saved ribbon rack",
  theme: "Light/dark theme choice",
};

const refresh = () => {
  entries.value = inspect();
};

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  // Locale-formatted so it reads naturally; the ISO string is in the export.
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function download() {
  try {
    const payload = exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Date in the filename so repeated backups don't overwrite each other.
    a.download = `saltdog-backup-${payload.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notice.value = { type: "success", text: "Backup downloaded." };
  } catch (err) {
    notice.value = { type: "error", text: `Could not create the backup file. ${err.message}` };
  }
}

async function onFile(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const n = importAll(payload);
    refresh();
    notice.value = {
      type: "success",
      text: `Restored ${n} ${n === 1 ? "entry" : "entries"}. Reload the page to see them in the tools.`,
    };
  } catch (err) {
    notice.value = { type: "error", text: err.message || "That file could not be read." };
  } finally {
    // Reset the input so re-picking the same file fires change again.
    if (fileInput.value) fileInput.value.value = "";
  }
}

const canClear = computed(() => confirmText.value.trim().toUpperCase() === "DELETE");

function wipe() {
  if (!canClear.value) return;
  clearAll();
  confirmText.value = "";
  refresh();
  notice.value = {
    type: "success",
    text: "All stored entries deleted. Reload the page to reset the tools.",
  };
}

const linkCount = CATEGORIES.reduce((n, c) => n + c.links.length, 0);
const sectionCount = TOPICS.reduce((n, t) => n + t.sections.length, 0);

/**
 * Derived, not typed. Every one of these was a hardcoded number that went stale
 * the moment a topic or a tool was added — which is exactly how an About page
 * ends up quietly lying about the thing it exists to describe.
 */
const pdfCount = new Set(
  [
    ...ALL_TOPICS.map((t) => t.sourcePdf),
    // The ranks topic declares one chart but ships six: each service links its
    // own. Counting only topic-level sourcePdf undercounts by five.
    ...SERVICES.map((s) => s.sourcePdf),
  ].filter(Boolean),
).size;

/** Corrections are listed where they appear; this page only states how many. */
const correctionCount = RANK_CORRECTIONS.length + AWARD_CORRECTIONS.length;

/**
 * How many systems you can actually click through to. Stated as a fraction on
 * purpose: a few have no public front door at all, and rounding that up to "31
 * systems, all linked" would be the same overclaim the `reach` field exists to
 * prevent.
 */
const linkableSystems = SYSTEMS.filter((s) => s.reach !== "offline").length;
</script>

<template>
  <div>
    <header class="mb-6">
      <span class="salt-eyebrow">About</span>
      <h1 class="salt-heading text-h4 mb-2">About SALTDOG</h1>
      <p class="text-body-1 mb-0" style="max-width: 74ch; opacity: 0.88">
        An unofficial quick-reference desk for Navy reservists: a condensed
        systems directory, {{ TOPICS.length }} reference topics transcribed from
        one-page guides, and a handful of readiness calculators. Static files
        only — no server, no account, no analytics.
      </p>
    </header>

    <div class="salt-about-grid mb-8">
      <v-card class="pa-4">
        <span class="salt-eyebrow">What's here</span>
        <ul class="text-body-2 pl-5 mb-0 mt-1">
          <li>{{ linkCount }} links across {{ CATEGORIES.length }} categories</li>
          <li>{{ TOPICS.length }} knowledge topics, {{ sectionCount }} reference sections</li>
          <li>{{ pdfCount }} source PDFs, downloadable</li>
          <li>{{ TOOLS.length }} interactive tools</li>
          <li>
            {{ linkableSystems }} of {{ SYSTEMS.length }} systems open in one
            click, from the checklist item that needs them
          </li>
        </ul>
      </v-card>

      <v-card class="pa-4">
        <span class="salt-eyebrow">Build</span>
        <dl class="text-body-2 mb-0 mt-1">
          <dt style="opacity: 0.7">Version</dt>
          <dd class="mono mb-2">{{ version }}</dd>
          <template v-if="commit">
            <dt style="opacity: 0.7">Commit</dt>
            <dd class="mono mb-0">{{ commit }}</dd>
          </template>
        </dl>
      </v-card>
    </div>

    <!-- SOURCES -->
    <section id="sec-sources" class="salt-section mb-8" tabindex="-1">
      <h2 class="salt-heading text-h5 mb-3">Where the content comes from</h2>
      <p class="text-body-2 mb-3" style="max-width: 74ch; opacity: 0.88">
        Every table on this site is a transcription of a one-page PDF guide, and
        each page links its original so you can check the transcription. The
        source charts contain {{ correctionCount }} typographical errors; each is
        corrected here and footnoted where it appears — on the Rank Explorer and
        the awards precedence list — rather than reproduced silently.
      </p>
      <p class="text-body-2 mb-0" style="max-width: 74ch; opacity: 0.88">
        The Navy's public quick-links page that inspired this one is no longer
        reachable, so the directory is rebuilt from a reservist-scoped systems
        list. Every address on the site — in the directory, on a checklist item,
        under a tool — comes from that one list, so there is exactly one place to
        fix when one moves. Several of these systems have no public front door at
        all; those link the portal you reach them through and say so, rather than
        offering a deep link that would look right and go nowhere. System names
        and URLs change frequently — treat every link as a pointer, not a
        guarantee, and reach anything broken through
        <!-- Text kept on the tag's own line: a newline inside the anchor is a
             rendered space, and `text-decoration: underline` paints it, leaving
             an underline that visibly overshoots the link text. -->
        <!-- Addresses come from the registry, not typed here: this paragraph is
             the one that tells you links go stale, so having its own stale copy
             would be its own refutation. -->
        <a
          class="salt-link"
          :href="systemUrl('mynavy-hr')"
          target="_blank"
          rel="noopener"
        >MyNavy HR</a>
        or MNCC at
        <a class="salt-link" :href="systemUrl('mncc')">1-833-330-MNCC</a>.
      </p>
    </section>

    <!-- SEARCH ASSISTANT -->
    <section id="sec-assistant" class="salt-section mb-8" tabindex="-1">
      <h2 class="salt-heading text-h5 mb-3">The search assistant</h2>
      <p class="text-body-2 mb-0" style="max-width: 74ch; opacity: 0.88">
        The widget in the corner is an offline keyword search — TF-IDF ranking
        over the same reference cards you can browse, with a synonym list for
        Navy acronyms. It is not an AI, it does not reach the network, and it
        cannot answer anything that isn't already a card on this site. When it
        has no good match it says so and points you at MyNavy HR, MNP, or your
        NOSC instead of guessing.
      </p>
    </section>

    <!-- PRIVACY / STORED DATA -->
    <section id="sec-stored-data" class="salt-section" tabindex="-1">
      <h2 class="salt-heading text-h5 mb-3">Your stored data</h2>

      <v-alert density="compact" class="mb-4">
        <span class="text-body-2">
          Checklist progress, points entries, your saved ribbon rack, your theme
          choice, and whether the assistant opens expanded are saved in this
          browser's local storage. <strong>Nothing is transmitted anywhere.</strong>
          Clearing site data, using a different browser or device, or browsing in
          a private window means none of it is there.
        </span>
      </v-alert>

      <v-card class="pa-4 mb-4">
        <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-3">
          <span class="salt-eyebrow mb-0">
            Stored entries — {{ entries.length }}, {{ fmtBytes(totalBytes) }}
          </span>
          <v-btn size="x-small" variant="text" :prepend-icon="mdiRefresh" @click="refresh">
            Refresh
          </v-btn>
        </div>

        <table v-if="entries.length" class="salt-table">
          <caption class="sr-only">Data stored by this site in your browser</caption>
          <thead>
            <tr>
              <th scope="col">Entry</th>
              <th scope="col">Size</th>
              <th scope="col">Last saved</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in entries" :key="e.key">
              <td>
                {{ LABELS[e.key] || e.key }}
                <span class="mono text-caption" style="opacity: 0.6">({{ e.key }})</span>
              </td>
              <td class="mono">{{ fmtBytes(e.bytes) }}</td>
              <td>{{ fmtDate(e.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-body-2 mb-0" style="opacity: 0.75">
          Nothing stored yet. Ticking a checklist item or adding a points year
          will create an entry.
        </p>
      </v-card>

      <v-card class="pa-4 mb-4">
        <span class="salt-eyebrow">Backup and restore</span>
        <p class="text-body-2 mt-1" style="max-width: 68ch; opacity: 0.85">
          Export a JSON file before you clear your browser, switch machines, or
          hand this off. Restoring overwrites the entries present in the file and
          leaves the rest alone.
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            :prepend-icon="mdiDownloadOutline"
            variant="tonal"
            size="small"
            :disabled="!entries.length"
            @click="download"
          >
            Export JSON
          </v-btn>
          <v-btn
            :prepend-icon="mdiUploadOutline"
            variant="tonal"
            size="small"
            @click="fileInput?.click()"
          >
            Import JSON
          </v-btn>
          <!-- Hidden real file input: keeps the native picker without a styled
               label hack, and the button above carries the accessible name. -->
          <input
            ref="fileInput"
            type="file"
            accept="application/json,.json"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            @change="onFile"
          />
        </div>
      </v-card>

      <v-card class="pa-4">
        <span class="salt-eyebrow">Delete everything</span>
        <p class="text-body-2 mt-1" style="max-width: 68ch; opacity: 0.85">
          Removes every entry above. There is no undo — export first if you want
          it back. Type <span class="mono">DELETE</span> to enable the button.
        </p>
        <div class="d-flex flex-wrap ga-3 align-start">
          <v-text-field
            v-model="confirmText"
            label="Type DELETE"
            autocomplete="off"
            spellcheck="false"
            density="comfortable"
            hide-details
            style="max-width: 220px"
          />
          <v-btn
            :prepend-icon="mdiDeleteOutline"
            color="error"
            variant="flat"
            :disabled="!canClear || !entries.length"
            @click="wipe"
          >
            Delete all stored data
          </v-btn>
        </div>
      </v-card>

      <v-alert
        v-if="notice"
        :type="notice.type"
        :icon="notice.type === 'error' ? mdiAlertOutline : undefined"
        class="mt-4"
        closable
        close-label="Dismiss"
        @click:close="notice = null"
      >
        <span class="text-body-2">{{ notice.text }}</span>
      </v-alert>
    </section>
  </div>
</template>

<style scoped>
.salt-about-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
</style>

<script setup>
/**
 * Landing page for the /go redirector — and its documentation.
 *
 * Reached two ways, and both matter:
 *
 *   1. Handed off by the static go/index.html when a query resolves to something
 *      that must not be an automatic redirect (a portal, a phone number, a paper
 *      form) or that resolved to nothing at all.
 *   2. Visited directly by someone who wants to set the shortcut up.
 *
 * One page for both, because the moment a shortcut misses is the moment somebody
 * is willing to read how it works. A separate "help" page would be found by
 * nobody: the miss is the traffic.
 *
 * An unknown query is NOT a dead end here. The site already has an offline
 * retriever that answers questions, and "go good year" is a question, not a
 * destination — so a miss offers the query onward to the assistant rather than
 * shrugging. That is the division of labour the resolver's docblock describes:
 * the table decides destinations, the scorer answers questions, and neither
 * pretends to be the other.
 */
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import {
  mdiAlertCircleOutline,
  mdiCardAccountDetailsOutline,
  mdiCheckCircleOutline,
  mdiContentCopy,
  mdiMagnify,
  mdiOpenInNew,
} from "@mdi/js";
import { BANG_ENTRIES, queryFromLocation, resolveBang } from "../lib/bangs.js";
import CacChip from "../components/common/CacChip.vue";

const route = useRoute();

/**
 * The query as the redirector passed it.
 *
 * Read from the route rather than from `location`, because by the time this
 * component mounts the URL is `…/#/go?q=nsips` and the real `location.search` is
 * empty — the query lives in the hash. `queryFromLocation` is still used for the
 * direct-visit case, where somebody hits `#/go?q=…` by hand or a bare
 * `#/go#nsips` survives a copy-paste.
 */
const query = computed(() => {
  const fromRoute = String(route.query.q ?? "").trim();
  if (fromRoute) return fromRoute;
  return typeof location === "undefined" ? "" : queryFromLocation({ hash: route.hash });
});

const result = computed(() => (query.value ? resolveBang(query.value) : null));

/** Absolute URL to register, built at runtime so it's right on any host. */
const goUrl = computed(() => {
  if (typeof location === "undefined") return "https://thepollywog.github.io/saltdog/go?q=%s";
  // Strip the hash route and any filename, leaving the deployed base path.
  const base = location.href.split("#")[0].replace(/\/[^/]*$/, "/");
  return `${base}go?q=%s`;
});

const copied = ref(false);
async function copyUrl() {
  try {
    await navigator.clipboard.writeText(goUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2400);
  } catch {
    // Clipboard is permission-gated and throws in some contexts. The URL is
    // visible as selectable text either way, so this needs no error UI.
  }
}

/**
 * Hand an unresolved query to the search assistant.
 *
 * The chat widget owns its own open state, so this dispatches an event the widget
 * listens for rather than reaching into it. A window event is the smallest thing
 * that works across the two components without a store, and it keeps the widget
 * the only thing that knows how the widget opens.
 */
function askAssistant() {
  window.dispatchEvent(new CustomEvent("saltdog:ask", { detail: { query: query.value } }));
}

const BROWSERS = [
  {
    name: "Chrome / Edge",
    steps: [
      "Settings → Search engines → Site search → Add",
      'Name: SALTDOG · Shortcut: go · URL: the address below',
    ],
  },
  {
    name: "Firefox",
    steps: [
      "Bookmark this page, then edit the bookmark",
      'Set Keyword to "go" and the URL to the address below',
    ],
  },
  {
    name: "Safari",
    steps: [
      "No built-in keyword search — needs an extension such as Smart Keyword Search",
      "Or bookmark the shortcut list and click through",
    ],
  },
];
</script>

<template>
  <div>
    <header class="mb-5">
      <span class="salt-eyebrow">Address bar</span>
      <h1 class="salt-heading text-h4 mb-2">Go shortcuts</h1>
      <p class="text-body-1 mb-0" style="max-width: 72ch; opacity: 0.88">
        Type <code class="mono">go nsips</code> in your browser's address bar and
        land on NSIPS. No extension, no server — the shortcut resolves in your
        browser from a table built into this site.
      </p>
    </header>

    <!--
      RESULT FIRST. Someone who arrived here from a shortcut came for an outcome,
      not for setup instructions, so the outcome goes above the documentation even
      though the documentation is the bulk of the page.
    -->
    <template v-if="result">
      <!--
        A handoff, not a redirect — and the reason is stated. These systems have
        no public front door: the link goes to the portal that fronts them, and
        the `then` step is the half that gets forgotten. Redirecting silently
        would have felt faster and left someone hunting a launch page for a link
        whose name they don't know.
      -->
      <v-card v-if="result.kind === 'handoff'" class="pa-4 mb-6">
        <div class="d-flex flex-wrap align-start justify-space-between ga-2 mb-2">
          <div>
            <span class="salt-eyebrow">Shortcut · {{ result.query }}</span>
            <h2 class="salt-heading text-h6 mb-0">{{ result.name }}</h2>
            <p v-if="result.full" class="text-caption mb-0" style="opacity: 0.7">
              {{ result.full }}
            </p>
          </div>
          <CacChip :cac="result.cac" />
        </div>

        <p class="text-body-2 mb-3" style="opacity: 0.88">{{ result.desc }}</p>

        <v-alert density="compact" class="mb-3" :icon="mdiAlertCircleOutline">
          <span class="text-body-2">
            <template v-if="result.reach === 'portal'">
              {{ result.name }} has no direct address — you reach it through
              another system, so this could not just forward you.
              <template v-if="result.then">
                Once you're in, <strong>{{ result.then }}</strong>.
              </template>
            </template>
            <template v-else-if="result.reach === 'phone'">
              This one is a help desk, not a website.
            </template>
            <template v-else>
              There's no application to open — {{ result.access }}.
            </template>
          </span>
        </v-alert>

        <v-btn
          v-if="result.url"
          :href="result.url"
          target="_blank"
          rel="noopener noreferrer"
          color="primary"
          variant="flat"
          :append-icon="mdiOpenInNew"
        >
          {{ result.via ? result.via.replace(/^via /, "Open ") : `Open ${result.name}` }}
        </v-btn>
        <div class="salt-url mt-2" style="opacity: 0.6">{{ result.access }}</div>
      </v-card>

      <v-card v-else-if="result.kind === 'ambiguous'" class="pa-4 mb-6">
        <span class="salt-eyebrow">Shortcut · {{ result.query }}</span>
        <h2 class="salt-heading text-h6 mb-2">That matches more than one thing</h2>
        <p class="text-body-2 mb-3" style="opacity: 0.85">
          Pick one, or type the full shortcut next time.
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="c in result.candidates"
            :key="c.system"
            :to="{ name: 'go', query: { q: c.keys[0] } }"
            label
          >
            {{ c.name }}
            <span class="mono ml-2" style="opacity: 0.6">{{ c.keys[0] }}</span>
          </v-chip>
        </div>
      </v-card>

      <!--
        A miss. It says so plainly rather than guessing a plausible .mil address,
        then offers the two things that can actually help: the assistant (for a
        question) and the shortcut list below (for a destination).
      -->
      <v-card v-else class="pa-4 mb-6">
        <span class="salt-eyebrow">Shortcut · {{ result.query }}</span>
        <h2 class="salt-heading text-h6 mb-2">No shortcut for that yet</h2>
        <p class="text-body-2 mb-3" style="max-width: 68ch; opacity: 0.85">
          Only the shortcuts listed below are registered. If you were asking a
          question rather than naming a system, the search assistant reads every
          reference card on this site and works offline.
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            color="primary"
            variant="flat"
            :prepend-icon="mdiMagnify"
            @click="askAssistant"
          >
            Ask the assistant about "{{ result.query }}"
          </v-btn>
          <v-btn :to="{ name: 'quicklinks' }" variant="tonal">Browse all systems</v-btn>
        </div>
      </v-card>
    </template>

    <h2 class="salt-heading text-h6 mb-3">Registered shortcuts</h2>
    <v-table density="compact" class="mb-6">
      <thead>
        <tr>
          <th>Type</th>
          <th>Goes to</th>
          <th>What it's for</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in BANG_ENTRIES" :key="e.system">
          <td class="mono">
            <span v-for="(k, i) in e.keys" :key="k">
              <span v-if="i">, </span>go {{ k }}
            </span>
          </td>
          <td>{{ e.name }}</td>
          <td style="opacity: 0.85">{{ e.note ?? e.desc }}</td>
        </tr>
      </tbody>
    </v-table>

    <!--
      Stated rather than buried: one shortcut is the current state on purpose.
      A visitor counting one row in a table headed "Registered shortcuts" will
      otherwise reasonably assume it's broken.
    -->
    <v-alert density="compact" class="mb-6">
      <span class="text-body-2">
        One shortcut so far — this is a trial of the mechanism. More systems get
        added to the table once it's proven; every system on this site is already
        one click from
        <router-link :to="{ name: 'quicklinks' }" class="salt-link">Quick Links</router-link>.
      </span>
    </v-alert>

    <h2 class="salt-heading text-h6 mb-3">Set it up</h2>
    <v-card class="pa-4 mb-6">
      <div class="salt-eyebrow mb-1">Search URL</div>
      <div class="d-flex flex-wrap align-center ga-2 mb-4">
        <code class="mono salt-url" style="word-break: break-all">{{ goUrl }}</code>
        <v-btn
          size="small"
          variant="tonal"
          :prepend-icon="copied ? mdiCheckCircleOutline : mdiContentCopy"
          @click="copyUrl"
        >
          {{ copied ? "Copied" : "Copy" }}
        </v-btn>
      </div>

      <div class="salt-browser-grid">
        <div v-for="b in BROWSERS" :key="b.name">
          <div class="font-weight-medium text-body-2 mb-1">{{ b.name }}</div>
          <ol class="text-body-2 pl-4" style="opacity: 0.85">
            <li v-for="(s, i) in b.steps" :key="i" class="mb-1">{{ s }}</li>
          </ol>
        </div>
      </div>
    </v-card>

    <v-alert density="compact" :icon="mdiCardAccountDetailsOutline">
      <span class="text-body-2">
        The shortcut only forwards your browser — it does not log you in. Most of
        these systems need a CAC, and nothing you type in the address bar is sent
        anywhere but the site you land on.
      </span>
    </v-alert>
  </div>
</template>

<style scoped>
.salt-browser-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
</style>

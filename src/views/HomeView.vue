<script setup>
/**
 * Landing page: what this is, then straight into the three surfaces.
 * No hero imagery — the audience is here to find a system and leave.
 */
import { mdiArrowRight, mdiLinkVariant, mdiToolboxOutline, mdiBookOpenPageVariantOutline } from "@mdi/js";
import DisclaimerBanner from "../components/shell/DisclaimerBanner.vue";
import SystemLinks from "../components/common/SystemLinks.vue";
import { TOPICS } from "../data/index.js";
import { CATEGORIES } from "../data/quicklinks.js";
import { TOOLS } from "../data/tools.js";

const linkCount = CATEGORIES.reduce((n, c) => n + c.links.length, 0);

/**
 * The five a drilling reservist opens most, above the fold.
 *
 * This page's whole job is getting someone to a system and out. Making them
 * click "Browse links" first to reach NSIPS is one hop of pure friction for the
 * most common visit there is. Deliberately five and not thirty — the directory
 * is one card away and exists for the rest.
 */
const TOP_SYSTEMS = ["nsips", "mypay", "nrows", "mrrs", "milconnect"];

const CARDS = [
  {
    to: { name: "quicklinks" },
    icon: mdiLinkVariant,
    eyebrow: "Directory",
    title: "Quick Links",
    body: `${linkCount} systems a drilling reservist actually touches — pay, records, readiness, training, benefits — with CAC requirements marked.`,
    cta: "Browse links",
  },
  {
    to: { name: "knowledge-index" },
    icon: mdiBookOpenPageVariantOutline,
    eyebrow: "Reference",
    title: "Knowledge",
    body: `${TOPICS.length} reference cards as searchable tables: the annual checklist, EVAL/FITREP calendar, ranks for all six services, ribbon precedence, combatant commands, fleets, J-codes, and the phonetic alphabet.`,
    cta: "Open knowledge",
  },
  {
    to: { name: "tools", params: { tool: "checklist" } },
    icon: mdiToolboxOutline,
    eyebrow: "Interactive",
    title: "Readiness Tools",
    body: `${TOOLS.length} planning aids: track your checklist, look up when your EVAL or FITREP is due, count retirement points toward a good year, and build a ribbon rack in precedence order. Saved in this browser only.`,
    cta: "Open tools",
  },
];
</script>

<template>
  <div>
    <DisclaimerBanner />

    <header class="mb-8">
      <span class="salt-eyebrow">U.S. Navy Reserve — unofficial reference</span>
      <h1 class="salt-heading text-h4 mb-3">
        The reservist's quick-reference desk
      </h1>
      <p class="text-body-1" style="max-width: 68ch; opacity: 0.88">
        A condensed version of the Navy quick-links directory, cut down to what a
        SELRES sailor needs, plus the reference cards and readiness math that
        usually live in a folder of PDFs. Everything runs in your browser — no
        account, no server, and it keeps working offline once loaded.
      </p>

      <SystemLinks
        :ids="TOP_SYSTEMS"
        size="small"
        label="Straight to the ones you use most"
        class="mt-4"
      />
    </header>

    <div class="salt-home-grid mb-8">
      <v-card v-for="c in CARDS" :key="c.title" class="pa-5 d-flex flex-column">
        <v-icon :icon="c.icon" size="28" color="primary" class="mb-3" aria-hidden="true" />
        <span class="salt-eyebrow">{{ c.eyebrow }}</span>
        <h2 class="salt-heading text-h6 mb-2">{{ c.title }}</h2>
        <p class="text-body-2 mb-4" style="opacity: 0.85">{{ c.body }}</p>
        <v-spacer />
        <v-btn :to="c.to" :append-icon="mdiArrowRight" variant="tonal" block>
          {{ c.cta }}
        </v-btn>
      </v-card>
    </div>

    <v-card class="pa-5">
      <span class="salt-eyebrow">Ask a question</span>
      <h2 class="salt-heading text-h6 mb-2">The search assistant, bottom-right</h2>
      <p class="text-body-2 mb-0" style="opacity: 0.85">
        Type a question like <em>"how many points do I need for a good year"</em> or
        <em>"when is my E6 eval due"</em> and it will point you at the card that
        answers it. It is an offline keyword search over the pages of this site —
        not an AI, and not live data. If it doesn't know, it says so.
      </p>
    </v-card>
  </div>
</template>

<style scoped>
.salt-home-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(275px, 1fr));
}
</style>

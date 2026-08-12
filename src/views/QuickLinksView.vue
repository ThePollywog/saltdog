<script setup>
/**
 * The quick-links directory — the replacement for the dead my.navy.mil page.
 *
 * Filtering happens across name, description, and host, and matched categories
 * stay grouped rather than collapsing into one flat list: the grouping is how
 * someone who doesn't know the system's name finds it ("something under
 * readiness").
 */
import { computed, ref } from "vue";
import { mdiCardAccountDetailsOutline, mdiClose, mdiMagnify, mdiOpenInNew } from "@mdi/js";
import CacChip from "../components/common/CacChip.vue";
import { viaLabel } from "../data/systems.js";
import PdfButton from "../components/common/PdfButton.vue";
import DisclaimerBanner from "../components/shell/DisclaimerBanner.vue";
import quicklinks, { CATEGORIES, DISCLAIMER } from "../data/quicklinks.js";
import { useCitedSection } from "../composables/useCitedSection.js";

const { cited } = useCitedSection();

const query = ref("");
const cacOnly = ref(false);

const total = CATEGORIES.reduce((n, c) => n + c.links.length, 0);

const norm = (s) => String(s ?? "").toLowerCase();

const filtered = computed(() => {
  const q = norm(query.value).trim();
  const terms = q ? q.split(/\s+/) : [];

  return CATEGORIES.map((cat) => {
    const links = cat.links.filter((l) => {
      if (cacOnly.value && !l.cac) return false;
      if (!terms.length) return true;
      const haystack = norm(`${l.name} ${l.desc} ${l.access} ${cat.heading}`);
      // AND across terms: "pay les" should mean both, not either.
      return terms.every((t) => haystack.includes(t));
    });
    return { ...cat, links };
  }).filter((cat) => cat.links.length > 0);
});

const shown = computed(() => filtered.value.reduce((n, c) => n + c.links.length, 0));
const isFiltering = computed(() => query.value.trim().length > 0 || cacOnly.value);

function clear() {
  query.value = "";
  cacOnly.value = false;
}
</script>

<template>
  <div>
    <DisclaimerBanner />

    <header class="mb-5">
      <span class="salt-eyebrow">Directory</span>
      <h1 class="salt-heading text-h4 mb-2">Quick Links</h1>
      <p class="text-body-1 mb-4" style="max-width: 72ch; opacity: 0.88">
        {{ total }} systems a drilling reservist actually uses, grouped by what
        you're trying to get done. Most require a CAC.
      </p>
      <PdfButton
        v-if="quicklinks.sourcePdf"
        :file="quicklinks.sourcePdf"
        describes="the quick links reference"
        label="Original PDF"
      />
    </header>

    <v-card class="pa-4 mb-6 salt-no-print">
      <div class="d-flex flex-wrap align-center ga-4">
        <v-text-field
          v-model="query"
          :prepend-inner-icon="mdiMagnify"
          label="Filter by system, task, or address"
          :clear-icon="mdiClose"
          clearable
          style="min-width: 260px; flex: 1 1 320px"
        />
        <v-checkbox
          v-model="cacOnly"
          label="CAC-required only"
          :true-icon="mdiCardAccountDetailsOutline"
          hide-details
        />
      </div>

      <!-- Result count is announced: a filter that silently empties the page is
           disorienting without it. -->
      <div class="text-caption mt-2" aria-live="polite" style="opacity: 0.75">
        <template v-if="isFiltering">
          Showing {{ shown }} of {{ total }} links.
          <v-btn variant="text" size="x-small" @click="clear">Clear filter</v-btn>
        </template>
        <template v-else>Showing all {{ total }} links.</template>
      </div>
    </v-card>

    <v-alert v-if="isFiltering && !filtered.length" type="info" class="mb-6">
      No links match "{{ query }}". Try a broader term — or the search assistant,
      which looks across the whole site rather than just this list.
    </v-alert>

    <section
      v-for="cat in filtered"
      :key="cat.id"
      :id="`sec-${cat.id}`"
      :class="['salt-section', 'mb-8', { 'salt-cited': cited === cat.id }]"
      tabindex="-1"
      :aria-labelledby="`sec-${cat.id}-h`"
    >
      <h2 :id="`sec-${cat.id}-h`" class="salt-heading text-h6 mb-1">
        {{ cat.heading }}
        <span class="text-caption font-weight-regular" style="opacity: 0.6">
          ({{ cat.links.length }})
        </span>
      </h2>

      <div class="salt-link-grid mt-3">
        <!-- Keyed by system id, not url: portal-routed entries share their
             portal's address and the two offline ones have none at all. -->
        <v-card v-for="link in cat.links" :key="link.id" class="pa-4">
          <div class="d-flex flex-wrap align-start justify-space-between ga-2 mb-2">
            <a
              v-if="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="salt-link font-weight-medium text-body-1"
            >
              {{ link.name }}
              <v-icon :icon="mdiOpenInNew" size="13" class="ml-1" aria-hidden="true" />
              <span class="sr-only">(opens in a new tab)</span>
            </a>
            <!-- No application to open: a form or an office. Rendering a dead
                 anchor here would look clickable and do nothing. -->
            <span v-else class="font-weight-medium text-body-1">{{ link.name }}</span>
            <CacChip :cac="link.cac" />
          </div>
          <p class="text-body-2 mb-2" style="opacity: 0.85">{{ link.desc }}</p>
          <div class="salt-url" style="opacity: 0.6">
            {{ link.access }}
            <span v-if="viaLabel(link.id)">· {{ viaLabel(link.id) }}</span>
          </div>
        </v-card>
      </div>
    </section>

    <v-alert v-if="DISCLAIMER" density="compact" class="mt-2">
      <span class="text-body-2">{{ DISCLAIMER }}</span>
    </v-alert>
  </div>
</template>

<style scoped>
.salt-link-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
</style>

<script setup>
/**
 * Renders ONE section of a knowledge topic, dispatching on `section.kind`.
 *
 * This component is the no-duplication guarantee. The chat answer card renders
 * the very same `section` object that the knowledge page renders — by reference,
 * out of the same data module — so a cited answer and the page it cites cannot
 * disagree. Adding a section kind means adding a branch here and nowhere else.
 *
 * The heading carries `id="sec-<id>"` because that is the deep-link target the
 * router's scrollBehavior looks for (`?a=<id>`).
 */
import { computed, defineAsyncComponent } from "vue";
import RefTable from "./RefTable.vue";
import CacChip from "./CacChip.vue";
import SystemLinks from "./SystemLinks.vue";
import { viaLabel } from "../../data/systems.js";
import { mdiOpenInNew } from "@mdi/js";
import { spriteStyle } from "../../lib/ribbons.js";
import { insigniaStyle } from "../../lib/insignia.js";

/**
 * Async because it pulls in 46 KB of projected path data. TopicSection itself is
 * in the entry chunk — the chat answer card renders it — so a static import here
 * would put the world map's geometry on first paint of every page on the site.
 * Two of forty-seven sections draw a map.
 */
const WorldMap = defineAsyncComponent(() => import("./WorldMap.vue"));

const props = defineProps({
  section: { type: Object, required: true },
  /** Heading level; the page sets 2, the chat card 3. */
  level: { type: Number, default: 2 },
  /** Flash-highlight this section (chat deep-link arrival). */
  cited: { type: Boolean, default: false },
  /** Hide the heading when the container already names the section. */
  showHeading: { type: Boolean, default: true },
});

const tag = computed(() => `h${Math.min(6, Math.max(2, props.level))}`);
const rows = computed(() => props.section.rows ?? []);

/** Month rows with no reports at all — rendered explicitly, never as a blank. */
const NO_REPORTS = "— no reports due —";

const EVAL_COLUMNS = [
  { key: "month", title: "Month", mono: true, nowrap: true, width: "9rem" },
  { key: "officer", title: "Officer (FITREP)" },
  { key: "enlisted", title: "Enlisted (EVAL)" },
];

const PHONETIC_COLUMNS = [
  { key: "letter", title: "Char", mono: true, nowrap: true, width: "5rem" },
  { key: "word", title: "Code word" },
];

/**
 * Flatten a service object into one table with a Tier column.
 *
 * The sprite style is resolved here rather than in the template because
 * `insigniaStyle` needs the service id, which the flattened row would otherwise
 * lose. It is null for E-1, the one paygrade with no insignia in any service.
 */
const rankRows = computed(() => {
  const s = rows.value;
  const out = [];
  for (const [tier, label] of [
    ["officer", "Officer"],
    ["warrant", "Warrant"],
    ["enlisted", "Enlisted"],
  ]) {
    for (const r of s[tier] ?? []) {
      out.push({ ...r, tier: label, insignia: insigniaStyle(s.id, r) });
    }
  }
  return out;
});

const AWARD_COLUMNS = [
  { key: "precedence", title: "#", mono: true, nowrap: true, width: "3.5rem" },
  { key: "sprite", title: "Ribbon", nowrap: true, width: "5rem" },
  { key: "title", title: "Award" },
  { key: "abbr", title: "Abbr.", mono: true, nowrap: true },
  // The list is one unbroken precedence sequence, so the category has to travel
  // with each row — it is no longer implied by which section you're reading.
  { key: "groupLabel", title: "Category", nowrap: true },
];

const RANK_COLUMNS = [
  { key: "tier", title: "Tier", nowrap: true, width: "6rem" },
  { key: "grade", title: "Grade", mono: true, nowrap: true, width: "5rem" },
  { key: "insignia", title: "Insignia", nowrap: true, width: "5.5rem" },
  { key: "title", title: "Title" },
  { key: "abbr", title: "Abbr.", mono: true, nowrap: true },
];
</script>

<template>
  <section
    :id="`sec-${section.id}`"
    :class="['salt-section', 'mb-8', { 'salt-cited': cited }]"
    tabindex="-1"
    :aria-labelledby="showHeading ? `sec-${section.id}-h` : undefined"
  >
    <component
      :is="tag"
      v-if="showHeading"
      :id="`sec-${section.id}-h`"
      class="salt-heading text-h6 mb-3"
    >
      {{ section.heading }}
    </component>

    <!-- LINKS: name + description + host, with a CAC indicator. -->
    <template v-if="section.kind === 'links'">
      <v-list class="pa-0" bg-color="transparent">
        <v-list-item
          v-for="link in rows"
          :key="link.url"
          class="px-0 py-2"
          style="border-bottom: 1px solid rgba(var(--v-border-color), 0.4)"
        >
          <div class="d-flex flex-wrap align-center ga-2 mb-1">
            <!--
              A portal-routed system links to its portal, which is genuinely the
              only way in — but the label has to say so. Without "via MyNavy
              Portal" the PRIMS-2 link looks like it opens PRIMS-2 and instead
              drops you on a hub with no indication of where to go next.
            -->
            <a
              v-if="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="salt-link font-weight-medium"
            >
              {{ link.name }}
              <v-icon :icon="mdiOpenInNew" size="12" class="ml-1" aria-hidden="true" />
              <span class="sr-only">(opens in a new tab)</span>
            </a>
            <span v-else class="font-weight-medium">{{ link.name }}</span>
            <span v-if="viaLabel(link.id)" class="text-caption" style="opacity: 0.7">
              {{ viaLabel(link.id) }}
            </span>
            <CacChip :cac="link.cac" />
          </div>
          <div class="text-body-2" style="opacity: 0.85">{{ link.desc }}</div>
          <div class="salt-url mt-1" style="opacity: 0.6">{{ link.access }}</div>
        </v-list-item>
      </v-list>
    </template>

    <!-- CHECKLIST: read-only here; the interactive version lives in Tools. -->
    <template v-else-if="section.kind === 'checklist'">
      <ul class="pl-0" style="list-style: none">
        <li
          v-for="item in rows"
          :key="item.id"
          class="d-flex ga-3 py-2"
          style="border-bottom: 1px solid rgba(var(--v-border-color), 0.4)"
        >
          <span aria-hidden="true" style="opacity: 0.45">▢</span>
          <div>
            <div class="text-body-2">{{ item.label }}</div>
            <div v-if="item.note" class="text-caption mt-1" style="opacity: 0.72">
              {{ item.note }}
            </div>
            <SystemLinks :ids="item.systems" class="mt-2" />
          </div>
        </li>
      </ul>
    </template>

    <!-- STEPS: an ordered procedure, then the systems it's carried out in. -->
    <template v-else-if="section.kind === 'steps'">
      <ol class="pl-5 text-body-2">
        <li v-for="(step, i) in rows" :key="i" class="mb-2">{{ step }}</li>
      </ol>
      <SystemLinks :ids="section.systems" size="small" label="Go there" class="mt-3" />
    </template>

    <!-- KV: term/definition pairs. <dl> is the correct semantics here. -->
    <template v-else-if="section.kind === 'kv'">
      <dl class="salt-dl">
        <template v-for="(pair, i) in rows" :key="i">
          <dt class="salt-eyebrow mt-3">{{ pair.k }}</dt>
          <dd class="text-body-2 ml-0">{{ pair.v }}</dd>
        </template>
      </dl>
    </template>

    <!-- CODE-CARDS: J-codes, command authorities. -->
    <template v-else-if="section.kind === 'code-cards'">
      <div class="salt-cards">
        <v-card v-for="card in rows" :key="card.code" class="pa-4">
          <div class="d-flex align-center ga-3 mb-2">
            <span class="mono text-h6 font-weight-bold" style="color: rgb(var(--v-theme-primary))">
              {{ card.code }}
            </span>
            <span class="salt-heading text-subtitle-2">{{ card.title }}</span>
          </div>
          <ul class="pl-5 text-body-2">
            <li v-for="(b, i) in card.bullets" :key="i" class="mb-1">{{ b }}</li>
          </ul>
        </v-card>
      </div>
    </template>

    <!-- EVAL SCHEDULE: months with no reports are named, never left blank. -->
    <template v-else-if="section.kind === 'eval-schedule'">
      <RefTable
        :columns="EVAL_COLUMNS"
        :rows="rows"
        caption="Reporting month by paygrade"
        :is-empty="(r) => !r.officer.length && !r.enlisted.length"
      >
        <template #cell.officer="{ row }">
          <span v-if="row.officer.length" class="mono">{{ row.officer.join(", ") }}</span>
          <span v-else>{{ NO_REPORTS }}</span>
        </template>
        <template #cell.enlisted="{ row }">
          <span v-if="row.enlisted.length" class="mono">{{ row.enlisted.join(", ") }}</span>
          <span v-else>{{ NO_REPORTS }}</span>
        </template>
      </RefTable>
    </template>

    <!-- PHONETIC -->
    <template v-else-if="section.kind === 'phonetic'">
      <RefTable :columns="PHONETIC_COLUMNS" :rows="rows" caption="Phonetic code words" />
    </template>

    <!-- RANKS: one service, all tiers, with source-typo footnotes. -->
    <template v-else-if="section.kind === 'ranks'">
      <RefTable
        :columns="RANK_COLUMNS"
        :rows="rankRows"
        :caption="`${section.heading} ranks by paygrade`"
      >
        <template #cell.insignia="{ row }">
          <!--
            Decoration, like the ribbon sprites: the grade and title are in the
            neighbouring cells, so alt text here would make a screen reader read
            every rank twice. E-1 gets an em-dash — the source chart's own answer
            is the words "No Insignia", and an empty cell would read as a gap in
            the data rather than a fact about the paygrade.
          -->
          <span v-if="row.insignia" class="salt-insignia" :style="row.insignia" role="presentation" />
          <span v-else aria-hidden="true" style="opacity: 0.5">—</span>
        </template>
        <template #cell.title="{ row }">
          {{ row.title }}
          <sup v-if="row.corrected" :title="row.corrected" style="cursor: help">†</sup>
        </template>
      </RefTable>

      <v-alert v-if="!rows.warrant?.length && rows.warrantNote" density="compact" class="mt-3">
        <span class="text-body-2">{{ rows.warrantNote }}</span>
      </v-alert>

      <div v-if="rows.seniorEnlisted" class="text-body-2 mt-3">
        <span class="salt-eyebrow">Senior enlisted advisor</span>{{ rows.seniorEnlisted }}
      </div>
      <div v-if="rows.wartime" class="text-body-2 mt-2">
        <span class="salt-eyebrow">Wartime / special grade</span>{{ rows.wartime }}
      </div>

      <p
        v-for="(row, i) in rankRows.filter((r) => r.corrected)"
        :key="i"
        class="text-caption mt-3 mb-0"
        style="opacity: 0.75"
      >
        † {{ row.grade }}: {{ row.corrected }}
      </p>
    </template>

    <!-- AWARDS: precedence number, real ribbon artwork, name. -->
    <template v-else-if="section.kind === 'awards'">
      <RefTable
        :columns="AWARD_COLUMNS"
        :rows="rows"
        :caption="`${section.heading} in order of precedence`"
      >
        <template #cell.sprite="{ row }">
          <!--
            The ribbon is decoration: the name is in the very next cell, so alt
            text here would make a screen reader say every award twice.
          -->
          <span class="salt-ribbon" :style="spriteStyle(row, 66)" role="presentation" />
        </template>
        <template #cell.title="{ row }">
          {{ row.title }}
          <sup v-if="row.corrected" :title="row.corrected" style="cursor: help">†</sup>
        </template>
      </RefTable>

      <p
        v-for="row in rows.filter((r) => r.corrected)"
        :key="row.id"
        class="text-caption mt-3 mb-0"
        style="opacity: 0.75"
      >
        † {{ row.corrected }}
      </p>
    </template>

    <!--
      MAP: the world, with AOR fills and/or markers. The section may carry a
      table too (`columns` + `rows`), which then renders under the map — the map
      is an orientation aid and the table is the actual reference, so the table
      is never replaced by it.
    -->
    <template v-else-if="section.kind === 'map'">
      <WorldMap
        :regions="section.map.regions ?? 'all'"
        :pins="section.map.pins ?? []"
        :zones="section.map.zones ?? []"
        :label="section.map.label"
      >
        <template #caption>{{ section.map.caption }}</template>
      </WorldMap>

      <RefTable
        v-if="section.columns"
        :columns="section.columns"
        :rows="rows"
        :caption="section.heading"
        class="mt-4"
      />
    </template>

    <!-- TABLE: generic, column-driven. -->
    <template v-else-if="section.kind === 'table'">
      <RefTable
        :columns="section.columns"
        :rows="rows"
        :caption="section.heading"
      />
    </template>

    <!-- Unknown kind: show something rather than a silent blank. -->
    <template v-else>
      <v-alert type="warning" density="compact">
        No renderer for section kind "{{ section.kind }}".
      </v-alert>
    </template>

    <p v-if="section.note" class="text-caption mt-3 mb-0" style="opacity: 0.75">
      {{ section.note }}
    </p>
  </section>
</template>

<style scoped>
.salt-dl dd {
  margin-inline-start: 0;
}
/* Ribbons are flat stripe artwork, so nearest-neighbour keeps the stripe edges
   crisp where smoothing would blur them into each other. */
.salt-ribbon {
  display: inline-block;
  border: 1px solid rgba(var(--v-border-color), 0.55);
  image-rendering: -webkit-optimize-contrast;
}
/* `.salt-insignia` is in styles/app.css — the rank explorer renders it too. */
.salt-cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
</style>

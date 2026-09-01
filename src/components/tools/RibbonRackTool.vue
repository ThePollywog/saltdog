<script setup>
/**
 * Ribbon rack calculator — pick your awards, get the rack laid out as worn.
 *
 * This is the ONLY page for Navy awards. Precedence, the wear rules and the
 * device legend used to live on a knowledge page as well; they are the things
 * you want in front of you while building a rack, not on a second URL you have
 * to hold in your head, so the topic in data/awards.js declares its `home` as
 * this tool and the knowledge page is gone.
 *
 * The reference half is rendered by <TopicSection>, the same component the
 * knowledge pages and the chat answer card use, against the same section
 * objects — so folding the material in here did not fork it. The one section
 * this page renders its own way is `precedence`: the picker below IS that list,
 * in that order, and a 68-row table above a 68-row checkbox list would be the
 * duplication all over again.
 *
 * All the wear rules live in lib/ribbons.js so they're testable without a DOM;
 * this component is selection, persistence, and rendering only.
 *
 * Stored value is `{ [awardId]: count }` keyed by the hand-written ids in
 * data/awards.js — never a slug of the display name, which would orphan every
 * saved rack the first time an award title is copy-edited. Counts are the raw
 * input; devices are derived at render, so a correction to the device rules
 * heals existing saved racks instead of leaving a wrong number baked in.
 */
import { computed, ref } from "vue";
import {
  mdiCloseCircleOutline,
  mdiMagnify,
  mdiMinus,
  mdiPlus,
  mdiUndoVariant,
} from "@mdi/js";
import awardsTopic, { CORRECTIONS, MULTIPLE_DEVICE } from "../../data/awards.js";
import {
  deviceSummary,
  layoutRack,
  spriteStyle,
} from "../../lib/ribbons.js";
import { useLocalStore } from "../../composables/useLocalStore.js";
import { useCitedSection } from "../../composables/useCitedSection.js";
import PdfButton from "../common/PdfButton.vue";
import SystemLinks from "../common/SystemLinks.vue";
import TopicSection from "../common/TopicSection.vue";

const { state: held, reset } = useLocalStore("ribbons", {
  version: 1,
  fallback: () => ({}),
});

/**
 * Deep-link arrival. A chat citation to `awards#wear` now lands here rather
 * than on a knowledge page, so this tool has to honour `?a=<sectionId>` the way
 * KnowledgeView does — otherwise every awards citation would drop the reader at
 * the top of the calculator with no idea what was cited.
 */
const { cited } = useCitedSection();

const section = (id) => awardsTopic.sections.find((s) => s.id === id);
const precedence = section("precedence");
const wear = section("wear");
const devices = section("devices");

/** Header jump links into the reference half. */
const JUMPS = [
  { a: "wear", label: "How a rack is worn" },
  { a: "devices", label: "Device legend" },
];

const query = ref("");
const undo = ref(null);
const snack = ref(false);

/** Ribbon width in the rack preview; the picker uses a smaller swatch. */
const RACK_W = 104;
const SWATCH_W = 72;

/**
 * The picker is built from the precedence section's own rows, not from a second
 * pass over AWARDS. Same objects the cited table renders, already carrying the
 * precedence number and the category label.
 */
const ROWS = precedence.rows;
const GROUPS = [...new Map(ROWS.map((r) => [r.group, r.groupLabel])).entries()];

const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return null;
  return new Set(
    ROWS.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.abbr ?? "").toLowerCase().includes(q),
    ).map((a) => a.id),
  );
});

/**
 * Groups with their (possibly filtered) awards. Groups that filter down to
 * nothing are dropped entirely rather than rendered as an empty heading.
 */
const groups = computed(() =>
  GROUPS.map(([id, label]) => ({
    id,
    label,
    awards: ROWS.filter(
      (a) => a.group === id && (!matches.value || matches.value.has(a.id)),
    ),
  })).filter((g) => g.awards.length),
);

const rack = computed(() =>
  layoutRack(Object.entries(held.value).map(([id, count]) => ({ id, count }))),
);

/** Selected awards that can carry a multiple-award device, for the count list. */
const countable = computed(() =>
  rack.value.items.filter((i) => MULTIPLE_DEVICE[i.id]),
);

const deviceLines = computed(() =>
  rack.value.items
    .map((i) => ({ id: i.id, title: i.award.title, text: deviceSummary(i), note: i.devices.note }))
    .filter((x) => x.text || x.note),
);

function isHeld(id) {
  return Boolean(held.value[id]);
}

function toggle(id) {
  const next = { ...held.value };
  if (next[id]) delete next[id];
  else next[id] = 1;
  held.value = next;
}

/** Counts are 1-based: 1 means the award with no device. */
function bump(id, delta) {
  const next = { ...held.value };
  const value = (next[id] ?? 1) + delta;
  if (value < 1) delete next[id];
  else next[id] = value;
  held.value = next;
}

function setCount(id, raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return;
  held.value = { ...held.value, [id]: n };
}

/** Clear with an undo window — a mis-click shouldn't cost the whole rack. */
function clearAll() {
  undo.value = { ...held.value };
  reset();
  snack.value = true;
}

function restore() {
  if (undo.value) held.value = undo.value;
  undo.value = null;
  snack.value = false;
}

/** Screen-reader description of the rack — the preview is images only. */
const rackText = computed(() => {
  if (!rack.value.total) return "";
  return rack.value.rows
    .map((row, i) => {
      const names = row.map((item) => {
        const d = deviceSummary(item);
        return d ? `${item.award.title} with ${d}` : item.award.title;
      });
      return `Row ${i + 1} of ${rack.value.rows.length}, top to bottom: ${names.join("; ")}.`;
    })
    .join(" ");
});
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">Ribbon Rack Calculator</h2>
      <p class="text-body-2 mb-3" style="max-width: 74ch; opacity: 0.85">
        Select what you've been awarded. The rack is sorted into order of
        precedence and laid out three to a row, built from the bottom up the way
        it's worn — so a short row sits on top with your most senior award. All
        68 ribbons, the wear rules and the full device legend are on this page.
      </p>
      <div class="d-flex flex-wrap align-center ga-2">
        <PdfButton file="usn-ribbons.pdf" describes="the ribbons and devices chart" label="Original PDF" />
        <!--
          Jump links, because the reference half sits below a 68-row picker and
          would otherwise be invisible to anyone who didn't scroll past it.

          They go through the router as `?a=<section>` rather than as a bare
          `href="#sec-wear"`. The app is hash-routed, so a fragment anchor would
          overwrite the route itself and navigate to nowhere; `?a=` is the deep
          link the router's scrollBehavior already understands, and it moves
          focus as well as scrolling.
        -->
        <router-link
          v-for="jump in JUMPS"
          :key="jump.a"
          :to="{ name: 'tools', params: { tool: 'ribbons' }, query: { a: jump.a } }"
          class="salt-link text-caption"
        >{{ jump.label }}</router-link>
      </div>
    </header>

    <!--
      Rack preview first. It's the answer to the question, and putting the
      68-row picker above it would push it off the first screen on a phone.
    -->
    <v-card class="pa-4 mb-6">
      <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-3">
        <span class="salt-eyebrow mb-0">Your rack</span>
        <span v-if="rack.total" class="text-caption" style="opacity: 0.8">
          {{ rack.total }} {{ rack.total === 1 ? "ribbon" : "ribbons" }} ·
          {{ rack.rows.length }} {{ rack.rows.length === 1 ? "row" : "rows" }}
        </span>
      </div>

      <div v-if="!rack.total" class="text-body-2 py-6 text-center" style="opacity: 0.7">
        Nothing selected yet. Pick an award below to start building the rack.
      </div>

      <template v-else>
        <!-- Each row is centred, so a short top row sits over the middle of the
             one below it exactly as a mounted rack does. -->
        <div class="salt-rack" role="img" :aria-label="rackText">
          <div v-for="(row, i) in rack.rows" :key="i" class="salt-rack-row">
            <span
              v-for="item in row"
              :key="item.id"
              class="salt-ribbon"
              :style="spriteStyle(item.award, RACK_W)"
              :title="item.award.title"
            />
          </div>
        </div>

        <div class="d-flex justify-center mt-4">
          <v-btn
            size="small"
            variant="text"
            :prepend-icon="mdiCloseCircleOutline"
            @click="clearAll"
          >
            Clear rack
          </v-btn>
        </div>
      </template>
    </v-card>

    <!-- Devices, derived from the counts. Only shown when there's something to
         say, so an all-single-award rack doesn't get an empty panel. -->
    <v-card v-if="deviceLines.length" class="pa-4 mb-6">
      <span class="salt-eyebrow">Devices to mount</span>
      <ul class="pl-0 mt-2" style="list-style: none">
        <li v-for="line in deviceLines" :key="line.id" class="py-1">
          <span class="text-body-2 font-weight-medium">{{ line.title }}</span>
          <span v-if="line.text" class="text-body-2" style="opacity: 0.85">
            — {{ line.text }}
          </span>
          <div v-if="line.note" class="text-caption" style="opacity: 0.72">
            {{ line.note }}
          </div>
        </li>
      </ul>
    </v-card>

    <!-- Multiple-award counts, for the selected awards that can carry a device.
         Kept separate from the picker: a stepper on all 68 rows would bury the
         selection checkboxes, and only a handful of awards are ever repeated. -->
    <v-card v-if="countable.length" class="pa-4 mb-6">
      <span class="salt-eyebrow">How many of each</span>
      <p class="text-caption mb-3" style="opacity: 0.75">
        Total awards held, including the first. One means no device.
      </p>
      <div
        v-for="item in countable"
        :key="item.id"
        class="d-flex flex-wrap align-center ga-3 py-2"
        style="border-bottom: 1px solid rgba(var(--v-border-color), 0.4)"
      >
        <span
          class="salt-ribbon flex-shrink-0"
          :style="spriteStyle(item.award, SWATCH_W)"
          role="presentation"
        />
        <span class="text-body-2 flex-grow-1" style="min-width: 12rem">
          {{ item.award.title }}
        </span>
        <div class="d-flex align-center ga-1">
          <v-btn
            :icon="mdiMinus"
            size="x-small"
            variant="text"
            :disabled="item.count <= 1"
            :aria-label="`One fewer ${item.award.title}`"
            @click="bump(item.id, -1)"
          />
          <v-text-field
            :model-value="item.count"
            type="number"
            min="1"
            density="compact"
            hide-details
            variant="outlined"
            style="width: 5.5rem"
            :aria-label="`Number of ${item.award.title} awards`"
            @update:model-value="setCount(item.id, $event)"
          />
          <v-btn
            :icon="mdiPlus"
            size="x-small"
            variant="text"
            :aria-label="`One more ${item.award.title}`"
            @click="bump(item.id, 1)"
          />
        </div>
      </div>
    </v-card>

    <!--
      Picker AND precedence list — hence the `sec-precedence` id, which is where
      a chat citation to awards#precedence lands. Every row carries its
      precedence number, so "where does the Combat Action Ribbon go" is answered
      by the same list you tick it in. Grouped and searchable: a flat run of 68
      checkboxes isn't navigable, and precedence order alone isn't how people
      recall what they hold.
    -->
    <v-card
      id="sec-precedence"
      tabindex="-1"
      :class="['pa-4', { 'salt-cited': cited === 'precedence' }]"
    >
      <h3 id="sec-precedence-h" class="salt-eyebrow">
        Select awards — all 68, in order of precedence
      </h3>
      <v-text-field
        v-model="query"
        label="Search awards"
        :prepend-inner-icon="mdiMagnify"
        density="comfortable"
        autocomplete="off"
        clearable
        class="mt-2"
      />

      <p v-if="matches && !groups.length" class="text-body-2 py-4 mb-0" style="opacity: 0.75">
        No award matches “{{ query }}”.
      </p>

      <section v-for="g in groups" :key="g.id" class="mb-4">
        <h4 class="salt-eyebrow mt-4">{{ g.label }}</h4>
        <div
          v-for="award in g.awards"
          :key="award.id"
          class="d-flex align-center ga-3 py-1"
        >
          <!-- Fixed-width and monospace so the numbers form a column rather
               than ragging with the label widths. -->
          <span class="salt-precedence text-caption" aria-hidden="true">
            {{ award.precedence }}
          </span>
          <v-checkbox
            :model-value="isHeld(award.id)"
            :label="award.title"
            density="compact"
            hide-details
            class="flex-grow-1"
            @update:model-value="toggle(award.id)"
          />
          <span
            class="salt-ribbon flex-shrink-0"
            :style="spriteStyle(award, SWATCH_W)"
            role="presentation"
          />
        </div>
      </section>
    </v-card>

    <!--
      The reference half, rendered by the same component the chat answer card
      uses against the same section objects. Not retyped here: if the wear rules
      change in data/awards.js, this page and every citation to it change
      together or not at all.
    -->
    <div class="mt-8">
      <TopicSection :section="wear" :level="3" :cited="cited === 'wear'" />
      <TopicSection :section="devices" :level="3" :cited="cited === 'devices'" />
    </div>

    <p class="text-caption mt-4 mb-0" style="opacity: 0.75; max-width: 74ch">
      Planning aid only. Precedence and device rules come from the Navy
      ribbons-and-devices chart, not SECNAVINST 1650.1 — this tool has no idea
      what you actually rate, and awards created after that chart was published
      are missing. Check your record in NSIPS and your rack against the current
      instruction before you mount anything.
    </p>
    <!-- NDAWS is the awards record; NSIPS is the service record. Both are named
         in the caveat above, so both are one click from it. -->
    <SystemLinks
      :ids="['ndaws', 'nsips']"
      size="small"
      label="Verify your awards"
      class="mt-3"
    />
    <p
      v-for="(c, i) in CORRECTIONS"
      :key="i"
      class="text-caption mt-2 mb-0"
      style="opacity: 0.72"
    >
      † {{ c.shown }}: {{ c.note }}
    </p>

    <v-snackbar v-model="snack" :timeout="8000">
      Rack cleared.
      <template #actions>
        <v-btn variant="text" :prepend-icon="mdiUndoVariant" @click="restore">Undo</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.salt-rack {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Ribbons on a real rack butt directly against each other — a gap here would
     make it read as a list of ribbons rather than a mounted rack. */
  gap: 2px;
}
.salt-rack-row {
  display: flex;
  gap: 2px;
}
.salt-ribbon {
  display: inline-block;
  border: 1px solid rgba(var(--v-border-color), 0.55);
  image-rendering: -webkit-optimize-contrast;
}
/* Right-aligned so 1 and 68 share a right edge and the checkboxes stay in line. */
.salt-precedence {
  flex: 0 0 auto;
  width: 2.25rem;
  text-align: right;
  font-family: var(--salt-mono, monospace);
  opacity: 0.6;
}
</style>

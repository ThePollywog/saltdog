<script setup>
/**
 * Interactive SELRES readiness checklist.
 *
 * Stored value is a map of stable item id -> ISO completion date. Storing the
 * DATE rather than a boolean costs nothing and answers the question people
 * actually have ("did I already do my PHA this year, or was that last year?").
 *
 * Item ids are hand-written in the data module and never derived from labels.
 * Slugifying the display text is the tempting shortcut, and it silently wipes
 * everyone's progress the first time somebody fixes a typo in a label.
 *
 * This is the ONLY page for the checklist topic. The cadence groups are the
 * ticked rows; the how-to procedures render below them, rather than on a
 * knowledge page the rows used to link out to. That link was the argument for
 * merging: following it took you off the tool, and the procedure you wanted was
 * a step for the box you were standing on.
 */
import { computed, ref } from "vue";
import { mdiCheckAll, mdiCloseCircleOutline, mdiUndoVariant } from "@mdi/js";
import checklistTopic, { GROUPS, HOWTO, HOWTO_NOTE, NOTE } from "../../data/checklist.js";
import { topicRoute } from "../../data/index.js";
import { useLocalStore } from "../../composables/useLocalStore.js";
import { useCitedSection } from "../../composables/useCitedSection.js";
import PdfButton from "../common/PdfButton.vue";
import SystemLinks from "../common/SystemLinks.vue";
import DirectiveRefs from "../common/DirectiveRefs.vue";
import TopicSection from "../common/TopicSection.vue";

/**
 * A citation to `reservist-checklist#howto-nsips-points` lands here now, so the
 * tool honours `?a=<sectionId>` the way KnowledgeView did.
 */
const { cited } = useCitedSection();

/**
 * The procedure sections, taken from the topic rather than rebuilt from HOWTO:
 * <TopicSection> renders the same objects the chat answer card does, so the
 * steps cannot drift between the two.
 */
const howtoSections = checklistTopic.sections.filter((x) => x.id.startsWith("howto-"));

/**
 * Where a row's "How to" link points. Via topicRoute so it follows the topic's
 * `home` — hardcoding the tools route here is how this link broke the first
 * time, when it still named the knowledge route after the page was gone.
 */
const howtoLink = (id) => topicRoute(checklistTopic.id, `howto-${id}`);

const { state: done, reset } = useLocalStore("checklist", {
  version: 1,
  fallback: () => ({}),
});

const undo = ref(null);
const snack = ref(false);

function isDone(id) {
  return Boolean(done.value[id]);
}

function toggle(id) {
  const next = { ...done.value };
  if (next[id]) delete next[id];
  else next[id] = new Date().toISOString().slice(0, 10);
  done.value = next;
}

const progress = computed(() =>
  GROUPS.map((g) => {
    const total = g.items.length;
    const complete = g.items.filter((i) => isDone(i.id)).length;
    return { id: g.id, total, complete, pct: total ? (complete / total) * 100 : 0 };
  }),
);

const overall = computed(() => {
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  const complete = Object.keys(done.value).filter((id) =>
    GROUPS.some((g) => g.items.some((i) => i.id === id)),
  ).length;
  return { total, complete, pct: total ? (complete / total) * 100 : 0 };
});

const byId = computed(() => Object.fromEntries(progress.value.map((p) => [p.id, p])));

/** Clear with an undo window — a mis-click shouldn't cost a year of tracking. */
function clearAll() {
  undo.value = { ...done.value };
  reset();
  snack.value = true;
}

function restore() {
  if (undo.value) done.value = undo.value;
  undo.value = null;
  snack.value = false;
}

/** How-to procedures, keyed for the cross-links on checklist rows. */
const howtoById = Object.fromEntries(HOWTO.map((h) => [h.id, h]));
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">Readiness Checklist</h2>
      <p class="text-body-2 mb-3" style="opacity: 0.85">
        Tick items as you complete them. Progress is saved in this browser only —
        nothing is transmitted, and clearing site data erases it.
      </p>
      <PdfButton file="reservist-checklist.pdf" describes="the reservist checklist" label="Original PDF" />
    </header>

    <v-card class="pa-4 mb-6">
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="salt-eyebrow mb-0">Overall</span>
        <span class="text-body-2 mono">
          {{ overall.complete }} / {{ overall.total }}
        </span>
      </div>
      <v-progress-linear
        :model-value="overall.pct"
        color="primary"
        height="8"
        rounded
        :aria-label="`${overall.complete} of ${overall.total} items complete`"
      />
      <div class="d-flex justify-end mt-3">
        <v-btn
          v-if="overall.complete > 0"
          size="small"
          variant="text"
          :prepend-icon="mdiCloseCircleOutline"
          @click="clearAll"
        >
          Clear all
        </v-btn>
      </div>
    </v-card>

    <section
      v-for="g in GROUPS"
      :key="g.id"
      :id="`sec-${g.id}`"
      :class="['salt-section', 'mb-6', { 'salt-cited': cited === g.id }]"
      tabindex="-1"
    >
      <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-1">
        <h3 class="salt-heading text-h6 mb-0">{{ g.heading }}</h3>
        <span class="text-caption mono" style="opacity: 0.7">
          {{ byId[g.id].complete }} / {{ byId[g.id].total }}
          <v-icon
            v-if="byId[g.id].complete === byId[g.id].total"
            :icon="mdiCheckAll"
            size="16"
            color="success"
            class="ml-1"
          />
        </span>
      </div>

      <v-progress-linear
        :model-value="byId[g.id].pct"
        color="primary"
        height="4"
        rounded
        class="mb-3"
        :aria-hidden="true"
      />

      <v-card class="pa-0">
        <div
          v-for="item in g.items"
          :key="item.id"
          class="px-4 py-2"
          style="border-bottom: 1px solid rgba(var(--v-border-color), 0.4)"
        >
          <!-- Real checkbox + real label: the whole row is clickable and the
               state is announced by the browser, not by us. -->
          <v-checkbox
            :model-value="isDone(item.id)"
            :label="item.label"
            hide-details
            density="comfortable"
            @update:model-value="toggle(item.id)"
          />
          <div class="ml-10 mb-1">
            <div v-if="item.note" class="text-caption" style="opacity: 0.75">
              {{ item.note }}
            </div>
            <div v-if="isDone(item.id)" class="text-caption mono" style="opacity: 0.6">
              Completed {{ done[item.id] }}
            </div>
            <router-link
              v-if="item.howto && howtoById[item.howto]"
              :to="howtoLink(item.howto)"
              class="salt-link text-caption"
            >How to: {{ howtoById[item.howto].heading || item.howto }}</router-link>

            <!-- The application itself, so a ticked box and the thing that
                 ticks it are one click apart rather than a search away. -->
            <SystemLinks :ids="item.systems" class="mt-2" />
            <!-- The instruction the item rests on. A ticked box is a claim about
                 readiness; this is where the claim comes from. -->
            <DirectiveRefs :refs="item.refs" class="mt-2" />
          </div>
        </div>
      </v-card>
    </section>

    <!-- The procedures. These used to live on the knowledge page the rows linked
         out to; they are the second half of the topic, and the half that answers
         "fine, but how". -->
    <h3 class="salt-heading text-h6 mt-8 mb-3">How to</h3>
    <TopicSection
      v-for="sec in howtoSections"
      :key="sec.id"
      :section="sec"
      :level="4"
      :cited="cited === sec.id"
    />

    <v-alert v-if="NOTE" density="compact" class="mb-3">
      <span class="text-body-2">{{ NOTE }}</span>
    </v-alert>
    <p v-if="HOWTO_NOTE" class="text-caption" style="opacity: 0.72">{{ HOWTO_NOTE }}</p>
    <!-- The note above names the three fallbacks in prose. They are the answer to
         "the link for my item is stale or I have no account yet", which is the
         most likely reason someone gets to the bottom of this page. -->
    <SystemLinks
      :ids="['mynavy-hr', 'mnp', 'mncc']"
      size="x-small"
      label="If a system has moved or you have no account"
      class="mt-2"
    />

    <v-snackbar v-model="snack" :timeout="8000">
      Checklist cleared.
      <template #actions>
        <v-btn variant="text" :prepend-icon="mdiUndoVariant" @click="restore">Undo</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

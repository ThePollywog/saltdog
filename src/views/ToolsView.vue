<script setup>
/**
 * Tab container for the interactive tools.
 *
 * The tab is part of the URL (`/tools/points`), not component state. That's the
 * difference between "open the points tracker" being a shareable link and being
 * a three-step instruction — and the chatbot needs to deep-link into a specific
 * tool the same way it deep-links into a knowledge section.
 *
 * Tool components are lazy — someone who came for the phonetic alphabet doesn't
 * need to parse the six-service rank tables.
 */
import { computed, defineAsyncComponent, watch } from "vue";
import { useRouter } from "vue-router";
import { TOOLS } from "../data/tools.js";

const props = defineProps({ tool: { type: String, default: "" } });
const router = useRouter();

/**
 * Ids and labels come from the shared registry; only the lazy component is local.
 *
 * The import specifier has to be a literal for Rollup to see the chunk boundary —
 * a path stored in data/tools.js and fed to `import(x)` would either bundle
 * everything eagerly or fail outright. So the registry owns the list and this map
 * owns the loading, and verify-corpus asserts the two have the same keys.
 */
const COMPONENTS = {
  checklist: () => import("../components/tools/ChecklistTool.vue"),
  due: () => import("../components/tools/DueDatesTool.vue"),
  eval: () => import("../components/tools/EvalLookupTool.vue"),
  points: () => import("../components/tools/PointsTracker.vue"),
  phonetic: () => import("../components/tools/PhoneticTool.vue"),
  ribbons: () => import("../components/tools/RibbonRackTool.vue"),
  ranks: () => import("../components/tools/RankExplorer.vue"),
};

const TABS = TOOLS.map((t) => ({ ...t, component: defineAsyncComponent(COMPONENTS[t.id]) }));

const active = computed(() => (TABS.some((t) => t.id === props.tool) ? props.tool : TABS[0].id));
const current = computed(() => TABS.find((t) => t.id === active.value));

/**
 * Normalize the URL when it doesn't name a real tool — `/tools` and
 * `/tools/typo` both land on the checklist, and `replace` keeps the bad URL out
 * of history so Back doesn't bounce through it.
 */
watch(
  () => props.tool,
  (t) => {
    if (t !== active.value) {
      router.replace({ name: "tools", params: { tool: active.value } });
    }
  },
  { immediate: true },
);

watch(
  current,
  (c) => {
    if (c) document.title = `${c.title} — SALTDOG`;
  },
  { immediate: true },
);

function select(id) {
  if (id !== active.value) router.push({ name: "tools", params: { tool: id } });
}
</script>

<template>
  <div>
    <header class="mb-4">
      <span class="salt-eyebrow">Interactive</span>
      <h1 class="salt-heading text-h4 mb-2">Readiness Tools</h1>
      <p class="text-body-1 mb-0" style="max-width: 74ch; opacity: 0.88">
        Planning aids built on the same reference data as the knowledge cards.
        Anything you enter stays in this browser — nothing is transmitted, and no
        tool here is a system of record.
      </p>
    </header>

    <!-- v-tabs renders real tab semantics; the click handler pushes the route
         rather than mutating local state, so the URL stays the source of truth. -->
    <v-tabs
      :model-value="active"
      show-arrows
      density="comfortable"
      class="mb-6"
      style="border-bottom: 1px solid rgba(var(--v-border-color), 0.4)"
    >
      <v-tab
        v-for="t in TABS"
        :key="t.id"
        :value="t.id"
        :prepend-icon="t.icon"
        @click="select(t.id)"
      >
        {{ t.title }}
      </v-tab>
    </v-tabs>

    <!-- Keyed so switching tools remounts: each tool owns its own inputs and
         should not inherit the previous one's scroll or field state. -->
    <component :is="current.component" v-if="current" :key="active" />
  </div>
</template>

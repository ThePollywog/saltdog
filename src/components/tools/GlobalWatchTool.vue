<script setup>
/**
 * World Map — a real-time multi-timezone watch display: day/night terminator
 * world map, hero clocks (local/selected/Zulu), a status roll-up (delta,
 * sunrise/sunset, next DST transition, moon phase), and a configurable zone
 * list.
 *
 * Ported from the standalone GLOBALWATCH dashboard
 * (~/workspace/aws/watchfloor-dashboard) into this site's tool suite, under
 * the display name "World Map" — the id, storage key, and internal
 * GlobalWatch* file names stay as-is (same "display text is not identity"
 * rule data/tools.js already follows for the ribbons/uniform tool).
 *
 * What changed in the port, everything else (the math, the layout logic, the
 * component split) is unchanged:
 *
 *  1. No more `<v-app>` / 100vh fixed-viewport takeover. The source app was
 *     its own standalone page; here it's one tab among many inside
 *     ToolsView.
 *  2. Full SALTDOG styling, not the source app's own dark cyan "watchfloor"
 *     theme — bordered v-cards, salt-heading/salt-eyebrow/mono, and the
 *     site's own saltLight/saltDark theme colors, so this tool looks like
 *     the rest of the site and follows the light/dark toggle like every
 *     other tool. AppShell.vue lets this one tool render full-width (still
 *     inside the app bar / nav drawer chrome) instead of the site's usual
 *     centered 1180px column, so the map has room to be a map.
 *  3. Zone/clock settings persist to localStorage via useLocalStore, not
 *     sessionStorage — see data/gwConfig.js for why.
 *
 * MDI icons went from the icon-font classes the source used to @mdi/js SVG
 * paths, matching how the rest of this site references icons.
 */
import { onMounted, onUnmounted, ref } from "vue";
import { mdiCog } from "@mdi/js";
import { DEFAULT_CONFIG } from "../../data/gwConfig.js";
import { useLocalStore } from "../../composables/useLocalStore.js";
import GlobalWatchClocks from "./GlobalWatchClocks.vue";
import GlobalWatchStatus from "./GlobalWatchStatus.vue";
import GlobalWatchMap from "./GlobalWatchMap.vue";
import GlobalWatchSettings from "./GlobalWatchSettings.vue";

const { state: store } = useLocalStore("globalwatch", {
  version: 1,
  fallback: () => structuredClone(DEFAULT_CONFIG),
});

const now = ref(new Date());
const settings = ref(false);
let timer;
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div>
    <header class="mb-4 d-flex flex-wrap align-start justify-space-between ga-4">
      <div>
        <h2 class="salt-heading text-h5 mb-1">World Map</h2>
        <p class="text-body-2 mb-0" style="max-width: 74ch; opacity: 0.85">
          A multi-timezone watch display: the day/night terminator, hero
          clocks for your local zone / a selected zone / Zulu, sunrise-sunset
          and next-DST-transition lookups, and a configurable watch list.
          Fully offline — every calculation runs in your browser, nothing is
          sent anywhere. Your zone list and clock format are saved in this
          browser only.
        </p>
      </div>
      <v-btn variant="tonal" size="small" :prepend-icon="mdiCog" @click="settings = true">Configure</v-btn>
    </header>

    <GlobalWatchClocks :now="now" :config="store" />
    <GlobalWatchStatus :now="now" :config="store" class="mt-4" />
    <GlobalWatchMap :now="now" :config="store" class="mt-4 gw-map" />

    <GlobalWatchSettings v-model="settings" :config="store" />
  </div>
</template>

<style scoped>
/* The map is the one element here worth the extra vertical room AppShell's
   full-bleed layout freed up — a day/night terminator squeezed into a card
   the height PRT's standards table needs would waste the width gained. */
.gw-map :deep(.map-svg) {
  min-height: 360px;
}
</style>

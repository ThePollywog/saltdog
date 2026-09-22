<script setup>
/**
 * Three hero clocks: the operator's local zone, the selected "center" zone
 * (click to change), and ZULU. Logic ported from the standalone GLOBALWATCH
 * dashboard's HeroClocks.vue, unchanged; `config` is a prop (the source read
 * a module-level singleton). Styling is SALTDOG's own — bordered v-card,
 * salt-eyebrow/mono, and the site's theme colors (secondary/primary/success)
 * rather than the source app's fixed tactical palette.
 */
import { computed, ref } from "vue";
import { mdiChevronDown, mdiPencil } from "@mdi/js";
import { zoneTime, supportedZones, offsetLabel } from "../../lib/gwTime.js";

const props = defineProps({
  now: { type: Date, required: true },
  config: { type: Object, required: true },
});

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const picker = ref(false);
// Full IANA list as autocomplete items; Vuetify handles the search/filter.
const zoneItems = computed(() =>
  supportedZones().map((z) => ({ title: `${z}  (${offsetLabel(z, props.now)})`, value: z })),
);

// Guarded accessor: clearing the picker sets selectedTz to null; fall back to UTC.
const selectedTz = computed({
  get: () => props.config.selectedTz || "UTC",
  set: (v) => {
    props.config.selectedTz = v || "UTC";
  },
});

function clock(tz) {
  return zoneTime(tz, props.now, props.config.hourFormat, props.config.showSeconds);
}

// Raw UTC offset (minutes) for a tz at a given date.
function offsetMinutesAt(tz, date) {
  const s =
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const m = s.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

// Whether the operator's local zone observes DST and is currently on it.
const localDst = computed(() => {
  const y = props.now.getUTCFullYear();
  const jan = offsetMinutesAt(localTz, new Date(Date.UTC(y, 0, 1)));
  const jul = offsetMinutesAt(localTz, new Date(Date.UTC(y, 6, 1)));
  if (jan === jul) return { observes: false, active: false };
  const cur = offsetMinutesAt(localTz, props.now);
  return { observes: true, active: cur > Math.min(jan, jul) };
});

// Vuetify theme color name per panel — resolved via the site's own
// saltLight/saltDark tokens, so this reads correctly in both.
const panels = computed(() => [
  {
    key: "local",
    kicker: "LOCAL · OPERATOR",
    tz: localTz,
    label: localTz.split("/").pop().replace(/_/g, " ").toUpperCase(),
    accent: "secondary",
    t: clock(localTz),
    pick: false,
    dst: localDst.value,
  },
  {
    key: "selected",
    kicker: "SELECTED",
    tz: selectedTz.value,
    label: selectedTz.value.split("/").pop().replace(/_/g, " ").toUpperCase(),
    accent: "primary",
    t: clock(selectedTz.value),
    pick: true,
  },
  {
    key: "zulu",
    kicker: "ZULU · REFERENCE",
    tz: "UTC",
    label: "ZULU",
    accent: "success",
    t: clock("UTC"),
    pick: false,
  },
]);

/**
 * `vuetify/styles` is the prebuilt CSS bundle (no vite-plugin-vuetify SASS
 * pass), so Vuetify's generated `.text-primary` etc. utility classes don't
 * exist in this build — every other component here reaches theme colors via
 * the `--v-theme-*` CSS custom properties instead, and this does the same.
 */
function accentColor(name) {
  return `rgb(var(--v-theme-${name}))`;
}
</script>

<template>
  <div class="gw-hero-grid">
    <v-card
      v-for="p in panels"
      :key="p.key"
      class="pa-4 gw-hero-panel"
      :class="{ 'gw-hero-center': p.key === 'selected' }"
      :style="{ borderTopColor: accentColor(p.accent), borderTopWidth: '3px' }"
    >
      <div class="d-flex align-center justify-space-between mb-3">
        <span class="salt-eyebrow" :style="{ color: accentColor(p.accent) }">{{ p.kicker }}</span>
        <div class="d-flex align-center" style="gap: 8px">
          <v-chip v-if="p.dst && p.dst.observes" size="x-small" :color="p.dst.active ? 'warning' : undefined" label>
            {{ p.dst.active ? "DST" : "STD" }}
          </v-chip>
          <span class="mono text-caption" style="opacity: 0.7">{{ p.t.offset }}</span>
          <v-btn v-if="p.pick" :icon="mdiPencil" variant="text" size="x-small" :color="p.accent" @click="picker = true" />
        </div>
      </div>

      <div
        class="font-weight-bold mb-1 d-flex align-center"
        :class="{ 'gw-selectable': p.pick }"
        style="font-size: 1.05rem; letter-spacing: 0.1em; gap: 4px"
        @click="p.pick && (picker = true)"
      >
        {{ p.label }}
        <v-icon v-if="p.pick" size="16" :icon="mdiChevronDown" :color="p.accent" />
      </div>

      <div class="mono gw-hero-digits" :class="{ 'text-h3': p.key !== 'selected', 'text-h2': p.key === 'selected' }">
        {{ p.t.hh }}<span :style="{ color: accentColor(p.accent) }">:</span>{{ p.t.mm
        }}<template v-if="config.showSeconds"
          ><span :style="{ color: accentColor(p.accent) }">:</span
          ><span class="gw-hero-secs" style="opacity: 0.7">{{ p.t.ss }}</span></template
        >
        <span v-if="config.hourFormat === 12" class="ml-2 mono text-body-1" style="opacity: 0.7">{{ p.t.dayPeriod }}</span>
      </div>

      <div class="d-flex align-center mt-3" style="gap: 10px; letter-spacing: 0.1em">
        <span class="font-weight-bold" :style="{ color: accentColor(p.accent) }">{{ p.t.weekday }}</span>
        <span class="gw-hero-sep" :style="{ background: accentColor(p.accent) }" />
        <span class="font-weight-bold">{{ p.t.date }}</span>
      </div>
    </v-card>

    <!-- Selected-zone picker -->
    <v-dialog v-model="picker" max-width="460">
      <v-card class="pa-4">
        <div class="salt-eyebrow mb-3">Select center timezone</div>
        <v-autocomplete
          v-model="selectedTz"
          :items="zoneItems"
          label="IANA timezone"
          autofocus
          no-data-text="No match"
          :menu-props="{ maxHeight: 360 }"
        />
        <div class="d-flex justify-end mt-4">
          <v-btn variant="flat" color="primary" @click="picker = false">Done</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.gw-hero-grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr 1fr;
  gap: 16px;
}
.gw-hero-panel {
  border-top-style: solid !important;
}
.gw-hero-center {
  box-shadow: 0 0 0 1px rgba(var(--v-theme-primary), 0.35) !important;
}
.gw-hero-digits {
  line-height: 1.15;
}
.gw-hero-secs {
  font-size: 0.6em;
}
.gw-selectable {
  cursor: pointer;
}
.gw-selectable:hover {
  opacity: 0.75;
}
.gw-hero-sep {
  width: 2px;
  height: 16px;
  opacity: 0.55;
  border-radius: 1px;
}

@media (max-width: 900px) {
  .gw-hero-grid {
    grid-template-columns: 1fr;
  }
}
</style>

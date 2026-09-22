<script setup>
/**
 * Configuration drawer: clock format, add/remove watched zones, reset.
 * Logic ported from the standalone GLOBALWATCH dashboard's
 * SettingsDrawer.vue, unchanged — `config` is a prop and zone add/remove go
 * through the addZone/removeZone helpers in data/gwConfig.js instead of a
 * module-level singleton. Styling is a plain SALTDOG drawer, matching every
 * other v-navigation-drawer on the site (no forced dark background).
 */
import { ref, computed } from "vue";
import { mdiClose, mdiPlus, mdiRestore, mdiTrashCanOutline } from "@mdi/js";
import { addZone, removeZone, DEFAULT_CONFIG } from "../../data/gwConfig.js";
import { supportedZones, offsetLabel } from "../../lib/gwTime.js";

const model = defineModel({ type: Boolean });
const props = defineProps({ config: { type: Object, required: true } });

const newTz = ref(null);
const newLabel = ref("");
const newRegion = ref("");

const now = new Date();
// Full IANA list; Vuetify's autocomplete handles search/filtering natively.
const zoneItems = computed(() => supportedZones().map((z) => ({ title: `${z}  (${offsetLabel(z, now)})`, value: z })));

function commitAdd() {
  if (!newTz.value) return;
  const label = newLabel.value.trim() || newTz.value.split("/").pop().replace(/_/g, " ").toUpperCase();
  addZone(props.config, { label, tz: newTz.value, region: newRegion.value.trim().toUpperCase() || "CUSTOM" });
  newTz.value = null;
  newLabel.value = "";
  newRegion.value = "";
}

function resetConfig() {
  Object.assign(props.config, structuredClone(DEFAULT_CONFIG));
}
</script>

<template>
  <v-navigation-drawer v-model="model" location="right" width="400" temporary>
    <div class="pa-4">
      <div class="d-flex align-center justify-space-between mb-4">
        <span class="salt-heading text-h6">Configuration</span>
        <v-btn :icon="mdiClose" variant="text" size="small" @click="model = false" />
      </div>

      <!-- Clock options -->
      <div class="salt-eyebrow mb-2">Clock</div>
      <v-btn-toggle v-model="config.hourFormat" mandatory density="comfortable" variant="outlined" divided class="mb-3" style="width: 100%">
        <v-btn :value="24" style="flex: 1">24 hour</v-btn>
        <v-btn :value="12" style="flex: 1">12 hour</v-btn>
      </v-btn-toggle>
      <v-switch v-model="config.showSeconds" label="Show seconds" color="primary" density="compact" hide-details class="mb-3" />

      <v-divider class="my-5" />

      <!-- Add zone -->
      <div class="salt-eyebrow mb-2">Add timezone</div>
      <v-autocomplete
        v-model="newTz"
        :items="zoneItems"
        label="IANA timezone"
        density="compact"
        class="mb-2"
        no-data-text="No match"
        :menu-props="{ maxHeight: 320 }"
      />
      <div class="d-flex mb-2" style="gap: 12px">
        <v-text-field v-model="newLabel" label="Display label" density="compact" />
        <v-text-field v-model="newRegion" label="Region tag" density="compact" />
      </div>
      <v-btn block color="primary" :prepend-icon="mdiPlus" :disabled="!newTz" class="mb-5" @click="commitAdd">
        Add to watch
      </v-btn>

      <!-- Active zones -->
      <div class="salt-eyebrow mb-2">Active zones · {{ config.zones.length }}</div>
      <v-list density="compact" bg-color="transparent" class="pa-0">
        <v-list-item v-for="z in config.zones" :key="z.id" class="px-2 mb-1" border rounded="sm">
          <template #title>
            <span class="mono text-body-2">{{ z.label }}</span>
          </template>
          <template #subtitle>
            <span class="mono text-caption">{{ z.tz }} · {{ z.region }}</span>
          </template>
          <template #append>
            <v-btn :icon="mdiTrashCanOutline" variant="text" size="x-small" color="error" @click="removeZone(config, z.id)" />
          </template>
        </v-list-item>
      </v-list>

      <v-btn block variant="outlined" color="error" :prepend-icon="mdiRestore" class="mt-4 mb-8" @click="resetConfig">
        Reset to defaults
      </v-btn>
    </div>
  </v-navigation-drawer>
</template>

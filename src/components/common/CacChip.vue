<script setup>
/**
 * CAC-required indicator.
 *
 * Uses a word, not just a colour — "CAC" vs "Open". Colour-only status is
 * invisible to colour-blind users and vanishes entirely in print.
 */
import { mdiCardAccountDetailsOutline, mdiEarth } from "@mdi/js";

defineProps({ cac: { type: Boolean, default: false } });
</script>

<template>
  <v-chip
    :color="cac ? 'warning' : 'success'"
    :prepend-icon="cac ? mdiCardAccountDetailsOutline : mdiEarth"
    size="x-small"
    label
    :title="cac ? 'Requires a CAC and a government network or middleware' : 'Reachable without a CAC'"
  >
    {{ cac ? "CAC" : "Open" }}
  </v-chip>
</template>

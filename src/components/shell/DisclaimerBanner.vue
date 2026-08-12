<script setup>
/**
 * Site-wide disclaimer.
 *
 * Dismissible, but the dismissal is NOT persisted across sessions — it lives in
 * component state only. A readiness reference whose "verify before relying"
 * notice can be permanently hidden is worse than one without it, because the
 * absence reads as endorsement.
 */
import { ref } from "vue";
import { mdiAlertCircleOutline } from "@mdi/js";

const open = ref(true);
</script>

<template>
  <v-alert
    v-if="open"
    type="info"
    :icon="mdiAlertCircleOutline"
    class="mb-6"
    closable
    :close-label="'Hide this notice'"
    @click:close="open = false"
  >
    <div class="text-body-2">
      <strong>Reference aid, not an authority.</strong>
      System names and URLs change often and most require a CAC. Verify anything
      you act on against the official source, your NOSC, or MNCC
      (<a href="tel:18333306622" class="salt-link">1-833-330-MNCC</a>).
      Nothing here is transmitted anywhere.
    </div>
  </v-alert>
</template>

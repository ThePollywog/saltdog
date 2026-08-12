<script setup>
/**
 * "Download original PDF" — the escape hatch for anyone who wants the printable
 * card rather than the interactive version.
 *
 * `download` is set so a click saves rather than navigating away from the app,
 * and the accessible name includes the topic, because a page with five buttons
 * all named "PDF" is unusable with a screen reader.
 */
import { mdiFilePdfBox } from "@mdi/js";

const props = defineProps({
  /** Bare filename as stored in the data modules, e.g. "navy-fleets.pdf". */
  file: { type: String, required: true },
  label: { type: String, default: "Original PDF" },
  /** What the PDF is of, for the accessible name. */
  describes: { type: String, default: "" },
  size: { type: String, default: "small" },
  variant: { type: String, default: "outlined" },
});

// Relative so it resolves under any base path (the build uses base: "./").
const href = `pdf/${props.file}`;
</script>

<template>
  <v-btn
    :href="href"
    :download="file"
    :prepend-icon="mdiFilePdfBox"
    :size="size"
    :variant="variant"
    :aria-label="describes ? `Download ${describes} as PDF` : `Download ${label}`"
    class="salt-no-print"
  >
    {{ label }}
  </v-btn>
</template>

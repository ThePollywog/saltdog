<script setup>
/**
 * The citation row — "Authority: BUPERSINST 1610.10H" under a card.
 *
 * Deliberately small and deliberately everywhere. A checklist item that says
 * "12 days of AT" is a claim; the same item with RESPERSMAN 1571-010 under it is
 * a claim you can go check, and checking is the only thing that makes a site like
 * this trustworthy rather than merely confident.
 *
 * Each chip links to the LIBRARY, not to a document. See data/directives.js for
 * why — a PDF path on a Navy host is the fastest-rotting link this site could
 * contain, and one of the two libraries WAF-blocks every client that isn't a
 * browser, so a broken deep link could not even be detected by a build check.
 *
 * The revision letter is rendered as a hint on the chip and never as part of the
 * name, because the name is what someone will type into DONI's search and the
 * letter is what will be wrong first.
 */
import { computed } from "vue";
import { mdiOpenInNew } from "@mdi/js";
import {
  directiveUrl,
  directivesFor,
  display,
  libraryName,
} from "../../data/directives.js";

const props = defineProps({
  /** Directive ids, from a section's / item's `refs`. */
  refs: { type: Array, default: () => [] },
  /** "Authority" on a card, omitted inline where a label would be noise. */
  label: { type: String, default: "Authority" },
  size: { type: String, default: "x-small" },
});

const items = computed(() =>
  directivesFor(props.refs).map((d) => ({
    id: d.id,
    text: display(d),
    title: d.title,
    rev: d.rev ?? null,
    url: directiveUrl(d),
    library: libraryName(d),
  })),
);
</script>

<template>
  <div v-if="items.length" class="d-flex flex-wrap align-center ga-2">
    <span v-if="label" class="salt-eyebrow" style="opacity: 0.7">{{ label }}</span>

    <!--
      A chip per citation. `title` gives the document's full name on hover; the
      accessible name spells out the whole thing plus the destination, because
      "BUPERSINST 1610.10H" read aloud on its own is a licence-plate, not a link.
    -->
    <v-chip
      v-for="d in items"
      :key="d.id"
      :size="size"
      variant="outlined"
      label
      :href="d.url ?? undefined"
      :target="d.url ? '_blank' : undefined"
      :rel="d.url ? 'noopener noreferrer' : undefined"
      :title="d.rev ? `${d.title} (revision ${d.rev} as of transcription)` : d.title"
      :aria-label="
        d.url
          ? `${d.text} — ${d.title}. Opens ${d.library} in a new tab.`
          : `${d.text} — ${d.title}`
      "
      class="salt-ref mono"
    >
      {{ d.text }}
      <v-icon
        v-if="d.url"
        :icon="mdiOpenInNew"
        size="11"
        class="ml-1"
        aria-hidden="true"
      />
    </v-chip>
  </div>
</template>

<style scoped>
/* Citations are reference furniture, not calls to action: they sit quieter than
   a system link and only come forward on hover/focus. */
.salt-ref {
  opacity: 0.85;
}
.salt-ref:hover,
.salt-ref:focus-visible {
  opacity: 1;
}
</style>

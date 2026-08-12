<script setup>
/**
 * "Go do it" — the row of buttons that takes you to the actual application.
 *
 * Used by the checklist tool, the knowledge checklist/steps sections, and the
 * points tracker, so a system looks and behaves the same everywhere it appears.
 *
 * Three things this deliberately does NOT do:
 *
 * 1. It doesn't pretend a portal-routed system has its own address. PRIMS-2,
 *    eNAVFIT, C-WAY and NDAWS have no public front door, so the button carries
 *    the portal's URL and says "via MyNavy HR" out loud. Silently linking the
 *    portal under the app's name would look like a working deep link and land
 *    someone on a hub with no idea where to go next.
 * 2. It doesn't render a dead button. `offline` systems (the SAAR form, TAP) get
 *    plain text with their access path, because a disabled-looking button that
 *    can't do anything is worse than a sentence telling you to see your Security
 *    Manager.
 * 3. It doesn't hide the CAC gate. Most of these need a CAC and a government
 *    network, and finding that out after clicking is the whole frustration this
 *    site exists to remove — so it's on the button, in a word and not just a
 *    colour.
 */
import { mdiCardAccountDetailsOutline, mdiOpenInNew, mdiPhoneOutline } from "@mdi/js";
import { systemUrl, systemsFor, viaLabel } from "../../data/systems.js";

const props = defineProps({
  /** System ids from data/systems.js. Unknown ids are dropped, not blanked. */
  ids: { type: Array, default: () => [] },
  /** `x-small` inside dense checklist rows, `small` under a heading. */
  size: { type: String, default: "x-small" },
  /** Label above the row; omit inside a row that's already labelled. */
  label: { type: String, default: "" },
});

const rows = systemsFor(props.ids).map((sys) => ({
  ...sys,
  href: systemUrl(sys.id),
  via: viaLabel(sys.id),
}));

const linked = rows.filter((r) => r.href);
const unlinked = rows.filter((r) => !r.href);

/**
 * A tel: link must not open a new tab — on desktop it hands off to a dialer and
 * `target="_blank"` leaves a dead blank tab behind.
 */
const isPhone = (r) => r.reach === "phone";
</script>

<template>
  <div v-if="rows.length" class="salt-syslinks">
    <span v-if="label" class="salt-eyebrow d-block mb-1">{{ label }}</span>

    <div class="d-flex flex-wrap align-center ga-2">
      <v-btn
        v-for="r in linked"
        :key="r.id"
        :href="r.href"
        :target="isPhone(r) ? undefined : '_blank'"
        :rel="isPhone(r) ? undefined : 'noopener noreferrer'"
        :size="size"
        variant="tonal"
        class="salt-syslink"
        :append-icon="isPhone(r) ? mdiPhoneOutline : mdiOpenInNew"
      >
        {{ r.name }}
        <!--
          The via-label and the CAC gate are part of the button's accessible
          name, not decoration beside it: a screen-reader user tabbing the row
          hears "PRIMS-2, via MyNavy Portal, CAC required" rather than a bare
          system name that may not go where it appears to.
        -->
        <span v-if="r.via" class="salt-via">&nbsp;· {{ r.via }}</span>
        <!--
          `then` is the click AFTER the portal opens. It rides in the same label
          as `via` because the two are one instruction — "via NSIPS, then select
          ESR" — and splitting them across a button and a caption elsewhere is
          how someone ends up on the right site and still can't find the thing.
        -->
        <span v-if="r.then" class="salt-via">&nbsp;· {{ r.then }}</span>
        <v-icon
          v-if="r.cac"
          :icon="mdiCardAccountDetailsOutline"
          size="12"
          class="ml-1"
          aria-hidden="true"
        />
        <span class="sr-only">
          {{ isPhone(r) ? "(calls this number)" : "(opens in a new tab)" }}
          {{ r.cac ? "— requires a CAC" : "" }}
        </span>
      </v-btn>
    </div>

    <!-- No application to link: say where it actually happens. -->
    <p v-if="unlinked.length" class="text-caption mt-1 mb-0" style="opacity: 0.75">
      <span v-for="(r, i) in unlinked" :key="r.id">
        {{ i > 0 ? " · " : "" }}<strong>{{ r.name }}</strong>: {{ r.access }}
      </span>
    </p>
  </div>
</template>

<style scoped>
/* Buttons default to uppercase-ish letter-spacing site-wide; system names are
   proper nouns and read wrong stretched out. */
.salt-syslink {
  text-transform: none;
  letter-spacing: 0;
}
.salt-via {
  opacity: 0.75;
  font-weight: 400;
}
</style>

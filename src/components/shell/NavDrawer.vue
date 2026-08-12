<script setup>
/**
 * Primary navigation. Knowledge topics are listed individually rather than
 * hidden behind an index page — on a reference site, the point is to see the
 * whole surface at a glance.
 */
import {
  mdiAccountGroupOutline,
  mdiAlphabeticalVariant,
  mdiCalendarCheckOutline,
  mdiCheckboxMarkedOutline,
  mdiEarth,
  mdiFerry,
  mdiFileDocumentEditOutline,
  mdiHomeOutline,
  mdiInformationOutline,
  mdiLinkVariant,
  mdiOpenInNew,
  mdiSitemapOutline,
  mdiMedalOutline,
} from "@mdi/js";
import { TOPICS } from "../../data/index.js";
import { TOOLS } from "../../data/tools.js";

defineProps({ modelValue: { type: Boolean, default: true } });
defineEmits(["update:modelValue"]);

/** Topic id -> icon. Kept here so data modules stay free of presentation. */
const TOPIC_ICONS = {
  "reservist-checklist": mdiCheckboxMarkedOutline,
  "eval-fitrep": mdiCalendarCheckOutline,
  ranks: mdiAccountGroupOutline,
  "combatant-commands": mdiEarth,
  "navy-fleets": mdiFerry,
  "joint-codes": mdiSitemapOutline,
  "phonetic-alphabet": mdiAlphabeticalVariant,
  awards: mdiMedalOutline,
};

/**
 * The drawer shows the fuller `navTitle` — the tab bar has to fit six labels on
 * one line, but here there is room to say "EVAL / FITREP Due Date" instead of
 * "EVAL / FITREP", and the extra words are what make the list scannable.
 */
const TOOL_LINKS = TOOLS.map((t) => ({
  title: t.navTitle ?? t.title,
  to: `/tools/${t.id}`,
  icon: t.icon,
}));

/**
 * Sibling apps from the same project, hosted separately.
 *
 * WEBNAVFIT is the natural companion to this site: SALTDOG tells you WHEN your
 * eval is due and WEBNAVFIT is where you draft it, so the two halves of the same
 * task were a bookmark apart. Like this site it is fully client-side, which is
 * why it can be sent somewhere without a caveat about uploading a draft eval.
 *
 * The URL is lowercase deliberately. GitHub Pages paths are case-sensitive and
 * `/WEBNAVFIT/` returns 404; only `/webnavfit/` resolves. Both were requested
 * before this was written, because the app's own README advertises the uppercase
 * form and copying it would have shipped a dead link.
 */
const COMPANION_APPS = [
  {
    title: "WEBNAVFIT",
    subtitle: "Draft FITREPs & EVALs",
    href: "https://thepollywog.github.io/webnavfit/",
    icon: mdiFileDocumentEditOutline,
  },
];
</script>

<template>
  <v-navigation-drawer
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :width="284"
  >
    <nav aria-label="Main navigation">
      <v-list nav density="compact">
        <v-list-item :to="{ name: 'home' }" :prepend-icon="mdiHomeOutline" title="Home" />
        <v-list-item
          :to="{ name: 'quicklinks' }"
          :prepend-icon="mdiLinkVariant"
          title="Quick Links"
        />
      </v-list>

      <v-divider class="my-1" />

      <v-list nav density="compact">
        <v-list-subheader class="salt-eyebrow">Knowledge</v-list-subheader>
        <v-list-item
          v-for="t in TOPICS"
          :key="t.id"
          :to="{ name: 'knowledge', params: { topicId: t.id } }"
          :prepend-icon="TOPIC_ICONS[t.id]"
          :title="t.navTitle || t.title"
        />
      </v-list>

      <v-divider class="my-1" />

      <v-list nav density="compact">
        <v-list-subheader class="salt-eyebrow">Tools</v-list-subheader>
        <v-list-item
          v-for="t in TOOL_LINKS"
          :key="t.to"
          :to="t.to"
          :prepend-icon="t.icon"
          :title="t.title"
        />
      </v-list>

      <v-divider class="my-1" />

      <!--
        Companion apps: a separate group because these LEAVE the site, and every
        other item in this drawer is a route. A visitor clicking one is not
        navigating, they're departing, and the drawer should say so before the
        click rather than after — hence its own subheader, the new-tab glyph, and
        the screen-reader note. It gets `href`, not `to`: vue-router would try to
        resolve an absolute URL as a path and land on the catch-all.
      -->
      <v-list nav density="compact">
        <v-list-subheader class="salt-eyebrow">Companion apps</v-list-subheader>
        <v-list-item
          v-for="a in COMPANION_APPS"
          :key="a.href"
          :href="a.href"
          target="_blank"
          rel="noopener noreferrer"
          :prepend-icon="a.icon"
          :title="a.title"
          :subtitle="a.subtitle"
        >
          <!-- The slot rather than `append-icon`, because the icon needs the
               sr-only text beside it and a prop can only supply the glyph. -->
          <template #append>
            <v-icon :icon="mdiOpenInNew" size="13" aria-hidden="true" />
            <span class="sr-only">(opens in a new tab)</span>
          </template>
        </v-list-item>
      </v-list>

      <v-divider class="my-1" />

      <v-list nav density="compact">
        <v-list-item
          :to="{ name: 'about' }"
          :prepend-icon="mdiInformationOutline"
          title="About & Stored Data"
        />
      </v-list>
    </nav>
  </v-navigation-drawer>
</template>

<script setup>
/**
 * App chrome: skip link, app bar, nav drawer, routed content, chat widget.
 *
 * The drawer starts closed below the lg breakpoint so the first paint on a phone
 * is content, not a menu.
 */
import { computed, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import { useRoute } from "vue-router";
import { TOOLS } from "../../data/tools.js";
import { mdiEmailOutline, mdiMenu, mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import NavDrawer from "./NavDrawer.vue";
import ChatWidget from "../chat/ChatWidget.vue";
import { useAppTheme } from "../../composables/useAppTheme.js";
import { FOOTER_LINKS, reportUrl } from "../../lib/feedback.js";

const { lgAndUp } = useDisplay();
const { isDark, toggle } = useAppTheme();

const drawer = ref(lgAndUp.value);
watch(lgAndUp, (v) => (drawer.value = v));

const version = __APP_VERSION__;

/**
 * Feedback links, in the footer so they are on every page.
 *
 * Recomputed per route so each one carries the address the reporter is actually
 * looking at. That is the whole value of putting them here rather than on the
 * About page: "the rank chart is wrong" filed from the rank page needs no
 * further questions, and the same sentence filed from a contact form does.
 *
 * `location.href` is read through the route so the computed re-evaluates on
 * navigation — a hash-routed app does not remount, so reading it once at setup
 * would pin every report to whichever page happened to be loaded first.
 */
const route = useRoute();
const feedback = computed(() => {
  void route.fullPath;
  const here = typeof location === "undefined" ? "" : location.href;
  return FOOTER_LINKS.map((l) => ({ ...l, href: reportUrl(l.kind, here) }));
});

/**
 * True for a tool that opted into `fullBleed` in data/tools.js — drops the
 * site's usual centered 1180px column so that tool can use the full width
 * next to the nav drawer. The app bar, nav drawer and footer are unaffected;
 * only the routed content's own container changes.
 */
const fullBleed = computed(() => {
  if (route.name !== "tools") return false;
  return TOOLS.find((t) => t.id === route.params.tool)?.fullBleed === true;
});
</script>

<template>
  <v-app>
    <a href="#main" class="skip-link">Skip to content</a>

    <v-app-bar>
      <v-app-bar-nav-icon
        :icon="mdiMenu"
        aria-label="Toggle navigation"
        @click="drawer = !drawer"
      />

      <router-link
        :to="{ name: 'home' }"
        class="d-flex flex-column text-decoration-none"
        style="color: inherit"
      >
        <span class="salt-eyebrow mb-0">U.S. Navy</span>
        <span class="salt-heading text-h6" style="line-height: 1.1">SALTDOG</span>
      </router-link>

      <v-spacer />

      <v-btn
        :icon="isDark ? mdiWeatherSunny : mdiWeatherNight"
        variant="text"
        :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggle"
      />
    </v-app-bar>

    <NavDrawer v-model="drawer" />

    <v-main>
      <!-- tabindex="-1" so the skip link can move focus here, not just scroll. -->
      <main id="main" tabindex="-1" class="salt-section">
        <v-container v-if="!fullBleed" class="py-6" style="max-width: 1180px">
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
        </v-container>
        <!-- fullBleed: same vertical rhythm (py-6), no max-width and no side
             gutters — the tool's own header still gives it a left/right edge
             to align to, it just isn't clipped to the reading column. -->
        <v-container v-else fluid class="py-6 px-4">
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
        </v-container>
      </main>

      <v-footer class="d-flex flex-column align-start salt-no-print" border>
        <div class="text-caption" style="opacity: 0.7">
          SALTDOG {{ version }} — unofficial reference aid. Not a Department of the
          Navy publication. Runs entirely in your browser; no data is transmitted.
        </div>
        <!--
          Opens a prefilled email to the project mailbox. Deliberately plain
          links: dressing one as a button is how people end up surprised by
          what it does.

          No target="_blank" — a mailto handed to a new tab leaves an empty tab
          behind on every desktop browser, and on a machine with no mail client
          registered it leaves a blank page and no explanation. Same tab means a
          failed handoff costs nothing.
        -->
        <div class="text-caption mt-2 d-flex flex-wrap ga-4">
          <a
            v-for="link in feedback"
            :key="link.kind"
            :href="link.href"
            class="salt-link d-inline-flex align-center ga-1"
          >
            {{ link.label }}
            <v-icon :icon="mdiEmailOutline" size="13" aria-hidden="true" />
            <span class="sr-only">(opens your email app)</span>
          </a>
        </div>
      </v-footer>
    </v-main>

    <ChatWidget />
  </v-app>
</template>

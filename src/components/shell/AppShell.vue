<script setup>
/**
 * App chrome: skip link, app bar, nav drawer, routed content, chat widget.
 *
 * The drawer starts closed below the lg breakpoint so the first paint on a phone
 * is content, not a menu.
 */
import { ref, watch } from "vue";
import { useDisplay } from "vuetify";
import { mdiMenu, mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import NavDrawer from "./NavDrawer.vue";
import ChatWidget from "../chat/ChatWidget.vue";
import { useAppTheme } from "../../composables/useAppTheme.js";

const { lgAndUp } = useDisplay();
const { isDark, toggle } = useAppTheme();

const drawer = ref(lgAndUp.value);
watch(lgAndUp, (v) => (drawer.value = v));

const version = __APP_VERSION__;
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
        <span class="salt-eyebrow mb-0">U.S. Navy Reserve</span>
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
        <v-container class="py-6" style="max-width: 1180px">
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
      </v-footer>
    </v-main>

    <ChatWidget />
  </v-app>
</template>

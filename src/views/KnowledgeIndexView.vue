<script setup>
/**
 * Knowledge index. Each card lists its own sections as direct deep links, so a
 * reader can jump straight to "Command Authorities" without loading the topic
 * page first and hunting.
 */
import { mdiArrowRight } from "@mdi/js";
import PdfButton from "../components/common/PdfButton.vue";
import { TOPICS, topicRoute } from "../data/index.js";
</script>

<template>
  <div>
    <header class="mb-6">
      <span class="salt-eyebrow">Reference</span>
      <h1 class="salt-heading text-h4 mb-2">Knowledge</h1>
      <p class="text-body-1 mb-0" style="max-width: 72ch; opacity: 0.88">
        The reference cards, transcribed into searchable tables. Every card links
        the original PDF if you want the printable version.
      </p>
    </header>

    <div class="salt-topic-grid">
      <v-card v-for="t in TOPICS" :key="t.id" class="pa-5 d-flex flex-column">
        <span class="salt-eyebrow">{{ t.eyebrow }}</span>
        <h2 class="salt-heading text-h6 mb-2">
          <router-link
            :to="topicRoute(t.id)"
            class="text-decoration-none"
            style="color: inherit"
          >
            {{ t.title }}
          </router-link>
        </h2>
        <p class="text-body-2 mb-3" style="opacity: 0.85">{{ t.blurb }}</p>

        <div class="mb-4">
          <router-link
            v-for="s in t.sections.slice(0, 6)"
            :key="s.id"
            :to="topicRoute(t.id, s.id)"
            class="salt-link text-caption d-inline-block mr-3 mb-1"
          >{{ s.heading }}</router-link>
          <span v-if="t.sections.length > 6" class="text-caption" style="opacity: 0.6">
            +{{ t.sections.length - 6 }} more
          </span>
        </div>

        <v-spacer />
        <div class="d-flex flex-wrap ga-2">
          <v-btn :to="topicRoute(t.id)" :append-icon="mdiArrowRight" variant="tonal" size="small">
            Open
          </v-btn>
          <PdfButton v-if="t.sourcePdf" :file="t.sourcePdf" :describes="t.title" label="PDF" />
        </div>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.salt-topic-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}
</style>

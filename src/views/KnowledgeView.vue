<script setup>
/**
 * ONE view for every knowledge topic, driven by the registry.
 *
 * Seven near-identical views would have been seven places to fix a rendering
 * bug; `/knowledge/:topicId` against `TOPIC_BY_ID` plus `<TopicSection>` is the
 * same output with one code path.
 */
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { mdiArrowRight } from "@mdi/js";
import TopicSection from "../components/common/TopicSection.vue";
import PdfButton from "../components/common/PdfButton.vue";
import SystemLinks from "../components/common/SystemLinks.vue";
import { getTopic } from "../data/index.js";
import { useCitedSection } from "../composables/useCitedSection.js";

const props = defineProps({ topicId: { type: String, required: true } });
const route = useRoute();
const router = useRouter();
const { cited } = useCitedSection();

const topic = computed(() => getTopic(props.topicId));

// An unknown topic id (a stale bookmark, a typo) goes to the index rather than
// rendering an empty page.
watch(
  topic,
  (t) => {
    if (!t) router.replace({ name: "knowledge-index" });
  },
  { immediate: true },
);

// Quick links has its own view; if someone reaches it here, forward them.
watch(
  () => props.topicId,
  (id) => {
    if (id === "quicklinks") router.replace({ name: "quicklinks", query: route.query });
  },
  { immediate: true },
);

watch(
  topic,
  (t) => {
    if (t) document.title = `${t.title} — SALTDOG`;
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="topic">
    <nav aria-label="Breadcrumb" class="mb-3">
      <!-- Label on the tag's own line: a newline inside the link renders as a
           space that the underline paints, overshooting the word. -->
      <router-link
        :to="{ name: 'knowledge-index' }"
        class="salt-link text-caption"
      >Knowledge</router-link>
      <span class="text-caption" style="opacity: 0.5"> / {{ topic.title }}</span>
    </nav>

    <header class="mb-6">
      <span class="salt-eyebrow">{{ topic.eyebrow }}</span>
      <h1 class="salt-heading text-h4 mb-2">{{ topic.title }}</h1>
      <p v-if="topic.blurb" class="text-body-1 mb-4" style="max-width: 74ch; opacity: 0.88">
        {{ topic.blurb }}
      </p>

      <div class="d-flex flex-wrap ga-2">
        <PdfButton
          v-if="topic.sourcePdf"
          :file="topic.sourcePdf"
          :describes="topic.title"
          label="Original PDF"
        />
        <v-btn
          v-if="topic.toolRoute"
          :to="topic.toolRoute"
          :append-icon="mdiArrowRight"
          variant="tonal"
          size="small"
        >
          {{ topic.toolLabel || "Open the tool" }}
        </v-btn>
      </div>

      <!--
        The systems this topic is actually about, next to the PDF and the tool.
        A reference page that explains a deadline and names the application is
        two-thirds of the job; this is the third that saves a search. Topics with
        no application behind them (fleets, phonetic alphabet) declare nothing
        and render nothing.
      -->
      <SystemLinks
        :ids="topic.systems"
        size="small"
        label="Systems for this topic"
        class="mt-4"
      />
    </header>

    <v-alert v-if="topic.note" density="compact" class="mb-6">
      <span class="text-body-2">{{ topic.note }}</span>
    </v-alert>

    <TopicSection
      v-for="section in topic.sections"
      :key="section.id"
      :section="section"
      :level="2"
      :cited="cited === section.id"
    />
  </div>
</template>

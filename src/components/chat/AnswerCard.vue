<script setup>
/**
 * Renders one retrieval result: answer, ambiguous, or unknown.
 *
 * The answer body is the actual `<TopicSection>` from the data module — the same
 * component and the same object the knowledge page renders. Nothing is
 * paraphrased, so there is no way for a cited answer to drift from its source.
 */
import { mdiArrowRight, mdiHelpCircleOutline, mdiInformationOutline } from "@mdi/js";
import TopicSection from "../common/TopicSection.vue";
import PdfButton from "../common/PdfButton.vue";
import SystemLinks from "../common/SystemLinks.vue";

defineProps({ result: { type: Object, required: true } });
const emit = defineEmits(["navigate", "ask"]);

/** Where to send someone when the corpus has nothing: the two hubs and a phone. */
const FALLBACK_SYSTEMS = ["mynavy-hr", "mnp", "mncc"];
</script>

<template>
  <div>
    <!-- ANSWER -->
    <template v-if="result.kind === 'answer'">
      <div class="salt-eyebrow mb-1">
        {{ result.record.topicTitle }} → {{ result.record.heading }}
      </div>

      <v-card class="pa-3 mb-2">
        <TopicSection :section="result.record.section" :level="3" :show-heading="false" />
      </v-card>

      <div class="d-flex flex-wrap ga-2 mb-2">
        <v-btn
          size="small"
          variant="tonal"
          :append-icon="mdiArrowRight"
          @click="emit('navigate', result.record)"
        >
          Open in {{ result.record.topicId === 'quicklinks' ? 'Quick Links' : 'Knowledge' }}
        </v-btn>
        <PdfButton
          v-if="result.record.sourcePdf"
          :file="result.record.sourcePdf"
          :describes="result.record.topicTitle"
          label="PDF"
        />
        <v-btn
          v-if="result.record.toolRoute"
          size="small"
          variant="text"
          @click="emit('navigate', { route: result.record.toolRoute })"
        >
          {{ result.record.toolLabel || 'Open tool' }}
        </v-btn>
      </div>

      <p v-if="result.record.note" class="text-caption mb-0" style="opacity: 0.72">
        {{ result.record.note }}
      </p>
    </template>

    <!-- AMBIGUOUS: offer the choice instead of guessing. -->
    <template v-else-if="result.kind === 'ambiguous'">
      <div class="d-flex ga-2 mb-2">
        <v-icon :icon="mdiHelpCircleOutline" size="18" aria-hidden="true" />
        <span class="text-body-2">
          That could be a few things. Which did you mean?
        </span>
      </div>
      <div class="d-flex flex-column ga-2">
        <v-btn
          v-for="rec in result.options"
          :key="rec.id"
          variant="outlined"
          size="small"
          class="justify-start"
          :append-icon="mdiArrowRight"
          @click="emit('navigate', rec)"
        >
          <span class="text-truncate">{{ rec.topicTitle }} — {{ rec.heading }}</span>
        </v-btn>
      </div>
    </template>

    <!-- UNKNOWN: say so, then give routes that actually work. -->
    <template v-else>
      <div class="d-flex ga-2 mb-2">
        <v-icon :icon="mdiInformationOutline" size="18" aria-hidden="true" />
        <span class="text-body-2">
          I don't have a card covering that. This searches only the reference
          material on this site.
        </span>
      </div>

      <p class="text-body-2 mb-1">Where to go instead:</p>
      <!--
        The three fallbacks are real links rather than named-in-prose, and they
        come from the registry: this used to hold its own copy of the MyNavy HR
        and MNP addresses, which is precisely the copy that goes stale unnoticed
        because it only renders when the search fails.
      -->
      <SystemLinks :ids="FALLBACK_SYSTEMS" size="small" class="mb-2" />
      <ul class="text-body-2 pl-5 mb-3">
        <li>MyNavy HR — policy, pay, and career authority</li>
        <li>MyNavy Portal — single sign-on to the systems themselves</li>
        <li>Your NOSC, Career Counselor, or chain of command</li>
      </ul>

      <p class="salt-eyebrow mb-1">Questions I can answer</p>
      <div class="d-flex flex-wrap ga-2">
        <v-chip
          v-for="s in (result.suggestions ?? [])"
          :key="s"
          size="small"
          variant="outlined"
          link
          @click="emit('ask', s)"
        >
          {{ s }}
        </v-chip>
      </div>
    </template>
  </div>
</template>

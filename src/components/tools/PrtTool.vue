<script setup>
/**
 * PRT (Physical Readiness Test) calculator and standards table.
 *
 * PRT is one of the two parts of the PFA — the other is the Body Composition
 * Assessment, a pass/fail screen (waist-to-height ratio, with a body-fat
 * lookup as a second step) that Guide-5A does not cover and this tool does
 * not attempt to score. Scoring BCA from a guessed formula would be worse
 * than not offering it; see the note in the header.
 *
 * All grading numbers come straight from Table 4-1 of Guide-5A (Dec 2025,
 * standards below 5,000ft) — see data/prtTables.js. Altitude-adjusted
 * standards (Table 4-2) aren't included.
 *
 * Nothing here is persisted: unlike the points tracker, there's no return
 * value in remembering someone's last PRT inputs across visits.
 */
import { computed, ref } from "vue";
import { mdiAlertOutline, mdiCalculatorVariantOutline } from "@mdi/js";
import {
  AGE_GROUPS,
  CARDIO_EVENTS,
  CATEGORY_LABELS,
  ageGroupIndex,
  gradeEvent,
  mmssToSeconds,
  overallScore,
  secondsToMmss,
} from "../../lib/prt.js";
import { PRT_TABLE } from "../../data/prtTables.js";
import prtTopic from "../../data/prt.js";
import { useCitedSection } from "../../composables/useCitedSection.js";
import PdfButton from "../common/PdfButton.vue";
import SystemLinks from "../common/SystemLinks.vue";
import RefTable from "../common/RefTable.vue";
import TopicSection from "../common/TopicSection.vue";

const { cited } = useCitedSection();

const age = ref(30);
const gender = ref("M");
const pushups = ref(null);
const plankText = ref("");
const cardioEvent = ref("run");
const cardioText = ref("");

const ageIdx = computed(() => ageGroupIndex(age.value));
const ageGroup = computed(() => AGE_GROUPS[ageIdx.value]);

const plankSeconds = computed(() => mmssToSeconds(plankText.value));
const cardioSeconds = computed(() => mmssToSeconds(cardioText.value));

const pushupsGrade = computed(() =>
  gradeEvent("pushups", pushups.value, ageIdx.value, gender.value),
);
const plankGrade = computed(() =>
  plankSeconds.value == null ? null : gradeEvent("plank", plankSeconds.value, ageIdx.value, gender.value),
);
const cardioGrade = computed(() =>
  cardioSeconds.value == null
    ? null
    : gradeEvent(cardioEvent.value, cardioSeconds.value, ageIdx.value, gender.value),
);

const result = computed(() =>
  overallScore({ pushups: pushupsGrade.value, plank: plankGrade.value, cardio: cardioGrade.value }),
);

const cardioLabel = computed(
  () => CARDIO_EVENTS.find((e) => e.key === cardioEvent.value)?.label ?? "Cardio",
);

const plankInvalid = computed(() => plankText.value.length > 0 && plankSeconds.value == null);
const cardioInvalid = computed(() => cardioText.value.length > 0 && cardioSeconds.value == null);

/** Reference table for the selected age/gender — shown even with no inputs entered. */
const REF_COLUMNS = computed(() => [
  { key: "category", title: "Category", nowrap: true },
  { key: "points", title: "Points", mono: true },
  { key: "pushups", title: "Push-ups", mono: true },
  { key: "plank", title: "Plank", mono: true },
  { key: "cardioTime", title: cardioLabel.value, mono: true },
]);

const refRows = computed(() => {
  const rows = PRT_TABLE[ageIdx.value]?.[gender.value] ?? [];
  return rows.map((r, i) => ({
    category: CATEGORY_LABELS[i],
    points: r.points,
    pushups: r.pushups,
    plank: secondsToMmss(r.plank),
    cardioTime: secondsToMmss(r[cardioEvent.value]),
  }));
});
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">PRT Calculator</h2>
      <p class="text-body-2 mb-2" style="max-width: 74ch; opacity: 0.85">
        Scores the Physical Readiness Test (push-ups, forearm plank, and one
        cardio event) against the current age/gender standards. This is the
        PRT half of the PFA only — the other half, the Body Composition
        Assessment, is a separate pass/fail screen (waist-to-height ratio,
        with a body-fat lookup if that fails) that isn't scored here.
        Unofficial planning aid — PRIMS-2 and your CFL are the record of truth.
      </p>
      <div class="d-flex flex-wrap align-center ga-4">
        <PdfButton file="prt-guide-5a.pdf" describes="the PRT standards (Guide-5A)" label="Guide-5A PDF" />
        <SystemLinks :ids="['prims2']" />
      </div>
    </header>

    <v-card class="pa-4 mb-6">
      <div class="d-flex flex-wrap ga-4 align-start">
        <v-text-field
          v-model.number="age"
          label="Age"
          type="number"
          min="17"
          style="max-width: 100px"
        />
        <v-select
          v-model="gender"
          :items="[{ title: 'Male', value: 'M' }, { title: 'Female', value: 'F' }]"
          label="Gender"
          style="max-width: 140px"
        />
        <div class="pt-2">
          <span class="salt-eyebrow">Age group</span>
          <div class="text-body-1 mono">{{ ageGroup?.label ?? "—" }}</div>
        </div>
      </div>

      <v-divider class="my-4" />

      <div class="d-flex flex-wrap ga-4 align-start">
        <v-text-field
          v-model.number="pushups"
          label="Push-ups (max reps, 2 min)"
          type="number"
          min="0"
          style="max-width: 220px"
        />
        <v-text-field
          v-model="plankText"
          label="Forearm plank (mm:ss)"
          placeholder="2:30"
          :error="plankInvalid"
          :error-messages="plankInvalid ? ['Use mm:ss'] : []"
          style="max-width: 180px"
        />
        <v-select
          v-model="cardioEvent"
          :items="CARDIO_EVENTS.map((e) => ({ title: e.label, value: e.key }))"
          label="Cardio event"
          style="max-width: 220px"
        />
        <v-text-field
          v-model="cardioText"
          :label="`${cardioLabel} (mm:ss)`"
          placeholder="10:30"
          :error="cardioInvalid"
          :error-messages="cardioInvalid ? ['Use mm:ss'] : []"
          style="max-width: 180px"
        />
      </div>
    </v-card>

    <v-card v-if="pushupsGrade || plankGrade || cardioGrade" class="pa-4 mb-6">
      <div class="d-flex flex-wrap ga-6">
        <div v-if="pushupsGrade">
          <span class="salt-eyebrow">Push-ups</span>
          <div class="text-h6 salt-heading">{{ pushupsGrade.category }}</div>
          <div class="text-body-2 mono" style="opacity: 0.75">{{ pushupsGrade.points }} pts</div>
        </div>
        <div v-if="plankGrade">
          <span class="salt-eyebrow">Plank</span>
          <div class="text-h6 salt-heading">{{ plankGrade.category }}</div>
          <div class="text-body-2 mono" style="opacity: 0.75">{{ plankGrade.points }} pts</div>
        </div>
        <div v-if="cardioGrade">
          <span class="salt-eyebrow">{{ cardioLabel }}</span>
          <div class="text-h6 salt-heading">{{ cardioGrade.category }}</div>
          <div class="text-body-2 mono" style="opacity: 0.75">{{ cardioGrade.points }} pts</div>
        </div>
      </div>

      <template v-if="result">
        <v-divider class="my-4" />
        <div class="d-flex flex-wrap ga-6 align-center">
          <div>
            <span class="salt-eyebrow">Overall PRT score</span>
            <div class="text-h4 salt-heading mono">{{ result.average.toFixed(1) }}</div>
          </div>
          <div>
            <span class="salt-eyebrow">Overall category</span>
            <div class="text-h5 salt-heading">{{ result.category }}</div>
          </div>
        </div>

        <v-alert
          v-if="result.anyFailed"
          type="warning"
          density="compact"
          class="mt-4"
          :icon="mdiAlertOutline"
        >
          <span class="text-body-2">
            Guide-5A fails the whole PRT if any single event falls below
            Probationary, regardless of the average — that's the case here.
          </span>
        </v-alert>
      </template>
    </v-card>

    <h3 class="salt-heading text-h6 mb-3">
      <v-icon :icon="mdiCalculatorVariantOutline" size="18" class="mr-1" aria-hidden="true" />
      Standards — {{ gender === "M" ? "Male" : "Female" }}, age {{ ageGroup?.label ?? "—" }}
    </h3>
    <RefTable
      :columns="REF_COLUMNS"
      :rows="refRows"
      caption="PRT scoring standards for the selected age group and gender"
    />
    <p class="text-caption mt-3 mb-0" style="opacity: 0.72">
      Table 4-1, standards below 5,000ft elevation. Alternate cardio (2,000m
      row, 500yd/450m swim) is selectable above; the stationary bike and
      treadmill aren't included — Guide-5A scores those from machine-reported
      calories via the official PFA mobile app, not a time table.
    </p>

    <TopicSection
      v-for="s in prtTopic.sections"
      :key="s.id"
      :section="s"
      :level="3"
      :cited="cited === s.id"
      class="mt-6"
    />
  </div>
</template>

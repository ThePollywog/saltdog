<script setup>
/**
 * Retirement points / good-year tracker.
 *
 * Persists RAW INPUTS only — totals are derived at render. If the point math
 * ever needs correcting, old saved data heals itself instead of carrying a
 * baked-in wrong total forever.
 *
 * Years are anniversary years, not fiscal or calendar years. Binning points by
 * fiscal year is the classic bug in tools like this: it silently mis-files
 * everything earned near the boundary.
 */
import { computed, ref } from "vue";
import { mdiAlertOutline, mdiPlus, mdiTrashCanOutline, mdiUndoVariant } from "@mdi/js";
import {
  GOOD_YEAR_MIN,
  INACTIVE_POINT_CAP,
  MEMBERSHIP_POINTS,
  RETIREMENT_YEARS,
  anniversaryWindow,
  nextYearLabel,
  summarize,
} from "../../lib/points.js";
import { useLocalStore } from "../../composables/useLocalStore.js";
import SystemLinks from "../common/SystemLinks.vue";

const { state: store, reset } = useLocalStore("points", {
  version: 1,
  fallback: () => ({ anniversaryMonthDay: "", years: [] }),
});

const undo = ref(null);
const snack = ref(false);

const summary = computed(() => summarize(store.value.years));
const window_ = computed(() => anniversaryWindow(store.value.anniversaryMonthDay));

function addYear() {
  store.value = {
    ...store.value,
    years: [
      ...store.value.years,
      {
        label: nextYearLabel(store.value.years),
        idt: 0,
        at: 0,
        corr: 0,
        membership: MEMBERSHIP_POINTS,
      },
    ],
  };
}

function removeYear(i) {
  const years = [...store.value.years];
  years.splice(i, 1);
  store.value = { ...store.value, years };
}

function update(i, field, value) {
  const years = [...store.value.years];
  years[i] = { ...years[i], [field]: value };
  store.value = { ...store.value, years };
}

function clearAll() {
  undo.value = JSON.parse(JSON.stringify(store.value));
  reset();
  snack.value = true;
}

function restore() {
  if (undo.value) store.value = undo.value;
  undo.value = null;
  snack.value = false;
}

/** Number input coercion — an empty field is 0, not NaN. */
const numeric = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">Points & Good Years</h2>
      <p class="text-body-2 mb-2" style="opacity: 0.85">
        A planning aid. Your NSIPS Annual Retirement Point Record (ESR) is the
        record of truth — if the two disagree, NSIPS wins and you should ask your
        NOSC to reconcile it. Saved in this browser only.
      </p>
      <!-- Naming the record of truth and then not linking it makes the reader do
           the work twice: read that NSIPS wins, then go find NSIPS. -->
      <SystemLinks :ids="['nsips', 'mypay']" size="small" label="Check the record" />
    </header>

    <v-card class="pa-4 mb-6">
      <div class="d-flex flex-wrap ga-4 align-start">
        <v-text-field
          :model-value="store.anniversaryMonthDay"
          label="RC anniversary (MM-DD)"
          placeholder="10-01"
          hint="Your pay-entry/RC anniversary — not the fiscal year"
          persistent-hint
          style="max-width: 240px"
          @update:model-value="store = { ...store, anniversaryMonthDay: $event }"
        />
        <div v-if="window_">
          <span class="salt-eyebrow">Current anniversary year</span>
          <div class="text-body-1 mono">{{ window_.label }}</div>
        </div>
      </div>
    </v-card>

    <v-card class="pa-4 mb-6">
      <div class="d-flex flex-wrap ga-8">
        <div>
          <span class="salt-eyebrow">Good years</span>
          <div class="text-h4 salt-heading">
            {{ summary.goodYears }}<span class="text-h6" style="opacity: 0.6">/{{ RETIREMENT_YEARS }}</span>
          </div>
        </div>
        <div>
          <span class="salt-eyebrow">Total points</span>
          <div class="text-h4 salt-heading mono">{{ summary.totalPoints }}</div>
        </div>
        <div>
          <span class="salt-eyebrow">Years remaining</span>
          <div class="text-h4 salt-heading">{{ summary.remainingToRetirement }}</div>
        </div>
      </div>

      <v-progress-linear
        :model-value="summary.progress * 100"
        color="primary"
        height="8"
        rounded
        class="mt-4"
        :aria-label="`${summary.goodYears} of ${RETIREMENT_YEARS} good years`"
      />

      <v-alert v-if="summary.retirementEligible" type="success" density="compact" class="mt-4">
        <span class="text-body-2">
          {{ RETIREMENT_YEARS }} good years reached — reserve retirement eligibility.
          Confirm against your ESR and NOSC before acting on it.
        </span>
      </v-alert>
    </v-card>

    <h3 class="salt-heading text-h6 mb-3">Anniversary years</h3>

    <v-alert v-if="!store.years.length" density="compact" class="mb-4">
      <span class="text-body-2">
        No years tracked yet. Add one and enter your IDT (drill), AT/ADT, and
        correspondence points. Membership points default to
        {{ MEMBERSHIP_POINTS }} for a full year of participation.
      </span>
    </v-alert>

    <v-card v-for="(y, i) in summary.rows" :key="i" class="pa-4 mb-3">
      <div class="d-flex flex-wrap ga-3 align-start">
        <v-text-field
          :model-value="store.years[i].label"
          label="Year"
          style="max-width: 130px"
          @update:model-value="update(i, 'label', $event)"
        />
        <v-text-field
          :model-value="store.years[i].idt"
          label="IDT (drill)"
          type="number"
          min="0"
          style="max-width: 120px"
          @update:model-value="update(i, 'idt', numeric($event))"
        />
        <v-text-field
          :model-value="store.years[i].at"
          label="AT / ADT"
          type="number"
          min="0"
          style="max-width: 120px"
          @update:model-value="update(i, 'at', numeric($event))"
        />
        <v-text-field
          :model-value="store.years[i].corr"
          label="Corresp."
          type="number"
          min="0"
          style="max-width: 120px"
          @update:model-value="update(i, 'corr', numeric($event))"
        />
        <v-text-field
          :model-value="store.years[i].membership"
          label="Membership"
          type="number"
          min="0"
          style="max-width: 130px"
          @update:model-value="update(i, 'membership', numeric($event))"
        />

        <v-spacer />

        <div class="text-right">
          <span class="salt-eyebrow">Total</span>
          <div class="text-h5 salt-heading mono">{{ y.total }}</div>
          <v-chip :color="y.isGood ? 'success' : 'warning'" size="x-small" label class="mt-1">
            {{ y.isGood ? 'Good year' : `${y.shortBy} short` }}
          </v-chip>
        </div>

        <v-btn
          :icon="mdiTrashCanOutline"
          variant="text"
          size="small"
          :aria-label="`Remove ${store.years[i].label || 'this year'}`"
          @click="removeYear(i)"
        />
      </div>

      <!-- Flagged, never silently clamped: the user's record is the user's record. -->
      <v-alert
        v-if="y.overInactiveCap"
        type="warning"
        density="compact"
        class="mt-3"
        :icon="mdiAlertOutline"
      >
        <span class="text-body-2">
          Inactive-duty points ({{ y.inactive }}) exceed the {{ INACTIVE_POINT_CAP }}-point
          annual cap that applies to most years. Your total is shown as entered —
          check how the cap applies to this year in your ESR.
        </span>
      </v-alert>
    </v-card>

    <div class="d-flex flex-wrap ga-2 mt-4">
      <v-btn :prepend-icon="mdiPlus" variant="tonal" @click="addYear">Add a year</v-btn>
      <v-btn
        v-if="store.years.length"
        variant="text"
        size="small"
        @click="clearAll"
      >
        Clear all
      </v-btn>
    </div>

    <p class="text-caption mt-4" style="opacity: 0.72">
      A satisfactory ("good") year requires at least {{ GOOD_YEAR_MIN }} retirement
      points earned in the anniversary year.
    </p>

    <v-snackbar v-model="snack" :timeout="8000">
      Points tracker cleared.
      <template #actions>
        <v-btn variant="text" :prepend-icon="mdiUndoVariant" @click="restore">Undo</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

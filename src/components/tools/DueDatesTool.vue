<script setup>
/**
 * Due dates — the checklist sorted by what bites next, plus a calendar export.
 *
 * This tool stores NOTHING of its own. Completion dates come from the `checklist`
 * store and the RC anniversary from the `points` store, both of which the user has
 * already filled in elsewhere. A third copy of either would immediately disagree
 * with the other two, and "which of these three screens is right about my PHA" is
 * a worse problem than not having this page at all.
 *
 * The anniversary override below is the one exception, and it writes back to the
 * points store rather than to a new key — so setting it here fixes the points
 * tracker too, which is where it actually belongs.
 *
 * All the arithmetic is in lib/due.js and none of it is here: the DST, month-end
 * and UTC-parsing traps are the kind of thing that has to be unit-tested, and a
 * component is not testable in this project.
 */
import { computed, ref } from "vue";
import {
  mdiAlertCircleOutline,
  mdiCalendarExport,
  mdiCalendarQuestion,
  mdiCheckCircleOutline,
  mdiClockAlertOutline,
  mdiHelpCircleOutline,
} from "@mdi/js";
import { GROUPS, NOTE } from "../../data/checklist.js";
import { buildIcs, buildSchedule, ICS_FILENAME, summarizeSchedule } from "../../lib/due.js";
import { useLocalStore } from "../../composables/useLocalStore.js";
import SystemLinks from "../common/SystemLinks.vue";
import DirectiveRefs from "../common/DirectiveRefs.vue";

/** Read-only here; the checklist tool owns writes to it. */
const { state: done } = useLocalStore("checklist", {
  version: 1,
  fallback: () => ({}),
});

/**
 * The points store, for `anniversaryMonthDay`. Same key, same version, same
 * fallback shape as PointsTracker — this is a second reader of one record, not a
 * second record.
 */
const { state: points } = useLocalStore("points", {
  version: 1,
  fallback: () => ({ anniversaryMonthDay: "", years: [] }),
});

const anniversary = computed({
  get: () => points.value.anniversaryMonthDay ?? "",
  set: (v) => {
    points.value = { ...points.value, anniversaryMonthDay: v };
  },
});

/**
 * "Today" is captured once when the tool mounts rather than read per-render.
 * A computed that calls `new Date()` would recompute a different answer on every
 * reactive tick, which makes the day-count flicker across midnight and makes the
 * .ics non-deterministic mid-session.
 */
const today = ref(new Date());

const rows = computed(() =>
  buildSchedule(GROUPS, {
    completions: done.value,
    anniversaryMonthDay: anniversary.value,
    today: today.value,
  }),
);

const summary = computed(() => summarizeSchedule(rows.value));

const STATUS = {
  overdue: { label: "Overdue", color: "error", icon: mdiAlertCircleOutline },
  "due-soon": { label: "Due soon", color: "warning", icon: mdiClockAlertOutline },
  ok: { label: "On track", color: "success", icon: mdiCheckCircleOutline },
  "needs-anchor": { label: "Needs a date", color: "info", icon: mdiCalendarQuestion },
  unscheduled: { label: "Event-driven", color: undefined, icon: mdiHelpCircleOutline },
};

/** "in 43 days" / "12 days ago" / "today" — the sentence people want. */
function relative(days) {
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

const showAll = ref(false);
const ACTIONABLE = new Set(["overdue", "due-soon"]);

const visible = computed(() =>
  showAll.value ? rows.value : rows.value.filter((r) => ACTIONABLE.has(r.status)),
);

const exportInfo = computed(() => buildIcs(rows.value, { stamp: today.value }));

const snack = ref(false);
const snackText = ref("");

/**
 * Download the .ics from a Blob. No network, no server, and no data URI —
 * a data URI trips content-type sniffing in some clients and silently opens as
 * text instead of importing.
 */
function exportIcs() {
  const { ics, exported, skipped } = buildIcs(rows.value, { stamp: new Date() });
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ICS_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  // Say what was left out. Exporting 14 of 31 items without a word reads as
  // "it's all on your calendar now", which is the one wrong impression here.
  snackText.value = skipped
    ? `${exported} dated items exported. ${skipped} left out — they have no calendar date yet.`
    : `${exported} items exported to ${ICS_FILENAME}.`;
  snack.value = true;
}
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">Due Dates & Calendar</h2>
      <p class="text-body-2 mb-3" style="max-width: 72ch; opacity: 0.85">
        The same checklist, sorted by what's closest. Dates are computed from the
        completion dates you ticked in the Readiness Checklist and from your RC
        anniversary — nothing new is stored here, and nothing is transmitted.
      </p>
    </header>

    <v-card class="pa-4 mb-6">
      <div class="d-flex flex-wrap align-center ga-4">
        <v-text-field
          v-model="anniversary"
          label="RC anniversary (MM-DD)"
          placeholder="10-01"
          hint="Shared with the Points tool — setting it here sets it there."
          persistent-hint
          class="mono"
          style="max-width: 15rem"
        />
        <div class="text-body-2" style="flex: 1 1 auto; opacity: 0.85">
          <!-- Named rather than implied: the anniversary drives good-year items,
               and without it those rows honestly cannot be dated at all. -->
          A good year runs from your anniversary date, not from January or from
          October. Without it, the good-year rows below say so instead of guessing.
        </div>
      </div>
    </v-card>

    <div class="d-flex flex-wrap ga-3 mb-4" aria-live="polite">
      <v-chip
        v-for="key in ['overdue', 'due-soon', 'ok', 'needs-anchor', 'unscheduled']"
        :key="key"
        :color="STATUS[key].color"
        :prepend-icon="STATUS[key].icon"
        variant="tonal"
        label
      >
        {{ summary[key] }} {{ STATUS[key].label.toLowerCase() }}
      </v-chip>
    </div>

    <div class="d-flex flex-wrap align-center ga-3 mb-4">
      <v-btn
        :prepend-icon="mdiCalendarExport"
        variant="flat"
        color="primary"
        :disabled="exportInfo.exported === 0"
        @click="exportIcs"
      >
        Export {{ exportInfo.exported }} to calendar (.ics)
      </v-btn>
      <v-btn variant="text" size="small" @click="showAll = !showAll">
        {{ showAll ? "Show only what needs attention" : `Show all ${summary.total} items` }}
      </v-btn>
    </div>

    <v-alert
      v-if="!visible.length"
      :type="summary.scheduled ? 'success' : 'info'"
      density="compact"
      class="mb-6"
    >
      <template v-if="summary.scheduled">
        Nothing overdue or due soon.
        <template v-if="summary['needs-anchor']">
          {{ summary["needs-anchor"] }} item(s) still need a completion date before
          they can be tracked — tick them once in the Readiness Checklist.
        </template>
      </template>
      <template v-else>
        No dates yet. Tick items in the Readiness Checklist with the date you last
        did them, and they'll appear here with a due date.
      </template>
    </v-alert>

    <v-card v-for="row in visible" :key="row.itemId" class="pa-4 mb-3">
      <div class="d-flex flex-wrap align-start justify-space-between ga-3">
        <div style="flex: 1 1 22rem">
          <div class="d-flex flex-wrap align-center ga-2 mb-1">
            <v-chip
              :color="STATUS[row.status].color"
              :prepend-icon="STATUS[row.status].icon"
              size="x-small"
              variant="tonal"
              label
            >
              {{ STATUS[row.status].label }}
            </v-chip>
            <span class="text-caption salt-eyebrow" style="opacity: 0.7">
              {{ row.groupHeading }}
            </span>
          </div>

          <div class="text-body-1 font-weight-medium">{{ row.item.label }}</div>

          <!--
            The date and the reason travel together. "2027-03-15" alone invites
            the question this line answers — where did that come from — and the
            answer is different per basis, so it is generated rather than static.
          -->
          <div class="text-body-2 mt-1">
            <template v-if="row.dueISO">
              <span class="mono">{{ row.dueISO }}</span>
              <span :class="row.status === 'overdue' ? 'font-weight-medium' : ''">
                · {{ relative(row.daysUntil) }}
              </span>
            </template>
            <template v-else>
              <span style="opacity: 0.8">No date yet</span>
            </template>
          </div>
          <div class="text-caption mt-1" style="opacity: 0.75">{{ row.reason }}</div>

          <SystemLinks :ids="row.item.systems" size="x-small" class="mt-3" />
          <DirectiveRefs :refs="row.item.refs" class="mt-2" />
        </div>
      </div>
    </v-card>

    <v-alert density="compact" class="mt-6">
      <span class="text-body-2">
        Planning aid only. These dates are computed from what you entered here, not
        read from any Navy system — NSIPS, MRRS and PRIMS-2 are the records of
        truth, and a NAVADMIN can change a cycle without changing this page.
        {{ NOTE }}
      </span>
    </v-alert>

    <v-snackbar v-model="snack" :timeout="9000">
      {{ snackText }}
    </v-snackbar>
  </div>
</template>

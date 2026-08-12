<script setup>
/**
 * EVAL/FITREP due-date lookup.
 *
 * Everything shown is DERIVED from the published calendar and labelled as such.
 * Two cases the source card doesn't cover are handled explicitly rather than
 * returning nothing: flag officers (O7-O10, different cycle) and the two months
 * with no scheduled reports.
 */
import { computed, ref } from "vue";
import { mdiAlertOutline, mdiCalendarCheckOutline } from "@mdi/js";
import {
  COVERED_PAYGRADES,
  EMPTY_MONTHS,
  FLAG_PAYGRADES,
  lookupPaygrade,
} from "../../lib/evalRules.js";
import { RULES, SCHEDULE } from "../../data/evalCalendar.js";
import PdfButton from "../common/PdfButton.vue";
import RefTable from "../common/RefTable.vue";
import SystemLinks from "../common/SystemLinks.vue";

const grade = ref("E6");
const result = computed(() => lookupPaygrade(grade.value));

const CHOICES = [...COVERED_PAYGRADES, ...FLAG_PAYGRADES];

const SCHEDULE_COLUMNS = [
  { key: "month", title: "Month", mono: true, nowrap: true, width: "9rem" },
  { key: "officer", title: "Officer (FITREP)" },
  { key: "enlisted", title: "Enlisted (EVAL)" },
];
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">EVAL / FITREP Due Date</h2>
      <p class="text-body-2 mb-3" style="opacity: 0.85">
        Pick a paygrade to see its reporting month and the derived due dates.
        Derived from the published cycle — special reports (detachment, promotion,
        frocking) fall outside it entirely, and windows shift. Confirm with your
        reporting senior or admin.
      </p>
      <div class="d-flex flex-wrap align-center ga-4">
        <PdfButton file="eval-fitrep-calendar.pdf" describes="the EVAL and FITREP calendar" label="Original PDF" />
        <!-- Knowing the due date is half the task; the other half is submitting
             the thing, and eNAVFIT is where that happens. -->
        <SystemLinks :ids="['enavfit', 'ompf']" />
      </div>
    </header>

    <v-card class="pa-4 mb-6">
      <v-select
        v-model="grade"
        :items="CHOICES"
        label="Paygrade"
        style="max-width: 220px"
      />

      <!-- OK -->
      <template v-if="result.status === 'ok'">
        <div class="d-flex flex-wrap ga-6 mt-4">
          <div>
            <span class="salt-eyebrow">Reporting month</span>
            <div class="text-h5 salt-heading">{{ result.month }}</div>
          </div>
          <div>
            <span class="salt-eyebrow">Report due</span>
            <div class="text-h5 salt-heading mono">
              {{ result.month }} {{ result.reportDue.day }}
            </div>
          </div>
          <div>
            <span class="salt-eyebrow">Counseling due</span>
            <div class="text-h5 salt-heading">{{ result.counseling.month }}</div>
          </div>
          <div>
            <span class="salt-eyebrow">Report type</span>
            <div class="text-h5 salt-heading">
              {{ result.tier === 'officer' ? 'FITREP' : 'EVAL' }}
            </div>
          </div>
        </div>

        <v-divider class="my-4" />

        <ul class="text-body-2 pl-5 mb-0">
          <li class="mb-1">{{ result.reportDue.rule }}</li>
          <li>{{ result.counseling.rule }}</li>
        </ul>
      </template>

      <!-- FLAG: explain, don't return empty. -->
      <v-alert v-else-if="result.status === 'flag'" type="info" class="mt-4" :icon="mdiAlertOutline">
        <span class="text-body-2">{{ result.message }}</span>
      </v-alert>

      <v-alert v-else type="warning" class="mt-4" :icon="mdiAlertOutline">
        <span class="text-body-2">{{ result.message || 'Not a recognized paygrade.' }}</span>
      </v-alert>
    </v-card>

    <section id="sec-rules" class="salt-section mb-6" tabindex="-1">
      <h3 class="salt-heading text-h6 mb-3">Due-Date Rules</h3>
      <dl>
        <template v-for="(r, i) in RULES" :key="i">
          <dt class="salt-eyebrow mt-3">{{ r.k }}</dt>
          <dd class="text-body-2 ml-0">{{ r.v }}</dd>
        </template>
      </dl>
    </section>

    <section id="sec-schedule" class="salt-section mb-6" tabindex="-1">
      <h3 class="salt-heading text-h6 mb-3">
        <v-icon :icon="mdiCalendarCheckOutline" size="18" class="mr-1" aria-hidden="true" />
        Full Reporting Calendar
      </h3>
      <RefTable
        :columns="SCHEDULE_COLUMNS"
        :rows="SCHEDULE"
        caption="Reporting month by paygrade"
        :is-empty="(r) => !r.officer.length && !r.enlisted.length"
      >
        <template #cell.officer="{ row }">
          <span v-if="row.officer.length" class="mono">{{ row.officer.join(", ") }}</span>
          <span v-else>— no reports due —</span>
        </template>
        <template #cell.enlisted="{ row }">
          <span v-if="row.enlisted.length" class="mono">{{ row.enlisted.join(", ") }}</span>
          <span v-else>— no reports due —</span>
        </template>
      </RefTable>

      <p v-if="EMPTY_MONTHS.length" class="text-caption mt-3 mb-0" style="opacity: 0.75">
        No periodic reports are scheduled in {{ EMPTY_MONTHS.join(" or ") }}.
      </p>
    </section>
  </div>
</template>

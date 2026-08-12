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
import {
  mdiAlertOutline,
  mdiClipboardArrowDownOutline,
  mdiPlus,
  mdiTrashCanOutline,
  mdiUndoVariant,
} from "@mdi/js";
import {
  GOOD_YEAR_MIN,
  INACTIVE_POINT_CAP,
  MEMBERSHIP_POINTS,
  RETIREMENT_YEARS,
  anniversaryWindow,
  nextYearLabel,
  summarize,
} from "../../lib/points.js";
import { parsePointRecord } from "../../lib/importPoints.js";
import { useLocalStore } from "../../composables/useLocalStore.js";
import SystemLinks from "../common/SystemLinks.vue";

const { state: store, reset } = useLocalStore("points", {
  version: 1,
  fallback: () => ({ anniversaryMonthDay: "", years: [] }),
});

const undo = ref(null);
const snack = ref(false);
/** Both "cleared" and "imported" are undoable, so the message has to say which. */
const snackText = ref("");

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
  snackText.value = "Points tracker cleared.";
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

/* ---- Import from a pasted NSIPS point record ------------------------------ *
 *
 * Paste, not login. NSIPS is behind CAC/PKI on an F5 portal that sends no CORS
 * headers, so a static site cannot read it even with a valid session — and the
 * alternative, proxying government credentials through a server, is a phishing
 * pattern this site will not implement. See lib/importPoints.js. The user is
 * already looking at the record; copying it costs seconds and keeps NSIPS the
 * source of truth without this page touching an account.
 *
 * Always previewed, never auto-applied. The parser recovers column order from
 * the pasted header and falls back to arithmetic, which is good but not certain,
 * and a silent mis-mapping would corrupt a 20-year record while looking fine.
 */
const showImport = ref(false);
const pasted = ref("");
const parsed = computed(() => (pasted.value.trim() ? parsePointRecord(pasted.value) : null));
const importMode = ref("replace");

/** Preview totals, using the same math the tracker itself uses. */
const previewRows = computed(() => (parsed.value ? summarize(parsed.value.rows).rows : []));

function applyImport() {
  if (!parsed.value?.rows.length) return;
  undo.value = JSON.parse(JSON.stringify(store.value));
  // `mismatch` is a parser annotation for the preview, not tracker data.
  const clean = parsed.value.rows.map(({ mismatch, ...row }) => row);
  store.value = {
    ...store.value,
    years: importMode.value === "append" ? [...store.value.years, ...clean] : clean,
  };
  const n = clean.length;
  pasted.value = "";
  showImport.value = false;
  snackText.value = `Imported ${n} year${n === 1 ? "" : "s"}. Check them against your ESR.`;
  snack.value = true;
}
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

    <!--
      IMPORT. Deliberately paste-based. NSIPS authenticates with CAC/PKI behind an
      F5 portal and sends no CORS headers, so no browser page on another origin can
      read a point record no matter who is logged in; and proxying a government
      login through a server of ours is a phishing pattern, not a feature. The
      honest version is to say that plainly and make the copy-paste fast, rather
      than ship a "Connect to NSIPS" button that cannot work.
    -->
    <v-card class="pa-4 mb-6">
      <div class="d-flex flex-wrap align-center justify-space-between ga-3">
        <div>
          <h3 class="salt-heading text-subtitle-1 mb-1">Import from NSIPS</h3>
          <p class="text-body-2 mb-0" style="max-width: 68ch; opacity: 0.85">
            Open your Annual Retirement Point Record in NSIPS, select the table,
            and paste it here — the years and point columns are read for you.
          </p>
        </div>
        <v-btn
          :prepend-icon="mdiClipboardArrowDownOutline"
          variant="tonal"
          size="small"
          :aria-expanded="showImport"
          @click="showImport = !showImport"
        >
          {{ showImport ? "Close" : "Paste a record" }}
        </v-btn>
      </div>

      <v-expand-transition>
        <div v-if="showImport" class="mt-4">
          <!--
            Stated up front, not in a footnote. Someone who came here hoping to
            connect an account deserves to know why they are pasting instead —
            and that this page never sees their credentials either way.
          -->
          <v-alert density="compact" class="mb-3">
            <span class="text-body-2">
              There is no automatic sign-in, and there will not be one. NSIPS uses
              CAC/PKI and blocks cross-site reads, so no page outside
              <span class="mono">.mil</span> can fetch your record — and this site
              will not ask for a government login to work around that. Nothing you
              paste leaves your browser.
            </span>
          </v-alert>

          <v-textarea
            v-model="pasted"
            label="Paste your point record"
            placeholder="FY24&#9;48&#9;14&#9;0&#9;15&#9;77"
            rows="6"
            auto-grow
            max-rows="14"
            spellcheck="false"
            class="mono"
            hint="Tabs, pipes, commas, or two or more spaces between columns"
            persistent-hint
          />

          <template v-if="parsed">
            <v-alert
              v-for="(w, i) in parsed.warnings"
              :key="i"
              type="warning"
              density="compact"
              class="mt-3"
              :icon="mdiAlertOutline"
            >
              <span class="text-body-2">{{ w }}</span>
            </v-alert>

            <template v-if="previewRows.length">
              <div class="salt-eyebrow mt-4 mb-1">
                Preview — {{ previewRows.length }} year{{ previewRows.length === 1 ? "" : "s" }}
                <span v-if="parsed.usedHeader" style="opacity: 0.7">· columns read from your header</span>
                <span v-else style="opacity: 0.7">· no header found, order assumed</span>
              </div>
              <v-table density="compact" class="mb-3">
                <thead>
                  <tr>
                    <th>Year</th><th class="text-right">IDT</th><th class="text-right">AT</th>
                    <th class="text-right">Corr.</th><th class="text-right">Mbr.</th>
                    <th class="text-right">Total</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in previewRows" :key="i">
                    <td>{{ r.label }}</td>
                    <td class="text-right mono">{{ r.idt }}</td>
                    <td class="text-right mono">{{ r.at }}</td>
                    <td class="text-right mono">{{ r.corr }}</td>
                    <td class="text-right mono">{{ r.membership }}</td>
                    <td class="text-right mono font-weight-medium">{{ r.total }}</td>
                    <td class="text-right">
                      <v-chip :color="r.isGood ? 'success' : 'warning'" size="x-small" label>
                        {{ r.isGood ? "Good" : `${r.shortBy} short` }}
                      </v-chip>
                    </td>
                  </tr>
                </tbody>
              </v-table>

              <div class="d-flex flex-wrap align-center ga-4">
                <v-radio-group v-model="importMode" inline hide-details density="compact">
                  <v-radio label="Replace tracked years" value="replace" />
                  <v-radio label="Add to them" value="append" />
                </v-radio-group>
                <v-spacer />
                <v-btn color="primary" variant="flat" size="small" @click="applyImport">
                  Apply {{ previewRows.length }} year{{ previewRows.length === 1 ? "" : "s" }}
                </v-btn>
              </div>
            </template>
          </template>
        </div>
      </v-expand-transition>
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
      {{ snackText }}
      <template #actions>
        <v-btn variant="text" :prepend-icon="mdiUndoVariant" @click="restore">Undo</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

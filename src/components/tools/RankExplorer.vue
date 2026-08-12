<script setup>
/**
 * Six-service rank explorer.
 *
 * Two modes, because there are two real questions:
 *   by service  — "what are the Marine Corps warrant ranks"
 *   by paygrade — "what is an E-8 called in each service" (the joint-duty
 *                 question, and the one a single-service chart can't answer)
 *
 * Tier gaps are stated, not left blank: the Air Force and Space Force have no
 * warrant officers, and the Coast Guard runs W-2 through W-4 only. An empty
 * table reads as missing data; a sentence reads as fact.
 *
 * Insignia come from the shared sprite sheet cut out of the source charts. The
 * by-paygrade view is the one that needed them most: "what does an E-8 look like
 * in each service" is not a question a column of titles answers.
 */
import { computed, ref } from "vue";
import { CORRECTIONS, SERVICES } from "../../data/ranks.js";
import { insigniaStyle } from "../../lib/insignia.js";
import PdfButton from "../common/PdfButton.vue";
import RefTable from "../common/RefTable.vue";

const mode = ref("service");
const serviceId = ref("usn");
const paygrade = ref("E-8");

const service = computed(() => SERVICES.find((s) => s.id === serviceId.value) ?? SERVICES[0]);

const TIERS = [
  { key: "officer", label: "Officer" },
  { key: "warrant", label: "Warrant Officer" },
  { key: "enlisted", label: "Enlisted" },
];

const COLUMNS = [
  { key: "grade", title: "Grade", mono: true, nowrap: true, width: "5.5rem" },
  { key: "insignia", title: "Insignia", nowrap: true, width: "5rem" },
  { key: "title", title: "Title" },
  { key: "abbr", title: "Abbr.", mono: true, nowrap: true },
];

const CROSS_COLUMNS = [
  { key: "service", title: "Service", nowrap: true, width: "9rem" },
  { key: "insignia", title: "Insignia", nowrap: true, width: "5rem" },
  { key: "title", title: "Title" },
  { key: "abbr", title: "Abbr.", mono: true, nowrap: true },
];

/**
 * Rows for one tier, with the sprite offset resolved.
 *
 * Computed in script rather than called from the template so the service id is
 * bound once, at the point where it is unambiguous. In the by-paygrade mode below
 * it is a DIFFERENT service on every row, which is exactly the kind of thing a
 * template expression gets wrong silently.
 */
const tierRows = (tier) =>
  (service.value[tier] ?? []).map((r) => ({
    ...r,
    insignia: insigniaStyle(service.value.id, r),
  }));

/** Every paygrade any service uses, in a sensible order. */
const ALL_GRADES = computed(() => {
  const seen = new Set();
  for (const s of SERVICES) {
    for (const tier of ["enlisted", "warrant", "officer"]) {
      for (const r of s[tier] ?? []) seen.add(r.grade);
    }
  }
  const order = { E: 0, W: 1, O: 2 };
  return [...seen].sort((a, b) => {
    const ta = order[a[0]] ?? 9;
    const tb = order[b[0]] ?? 9;
    if (ta !== tb) return ta - tb;
    return Number(a.slice(2)) - Number(b.slice(2));
  });
});

/**
 * One row per service for the selected paygrade — including the services that
 * DON'T have it. Filtering those out would answer "who has an E-8" while hiding
 * the more useful fact that the Air Force has no W-3 at all.
 */
const crossRows = computed(() =>
  SERVICES.map((s) => {
    const found = ["enlisted", "warrant", "officer"]
      .flatMap((t) => s[t] ?? [])
      .find((r) => r.grade === paygrade.value);
    return {
      service: `${s.name} (${s.short})`,
      title: found?.title ?? "— no equivalent grade —",
      abbr: found?.abbr ?? "—",
      corrected: found?.corrected,
      missing: !found,
      // Each row is a different service, so the id has to come from `s`.
      insignia: found ? insigniaStyle(s.id, found) : null,
    };
  }),
);
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">Rank Explorer</h2>
      <p class="text-body-2 mb-3" style="opacity: 0.85">
        Ranks and paygrades for all six uniformed services. The original charts
        are flattened images with no text layer, so the text is a transcription;
        the insignia are cut from the charts themselves. Download a chart for the
        full-size artwork.
      </p>
    </header>

    <v-btn-toggle v-model="mode" mandatory density="comfortable" class="mb-5">
      <v-btn value="service">By service</v-btn>
      <v-btn value="paygrade">Compare a paygrade</v-btn>
    </v-btn-toggle>

    <!-- BY SERVICE -->
    <template v-if="mode === 'service'">
      <v-card class="pa-4 mb-5">
        <div class="d-flex flex-wrap ga-4 align-center">
          <v-select
            v-model="serviceId"
            :items="SERVICES.map((s) => ({ title: `${s.name} (${s.short})`, value: s.id }))"
            label="Service"
            style="max-width: 280px"
          />
          <PdfButton
            v-if="service.sourcePdf"
            :file="service.sourcePdf"
            :describes="`the ${service.name} rank chart`"
            label="Original chart"
          />
        </div>
      </v-card>

      <section
        v-for="tier in TIERS"
        :key="tier.key"
        :id="`sec-${tier.key}`"
        class="salt-section mb-6"
        tabindex="-1"
      >
        <h3 class="salt-heading text-h6 mb-3">{{ tier.label }}</h3>

        <RefTable
          v-if="(service[tier.key] ?? []).length"
          :columns="COLUMNS"
          :rows="tierRows(tier.key)"
          :caption="`${service.name} ${tier.label} ranks`"
        >
          <template #cell.insignia="{ row }">
            <span v-if="row.insignia" class="salt-insignia" :style="row.insignia" role="presentation" />
            <span v-else aria-hidden="true" style="opacity: 0.5">—</span>
          </template>
          <template #cell.title="{ row }">
            {{ row.title }}
            <sup v-if="row.corrected" :title="row.corrected" style="cursor: help">†</sup>
          </template>
        </RefTable>

        <!-- A gap gets a sentence, not an empty table. -->
        <v-alert v-else density="compact">
          <span class="text-body-2">
            {{ service.warrantNote || `The ${service.name} has no ${tier.label.toLowerCase()} ranks.` }}
          </span>
        </v-alert>
      </section>

      <div v-if="service.seniorEnlisted" class="text-body-2 mb-2">
        <span class="salt-eyebrow">Senior enlisted advisor</span>{{ service.seniorEnlisted }}
      </div>
      <div v-if="service.wartime" class="text-body-2 mb-2">
        <span class="salt-eyebrow">Wartime / special grade</span>{{ service.wartime }}
      </div>
    </template>

    <!-- COMPARE A PAYGRADE -->
    <template v-else>
      <v-card class="pa-4 mb-5">
        <v-select
          v-model="paygrade"
          :items="ALL_GRADES"
          label="Paygrade"
          style="max-width: 200px"
        />
      </v-card>

      <RefTable
        :columns="CROSS_COLUMNS"
        :rows="crossRows"
        :caption="`Title for paygrade ${paygrade} in each service`"
        :is-empty="(r) => r.missing"
      >
        <template #cell.insignia="{ row }">
          <span v-if="row.insignia" class="salt-insignia" :style="row.insignia" role="presentation" />
          <span v-else aria-hidden="true" style="opacity: 0.5">—</span>
        </template>
        <template #cell.title="{ row }">
          {{ row.title }}
          <sup v-if="row.corrected" :title="row.corrected" style="cursor: help">†</sup>
        </template>
      </RefTable>
    </template>

    <!-- Source-typo footnotes, always visible so the corrections are auditable. -->
    <v-card v-if="CORRECTIONS.length" class="pa-4 mt-6">
      <span class="salt-eyebrow">Corrections to the source charts</span>
      <ul class="text-body-2 pl-5 mb-0 mt-1">
        <li v-for="(c, i) in CORRECTIONS" :key="i" class="mb-1">
          <span class="mono">{{ c.service }} {{ c.grade }}</span> — shown as
          <em>{{ c.shown }}</em>. {{ c.note }}
        </li>
      </ul>
    </v-card>
  </div>
</template>

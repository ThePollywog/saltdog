<script setup>
/**
 * Roll-up status strip: local/selected delta, ISO 8601 Zulu stamp,
 * sunrise/sunset, next DST transition, ordinal/ISO-week date, session uptime,
 * and moon phase. Ported from the standalone GLOBALWATCH dashboard's
 * StatusBar.vue — logic unchanged, `config` is now a prop, and the moon-phase
 * icon is an SVG path instead of an icon-font class.
 */
import { computed, ref, onMounted } from "vue";
import {
  mdiMoonFirstQuarter,
  mdiMoonFull,
  mdiMoonLastQuarter,
  mdiMoonNew,
  mdiMoonWaningCrescent,
  mdiMoonWaningGibbous,
  mdiMoonWaxingCrescent,
  mdiMoonWaxingGibbous,
} from "@mdi/js";
import { zoneTime } from "../../lib/gwTime.js";
import { moonPhase, sunTimes, nextDstTransition } from "../../lib/gwSolar.js";
import { coordsFor } from "../../lib/gwCoords.js";

const props = defineProps({
  now: { type: Date, required: true },
  config: { type: Object, required: true },
});

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const mountTime = ref(props.now.getTime());
onMounted(() => {
  mountTime.value = Date.now();
});

// Parse a "UTC+05:30" style offset label into fractional hours.
function offsetHours(tz) {
  const o = zoneTime(tz, props.now, 24, false).offset; // e.g. "UTC+05:30"
  const m = o.match(/UTC([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) + Number(m[3]) / 60);
}

function fmtDelta(h) {
  const sign = h > 0 ? "+" : h < 0 ? "−" : "±";
  const a = Math.abs(h);
  const hh = Math.floor(a);
  const mm = Math.round((a - hh) * 60);
  return `${sign}${hh}${mm ? ":" + String(mm).padStart(2, "0") : "h"}`;
}

// Δ between operator local zone and the selected center zone.
const delta = computed(() => {
  const d = offsetHours(props.config.selectedTz) - offsetHours(localTz);
  return fmtDelta(d);
});

// Full ISO 8601 Zulu timestamp, ticking every second.
const isoStamp = computed(() => props.now.toISOString().replace(/\.\d{3}Z$/, "Z"));

// Raw UTC offset (minutes) for a tz at a given date, via the shortOffset name.
function offsetMinutesAt(tz, date) {
  const s =
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const m = s.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

// Is the local zone observing DST right now? Compare its current offset to its
// standard-time offset (the smaller of the Jan/Jul offsets). If the zone never
// changes offset, it has no DST.
const dst = computed(() => {
  const y = props.now.getUTCFullYear();
  const jan = offsetMinutesAt(localTz, new Date(Date.UTC(y, 0, 1)));
  const jul = offsetMinutesAt(localTz, new Date(Date.UTC(y, 6, 1)));
  const std = Math.min(jan, jul); // standard (winter) offset
  if (jan === jul) return { observes: false, active: false };
  const cur = offsetMinutesAt(localTz, props.now);
  return { observes: true, active: cur > std };
});

// Ordinal (day-of-year) + ISO week — standard military/ops date references, in Zulu.
const dateRefs = computed(() => {
  const n = props.now;
  const start = Date.UTC(n.getUTCFullYear(), 0, 0);
  const doy = Math.floor((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - start) / 86400000);
  // ISO week
  const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { doy: String(doy).padStart(3, "0"), week: String(week).padStart(2, "0"), year: n.getUTCFullYear() };
});

// Operator session uptime since the dashboard was opened.
const uptime = computed(() => {
  const s = Math.max(0, Math.floor((props.now.getTime() - mountTime.value) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
});

const localShort = localTz.split("/").pop().replace(/_/g, " ");
const dstSub = computed(() =>
  !dst.value.observes
    ? `${localShort} · no DST`
    : dst.value.active
      ? `${localShort} · DST ACTIVE`
      : `${localShort} · standard time`,
);

// Moon phase, with a matching MDI icon for the current phase.
const MOON_ICONS = {
  "NEW MOON": mdiMoonNew,
  "WAXING CRESCENT": mdiMoonWaxingCrescent,
  "FIRST QUARTER": mdiMoonFirstQuarter,
  "WAXING GIBBOUS": mdiMoonWaxingGibbous,
  "FULL MOON": mdiMoonFull,
  "WANING GIBBOUS": mdiMoonWaningGibbous,
  "LAST QUARTER": mdiMoonLastQuarter,
  "WANING CRESCENT": mdiMoonWaningCrescent,
};
const moon = computed(() => {
  const m = moonPhase(props.now);
  return {
    name: m.name,
    icon: MOON_ICONS[m.name] || mdiMoonFull,
    pct: Math.round(m.illum * 100),
    age: m.age.toFixed(1),
    trend: m.waxing ? "waxing" : "waning",
  };
});

// Format a UTC Date as HH:MM in a target timezone.
function hhmm(date, tz) {
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: props.config.hourFormat === 12,
  }).format(date);
}

const selTz = computed(() => props.config.selectedTz || "UTC");
const selShort = computed(() => selTz.value.split("/").pop().replace(/_/g, " "));

// Sunrise / sunset for the selected zone (rendered in that zone's local time).
const sun = computed(() => {
  const c = coordsFor(selTz.value);
  if (!c) return { rise: "--:--", set: "--:--", note: "no location" };
  const t = sunTimes(props.now, c.lat, c.lon);
  if (!t.sunrise && !t.sunset) {
    // Polar day or night: decide which by current solar elevation proxy (lat sign vs season)
    return { rise: "--:--", set: "--:--", note: "polar day/night" };
  }
  return {
    rise: hhmm(t.sunrise, selTz.value),
    set: hhmm(t.sunset, selTz.value),
    note: selShort.value,
  };
});

// Next DST transition for the selected zone.
const nextDst = computed(() => {
  const tr = nextDstTransition(selTz.value, props.now);
  if (!tr) return { value: "NONE", sub: `${selShort.value} · no DST` };
  const days = Math.max(0, Math.round((tr.date.getTime() - props.now.getTime()) / 86400000));
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: selTz.value,
    day: "2-digit",
    month: "short",
  })
    .format(tr.date)
    .toUpperCase();
  return {
    value: days === 0 ? "TODAY" : `${days}d`,
    sub: `${tr.forward ? "SPRING FWD" : "FALL BACK"} · ${dateStr}`,
  };
});

/** Vuetify theme color name per cell — see accentColor() below. */
const cells = computed(() => [
  { label: "Local → selected", sub: selShort.value, value: delta.value, accent: "primary" },
  {
    label: "ISO 8601 · Zulu",
    sub: dstSub.value,
    value: isoStamp.value,
    accent: "warning",
    small: true,
    flag: dst.value.observes && dst.value.active ? "DST" : null,
  },
  {
    label: "Sunrise / sunset",
    sub: sun.value.note,
    value: `${sun.value.rise} / ${sun.value.set}`,
    accent: "accent",
    small: true,
  },
  { label: "Next DST · selected", sub: nextDst.value.sub, value: nextDst.value.value, accent: "info" },
  {
    label: "Zulu date",
    sub: `DOY · ISO wk ${dateRefs.value.year}`,
    value: `${dateRefs.value.doy} · W${dateRefs.value.week}`,
    accent: "success",
  },
  { label: "Watch session", sub: "since open", value: uptime.value, accent: "error" },
]);

/** Same reasoning as GlobalWatchClocks.vue's accentColor(): no `.text-*` utility classes in this build. */
function accentColor(name) {
  return `rgb(var(--v-theme-${name}))`;
}
</script>

<template>
  <v-card class="pa-4">
    <div class="d-flex flex-wrap ga-6">
      <div v-for="c in cells" :key="c.label">
        <div class="d-flex align-center ga-2">
          <span class="salt-eyebrow">{{ c.label }}</span>
          <v-chip v-if="c.flag" size="x-small" color="warning" label>{{ c.flag }}</v-chip>
        </div>
        <div class="mono" :class="c.small ? 'text-body-1' : 'text-h5'" :style="{ color: accentColor(c.accent) }">
          {{ c.value }}
        </div>
        <div class="text-caption mono" style="opacity: 0.7">{{ c.sub }}</div>
      </div>

      <!-- Moon phase cell -->
      <div class="d-flex align-center ga-3">
        <v-icon :icon="moon.icon" size="34" style="opacity: 0.85" />
        <div>
          <span class="salt-eyebrow">Moon phase</span>
          <div class="mono text-h5">{{ moon.pct }}%</div>
          <div class="text-caption mono" style="opacity: 0.7">{{ moon.name }} · {{ moon.age }}d</div>
        </div>
      </div>
    </div>
  </v-card>
</template>

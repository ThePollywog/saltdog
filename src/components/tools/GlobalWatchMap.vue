<script setup>
/**
 * Real-time day/night terminator world map, with a per-UTC-offset time rail
 * across the bottom and a click-to-read solar-time probe. Ported from the
 * standalone GLOBALWATCH dashboard's WorldMap.vue — logic unchanged, `config`
 * is now a prop. Named GlobalWatchMap (not WorldMap) to stay distinct from
 * components/common/WorldMap.vue, which draws the AOR combatant-command map
 * from entirely different geometry.
 */
import { computed, shallowRef, ref, watch } from "vue";
import { useTheme } from "vuetify";
import land from "../../data/gwLand.json";
import { nightPolygon, sunTimes } from "../../lib/gwSolar.js";
import { dayState, offsetLabel, supportedZones } from "../../lib/gwTime.js";
import { coordsFor } from "../../lib/gwCoords.js";

const props = defineProps({
  now: { type: Date, required: true },
  config: { type: Object, required: true },
});

/**
 * The night overlay needs to read as "darker than day" against the page's
 * OWN background, not just against a fixed sea color — and in saltDark the
 * page is already near-black, so the same fixed navy tint that reads clearly
 * against saltLight's white sea nearly disappears against it. Rather than
 * pick one fixed color, the overlay goes darker still (toward black) and a
 * bit more opaque specifically in dark mode, so the terminator stays legible
 * in both themes.
 */
const vuetifyTheme = useTheme();
const isDark = computed(() => vuetifyTheme.global.current.value.dark);
const nightFill = computed(() => (isDark.value ? "#000000" : "#0A1628"));
const nightFillOpacity = computed(() => (isDark.value ? 0.55 : 0.45));

// Equirectangular projection into a 0..360 x 0..180 viewBox.
const W = 360;
const H = 180;
const px = (lon) => lon + 180;
const py = (lat) => 90 - lat;

// --- Click-to-read: mean solar time at an arbitrary point on the map ---
const probe = ref(null); // { x, y, lon, lat }

function readPoint(evt) {
  const svg = evt.currentTarget;
  const r = svg.getBoundingClientRect();
  const x = ((evt.clientX - r.left) / r.width) * W;
  const y = ((evt.clientY - r.top) / r.height) * H;
  probe.value = { x, y, lon: x - 180, lat: 90 - y };
}

// Mean solar time at the probe longitude (UTC shifted by lon/15 hours).
const probeInfo = computed(() => {
  if (!probe.value) return null;
  const { lon, lat } = probe.value;
  const ms = props.now.getTime() + (lon / 15) * 3600000;
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const t = sunTimes(props.now, lat, lon);
  const fmt = (dd) =>
    dd
      ? String(new Date(dd.getTime() + (lon / 15) * 3600000).getUTCHours()).padStart(2, "0") +
        ":" +
        String(new Date(dd.getTime() + (lon / 15) * 3600000).getUTCMinutes()).padStart(2, "0")
      : "--:--";
  return {
    time: `${hh}:${mm}`,
    coords: `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`,
    rise: fmt(t.sunrise),
    set: fmt(t.sunset),
  };
});

// Pre-build land paths once (static geometry).
const landPaths = (() => {
  const paths = [];
  for (const f of land.features) {
    const geom = f.geometry;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        let d = "";
        for (let i = 0; i < ring.length; i++) {
          const [lon, lat] = ring[i];
          d += (i === 0 ? "M" : "L") + px(lon).toFixed(2) + " " + py(lat).toFixed(2);
        }
        paths.push(d + "Z");
      }
    }
  }
  return paths;
})();

const night = computed(() => nightPolygon(props.now));

const nightPath = computed(() => {
  const pts = night.value.points;
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const [lon, lat] = pts[i];
    d += (i === 0 ? "M" : "L") + px(lon).toFixed(2) + " " + py(lat).toFixed(2);
  }
  return d + "Z";
});

const sun = computed(() => ({ x: px(night.value.sun.lon), y: py(night.value.sun.lat) }));
// Antisolar / solar-midnight meridian: longitude 180° opposite the sun.
const midnightLon = computed(() => ((night.value.sun.lon + 360) % 360) - 180);
const antisun = computed(() => ({ x: px(midnightLon.value), y: py(-night.value.sun.lat) }));
// Solar-noon meridian: the sun's own longitude.
const noonX = computed(() => px(night.value.sun.lon));

// Resolve approximate lon/lat for each configured zone so we can pin it.
const pins = computed(() =>
  props.config.zones
    .map((z) => {
      const c = coordsFor(z.tz);
      return c
        ? { id: z.id, label: z.label, x: px(c.lon), y: py(c.lat), tz: z.tz, selected: props.config.selectedTz === z.tz }
        : null;
    })
    .filter(Boolean),
);

// The complete set of zone names, picked once.
const allZones = supportedZones();

// Parse "UTC+05:30" -> fractional hours.
function offsetToHours(label) {
  const m = label.match(/UTC([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 60);
}

function zoneHour24(tz) {
  return (
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false })
        .format(props.now)
        .replace(/\D/g, ""),
    ) % 24
  );
}

// One representative zone per distinct current UTC offset, positioned along the
// map at the longitude that offset implies (15° per hour). Recomputed when the
// minute changes so DST shifts are reflected; refreshed times tick each second.
const watchedTz = computed(() => new Set(props.config.zones.map((z) => z.tz)));

const repByOffset = shallowRef([]);
function rebuildReps() {
  const byOff = new Map();
  for (const tz of allZones) {
    const label = offsetLabel(tz, props.now);
    const watched = watchedTz.value.has(tz);
    // Prefer a watched zone, then a city zone, as the representative for an offset.
    const existing = byOff.get(label);
    const rank = (watched ? 2 : 0) + (tz.includes("/") ? 1 : 0);
    if (!existing || rank > existing.rank) {
      byOff.set(label, { tz, label, rank, watched });
    }
  }
  repByOffset.value = [...byOff.values()].sort((a, b) => offsetToHours(a.label) - offsetToHours(b.label));
}
rebuildReps();
watch(() => props.now.getUTCMinutes() + ":" + props.config.zones.length, rebuildReps);

const strip = computed(() =>
  repByOffset.value.map((r) => {
    const hrs = offsetToHours(r.label);
    const lon = Math.max(-180, Math.min(180, hrs * 15));
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: r.tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: props.config.hourFormat === 12,
    }).format(props.now);
    const watched = watchedTz.value.has(r.tz);
    const state = dayState(zoneHour24(r.tz), props.config.workdayStart, props.config.workdayEnd);
    return {
      tz: r.tz,
      label: r.tz.split("/").pop().replace(/_/g, " ").toUpperCase(),
      lon,
      pct: ((lon + 180) / 360) * 100,
      time,
      offset: r.label,
      watched,
      // Theme color names, not hex — resolved to rgb(var(--v-theme-*)) at render.
      accent: watched ? { active: "success", day: "info", night: "on-surface-variant" }[state] : null,
      selected: props.config.selectedTz === r.tz,
    };
  }),
);

/** Same reasoning as GlobalWatchClocks.vue's accentColor(): no `.text-*` / bg utility classes in this build. */
function themeColor(name, alpha) {
  return alpha == null ? `rgb(var(--v-theme-${name}))` : `rgba(var(--v-theme-${name}), ${alpha})`;
}
</script>

<template>
  <v-card class="pa-3 map-card">
    <div class="d-flex align-center justify-space-between mb-2 px-1" style="flex: none">
      <span class="salt-eyebrow">Day / night terminator · realtime</span>
      <span v-if="probeInfo" class="mono text-caption d-flex align-center" style="gap: 10px">
        <span :style="{ color: themeColor('accent') }">◎ {{ probeInfo.coords }}</span>
        <span>{{ probeInfo.time }} LMT</span>
        <span style="opacity: 0.7">↑{{ probeInfo.rise }} ↓{{ probeInfo.set }}</span>
        <span style="cursor: pointer; opacity: 0.7" @click="probe = null">✕</span>
      </span>
      <span v-else class="mono text-caption" :style="{ color: themeColor('primary') }">
        Solar {{ night.sun.lat.toFixed(1) }}° / {{ night.sun.lon.toFixed(1) }}° · click map to read
      </span>
    </div>

    <svg class="map-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" @click="readPoint">
      <!-- ocean -->
      <rect :width="W" :height="H" :fill="themeColor('on-surface', 0.03)" />

      <!-- graticule -->
      <g :stroke="themeColor('on-surface', 0.12)" stroke-width="0.3">
        <line v-for="lon in [60, 120, 180, 240, 300]" :key="'v' + lon" :x1="lon" y1="0" :x2="lon" :y2="H" />
        <line v-for="lat in [30, 60, 90, 120, 150]" :key="'h' + lat" x1="0" :y1="lat" :x2="W" :y2="lat" />
      </g>
      <line :x1="0" :y1="90" :x2="W" :y2="90" :stroke="themeColor('on-surface', 0.25)" stroke-width="0.4" stroke-dasharray="2 2" />

      <!-- land -->
      <path
        v-for="(d, i) in landPaths"
        :key="i"
        :d="d"
        :fill="themeColor('on-surface', 0.1)"
        :stroke="themeColor('on-surface', 0.55)"
        stroke-width="0.25"
      />

      <!--
        Night overlay: a fixed dark tint (saltDark's own background hex),
        not a theme token — this represents actual darkness, so it stays dark
        in light mode too, the same reasoning WorldMap.vue's AOR fills use
        fixed hues rather than theme colors for informational shading.
      -->
      <path :d="nightPath" :fill="nightFill" :fill-opacity="nightFillOpacity" :stroke="themeColor('primary')" stroke-width="0.4" stroke-opacity="0.4" />

      <!-- solar-midnight meridian (geographic midnight line) -->
      <line
        :x1="antisun.x"
        :y1="0"
        :x2="antisun.x"
        :y2="H"
        :stroke="themeColor('primary')"
        stroke-width="0.6"
        stroke-dasharray="1.5 1.5"
        stroke-opacity="0.85"
      />
      <text :x="antisun.x" y="6" :fill="themeColor('primary')" font-size="3.4" text-anchor="middle" opacity="0.9">00:00</text>
      <text :x="antisun.x" :y="H - 2.5" :fill="themeColor('primary')" font-size="3" text-anchor="middle" opacity="0.7">MIDNIGHT</text>

      <!-- solar-noon meridian (very thin sun line) -->
      <line :x1="noonX" :y1="0" :x2="noonX" :y2="H" :stroke="themeColor('accent')" stroke-width="0.25" stroke-opacity="0.8" />
      <text :x="noonX" y="6" :fill="themeColor('accent')" font-size="3" text-anchor="middle" opacity="0.8">SUN</text>

      <!-- subsolar (sun) marker -->
      <circle :cx="sun.x" :cy="sun.y" r="2.2" :fill="themeColor('accent')" :stroke="themeColor('accent', 0.5)" stroke-width="1.6" />

      <!-- antisolar (midnight) marker -->
      <circle :cx="antisun.x" :cy="antisun.y" r="1.6" :fill="themeColor('on-surface-variant')" />

      <!-- zone pins (click to select) -->
      <g v-for="p in pins" :key="p.id" style="cursor: pointer" @click.stop="config.selectedTz = p.tz">
        <circle :cx="p.x" :cy="p.y" r="6" fill="transparent" />
        <circle v-if="p.selected" :cx="p.x" :cy="p.y" r="4.6" fill="none" :stroke="themeColor('accent')" stroke-width="0.6" stroke-opacity="0.7" />
        <circle
          :cx="p.x"
          :cy="p.y"
          r="3.4"
          fill="none"
          :stroke="themeColor(p.selected ? 'accent' : 'primary')"
          stroke-width="0.5"
          :stroke-opacity="p.selected ? 0.9 : 0.6"
        />
        <circle :cx="p.x" :cy="p.y" r="1.3" :fill="themeColor(p.selected ? 'accent' : 'primary')" />
        <text
          :x="p.x + 4"
          :y="p.y + 1.5"
          :fill="themeColor('on-surface')"
          font-size="3.4"
          paint-order="stroke"
          :stroke="themeColor('surface')"
          stroke-width="0.8"
        >
          {{ p.label }}
        </text>
      </g>

      <!-- click-to-read probe crosshair -->
      <g v-if="probe" style="pointer-events: none">
        <line :x1="probe.x - 5" :y1="probe.y" :x2="probe.x + 5" :y2="probe.y" :stroke="themeColor('secondary')" stroke-width="0.5" />
        <line :x1="probe.x" :y1="probe.y - 5" :x2="probe.x" :y2="probe.y + 5" :stroke="themeColor('secondary')" stroke-width="0.5" />
        <circle :cx="probe.x" :cy="probe.y" r="2.4" fill="none" :stroke="themeColor('secondary')" stroke-width="0.5" />
      </g>
    </svg>

    <!-- Offset rail — one representative zone per UTC offset, placed at its
         longitude along the map -->
    <div class="map-strip">
      <button
        v-for="c in strip"
        :key="c.offset"
        class="strip-cell"
        :class="{ 'strip-selected': c.selected, 'strip-watched': c.watched }"
        :title="`${c.tz} · ${c.offset}`"
        :style="{ left: c.pct + '%' }"
        @click="config.selectedTz = c.tz"
      >
        <span class="strip-tick" :style="{ background: c.accent ? themeColor(c.accent) : themeColor('on-surface-variant', 0.4) }" />
        <span class="strip-body">
          <span class="strip-time mono">{{ c.time }}</span>
          <span class="strip-sub mono">{{ c.offset.replace("UTC", "") || "UTC" }}</span>
        </span>
      </button>
    </div>
  </v-card>
</template>

<style scoped>
.map-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
/* Width-driven so the map fills the full panel width (no letterboxing) and the
   strip below aligns 1:1 with the map's longitude axis. */
.map-svg {
  width: 100%;
  height: auto;
  display: block;
  border: 1px solid rgba(var(--v-border-color), 0.55);
}

/* Offset rail: one cell per UTC offset, absolutely placed at its longitude so
   it lines up with the map's longitude axis directly above. */
.map-strip {
  flex: none;
  position: relative;
  width: 100%;
  height: 40px;
  margin-top: 4px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.strip-cell {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  opacity: 0.55; /* offsets with no watched zone are dimmed */
}
.strip-watched {
  opacity: 1;
}
.strip-cell:hover {
  opacity: 1;
  z-index: 3;
}
.strip-tick {
  width: 1px;
  height: 5px;
  opacity: 0.7;
}
.strip-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 7px;
  border-radius: 4px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-on-surface), 0.04);
  transition:
    background 0.12s,
    border-color 0.12s;
}
.strip-cell:hover .strip-body {
  background: rgba(var(--v-theme-primary), 0.12);
}
.strip-selected {
  opacity: 1;
  z-index: 4;
}
.strip-selected .strip-body {
  background: rgba(var(--v-theme-primary), 0.14);
  border-color: rgb(var(--v-theme-primary));
}
.strip-sub {
  font-size: 0.5rem;
  opacity: 0.7;
  line-height: 1;
}
.strip-time {
  font-size: 0.78rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.strip-selected .strip-time {
  color: rgb(var(--v-theme-primary));
}
</style>

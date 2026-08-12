<script setup>
/**
 * The world map, drawn from committed path data. Used by the COCOM page (AOR
 * regions) and the fleets page (operating areas and HQ pins).
 *
 * INLINE SVG, NOT AN IMAGE FILE, for three reasons that all matter here:
 * it re-tints with the theme (an exported PNG would need two files and would
 * still be wrong for anyone who overrides colours), the regions can be
 * highlighted and given accessible names, and it stays sharp at any width — this
 * is reference geography someone will zoom into.
 *
 * ACCESSIBILITY: the map is `role="img"` with a summary label, not a set of
 * focusable regions. Every fact drawn here is also in the table directly below
 * it — that is deliberate, and it is why hover-only tooltips are not the whole
 * story. A screen reader gets the summary and then the table; making 6 polygons
 * and 6 pins individually tabbable would add 12 stops that lead to information
 * the user is about to read anyway.
 */
import { computed, ref } from "vue";
import { AOR_ORDER, AOR_PATHS, LAND_PATH, MAP_H, MAP_W } from "../../data/geo.js";

const props = defineProps({
  /**
   * Which AOR polygons to fill: an array of command names from AOR_ORDER, or
   * "all". Unknown names are ignored rather than thrown, so a data typo costs a
   * missing region and not a blank page.
   */
  regions: { type: [Array, String], default: "all" },
  /** [{ label, lon, lat, dx?, dy? }] point markers, e.g. fleet HQs. */
  pins: { type: Array, default: () => [] },
  /** [{ label, lon, lat, rLon, rLat }] approximate zones, e.g. fleet AORs. */
  zones: { type: Array, default: () => [] },
  /** Accessible summary. Required — an unlabelled role="img" is invisible. */
  label: { type: String, required: true },
});

/** Equirectangular, identical to the projection the paths were built with. */
const px = (lon) => ((lon + 180) / 360) * MAP_W;
const py = (lat) => ((90 - lat) / 180) * MAP_H;

const shown = computed(() =>
  (props.regions === "all" ? AOR_ORDER : props.regions).filter((n) => AOR_PATHS[n]),
);

/**
 * Hover/focus highlight. One region at a time, tracked here rather than in CSS
 * because the caption below the map names the hovered region — a fill change
 * alone tells you which shape you are on, not what it is called.
 */
const active = ref(null);

/**
 * Six fills that stay distinguishable in both themes and are all light enough to
 * leave the coastline readable through them. Fill-opacity does the work; the
 * hues only separate neighbours, and none of them is load-bearing — the label
 * inside each region is.
 */
const HUE = {
  USNORTHCOM: 210,
  USSOUTHCOM: 145,
  USEUCOM: 265,
  USAFRICOM: 35,
  USCENTCOM: 0,
  USINDOPACOM: 190,
};

/** Where to print each command's name. Chosen by hand: the centroid of an AOR
 *  that wraps the seam or the pole is not inside it. */
const NAME_AT = {
  USNORTHCOM: [-100, 45],
  USSOUTHCOM: [-65, -20],
  USEUCOM: [25, 58],
  USAFRICOM: [22, 2],
  USCENTCOM: [55, 30],
  USINDOPACOM: [150, 25],
};

const SHORT = (name) => name.replace(/^US/, "");

const graticule = computed(() => {
  const lines = [];
  for (let lon = -150; lon <= 150; lon += 30) lines.push(["v", px(lon)]);
  for (let lat = -60; lat <= 60; lat += 30) lines.push(["h", py(lat)]);
  return lines;
});
</script>

<template>
  <figure class="salt-map ma-0">
    <svg
      :viewBox="`0 0 ${MAP_W} ${MAP_H}`"
      role="img"
      :aria-label="label"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect class="salt-map-sea" x="0" y="0" :width="MAP_W" :height="MAP_H" />

      <g class="salt-map-grid" aria-hidden="true">
        <line
          v-for="([kind, at], i) in graticule"
          :key="i"
          :x1="kind === 'v' ? at : 0"
          :y1="kind === 'v' ? 0 : at"
          :x2="kind === 'v' ? at : MAP_W"
          :y2="kind === 'v' ? MAP_H : at"
        />
      </g>

      <!--
        AOR fills go UNDER the coastline, so the continents stay legible through
        them. Drawn before the land path for that reason and no other.
      -->
      <path
        v-for="name in shown"
        :key="name"
        class="salt-map-aor"
        :class="{ 'is-active': active === name }"
        :d="AOR_PATHS[name]"
        :style="{ '--aor-hue': HUE[name] ?? 210 }"
        @mouseenter="active = name"
        @mouseleave="active = null"
      />

      <path class="salt-map-land" :d="LAND_PATH" />

      <!-- Approximate zones (fleet operating areas) are dashed, because they
           are illustrative and the AOR polygons are authoritative. Saying so in
           the line style as well as the caption is cheap. -->
      <g v-if="zones.length" class="salt-map-zones">
        <template v-for="z in zones" :key="z.label">
          <ellipse
            :cx="px(z.lon)"
            :cy="py(z.lat)"
            :rx="(z.rLon / 360) * MAP_W"
            :ry="(z.rLat / 180) * MAP_H"
          />
          <text :x="px(z.lon)" :y="py(z.lat)" text-anchor="middle" dominant-baseline="middle">
            {{ z.label }}
          </text>
        </template>
      </g>

      <g v-if="shown.length" class="salt-map-names">
        <text
          v-for="name in shown"
          :key="name"
          :x="px(NAME_AT[name]?.[0] ?? 0)"
          :y="py(NAME_AT[name]?.[1] ?? 0)"
          text-anchor="middle"
          :class="{ 'is-active': active === name }"
        >
          {{ SHORT(name) }}
        </text>
      </g>

      <g v-if="pins.length" class="salt-map-pins">
        <template v-for="p in pins" :key="p.label">
          <circle :cx="px(p.lon)" :cy="py(p.lat)" r="3.4" />
          <text :x="px(p.lon) + (p.dx ?? 6)" :y="py(p.lat) + (p.dy ?? -4)">{{ p.label }}</text>
        </template>
      </g>
    </svg>

    <figcaption class="text-caption mt-2" style="opacity: 0.75">
      <!-- The hovered name replaces the standing caption rather than appearing
           next to it: two lines that swap would reflow the table below. -->
      <span v-if="active" class="salt-eyebrow">{{ active }}</span>
      <slot v-else name="caption" />
    </figcaption>
  </figure>
</template>

<style scoped>
.salt-map svg {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid rgba(var(--v-border-color), 0.55);
}
.salt-map-sea {
  fill: rgba(var(--v-theme-on-surface), 0.03);
}
.salt-map-grid line {
  stroke: rgba(var(--v-theme-on-surface), 0.12);
  stroke-width: 0.5;
}
.salt-map-land {
  fill: rgba(var(--v-theme-on-surface), 0.1);
  stroke: rgba(var(--v-theme-on-surface), 0.55);
  /* Sub-pixel at full width; anything heavier closes the Indonesian straits. */
  stroke-width: 0.6;
  stroke-linejoin: round;
}
.salt-map-aor {
  fill: hsl(var(--aor-hue) 70% 50% / 0.22);
  stroke: hsl(var(--aor-hue) 70% 45%);
  stroke-width: 1.1;
  stroke-linejoin: round;
  /* Even-odd because it is right for any winding, not because this data needs
     it. Measured: over 3.5M sample points, even-odd and nonzero agree on every
     interior point of all six AORs and the coastline — the sources follow the
     GeoJSON convention of holes wound opposite their outer ring, which is
     exactly the case nonzero also gets right. So this is insurance against a
     future source that does not, and the map would look identical today either
     way. It is stated plainly because the comment that used to be here claimed
     nonzero would leave the pole-wrapping AORs unfilled, which is false, and a
     false reason is worse than none: it makes the next person afraid of a line
     that is doing nothing. */
  fill-rule: evenodd;
  transition: fill 0.15s ease;
}
.salt-map-aor.is-active {
  fill: hsl(var(--aor-hue) 70% 50% / 0.42);
}
.salt-map-names text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  fill: rgb(var(--v-theme-on-surface));
  /* The names sit over both land and sea, so they need a halo rather than a
     colour that happens to work on one of them. */
  paint-order: stroke;
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 3px;
  pointer-events: none;
}
.salt-map-zones ellipse {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 1.2;
  stroke-dasharray: 5 4;
}
.salt-map-zones text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  fill: rgb(var(--v-theme-primary));
  paint-order: stroke;
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 3px;
}
.salt-map-pins circle {
  fill: rgb(var(--v-theme-primary));
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 1;
}
.salt-map-pins text {
  font-size: 8px;
  fill: rgb(var(--v-theme-on-surface));
  paint-order: stroke;
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 2.5px;
}
</style>

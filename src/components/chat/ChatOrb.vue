<script setup>
/**
 * The orb: WebGL when available, CSS when not.
 *
 * Capability and preference are INDEPENDENT axes, which gives four cells:
 *
 *                | motion OK          | reduced motion
 *   -------------+--------------------+------------------------
 *   WebGL        | animated RAF loop  | one static WebGL frame
 *   no WebGL     | CSS keyframes      | static CSS gradient
 *
 * The middle-right cell is the one usually got wrong — a reduced-motion user
 * with a GPU still gets the WebGL rendering, just not animated.
 *
 * The canvas is aria-hidden; state is exposed as adjacent .sr-only text, because
 * a decorative canvas conveys nothing to a screen reader and "thinking" is real
 * information.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useTheme } from "vuetify";
import { createOrb, hexToRgb } from "../../lib/orb.js";
import { useReducedMotion } from "../../composables/useReducedMotion.js";

const props = defineProps({
  /** 'idle' | 'thinking' | 'answering' */
  state: { type: String, default: "idle" },
  size: { type: Number, default: 128 },
});

const canvas = ref(null);
const wrap = ref(null);
/**
 * Starts false and only flips on a real failure.
 *
 * The tempting shape is `webgl = ref(false)` and show the canvas once it's
 * confirmed working — but that hides the canvas with `display: none` at the
 * exact moment createOrb() measures `clientWidth`, so the orb initialises 1×1
 * and paints nothing. The canvas must be laid out before it is sized.
 */
const failed = ref(false);
const reduced = useReducedMotion();
const theme = useTheme();

let orb = null;
let io = null;

const STATE_TEXT = {
  idle: "Assistant ready.",
  thinking: "Searching this site's reference cards.",
  answering: "Answer ready.",
};
const stateText = computed(() => STATE_TEXT[props.state] ?? STATE_TEXT.idle);

/** Current theme colours as GL vec3s. */
function colors() {
  const c = theme.global.current.value.colors;
  return {
    core: hexToRgb(c.primary) ?? [0.78, 0.66, 0.32],
    rim: hexToRgb(c.accent || c.primary) ?? [0.85, 0.72, 0.36],
  };
}

function onVisibility() {
  // An orb burning a GPU core in a background tab is the fastest route to a
  // battery complaint.
  orb?.setPaused(document.hidden);
}

onMounted(() => {
  const { core, rim } = colors();
  orb = createOrb(canvas.value, {
    core,
    rim,
    fallbackSize: props.size,
    reducedMotion: reduced.value,
    onContextLost: () => {
      // Permanent switch to CSS: a lost context won't come back on its own.
      failed.value = true;
      orb = null;
    },
  });
  failed.value = !orb;
  if (!orb) return;

  orb.setState(props.state);
  document.addEventListener("visibilitychange", onVisibility);

  // Pause when scrolled out of view.
  if (typeof IntersectionObserver === "function" && wrap.value) {
    io = new IntersectionObserver(
      ([e]) => orb?.setPaused(document.hidden || !e.isIntersecting),
      { threshold: 0.01 },
    );
    io.observe(wrap.value);
  }

  window.addEventListener("resize", onResize);
});

function onResize() {
  orb?.resize();
}

watch(() => props.state, (s) => {
  orb?.setState(s);
  if (s === "answering") orb?.pulse();
});

watch(reduced, (v) => orb?.setReducedMotion(v));

watch(
  () => theme.global.name.value,
  () => {
    const { core, rim } = colors();
    orb?.setColors(core, rim);
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("resize", onResize);
  io?.disconnect();
  orb?.destroy();
  orb = null;
});
</script>

<template>
  <div
    ref="wrap"
    class="salt-orb"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <!-- Rendered (and laid out) from the first paint so createOrb() can measure
         it; removed only if WebGL actually failed. -->
    <canvas v-if="!failed" ref="canvas" aria-hidden="true" class="salt-orb-canvas" />

    <!-- CSS fallback: same three states, no GPU. -->
    <div
      v-else
      aria-hidden="true"
      :class="['salt-orb-css', `is-${state}`, { 'is-static': reduced }]"
    />

    <!-- The state, for assistive tech. Not aria-live: the transcript already
         announces answers, and two live regions would double-speak. -->
    <span class="sr-only">{{ stateText }}</span>
  </div>
</template>

<style scoped>
.salt-orb {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.salt-orb-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.salt-orb-css {
  width: 76%;
  height: 76%;
  border-radius: 50%;
  background: radial-gradient(
    circle at 38% 34%,
    rgb(var(--v-theme-primary)) 0%,
    rgba(var(--v-theme-primary), 0.55) 48%,
    rgba(var(--v-theme-primary), 0.12) 74%,
    transparent 100%
  );
  box-shadow: 0 0 18px rgba(var(--v-theme-primary), 0.35);
  animation: salt-orb-breathe 4.5s ease-in-out infinite;
}
.salt-orb-css.is-thinking {
  animation-duration: 1.1s;
}
.salt-orb-css.is-answering {
  animation-duration: 2.4s;
}
/* Reduced motion: no keyframes at all, just the gradient. */
.salt-orb-css.is-static {
  animation: none;
}

@keyframes salt-orb-breathe {
  0%,
  100% {
    transform: scale(0.94);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.03);
    opacity: 1;
  }
}
</style>

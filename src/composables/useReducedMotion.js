import { onScopeDispose, readonly, ref } from "vue";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Reactive `prefers-reduced-motion`. Capability and preference are separate
 * axes: a reduced-motion user with WebGL still gets WebGL, just one static
 * frame instead of an animation loop.
 */
export function useReducedMotion() {
  const reduced = ref(false);
  if (typeof matchMedia !== "function") return readonly(reduced);

  const mq = matchMedia(QUERY);
  reduced.value = mq.matches;
  const onChange = (e) => {
    reduced.value = e.matches;
  };
  mq.addEventListener("change", onChange);
  onScopeDispose(() => mq.removeEventListener("change", onChange));
  return readonly(reduced);
}

/** Non-reactive one-shot check, for plain modules outside a component scope. */
export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia(QUERY).matches;
}

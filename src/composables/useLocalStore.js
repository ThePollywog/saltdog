import { onScopeDispose, ref, watch } from "vue";
import { load, remove, save } from "../lib/persist.js";

/**
 * A ref seeded from localStorage and persisted on change.
 *
 * Writes are debounced 300ms: a checklist has ~30 checkboxes and a user
 * click-storm shouldn't produce 30 serializations.
 */
export function useLocalStore(key, { version = 1, migrate, fallback }) {
  const state = ref(load(key, { version, migrate, fallback }));

  let timer = null;
  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    save(key, version, state.value);
  };

  watch(
    state,
    () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 300);
    },
    { deep: true },
  );

  // Don't lose the last 300ms of edits to a tab close or a route change.
  const onHide = () => {
    if (timer) flush();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
  }

  onScopeDispose(() => {
    onHide();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    }
  });

  const reset = () => {
    remove(key);
    state.value = fallback();
  };

  return { state, reset, flush };
}

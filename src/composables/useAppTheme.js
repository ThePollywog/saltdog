/**
 * Theme toggle, persisted.
 *
 * Defaults to the OS preference on a first visit, but an explicit choice always
 * wins afterward — "I picked light, why is it dark again" is the bug that makes
 * a theme toggle feel broken.
 */
import { computed } from "vue";
import { useTheme } from "vuetify";
import { load, save } from "../lib/persist.js";

const KEY = "theme";
const DARK = "saltDark";
const LIGHT = "saltLight";

/** Read the stored choice, or fall back to the OS preference. */
export function initialTheme() {
  const stored = load(KEY, { version: 1, fallback: () => null });
  if (stored === DARK || stored === LIGHT) return stored;
  const prefersLight =
    typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? LIGHT : DARK;
}

export function useAppTheme() {
  const theme = useTheme();

  const isDark = computed(() => theme.global.current.value.dark);

  function toggle() {
    const next = isDark.value ? LIGHT : DARK;
    theme.change(next);
    save(KEY, 1, next);
  }

  return { isDark, toggle, name: computed(() => theme.global.name.value) };
}

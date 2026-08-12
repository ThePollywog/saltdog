/**
 * Theme toggle, persisted.
 *
 * Defaults to the OS preference on a first visit, but an explicit choice always
 * wins afterward — "I picked light, why is it dark again" is the bug that makes
 * a theme toggle feel broken.
 */
import { computed, watchEffect } from "vue";
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

  /**
   * Keep <meta name="theme-color"> on the app bar's actual colour.
   *
   * Read out of the resolved palette rather than written as a literal, because a
   * literal is a second copy of a value that already lives in vuetify.js and
   * would silently go stale the first time the palette is retuned. `surface` is
   * the right token: <v-app-bar> is declared with no `color`, so that is what it
   * renders as, and this meta exists purely to make the browser chrome continue
   * the app bar rather than sit on top of a seam.
   *
   * index.html ships one such tag with no `media` attribute, so this updates it
   * in place instead of appending a second one — with two present the browser
   * takes the first that applies, which would make the toggle look broken.
   */
  watchEffect(() => {
    const surface = theme.global.current.value.colors?.surface;
    if (!surface || typeof document === "undefined") return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", surface);
  });

  function toggle() {
    const next = isDark.value ? LIGHT : DARK;
    theme.change(next);
    save(KEY, 1, next);
  }

  return { isDark, toggle, name: computed(() => theme.global.name.value) };
}

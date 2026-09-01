/**
 * Deep-link arrival handling for `?a=<sectionId>`.
 *
 * The router scrolls; this moves FOCUS. Without the focus move, a screen-reader
 * user who follows a chat citation lands at the top of a new page with no idea
 * that anything was cited — the scroll is a purely visual effect.
 *
 * Also drives the brief highlight flash so a sighted user sees which of eight
 * sections on the page they were sent to.
 */
import { nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

/**
 * Pixels of sticky app bar to keep clear above a cited section. Exported
 * because the router's scrollBehavior needs the same number, and two copies of
 * it is one heading tucked under the app bar away from disagreeing.
 */
export const SCROLL_OFFSET = 76;

export function useCitedSection() {
  const route = useRoute();
  const cited = ref(null);

  async function land(id) {
    cited.value = id || null;
    if (!id) return;

    await nextTick();
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;

    // preventScroll: when the router's scrollBehavior positioned the page it
    // already accounted for the app bar, and letting focus scroll again would
    // jump the heading under the sticky bar.
    el.focus({ preventScroll: true });

    // But on a COLD load it did not position anything. scrollBehavior runs
    // before the lazy view has rendered, so `#sec-<id>` does not exist yet and
    // it resolves to the top of the page — which is where someone following a
    // shared citation link lands, with the highlight flashing somewhere below
    // the fold. Only correct it when the section is actually out of view, so an
    // in-app navigation is not scrolled twice.
    const box = el.getBoundingClientRect();
    if (box.top < SCROLL_OFFSET || box.top > window.innerHeight - 40) {
      window.scrollTo({ top: window.scrollY + box.top - SCROLL_OFFSET, behavior: "auto" });
    }

    // Clear after the flash so re-visiting the same section re-triggers it.
    window.setTimeout(() => {
      if (cited.value === id) cited.value = null;
    }, 2000);
  }

  onMounted(() => land(route.query.a));
  watch(() => [route.path, route.query.a], () => land(route.query.a));

  return { cited };
}

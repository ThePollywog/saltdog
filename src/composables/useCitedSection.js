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

export function useCitedSection() {
  const route = useRoute();
  const cited = ref(null);

  async function land(id) {
    cited.value = id || null;
    if (!id) return;

    await nextTick();
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;

    // preventScroll: the router's scrollBehavior already positioned the page
    // with the app bar offset accounted for; letting focus scroll again would
    // jump the heading under the sticky bar.
    el.focus({ preventScroll: true });

    // Clear after the flash so re-visiting the same section re-triggers it.
    window.setTimeout(() => {
      if (cited.value === id) cited.value = null;
    }, 2000);
  }

  onMounted(() => land(route.query.a));
  watch(() => [route.path, route.query.a], () => land(route.query.a));

  return { cited };
}

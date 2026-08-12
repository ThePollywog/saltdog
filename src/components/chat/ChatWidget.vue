<script setup>
/**
 * The offline Q&A widget: a FAB, a panel, an orb, and a transcript.
 *
 * The header says what this is out loud — "offline keyword search, not an AI".
 * A glowing orb next to a text box sets an expectation this deliberately does
 * not meet, and the audience may be leaning on it for readiness deadlines, so
 * the honest label is both cheaper and safer than the alternative.
 *
 * Focus contract:
 *   open      -> focus the input
 *   Esc       -> close and return focus to the FAB
 *   citation  -> close, navigate, then focus the cited <section> (handled by
 *                useCitedSection on the destination view) so a screen-reader
 *                user lands on the content, not the top of a new page.
 *
 * The panel expands to fill the viewport, because the corner size is wrong for
 * the two things people actually do with an answer: read a full rank table, and
 * compare several results. Expanded is still NOT modal — no overlay, no focus
 * trap, no `inert` behind it — so Tab continues out into the page and Esc closes
 * from anywhere inside. The size preference persists: "I expanded it, why is it
 * small again" is the same complaint as the theme toggle losing its choice.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  mdiArrowCollapse,
  mdiArrowExpand,
  mdiChatQuestionOutline,
  mdiClose,
  mdiRefresh,
  mdiSend,
} from "@mdi/js";
import ChatOrb from "./ChatOrb.vue";
import AnswerCard from "./AnswerCard.vue";
import { useChat } from "../../composables/useChat.js";
import { load, save } from "../../lib/persist.js";

const PREF_KEY = "chat";
const PREF_VERSION = 1;

const router = useRouter();
const { messages, pending, state, draft, send, reset, warm, starters } = useChat();

const open = ref(false);
const fab = ref(null);
const input = ref(null);
const transcript = ref(null);

/**
 * Read as an object, not a bare boolean: this is the only chat preference today
 * and storing `true` would make the second one a migration.
 */
const expanded = ref(
  load(PREF_KEY, { version: PREF_VERSION, fallback: () => ({}) })?.expanded === true,
);

const hasHistory = computed(() => messages.value.length > 0);

watch(open, async (isOpen) => {
  if (isOpen) warm(); // load the knowledge chunk while the user is still typing
  // Both branches wait for the DOM: the input doesn't exist yet on open, and on
  // close the FAB may still be `v-show`-hidden from the expanded state. Focusing
  // a `display: none` element silently does nothing and drops focus to <body>.
  await nextTick();
  if (isOpen) input.value?.focus();
  else fab.value?.$el?.focus?.(); // return focus to the trigger, per convention
});

/** Newest message in view, both as the transcript grows and as it resizes. */
async function scrollToLatest() {
  await nextTick();
  const el = transcript.value;
  if (el) el.scrollTop = el.scrollHeight;
}

watch(() => messages.value.length, scrollToLatest);

/**
 * Resizing keeps the newest answer in view. Without this, expanding a long
 * transcript grows the scroll box around whatever was at the old scrollTop and
 * strands you in the middle of your own history.
 */
watch(expanded, (v) => {
  save(PREF_KEY, PREF_VERSION, { expanded: v });
  scrollToLatest();
});

function onSubmit(e) {
  e?.preventDefault?.();
  send();
}

function onEscape() {
  if (open.value) open.value = false;
}

/**
 * Follow a citation. Closing BEFORE navigating matters: the destination view's
 * onMounted focus move would otherwise be immediately stolen back by the
 * closing dialog's focus-return.
 */
function navigate(recordOrRoute) {
  const route = recordOrRoute.route ?? recordOrRoute;
  open.value = false;
  router.push(route);
}

function askStarter(q) {
  send(q);
}

/**
 * Open with a question already asked, from elsewhere in the app.
 *
 * A window event rather than a prop, a store, or a provide/inject: the widget
 * lives in AppShell and the only current caller is a routed view several levels
 * away, so anything else means threading state through components that have no
 * other reason to know the assistant exists. This keeps the widget the only thing
 * that knows how the widget opens.
 *
 * `onMounted`/`onUnmounted` rather than a bare addEventListener, because the
 * widget is mounted once per app but HMR remounts it during development and a
 * leaked listener would fire `send()` twice per event.
 */
function onExternalAsk(e) {
  const q = String(e?.detail?.query ?? "").trim();
  if (!q) return;
  open.value = true;
  send(q);
}

onMounted(() => window.addEventListener("saltdog:ask", onExternalAsk));
onUnmounted(() => window.removeEventListener("saltdog:ask", onExternalAsk));
</script>

<template>
  <div>
    <!-- Trigger -->
    <!-- `:icon` with a string value makes this an icon button AND sets the glyph.
         Passing a bare `icon` alongside it silently wins and renders an empty
         square. -->
    <!-- Hidden only while the panel is covering it. A full-screen panel paints
         over the FAB (same z-index, later in the DOM), which would leave a
         button in the tab order that a keyboard user can reach and cannot see —
         and a sighted user two "close" affordances, one of them invisible.
         `v-show` on `open && expanded`, not on `expanded` alone: keyed on the
         preference it would stay hidden after closing, with nothing left to
         reopen the widget. -->
    <v-btn
      ref="fab"
      v-show="!(open && expanded)"
      size="large"
      color="primary"
      class="salt-fab salt-no-print"
      :icon="open ? mdiClose : mdiChatQuestionOutline"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-label="open ? 'Close the reference assistant' : 'Open the reference assistant'"
      @click="open = !open"
    />

    <!-- Panel. Not a v-dialog, in either size: this is a non-blocking helper
         that people read alongside the page, and a modal overlay would hide the
         content they are trying to compare against. Expanded covers the page by
         the user's own choice, but there is still no overlay and no focus trap,
         so `aria-modal` stays honestly false and Tab leads back out to the
         page. -->
    <v-card
      v-if="open"
      class="salt-panel salt-no-print"
      :class="{ 'salt-panel--full': expanded }"
      role="dialog"
      aria-modal="false"
      aria-labelledby="salt-chat-title"
      @keydown.esc="onEscape"
    >
      <!-- Padding comes from `.salt-panel-row`, not Vuetify's `pa-3`: the utility
           classes ship `!important`, so the expanded layout could not widen the
           side padding to centre this row on the reading measure. -->
      <header
        class="salt-panel-row d-flex align-center ga-3"
        style="border-bottom: 1px solid rgba(var(--v-border-color), 0.6)"
      >
        <ChatOrb :state="state" :size="52" />
        <div class="flex-grow-1">
          <h2 id="salt-chat-title" class="salt-heading text-subtitle-1 mb-0">
            Reference assistant
          </h2>
          <p class="text-caption mb-0" style="opacity: 0.75">
            Offline keyword search over this site's cards. Not an AI, not live data.
          </p>
        </div>
        <v-btn
          v-if="hasHistory"
          :icon="mdiRefresh"
          variant="text"
          size="small"
          aria-label="Clear this conversation"
          @click="reset"
        />
        <!-- The label states the resulting size rather than toggling a generic
             "Expand", so a screen-reader user hears what the button will do —
             and it doubles as the current state. -->
        <v-btn
          class="salt-expand"
          :icon="expanded ? mdiArrowCollapse : mdiArrowExpand"
          variant="text"
          size="small"
          :aria-pressed="expanded ? 'true' : 'false'"
          :aria-label="
            expanded
              ? 'Shrink the assistant back to the corner'
              : 'Expand the assistant to fill the screen'
          "
          @click="expanded = !expanded"
        />
        <v-btn
          :icon="mdiClose"
          variant="text"
          size="small"
          aria-label="Close the reference assistant"
          @click="open = false"
        />
      </header>

      <!-- role="log" + polite: each answer is announced once, on arrival. -->
      <div ref="transcript" class="salt-transcript pa-3" role="log" aria-live="polite" aria-relevant="additions">
        <template v-if="!hasHistory">
          <p class="text-body-2 mb-3" style="opacity: 0.85">
            Ask about drill requirements, evaluation due dates, retirement points,
            ranks, fleets, J-codes, or where to find a system.
          </p>
          <div class="d-flex flex-wrap ga-2">
            <v-chip
              v-for="s in starters"
              :key="s"
              size="small"
              variant="outlined"
              link
              @click="askStarter(s)"
            >
              {{ s }}
            </v-chip>
          </div>
        </template>

        <div v-for="m in messages" :key="m.id" class="mb-4">
          <template v-if="m.role === 'user'">
            <div class="salt-eyebrow mb-1">You asked</div>
            <p class="text-body-2 font-weight-medium mb-0">{{ m.text }}</p>
          </template>
          <AnswerCard
            v-else
            :result="m.result"
            @navigate="navigate"
            @ask="askStarter"
          />
        </div>

        <p v-if="pending" class="text-caption mb-0" style="opacity: 0.7">Searching…</p>
      </div>

      <form
        class="salt-panel-row d-flex ga-2"
        style="border-top: 1px solid rgba(var(--v-border-color), 0.6)"
        @submit="onSubmit"
      >
        <v-text-field
          ref="input"
          v-model="draft"
          label="Ask a question"
          density="compact"
          hide-details
          autocomplete="off"
          :disabled="pending"
        />
        <v-btn
          type="submit"
          :icon="mdiSend"
          color="primary"
          :disabled="pending || !draft.trim()"
          aria-label="Send question"
        />
      </form>
    </v-card>
  </div>
</template>

<style scoped>
.salt-fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2400;
}

.salt-panel {
  position: fixed;
  right: 20px;
  bottom: 88px;
  z-index: 2400;
  width: min(430px, calc(100vw - 40px));
  max-height: min(620px, calc(100vh - 140px));
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.34);
}

.salt-transcript {
  overflow-y: auto;
  flex: 1 1 auto;
}

/* The header and input rows. Same 12px as `pa-3`, but overridable. */
.salt-panel-row {
  padding: 12px;
}

/**
 * Expanded. `inset: 0` with no width/max-height rather than 100vw/100vh: on
 * mobile Safari those units are the *large* viewport, so the toolbar overlaps
 * the input row — the one control the panel exists around. Anchoring to all four
 * edges lets the layout viewport decide, which is what `inset` already does
 * correctly everywhere.
 *
 * Deliberately not `position: fixed` -> `dialog`/`:modal`: a top-layer element
 * gets an inert backdrop for free, and inertness is precisely what this widget
 * must not have.
 */
.salt-panel--full {
  inset: 0;
  width: auto;
  max-height: none;
  border-radius: 0;
  box-shadow: none;
  /* One measure for all three rows, so the header, the answers, and the input
     share a left edge instead of each finding its own. */
  --salt-measure: 74ch;
}

/**
 * A transcript the width of a 27" monitor is unreadable, so the content keeps a
 * measure. The transcript's *children* are capped rather than the scroll box, so
 * the scrollbar stays on the panel edge where the eye expects it.
 */
.salt-panel--full .salt-transcript > * {
  max-width: var(--salt-measure);
  margin-inline: auto;
}

/**
 * The header and the input row centre via padding, not `max-width` + `margin`.
 * Constraining the boxes themselves would pull their 1px rules in with them,
 * leaving two short lines floating in the middle of a full-width panel; padding
 * keeps each rule spanning the viewport while its content stays on the measure.
 */
.salt-panel--full > .salt-panel-row {
  padding-inline: max(12px, calc((100% - var(--salt-measure)) / 2));
}

@media (max-width: 600px) {
  .salt-panel {
    right: 12px;
    left: 12px;
    width: auto;
    bottom: 80px;
  }
}
</style>

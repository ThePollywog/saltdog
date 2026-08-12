/**
 * Chat state over the offline retriever.
 *
 * EVERYTHING search-related loads on demand — the scorer and the starter list as
 * well as the corpus, all through one dynamic import in warm(). Importing `ask`
 * statically was the subtle version of this bug: AppShell mounts ChatWidget on
 * every page, so a static import pulls the whole engine into the entry graph and
 * lazily building the corpus saves nothing. The engine now genuinely stays
 * unfetched for a visitor who never opens the widget.
 *
 * The "thinking" delay is deliberate and small: retrieval is synchronous and
 * sub-millisecond, and an answer that appears in the same frame as the keypress
 * reads as a glitch rather than a response. It also gives the orb's thinking
 * state a chance to be seen. It is NOT there to imply computation.
 */
import { nextTick, ref, shallowRef } from "vue";

const THINKING_MS = 260;

let enginePromise = null;
/** Load scorer + corpus + starters as one chunk, once. */
function getEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import("../lib/retrieval.js"),
      import("../lib/corpus.js"),
      import("../data/aliases.js"),
    ]).then(([r, c, a]) => ({
      ask: r.ask,
      corpus: c.buildCorpus(),
      starters: a.STARTER_QUESTIONS,
    }));
  }
  return enginePromise;
}

export function useChat() {
  /** [{ id, role: 'user'|'bot', text?, result? }] */
  const messages = ref([]);
  const pending = ref(false);
  const state = ref("idle"); // drives the orb
  const draft = ref("");

  const engine = shallowRef(null);
  /**
   * Empty until warm() resolves, so the widget must tolerate no starters for a
   * frame. That is why the panel also carries a static intro line — an empty
   * panel with no chips and no text would read as broken.
   */
  const starters = shallowRef([]);
  let seq = 0;

  /** Preload the engine (called when the panel opens, not on app boot). */
  async function warm() {
    if (!engine.value) {
      engine.value = await getEngine();
      starters.value = engine.value.starters;
    }
    return engine.value;
  }

  async function send(text) {
    const q = String(text ?? draft.value).trim();
    if (!q || pending.value) return;

    draft.value = "";
    messages.value.push({ id: ++seq, role: "user", text: q });
    pending.value = true;
    state.value = "thinking";
    await nextTick();

    const { ask, corpus } = await warm();
    const started = Date.now();
    const result = ask(q, corpus);

    const wait = Math.max(0, THINKING_MS - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));

    messages.value.push({ id: ++seq, role: "bot", result });
    pending.value = false;
    state.value = "answering";

    // Settle back to idle once the pulse has played out.
    setTimeout(() => {
      if (!pending.value) state.value = "idle";
    }, 1200);
  }

  function reset() {
    messages.value = [];
    state.value = "idle";
    draft.value = "";
  }

  return {
    messages,
    pending,
    state,
    draft,
    send,
    reset,
    warm,
    starters,
  };
}

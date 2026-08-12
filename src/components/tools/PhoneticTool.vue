<script setup>
/**
 * Phonetic speller — type anything, get it in voice procedure.
 *
 * The output is selectable text (not just a visual), and there's a copy button,
 * because the actual use case is pasting a spelled-out name into a message or
 * reading it off a phone while on a radio or a call.
 */
import { computed, ref } from "vue";
import { mdiContentCopy, mdiCheck } from "@mdi/js";
import { ALPHABET, DIGITS, spell } from "../../data/phonetic.js";
import PdfButton from "../common/PdfButton.vue";
import RefTable from "../common/RefTable.vue";

const text = ref("");
const copied = ref(false);

const spelled = computed(() => (text.value.trim() ? spell(text.value) : ""));

const COLUMNS = [
  { key: "letter", title: "Char", mono: true, nowrap: true, width: "5rem" },
  { key: "word", title: "Code word" },
];

async function copy() {
  try {
    await navigator.clipboard.writeText(spelled.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch {
    // Clipboard can be blocked by permissions or a non-secure context; the text
    // is on screen and selectable, so this is a convenience, not the mechanism.
  }
}
</script>

<template>
  <div>
    <header class="mb-4">
      <h2 class="salt-heading text-h5 mb-1">Phonetic Speller</h2>
      <p class="text-body-2 mb-3" style="opacity: 0.85">
        Type a name, a hull number, or a callsign to get it in voice procedure.
      </p>
      <PdfButton file="phonetic-alphabet.pdf" describes="the phonetic alphabet" label="Original PDF" />
    </header>

    <v-card class="pa-4 mb-6">
      <v-text-field v-model="text" label="Text to spell" autocomplete="off" clearable />

      <div v-if="spelled" class="mt-4">
        <div class="d-flex align-center justify-space-between ga-2 mb-1">
          <span class="salt-eyebrow mb-0">Spoken as</span>
          <v-btn
            size="x-small"
            variant="text"
            :prepend-icon="copied ? mdiCheck : mdiContentCopy"
            @click="copy"
          >
            {{ copied ? "Copied" : "Copy" }}
          </v-btn>
        </div>
        <!-- aria-live so the result is announced as it's typed. -->
        <p class="mono text-body-1 mb-0" style="line-height: 1.7" aria-live="polite">
          {{ spelled }}
        </p>
      </div>
    </v-card>

    <div class="salt-two-col">
      <section id="sec-letters" class="salt-section" tabindex="-1">
        <h3 class="salt-heading text-h6 mb-3">Letters</h3>
        <RefTable :columns="COLUMNS" :rows="ALPHABET" caption="Phonetic code words for letters" />
      </section>

      <section id="sec-digits" class="salt-section" tabindex="-1">
        <h3 class="salt-heading text-h6 mb-3">Numerals</h3>
        <RefTable :columns="COLUMNS" :rows="DIGITS" caption="Phonetic code words for digits" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.salt-two-col {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  align-items: start;
}
</style>

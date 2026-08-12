/**
 * NATO / military radiotelephony phonetic alphabet.
 * Source of truth: guides/military/phonetic-alphabet/build_phonetic.py (ALPHABET).
 */

export const ALPHABET = [
  { letter: "A", word: "Alpha" },
  { letter: "B", word: "Bravo" },
  { letter: "C", word: "Charlie" },
  { letter: "D", word: "Delta" },
  { letter: "E", word: "Echo" },
  { letter: "F", word: "Foxtrot" },
  { letter: "G", word: "Golf" },
  { letter: "H", word: "Hotel" },
  { letter: "I", word: "India" },
  { letter: "J", word: "Juliet" },
  { letter: "K", word: "Kilo" },
  { letter: "L", word: "Lima" },
  { letter: "M", word: "Mike" },
  { letter: "N", word: "November" },
  { letter: "O", word: "Oscar" },
  { letter: "P", word: "Papa" },
  { letter: "Q", word: "Quebec" },
  { letter: "R", word: "Romeo" },
  { letter: "S", word: "Sierra" },
  { letter: "T", word: "Tango" },
  { letter: "U", word: "Uniform" },
  { letter: "V", word: "Victor" },
  { letter: "W", word: "Whiskey" },
  { letter: "X", word: "X-Ray" },
  { letter: "Y", word: "Yankee" },
  { letter: "Z", word: "Zulu" },
];

/** Digits are spoken as words in voice procedure; included for the speller. */
export const DIGITS = [
  { letter: "0", word: "Zero" },
  { letter: "1", word: "One" },
  { letter: "2", word: "Two" },
  { letter: "3", word: "Three" },
  { letter: "4", word: "Four" },
  { letter: "5", word: "Five" },
  { letter: "6", word: "Six" },
  { letter: "7", word: "Seven" },
  { letter: "8", word: "Eight" },
  { letter: "9", word: "Nine" },
];

const MAP = new Map(
  [...ALPHABET, ...DIGITS].map((e) => [e.letter.toUpperCase(), e.word]),
);

/**
 * Spell a string in voice procedure. Letters and digits map to their code
 * words; anything else passes through unchanged so punctuation is preserved.
 */
export function spell(text) {
  return [...String(text ?? "")]
    .map((ch) => {
      const up = ch.toUpperCase();
      if (MAP.has(up)) return MAP.get(up);
      if (ch === " ") return "(space)";
      return ch;
    })
    .filter((s) => s !== "")
    .join(" - ");
}

export default {
  id: "phonetic-alphabet",
  title: "Phonetic Alphabet",
  eyebrow: "A–Z",
  blurb: "NATO / military radiotelephony voice procedure — Alpha through Zulu.",
  sourcePdf: "phonetic-alphabet.pdf",
  keywords: [
    "phonetic",
    "alphabet",
    "nato",
    "spell",
    "voice procedure",
    "radio",
    "alpha bravo charlie",
  ],
  toolRoute: { name: "tools", params: { tool: "phonetic" } },
  toolLabel: "Spell a word",
  sections: [
    {
      id: "letters",
      heading: "Letters",
      kind: "phonetic",
      keywords: ["letters", "alpha", "bravo", "charlie", "zulu"],
      rows: ALPHABET,
    },
    {
      id: "digits",
      heading: "Numerals",
      kind: "phonetic",
      keywords: ["numbers", "digits", "numerals", "zero", "niner"],
      rows: DIGITS,
    },
  ],
};

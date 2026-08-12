/**
 * Doctrine, customs and courtesies — the material a Sailor is expected to know
 * cold: the creed, the core values, the general orders, and the shipboard
 * conventions that no instruction teaches you because everyone assumes you
 * already absorbed them.
 *
 * WHY THIS IS NOT "THE BLUEJACKET'S MANUAL". That book is the obvious home for
 * this content and it is the wrong source: it is copyrighted Naval Institute
 * Press material, not a public-domain government work like every instruction
 * cited elsewhere on this site. Transcribing it here would be infringement, and
 * a reference whose provenance is unciteable is worth nothing on a site whose
 * entire value is that you can check it. The same ground is covered by U.S. Navy
 * Regulations, the SORM and the Uniform Regulations, which are public, so those
 * are what the sections below cite.
 *
 * TWO KINDS OF CONTENT, HELD TO DIFFERENT STANDARDS:
 *
 *   Fixed texts — the Sailor's Creed and the General Orders — are QUOTATIONS.
 *   They have one correct wording, people are held to it at boards and at
 *   quarters, and a paraphrase is a defect even when it reads better. They are
 *   set as `verbatim` and `steps` rows with no editorializing inside them.
 *
 *   Everything else — saluting, colors, watches, terminology — is SUMMARIZED in
 *   plain words on purpose. These are conventions with local variations and
 *   commanding-officer discretion, and pretending otherwise by quoting an
 *   instruction out of context would misrepresent how much latitude a command
 *   actually has. The `note` below says so on the page rather than only here.
 */

/**
 * The Sailor's Creed, as adopted 1993 and revised 1994.
 *
 * One line per sentence because that is how it is written, recited and printed —
 * running it together as a paragraph is what makes it unlearnable.
 */
export const SAILORS_CREED = [
  "I am a United States Sailor.",
  "I will support and defend the Constitution of the United States of America and I will obey the orders of those appointed over me.",
  "I represent the fighting spirit of the Navy and those who have gone before me to defend freedom and democracy around the world.",
  "I proudly serve my country's Navy combat team with Honor, Courage and Commitment.",
  "I am committed to excellence and the fair treatment of all.",
];

/**
 * The three core values.
 *
 * The one-word names are the official ones; the gloss under each is a plain
 * summary, not a quotation, because the Navy's own expanded wording runs to
 * several paragraphs each and abridging it silently would be the worse choice.
 */
export const CORE_VALUES = [
  {
    k: "Honor",
    v: "Be truthful and accountable. Say what happened, including when it reflects badly on you, and keep the commitments you make to your Shipmates, your command and the public.",
  },
  {
    k: "Courage",
    v: "Meet the demands of the profession and do what is right whether or not anyone is watching — including the moral courage to raise a problem to someone senior to you.",
  },
  {
    k: "Commitment",
    v: "Hold yourself and your Shipmates to the standard, treat everyone with dignity and respect, and work for the good of the command rather than your own convenience.",
  },
];

/**
 * The eleven General Orders of the Sentry, in order.
 *
 * Quoted, numbered, and left alone. This is the single most-memorized text in
 * the enlisted Navy and the wording is what gets asked for — "the fifth general
 * order" has one answer, so paraphrasing any of these would defeat the point of
 * printing them.
 */
export const GENERAL_ORDERS = [
  "To take charge of this post and all government property in view.",
  "To walk my post in a military manner, keeping always on the alert and observing everything that takes place within sight or hearing.",
  "To report all violations of orders I am instructed to enforce.",
  "To repeat all calls from posts more distant from the guardhouse than my own.",
  "To quit my post only when properly relieved.",
  "To receive, obey and pass on to the sentry who relieves me all orders from the Commanding Officer, Command Duty Officer, Officer of the Deck, and Officers and Petty Officers of the Watch only.",
  "To talk to no one except in the line of duty.",
  "To give the alarm in case of fire or disorder.",
  "To call the Officer of the Deck in any case not covered by instructions.",
  "To salute all officers, and all colors and standards not cased.",
  "To be especially watchful at night and during the time for challenging, and to challenge all persons on or near my post, and to allow no one to pass without proper authority.",
];

/** Saluting: who, when, and the cases where you do not. */
export const SALUTING = [
  {
    k: "Who salutes whom",
    v: "The junior salutes first and holds it until it is returned. Salutes are exchanged with commissioned and warrant officers of all U.S. services, and with officers of friendly foreign services, when recognized as such.",
  },
  {
    k: "When",
    v: "Outdoors and covered, at about six paces or the nearest point of approach. Accompany the first salute of the day with a greeting — \"Good morning, sir\" or \"ma'am\".",
  },
  {
    k: "Indoors",
    v: "No salute indoors, with the standing exceptions: when under arms, and when reporting to an officer in an office or at a formal occasion.",
  },
  {
    k: "When you do not salute",
    v: "In formation unless given the command, when carrying articles in both hands, when it would interfere with the task at hand, in public conveyances and crowded public places, and in an area where saluting has been specifically suspended.",
  },
  {
    k: "Boarding and leaving a ship",
    v: "On reaching the top of the brow, face and salute the national ensign, then salute the Officer of the Deck and request permission to come aboard. Reverse it on leaving: request permission to go ashore, salute the OOD, then the ensign.",
  },
  {
    k: "Uncovered",
    v: "If you are not wearing a cover, stand at attention instead of saluting. Do not improvise a salute bareheaded.",
  },
];

/** Colors, the ensign, and half-masting. */
export const COLORS = [
  {
    k: "Morning colors",
    v: "0800 daily, at shore commands and aboard ships not underway. Evening colors is at sunset.",
  },
  {
    k: "What you do",
    v: "At the first note, stop, face the ensign — or face the music if you cannot see the ensign — and stand at attention. Salute if covered and in uniform; hold it from the first note to the last. Then carry on.",
  },
  {
    k: "In a vehicle",
    v: "Stop the vehicle. Occupants sit at attention and do not salute.",
  },
  {
    k: "Half-mast",
    v: "The ensign is hoisted smartly to the peak first, then lowered ceremoniously to half-mast. When it comes down at the end of the day it is hoisted to the peak again before being lowered.",
  },
  {
    k: "Underway",
    v: "Ships underway do not hold colors ceremonies. The ensign flies from the gaff while underway and from the flagstaff in port.",
  },
];

/**
 * The standard watch rotation.
 *
 * Local watch bills vary and many commands stand something else entirely — the
 * three-section rotation a reservist meets on a drill weekend often looks
 * nothing like this. It is here because the NAMES are what get used in
 * conversation and in orders.
 */
export const WATCHES = [
  { watch: "First watch", time: "2000 – 2400" },
  { watch: "Mid watch", time: "0000 – 0400" },
  { watch: "Morning watch", time: "0400 – 0800" },
  { watch: "Forenoon watch", time: "0800 – 1200" },
  { watch: "Afternoon watch", time: "1200 – 1600" },
  { watch: "First dog watch", time: "1600 – 1800" },
  { watch: "Second dog watch", time: "1800 – 2000" },
];

export const BELLS = [
  {
    k: "How they are struck",
    v: "One bell for each half hour elapsed in the watch, struck in pairs — two bells is one hour, four bells is two hours — with the odd bell struck alone at the end.",
  },
  {
    k: "Eight bells",
    v: "Four hours elapsed: the end of the watch. The count then starts over at one bell.",
  },
  {
    k: "Why the dog watches exist",
    v: "Splitting 1600 to 2000 into two short watches makes the number of watches in a day odd, so the rotation shifts and no section is stuck with the mid watch every night.",
  },
];

/**
 * Shipboard terminology.
 *
 * Chosen for the words that cause an actual misunderstanding rather than for
 * colour: someone told to secure a door in a bulkhead needs to know it is not
 * the hatch in the deck. The slang at the end is included because it is used
 * constantly and never explained.
 */
export const TERMINOLOGY = [
  { k: "Deck / bulkhead / overhead", v: "Floor, wall, ceiling." },
  { k: "Hatch / door", v: "A hatch closes an opening in a deck; a door closes one in a bulkhead. A watertight door is dogged, not locked." },
  { k: "Ladder", v: "Stairs. You go up and down a ladder, never a staircase." },
  { k: "Port / starboard", v: "Left and right when facing forward. Fixed to the ship, so they do not change when you turn around." },
  { k: "Forward / aft", v: "Toward the bow and toward the stern. Athwartships is across, side to side." },
  { k: "Topside / below", v: "Above the main deck, in the open air; and anywhere on the decks beneath it." },
  { k: "Head", v: "The bathroom." },
  { k: "Galley / mess deck", v: "Where food is cooked, and where it is eaten. The wardroom is the officers' mess." },
  { k: "Berthing", v: "Sleeping compartment. A rack is a bunk." },
  { k: "Quarterdeck", v: "The ceremonial and official entry point of the ship, where the OOD stands and where you report aboard." },
  { k: "Brow", v: "The ramp between the ship and the pier. A gangway is the opening it lands at — and \"gangway\" shouted at you means clear the passage." },
  { k: "Fantail / forecastle", v: "The open deck at the stern, and the forward part of the main deck. Forecastle is pronounced \"fo'c's'le\"." },
  { k: "Scuttlebutt", v: "A drinking fountain, and by extension the rumors traded around it." },
  { k: "Chit", v: "A written request or authorization — a special-request chit, a leave chit." },
  { k: "Turn to", v: "Begin work. \"Knock it off\" is stop; \"square away\" is put it right; \"secure\" is both to stow something and to finish for the day." },
  { k: "Geedunk", v: "The ship's store, or the snacks bought there." },
  { k: "Zulu time", v: "Coordinated Universal Time, used so a schedule means the same thing in every time zone. Local time is reported against it." },
];

export const NOTE =
  "The Sailor's Creed and the General Orders are quoted exactly; everything else " +
  "on this page is summarized in plain words. Customs, watch bills and ceremony " +
  "carry real local variation and a commanding officer's discretion, so treat " +
  "this as orientation and follow your command's own instruction and Plan of the " +
  "Day. U.S. Navy Regulations, the SORM and the Uniform Regulations are the " +
  "authorities, and none of this material comes from any copyrighted manual.";

export default {
  id: "doctrine",
  title: "Doctrine, Customs & Courtesies",
  eyebrow: "Creed",
  blurb:
    "The Sailor's Creed, the core values, the eleven General Orders, and the saluting, colors, watch and shipboard conventions everyone assumes you already know.",
  /**
   * TOPIC-IDENTIFYING WORDS ONLY, and that restraint is load-bearing.
   *
   * corpus.js folds the topic's keywords into EVERY section's keyword field, so
   * anything listed here scores identically on all eight sections and cannot
   * discriminate between them. The first draft listed "salute", "colors",
   * "watch", "creed" and the rest up here as well as on their own sections, and
   * the result was that "when do I not salute" tied all eight sections at 0.875
   * and answered with the Sailor's Creed — the section keyword added nothing the
   * topic keyword had not already given every one of its siblings.
   *
   * So a word that names one section belongs on that section and nowhere else.
   * What stays here is what names the whole page, plus "bluejacket": people will
   * search for the book by name, this page is the answer to that search, and it
   * is deliberately the only place that word appears (see the file header).
   */
  keywords: ["doctrine", "customs", "courtesies", "bluejacket", "navy regulations"],
  note: NOTE,
  sections: [
    {
      id: "creed",
      heading: "The Sailor's Creed",
      kind: "verbatim",
      keywords: ["sailors creed", "creed", "i am a united states sailor", "recite", "memorize"],
      /**
       * NO `refs`, AND THAT IS THE ACCURATE ANSWER.
       *
       * The first version cited U.S. Navy Regulations here, which was wrong: the
       * creed is not in it. It came out of a CNO-chartered committee in 1993 and
       * was revised in 1994, and it is carried in training material rather than
       * promulgated as a numbered instruction — so none of the eighteen documents
       * in the registry is its source. Caught by looking at the rendered page,
       * where the chip read "Authority: U.S. Navy Regulations" twice in a row
       * under two texts that neither of them contains.
       *
       * A citation chip that names the wrong document is worse than no chip: the
       * whole reason this site prints authorities is so a reader can go check, and
       * sending them to a document that does not contain the text spends that
       * credibility to look thorough. The note says what is actually known.
       */
      note:
        "Adopted in 1993 and revised in 1994. The creed is promulgated by the CNO " +
        "and carried in training material rather than in a numbered instruction, so " +
        "none of the directives indexed on this site is its source.",
      rows: SAILORS_CREED,
    },
    {
      id: "core-values",
      heading: "Core values",
      kind: "kv",
      keywords: ["core values", "honor", "courage", "commitment", "ethos", "values"],
      // Same reason as the creed above: the three values are CNO/SECNAV-level
      // policy carried in training and leadership material, not an article of
      // Navy Regulations. Left uncited rather than mis-cited.
      rows: CORE_VALUES,
    },
    {
      id: "general-orders",
      heading: "The eleven General Orders of the Sentry",
      kind: "steps",
      keywords: [
        "general orders",
        "eleven",
        "11",
        "sentry",
        "watch",
        "post",
        "relieved",
        "officer of the deck",
        "challenge",
      ],
      // The SORM alone. Navy Regulations was cited here too and dropped: the
      // general orders are watch-standing material, which is the SORM's subject,
      // and a second citation that merely looks authoritative dilutes the one
      // that is actually right.
      refs: ["opnavinst-3120-32"],
      rows: GENERAL_ORDERS,
    },
    {
      id: "saluting",
      heading: "Saluting and courtesies",
      kind: "kv",
      /**
       * "report aboard" is here as well as "reporting aboard" because the
       * tokenizer only strips a trailing plural — it does not stem "reporting"
       * to "report" — so the phrase everyone actually types ("how do I report
       * aboard a ship") missed this section by one covered word and came back
       * `unknown` at 0.272 against a 0.28 threshold. Fixed in the data rather
       * than with a phrase alias: the words belong to this section, and a wide
       * alias expansion is the thing that sinks scores in a coverage-weighted
       * scorer (see the note in data/aliases.js).
       */
      keywords: [
        "salute",
        "saluting",
        "courtesies",
        "six paces",
        "brow",
        "cover",
        "reporting aboard",
        "report aboard",
        "permission to come aboard",
      ],
      refs: ["navy-regs", "navpers-15665"],
      rows: SALUTING,
    },
    {
      id: "colors",
      heading: "Colors and the ensign",
      kind: "kv",
      keywords: ["colors", "morning colors", "evening colors", "ensign", "flag", "half mast", "sunset", "0800"],
      refs: ["navy-regs"],
      rows: COLORS,
    },
    {
      id: "watches",
      heading: "The watch rotation",
      kind: "table",
      keywords: ["watch", "watches", "mid watch", "dog watch", "forenoon", "rotation", "watch bill"],
      refs: ["opnavinst-3120-32"],
      columns: [
        { key: "watch", title: "Watch" },
        { key: "time", title: "Time", mono: true, nowrap: true },
      ],
      rows: WATCHES,
    },
    {
      id: "bells",
      heading: "Ship's bells",
      kind: "kv",
      keywords: ["bells", "eight bells", "strike", "half hour", "dog watch"],
      refs: ["opnavinst-3120-32"],
      rows: BELLS,
    },
    {
      id: "terminology",
      heading: "Shipboard terminology",
      kind: "kv",
      /**
       * Every headword this section defines, because the headword IS the query —
       * nobody searches for "shipboard terminology", they search for "ladder" or
       * "what is a geedunk". Listed rather than left to the body text so a
       * one-word question clears the answer threshold: "what is a ladder on a
       * ship" scored 0.250 against a 0.28 threshold on body weight alone and came
       * back `unknown`.
       */
      keywords: [
        "terminology",
        "terms",
        "slang",
        "shipboard",
        "deck",
        "bulkhead",
        "overhead",
        "hatch",
        "ladder",
        "port",
        "starboard",
        "forward",
        "aft",
        "athwartships",
        "topside",
        "head",
        "galley",
        "mess deck",
        "wardroom",
        "berthing",
        "rack",
        "quarterdeck",
        "brow",
        "gangway",
        "fantail",
        "forecastle",
        "scuttlebutt",
        "chit",
        "turn to",
        "geedunk",
        "zulu",
      ],
      rows: TERMINOLOGY,
    },
  ],
};

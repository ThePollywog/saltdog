/**
 * Where the uniform rules are specified — a map into NAVPERS 15665, not a copy
 * of it.
 *
 * WHAT THIS DELIBERATELY DOES NOT CONTAIN: measurements. "1/4 inch above the
 * left breast pocket" is the kind of fact this site is otherwise built to carry,
 * and it is exactly the kind that must not be guessed or taken from a superseded
 * revision. The current U.S. Navy Uniform Regulations is NAVPERS 15665J, and it
 * is published behind www.mynavyhr.navy.mil, which WAF-blocks every non-browser
 * client — so nothing here could transcribe it and no build check could ever
 * verify a transcription against it. A page that prints a number a Sailor mounts
 * a real rack from, sourced from a revision nobody checked, is worse than a page
 * that says where the number lives.
 *
 * So this is a locator. It answers "which chapter do I open", which is the part
 * that is genuinely hard about a 400-page publication, and then hands over.
 *
 * CHAPTERS AND SECTIONS, NOT ARTICLE NUMBERS. The article numbering (5312 for
 * ribbons, 5201.4 for nametags) is transcribed accurately from the publication's
 * own table of contents, and it is still not published here. Article numbers
 * within a manual are the fastest-drifting thing in it — data/directives.js
 * makes the same call for the same reason — while the chapter and section
 * structure is stable and is how the document is actually navigated. The
 * subjects under each row are the section's own sub-headings, so searching any
 * one of them lands in the right place regardless of how it is numbered.
 */

/**
 * @param {string} subject  what you are looking for
 * @param {string} where    chapter and section, as the publication names them
 * @param {string} covers   that section's own sub-headings, comma-separated
 */
const p = (subject, where, covers) => ({ subject, where, covers });

/**
 * The insignia and awards half of the publication — chapters four and five.
 *
 * Scoped there on purpose: this is the material you assemble onto a uniform, and
 * it is where every measurement in the document lives. Grooming standards
 * (chapter two), uniform components (three), occasions for wear (six) and
 * civilian clothing (seven) are real chapters and are not mapped here, because a
 * locator that lists everything stops being a locator.
 */
export const PLACEMENT = [
  p(
    "Officer rank insignia",
    "Chapter 4, Section 1",
    "Sleeve insignia, sleeve devices for line and staff corps, shoulder insignia, collar grade insignia",
  ),
  p(
    "Enlisted rate and rating insignia",
    "Chapter 4, Section 2",
    "CPO rating badges and collar insignia, E-1 to E-6 rating badges, group rate marks, striker marks, unit identification marks, specialty marks, service stripes",
  ),
  p(
    "Headgear insignia",
    "Chapter 4, Section 3",
    "Cap devices, visor ornamentation, chin straps — separately for commissioned and warrant officers, CPOs, and E-1 to E-6",
  ),
  p(
    "Identification badges",
    "Chapter 5, Section 1",
    "Provisions for wear, the authorized badges, and eligibility for each",
  ),
  p(
    "Breast insignia and nametags",
    "Chapter 5, Section 2",
    "Command insignia, warfare and other qualification insignia, descriptions of each, nametags",
  ),
  p(
    "Ribbons, medals and their attachments",
    "Chapter 5, Section 3",
    "Precedence of awards, ribbons, ribbons with medals, large medals, miniature medals, attachments worn on ribbons and medals, letter devices, clasps, marksmanship badges, wearing awards on civilian clothes",
  ),
  p(
    "Aiguillettes, brassards and buttons",
    "Chapter 5, Section 4",
    "Aiguillettes and the occasions and authority for wearing them, brassards, buttons, boatswain's pipe and lanyard",
  ),
];

export default {
  id: "uniform",
  title: "Uniform Insignia & Placement",
  eyebrow: "Uniform",
  // Rendered by the same tool as the awards topic. See TOOL_TOPICS in index.js.
  home: { name: "tools", params: { tool: "ribbons" } },
  homeLabel: "Uniform Information",
  blurb:
    "Which chapter of the Uniform Regulations specifies each piece of insignia, and where to read the current one.",
  /**
   * "navpers", "15665" and "uniform regulations" are deliberately NOT here.
   * Keywords carry a 2.5x field weight, and this topic cites NAVPERS 15665 from
   * both its sections — putting the series number here made the locator table
   * outrank the document's own entry in the directives index for its own name,
   * which is the citation burying the thing it cites. The `refs` below fold the
   * directive's text into the body at body weight instead, which is where a
   * citation belongs. verify-corpus asserts this and caught it.
   */
  keywords: [
    "uniform",
    "insignia",
    "placement",
    "measurement",
    "measurements",
    "inches",
    "how far",
    "where does it go",
    "rank insignia",
    "collar",
    "sleeve",
    "shoulder",
    "rating badge",
    "crow",
    "service stripes",
    "hash marks",
    "cap device",
    "headgear",
    "breast insignia",
    "warfare device",
    "nametag",
    "name tag",
    "identification badge",
    "aiguillette",
    "brassard",
    "wear",
    "worn",
    "spec",
    "specification",
    "specifications",
  ],
  note:
    "This is a map into the Uniform Regulations, not a copy of them. Exact measurements and the article-level rules are in NAVPERS 15665 itself — read the current revision before you place anything.",
  systems: ["mynavy-hr"],
  sections: [
    {
      id: "placement",
      refs: ["navpers-15665"],
      heading: "Where each rule is specified",
      kind: "table",
      keywords: [
        "chapter",
        "section",
        "where",
        "which chapter",
        "look up",
        "find",
        "specified",
        ...PLACEMENT.flatMap((x) => [x.subject.toLowerCase(), x.where.toLowerCase()]),
      ],
      columns: [
        { key: "subject", title: "What you're placing" },
        { key: "where", title: "Where it's specified", nowrap: true },
        { key: "covers", title: "That section covers" },
      ],
      rows: PLACEMENT,
    },
    {
      id: "measurements",
      refs: ["navpers-15665", "secnav-m-1650-1"],
      heading: "Why the measurements aren't printed here",
      kind: "steps",
      keywords: [
        "measurement",
        "measurements",
        "inch",
        "inches",
        "quarter inch",
        "distance",
        "spacing",
        "exact",
        "why",
        "missing",
        "not here",
      ],
      rows: [
        "The current publication is NAVPERS 15665J. It is served from MyNavy HR, which blocks every non-browser client — so a transcription here could not be checked against the source by any build step, and a wrong eighth of an inch reads exactly like a right one.",
        "Measurements also change by uniform and by sex — the same insignia sits differently on a jumper, a service coat and a dinner dress jacket — so a single number lifted out of context is wrong more often than it is right.",
        "What this site does carry is the part its own sources support: the order ribbons are worn in, how many to a row, which row is short, and the devices that go on them. Those come from the Navy ribbons-and-devices chart and are on the Ribbon rack and Wear & devices tabs.",
        "For anything dimensional, open NAVPERS 15665 on MyNavy HR under References, and check your rack against your command's own uniform guidance.",
      ],
    },
  ],
};

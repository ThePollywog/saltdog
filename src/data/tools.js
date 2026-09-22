/**
 * The interactive tools, in tab order.
 *
 * One list, three consumers: the tab bar in ToolsView, the nav drawer, and the
 * About page's count. Those were three separate hardcoded lists, so adding a
 * tool meant remembering all three — and the About page was already claiming
 * "5 interactive tools" while six existed.
 *
 * Icons live here rather than in the components because both consumers need
 * them; the lazy component imports stay in ToolsView, since a dynamic import
 * has to be statically analyzable for the bundler to split it.
 */
import {
  mdiAccountGroupOutline,
  mdiAlphabeticalVariant,
  mdiCalculatorVariantOutline,
  mdiCalendarCheckOutline,
  mdiCalendarClockOutline,
  mdiCheckboxMarkedOutline,
  mdiMedalOutline,
  mdiRadar,
  mdiRunFast,
} from "@mdi/js";

export const TOOLS = [
  {
    // "Reservist" is carried in both labels on purpose. This is the one tool
    // whose content does not apply to the whole Navy — the cadence is drill
    // weekends and AT, and an active-duty Sailor reading it as their own annual
    // checklist would be reading the wrong list. Every other tool here is
    // service-wide, so the audience is named on this one rather than on the site.
    id: "checklist",
    /** Short label for the tab bar. */
    title: "Reservist Checklist",
    /** Fuller label for the nav drawer, where there's room to be specific. */
    navTitle: "Reservist Readiness Checklist",
    icon: mdiCheckboxMarkedOutline,
  },
  {
    // Directly after the checklist, because it is the same data one step further
    // on and it reads the checklist's completion dates to work at all.
    id: "due",
    title: "Due Dates",
    navTitle: "Due Dates & Calendar",
    icon: mdiCalendarClockOutline,
  },
  {
    id: "eval",
    title: "EVAL / FITREP",
    navTitle: "EVAL / FITREP Due Date",
    icon: mdiCalendarCheckOutline,
  },
  {
    id: "points",
    title: "Points",
    navTitle: "Points & Good Years",
    icon: mdiCalculatorVariantOutline,
  },
  {
    id: "prt",
    title: "PRT",
    navTitle: "PRT Calculator",
    icon: mdiRunFast,
  },
  {
    id: "phonetic",
    title: "Phonetic",
    navTitle: "Phonetic Speller",
    icon: mdiAlphabeticalVariant,
  },
  {
    // The id stays "ribbons" through the rename. It is in the route, in the
    // saved-rack storage key and in two topics' `home` — display text is not
    // identity, which is the same rule the award and checklist ids follow.
    id: "ribbons",
    title: "Uniform",
    navTitle: "Uniform Information",
    icon: mdiMedalOutline,
  },
  {
    id: "ranks",
    title: "Ranks",
    navTitle: "Rank Explorer",
    icon: mdiAccountGroupOutline,
  },
  {
    // The id stays "globalwatch" — it names the ported dashboard this tool
    // came from, not the displayed title. Same "display text is not identity"
    // rule the ribbons id follows above.
    id: "globalwatch",
    title: "World Map",
    navTitle: "World Map",
    icon: mdiRadar,
    // A day/night map is worth more than the site's usual 1180px reading
    // column — AppShell.vue reads this flag to drop the centered container
    // for just this one tool, while leaving the app bar and nav drawer alone.
    fullBleed: true,
  },
];

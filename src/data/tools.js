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
} from "@mdi/js";

export const TOOLS = [
  {
    id: "checklist",
    /** Short label for the tab bar. */
    title: "Checklist",
    /** Fuller label for the nav drawer, where there's room to be specific. */
    navTitle: "Readiness Checklist",
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
    id: "phonetic",
    title: "Phonetic",
    navTitle: "Phonetic Speller",
    icon: mdiAlphabeticalVariant,
  },
  {
    id: "ribbons",
    title: "Ribbon Rack",
    navTitle: "Ribbon Rack Calculator",
    icon: mdiMedalOutline,
  },
  {
    id: "ranks",
    title: "Ranks",
    navTitle: "Rank Explorer",
    icon: mdiAccountGroupOutline,
  },
];

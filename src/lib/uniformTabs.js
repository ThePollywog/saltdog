/**
 * Which tab of the Uniform Information tool owns which section.
 *
 * Pure and separate from the component for one reason: this is the thing that
 * decides whether an arriving citation is rendered at all. A chat answer citing
 * `awards#devices` deep-links to `?a=devices`, and if that does not select the
 * tab holding the device legend then the section never mounts — the reader lands
 * on a page that does not contain what was cited, with no error anywhere. That
 * is logic, not markup, so it lives where it can be tested without a browser.
 *
 * `sections` is also the completeness guarantee. Every section of every topic
 * the tool hosts must appear in exactly one tab; a section owned by no tab is
 * citable but unrenderable, and one owned by two makes the resolution below
 * depend on declaration order. Both are asserted in the test suite.
 */
export const TABS = [
  { id: "rack", label: "Ribbon rack", sections: ["precedence"] },
  { id: "wear", label: "Wear & devices", sections: ["wear", "devices"] },
  { id: "insignia", label: "Insignia & placement", sections: ["placement", "measurements"] },
];

export const DEFAULT_TAB = TABS[0].id;

/**
 * The tab to show for a route query.
 *
 * An arriving citation beats an explicit `?tab=`. Someone following
 * `?a=devices` asked for the device legend; honouring a stale tab from the same
 * URL would show them a different tab while the cited-section highlight fired
 * on an element that was never rendered.
 *
 * @param {{a?: string, tab?: string}} query
 */
export function tabFor(query = {}) {
  const owner = TABS.find((t) => t.sections.includes(query.a));
  if (owner) return owner.id;
  return TABS.some((t) => t.id === query.tab) ? query.tab : DEFAULT_TAB;
}

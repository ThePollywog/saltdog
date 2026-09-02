/**
 * Which service a rank citation selects.
 *
 * The rank explorer shows ONE service at a time behind a selector, so a
 * citation to `ranks#usmc` cannot be honoured by scrolling — the Marine Corps
 * chart is not on the page until the selector says so. This resolves the
 * `?a=` value to a service id the component can select before it renders,
 * which is what makes the anchor `#sec-usmc` exist to be focused at all.
 *
 * It lives in lib/ rather than inside the component for the reason
 * lib/uniformTabs.js does: a mutation to logic that only a browser smoke check
 * can reach survives `node --test` forever and reports SURVIVED, which makes
 * the check a decoration. Pure functions here are killable.
 */

/**
 * @param {object} query  the route query, e.g. `{ a: "usmc" }`
 * @param {string[]} ids  every service id the explorer can show
 * @returns {string|null} the service to select, or null if `a` names none
 */
export function citedService(query = {}, ids = []) {
  const a = query?.a;
  return ids.includes(a) ? a : null;
}

/**
 * The service to display: the cited one when the citation names a service,
 * otherwise whatever the user already had selected.
 *
 * Written as "citation wins" rather than "only when nothing is selected",
 * because a selector always has something selected — the fallback reading
 * would make every citation a no-op.
 */
export function serviceToShow(query, ids, current) {
  return citedService(query, ids) ?? current;
}

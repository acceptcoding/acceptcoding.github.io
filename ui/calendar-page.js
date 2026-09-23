/**
 * Calendar page adapter.
 *
 * This module only joins the calendar route, policy, navigation, and rendering
 * ports. It deliberately does not own calendar dates, URL construction, or DOM
 * rendering. The composition root remains responsible for supplying those
 * policies and for preserving the existing calendar markup and interactions.
 */

function requireCallback(value, name) {
  if (typeof value !== 'function') throw new TypeError(`calendar page requires ${name}`);
  return value;
}

function routeContext(route) {
  return route?.context || route?.retained || Object.freeze({ level: null, levelSource: null, view: null });
}

/**
 * Hydrate the route data needed by the calendar page.
 *
 * `navigation.readState` owns date/level/view canonicalization. The calendar
 * policy owns the retained query context. No route values are reconstructed
 * here, so inferred level provenance and the selected view survive unchanged.
 */
export function hydrateCalendarRoute({
  url,
  today,
  navigation,
  calendarPolicy,
  policy,
} = {}) {
  const routeNavigation = navigation || {};
  const routePolicy = calendarPolicy || policy || {};
  const readState = requireCallback(routeNavigation.readState, 'navigation.readState');
  const retainedQueryContext = requireCallback(routePolicy.retainedQueryContext, 'calendarPolicy.retainedQueryContext');
  const parsed = readState(url, today);
  const context = retainedQueryContext(url);

  return Object.freeze({
    ...parsed,
    context,
    retained: context,
    retainedLevel: context.level,
    retainedView: context.view,
    retainedSource: context.levelSource,
  });
}

/**
 * Delegate calendar DOM work to the existing renderer.
 *
 * The renderer receives the hydrated route as one object. This keeps month
 * picker state, date links, ARIA, and responsive behavior in the established
 * renderer instead of creating a second calendar implementation in the UI
 * layer. `render` is accepted as an alias for callers with a generic port.
 */
export function renderCalendarPage({
  route,
  renderCalendar,
  render,
  ...options
} = {}) {
  const renderer = renderCalendar || render;
  requireCallback(renderer, 'renderCalendar');
  const hydratedRoute = route || hydrateCalendarRoute(options);
  return renderer({ ...options, route: hydratedRoute, context: routeContext(hydratedRoute) });
}

/**
 * Build the narrow page port used by a composition root.
 */
export function createCalendarPage({
  navigation,
  calendarPolicy,
  policy,
  renderCalendar,
  render,
} = {}) {
  const routePolicy = calendarPolicy || policy;
  const renderer = renderCalendar || render;

  return Object.freeze({
    hydrate: (options = {}) => hydrateCalendarRoute({
      ...options,
      navigation: options.navigation || navigation,
      calendarPolicy: options.calendarPolicy || routePolicy,
    }),
    render: (options = {}) => renderCalendarPage({
      ...options,
      renderCalendar: options.renderCalendar || renderer,
    }),
  });
}

/**
 * The daily-page composition seam.
 *
 * This module only coordinates the daily page's existing state, view-model,
 * and rendering callbacks. Route policy, ladder loading, persistence, account
 * state, and submission verification stay in their owning modules.
 */

const DAILY_RENDER_STEPS = Object.freeze([
  'renderWeek',
  'renderLevels',
  'renderLadder',
  'renderCompletion',
  'renderLevelExplanation',
  'renderShareContext',
  'updateDocumentTitle',
  'renderProfile',
  'renderSyncButton',
]);

function requireCallback(callback, name) {
  if (typeof callback !== 'function') throw new TypeError(`${name} must be a function`);
  return callback;
}

function invoke(callback, context) {
  if (typeof callback === 'function') callback(context);
}

/**
 * Resolve route state through the application's existing navigation callback.
 *
 * The adapter does not parse, canonicalize, or persist URLs. `readRouteState`
 * owns those policies and receives the complete route context unchanged.
 */
export function hydrateDailyRoute({
  url,
  today,
  state = null,
  readRouteState,
  applyRouteState,
  onDateChange,
} = {}) {
  requireCallback(readRouteState, 'readRouteState');
  const routeState = readRouteState({ url, today, state });
  if (!routeState || typeof routeState !== 'object') {
    throw new TypeError('readRouteState must return route state');
  }

  const previousDate = state?.date ?? null;
  const dateChanged = previousDate !== routeState.date;
  const firstRender = !previousDate;
  const context = Object.freeze({
    url,
    today,
    state,
    routeState,
    firstRender,
    dateChanged,
  });

  invoke(applyRouteState, context);
  if (dateChanged) invoke(onDateChange, context);
  return context;
}

/**
 * Run the existing daily-page render callbacks in the established order.
 *
 * Each callback receives the same immutable context. In particular,
 * `renderLadder` receives the caller's current view-model, so loading,
 * unavailable, and error states remain renderer-owned rather than being
 * recreated here.
 */
export function renderDailyPage({
  state,
  viewModel,
  route = null,
  callbacks = {},
  notice = null,
  ...directCallbacks
} = {}) {
  const context = Object.freeze({ state, viewModel, route, notice });
  const renderCallbacks = { ...directCallbacks, ...callbacks };
  for (const name of DAILY_RENDER_STEPS) invoke(renderCallbacks[name], context);
  invoke(renderCallbacks.clearNotice, context);
  return context;
}

/**
 * Compose hydration, first paint, and the existing ladder-load callback.
 * Loading starts only after the initial render, preserving the daily page's
 * loading first paint without moving any loading policy into this adapter.
 */
export function createDailyPageAdapter({
  readRouteState,
  applyRouteState,
  onDateChange,
  render = renderDailyPage,
  loadLadder,
} = {}) {
  requireCallback(readRouteState, 'readRouteState');
  requireCallback(render, 'render');

  return Object.freeze({
    hydrate: (context = {}) => hydrateDailyRoute({
      ...context,
      readRouteState,
      applyRouteState,
      onDateChange,
    }),
    render: (context = {}) => render(context),
    async load(context = {}) {
      if (typeof loadLadder !== 'function') return undefined;
      return loadLadder(context);
    },
    async run(context = {}) {
      const hydrated = hydrateDailyRoute({
        ...context,
        readRouteState,
        applyRouteState,
        onDateChange,
      });
      render({ ...context, route: hydrated.routeState, hydration: hydrated });
      if (typeof loadLadder === 'function') await loadLadder({ ...context, hydration: hydrated });
      return hydrated;
    },
  });
}

export { DAILY_RENDER_STEPS };

import * as core from '../core.js';
import { canonicalizeUrl, parseUrlState } from '../domain/url-state.js';
import { localizedRoute, parseRoute, routeLanguage, routePath } from '../js/routes.js';

const DEVELOPMENT_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isDevelopmentHost(hostname) {
  return DEVELOPMENT_HOSTS.has(String(hostname || '').toLowerCase());
}

export function getDevelopmentToday(url, hostname, fallbackToday = core.todayAtLocal()) {
  const candidate = new URL(url, 'https://accept.invalid').searchParams.get('dev-now');
  return isDevelopmentHost(hostname) && core.isValidDateString(candidate) ? candidate : fallbackToday;
}

export function getToday(url, hostname, fallbackToday = core.todayAtLocal()) {
  return getDevelopmentToday(url, hostname, fallbackToday);
}

export function canonicalDateUrl(url, date) {
  const target = new URL(url, 'https://accept.invalid');
  const requestedDates = target.searchParams.getAll('date');
  if (!requestedDates.length || (requestedDates.length === 1 && requestedDates[0] === date)) return target;
  target.searchParams.delete('date');
  target.searchParams.set('date', date);
  return target;
}

export function canonicalStateUrl(url, today) {
  const current = new URL(url, 'https://accept.invalid');
  const canonical = canonicalizeUrl(current, today);
  if (!isDevelopmentHost(current.hostname)) canonical.searchParams.delete('dev-now');
  return canonical;
}

export function readNavigationState(url, today) {
  const canonical = canonicalStateUrl(url, today);
  const state = parseUrlState(canonical, today);
  const route = parseRoute(canonical.pathname);
  if (!route.date) return state;
  const boundary = core.validateTrainingDate(route.date, today);
  return boundary.valid ? { ...state, date: boundary.date } : state;
}

export function clearTransientChallengeState(url) {
  const target = new URL(url, 'https://accept.invalid');
  target.searchParams.delete('level');
  target.searchParams.delete('level-source');
  target.searchParams.delete('view');
  return target;
}

export function challengePath({ pathname = '/', date, today, language }) {
  const routeLanguageFallback = language || routeLanguage(pathname, 'en');
  const kind = date === today ? 'daily' : 'dated';
  const path = routePath(routeLanguageFallback, kind, kind === 'dated' ? date : null);
  return path;
}

export function calendarUrl({ url, date, level = null, source = null, view = core.VIEW_PROVENANCE.WINDOW, language, from = 'home' }) {
  const current = new URL(url, 'https://accept.invalid');
  const target = new URL(routePath(language || routeLanguage(current.pathname, 'en'), 'challenges'), current);
  target.searchParams.set('date', date);
  const canonicalLevel = level ? core.canonicalLevel(level) : null;
  if (canonicalLevel) target.searchParams.set('level', canonicalLevel);
  else target.searchParams.delete('level');
  if (canonicalLevel && source === core.LEVEL_PROVENANCE.INFERRED) target.searchParams.set('level-source', 'inferred');
  else target.searchParams.delete('level-source');
  if (core.canonicalView(view) === core.ALL_PROBLEMS_VIEW) target.searchParams.set('view', core.ALL_PROBLEMS_VIEW);
  else target.searchParams.delete('view');
  return target;
}

export function calendarDateUrl({ url, date, context = {}, language }) {
  const current = new URL(url, 'https://accept.invalid');
  const target = new URL(routePath(language || routeLanguage(current.pathname, 'en'), 'dated', date), current);
  const canonicalLevel = core.canonicalLevel(context.level);
  const canonicalView = core.canonicalView(context.view);
  if (canonicalLevel) target.searchParams.set('level', canonicalLevel);
  else target.searchParams.delete('level');
  if (canonicalLevel && context.levelSource === 'inferred') target.searchParams.set('level-source', 'inferred');
  else target.searchParams.delete('level-source');
  if (canonicalView === core.ALL_PROBLEMS_VIEW) target.searchParams.set('view', core.ALL_PROBLEMS_VIEW);
  else target.searchParams.delete('view');
  if (isDevelopmentHost(current.hostname)) {
    const devNow = current.searchParams.get('dev-now');
    if (core.isValidDateString(devNow)) target.searchParams.set('dev-now', devNow);
  } else target.searchParams.delete('dev-now');
  return target;
}

export function challengeUrl({
  url,
  date,
  today,
  level = null,
  source = null,
  view = core.VIEW_PROVENANCE.WINDOW,
  language,
}) {
  const current = new URL(url, 'https://accept.invalid');
  const boundary = core.validateTrainingDate(date, today);
  if (!boundary.valid) return null;
  const canonicalLevel = level ? core.canonicalLevel(level) : null;
  const canonicalView = core.canonicalView(view);
  const target = new URL(challengePath({ pathname: current.pathname, date: boundary.date, today, language }), current);
  if (canonicalLevel) target.searchParams.set('level', canonicalLevel);
  else target.searchParams.delete('level');
  if (canonicalView === core.ALL_PROBLEMS_VIEW) target.searchParams.set('view', core.ALL_PROBLEMS_VIEW);
  else target.searchParams.delete('view');
  if (canonicalLevel && source === core.LEVEL_PROVENANCE.INFERRED) target.searchParams.set('level-source', 'inferred');
  else target.searchParams.delete('level-source');

  if (!isDevelopmentHost(current.hostname)) target.searchParams.delete('dev-now');
  else {
    const devNow = current.searchParams.get('dev-now');
    if (core.isValidDateString(devNow)) target.searchParams.set('dev-now', devNow);
    else target.searchParams.delete('dev-now');
  }
  return target;
}

export function navigate({
  url,
  date,
  today,
  level = null,
  source = null,
  view = core.VIEW_PROVENANCE.WINDOW,
  replace = false,
  language,
}) {
  const target = challengeUrl({ url, date, today, level, source, view, language });
  if (!target) return { accepted: false, history: null, url: null };
  return {
    accepted: true,
    history: replace ? 'replace' : 'push',
    url: `${target.pathname}${target.search}${target.hash}`,
  };
}

export function createNavigationCoordinator({ url, today = core.todayAtLocal(), state = {} } = {}) {
  let currentUrl = new URL(url || 'https://accept.invalid/', 'https://accept.invalid');
  let currentState = {
    ...readNavigationState(currentUrl, today),
    ...state,
  };

  function getState() {
    return { ...currentState };
  }

  function canonicalize() {
    const canonical = canonicalStateUrl(currentUrl, today);
    const changed = canonical.href !== currentUrl.href;
    currentUrl = canonical;
    currentState = { ...currentState, ...readNavigationState(currentUrl, today) };
    return { changed, url: `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`, state: getState() };
  }

  function command(date = currentState.date, level = currentState.level, replace = false, view = currentState.view) {
    const result = navigate({
      url: currentUrl,
      date,
      today,
      level,
      source: currentState.levelProvenance === core.LEVEL_PROVENANCE.INFERRED ? core.LEVEL_PROVENANCE.INFERRED : null,
      view,
      replace,
    });
    if (result.accepted) {
      currentUrl = new URL(result.url, currentUrl);
      currentState = { ...currentState, ...readNavigationState(currentUrl, today) };
    }
    return result;
  }

  return Object.freeze({ getState, canonicalize, navigate: command, url: () => new URL(currentUrl) });
}

export { canonicalizeUrl, localizedRoute, parseRoute };

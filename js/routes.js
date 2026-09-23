export const PUBLIC_LANGUAGES = Object.freeze(['pt', 'en', 'es']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanPath(pathname = '/') {
  const value = String(pathname || '/').split('?')[0].split('#')[0];
  if (value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

export function isRouteDate(value) {
  const text = String(value || '');
  if (!DATE_RE.test(text)) return false;
  const [, year, month, day] = text.match(/^(\d{4})-(\d{2})-(\d{2})$/).map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  return new Date(timestamp).toISOString().slice(0, 10) === text;
}

export function parseRoute(pathname = '/') {
  const path = cleanPath(pathname);
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return { kind: 'home', language: null, path };

  if (segments.length === 1 && segments[0] === 'index.html') {
    return { kind: 'daily', language: null, legacy: true, path };
  }
  if (segments.length === 1 && segments[0] === 'previous.html') {
    return { kind: 'challenges', language: null, legacy: true, path };
  }
  if (!PUBLIC_LANGUAGES.includes(segments[0])) return { kind: 'not-found', language: null, path };
  const language = segments[0];
  if (segments.length === 1) return { kind: 'home', language, path };
  if (segments.length === 2 && segments[1] === 'daily') return { kind: 'daily', language, path };
  if (segments.length === 2 && (segments[1] === 'challenges' || segments[1] === 'previous')) {
    return segments[1] === 'previous'
      ? { kind: 'challenges', language, legacy: true, path }
      : { kind: 'challenges', language, path };
  }
  if (segments.length === 3 && (segments[1] === 'challenges' || segments[1] === 'previous') && isRouteDate(segments[2])) {
    return segments[1] === 'previous'
      ? { kind: 'dated', language, date: segments[2], legacy: true, path }
      : { kind: 'dated', language, date: segments[2], path };
  }
  return { kind: 'not-found', language, path };
}

export function routePath(language, kind, date = null) {
  const lang = PUBLIC_LANGUAGES.includes(language) ? language : 'en';
  if (kind === 'home') return `/${lang}/`;
  if (kind === 'daily') return `/${lang}/daily/`;
  if (kind === 'challenges') return `/${lang}/challenges/`;
  if (kind === 'dated' && isRouteDate(date)) return `/${lang}/challenges/${date}/`;
  throw new RangeError(`Unsupported ACCEPT route: ${kind}`);
}

export function routeLanguage(pathname, fallback = 'en') {
  const route = parseRoute(pathname);
  return route.language || (PUBLIC_LANGUAGES.includes(fallback) ? fallback : 'en');
}

export function localizedRoute(pathname, language) {
  const route = parseRoute(pathname);
  if (!PUBLIC_LANGUAGES.includes(language) || route.kind === 'not-found') return null;
  if (['home', 'daily', 'challenges'].includes(route.kind)) return routePath(language, route.kind);
  if (route.kind === 'dated') return routePath(language, 'dated', route.date);
  return null;
}

export function isCleanPublicRoute(pathname) {
  const route = parseRoute(pathname);
  return !route.legacy && route.kind !== 'not-found';
}

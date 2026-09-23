/** Supported UI languages and browser-language inference rules. */
export const LANGUAGES = ['pt', 'en', 'es'];

export function preferredLanguage(primary) {
  const base = String(primary ?? '').trim().toLowerCase().split('-')[0];
  return base === 'pt' ? 'pt' : base === 'es' ? 'es' : 'en';
}

export function validLanguage(value) {
  return LANGUAGES.includes(value) ? value : null;
}
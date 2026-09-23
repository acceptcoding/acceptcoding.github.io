import { LANGUAGES, preferredLanguage, validLanguage } from './language-policy.js';

export const LANGUAGE_STORAGE_KEY = 'accept-language';
export const THEME_STORAGE_KEY = 'accept-theme';
export const THEMES = Object.freeze(['light', 'dark', 'system']);
export const SYSTEM_THEMES = Object.freeze(['light', 'dark']);

function validTheme(value) {
  return THEMES.includes(value) ? value : null;
}

/** Select an explicit language, then the browser's primary language, then English. */
export function chooseLanguage(explicit, primary) {
  return validLanguage(explicit) || preferredLanguage(primary);
}

/** Select a locale route first, then a saved language, then browser fallback. */
export function resolveLanguage({ routeLanguage = null, storedLanguage = null, primaryLanguage = '' } = {}) {
  return chooseLanguage(validLanguage(routeLanguage) || validLanguage(storedLanguage), primaryLanguage);
}

/** Select a stored theme, defaulting to the currently supported light policy. */
export function chooseTheme(stored) {
  return validTheme(stored) || 'light';
}

/** Resolve the rendered palette for a stored preference. */
export function effectiveTheme(stored, system = 'light') {
  const preference = chooseTheme(stored);
  return preference === 'system' && SYSTEM_THEMES.includes(system) ? system : preference === 'system' ? 'light' : preference;
}

/**
 * Read preference inputs without touching browser globals. The caller supplies
 * storage and the primary browser language, which keeps this policy pure and
 * makes route/application state irrelevant to preference resolution.
 */
export function resolvePreferences({
  explicitLanguage = null,
  primaryLanguage = '',
  storedTheme = null,
  systemTheme = 'light',
} = {}) {
  const language = chooseLanguage(explicitLanguage, primaryLanguage);
  const theme = chooseTheme(storedTheme);
  return Object.freeze({ language, theme, effectiveTheme: effectiveTheme(theme, systemTheme) });
}

/** Return the storage decision for a user-selected preference. */
export function persistenceDecision(kind, value) {
  if (kind === 'language' && validLanguage(value)) {
    return Object.freeze({ persist: true, key: LANGUAGE_STORAGE_KEY, value });
  }
  if (kind === 'theme' && validTheme(value)) {
    return Object.freeze({ persist: true, key: THEME_STORAGE_KEY, value });
  }
  return Object.freeze({ persist: false, key: null, value: null });
}

/** Browser-language inference is a display fallback and is never persisted. */
export function inferredLanguageDecision(primary) {
  return Object.freeze({
    persist: false,
    key: null,
    value: preferredLanguage(primary),
  });
}

/**
 * Update only preference data. The route and application fields are copied
 * unchanged so an adapter can localize or retheme without resetting a journey.
 */
export function withPreferences(applicationState, preferences) {
  return {
    ...applicationState,
    preferences: {
      ...(applicationState.preferences || {}),
      ...preferences,
    },
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseLanguage,
  effectiveTheme,
  inferredLanguageDecision,
  persistenceDecision,
  resolvePreferences,
  withPreferences,
} from '../application/preferences.js';

test('language policy prefers explicit language, then the primary browser language', () => {
  assert.equal(chooseLanguage('pt', 'es-MX'), 'pt');
  assert.equal(chooseLanguage('invalid', 'es-MX'), 'es');
  assert.equal(chooseLanguage(null, 'pt-BR'), 'pt');
});

test('language policy falls back to English for unsupported or absent browser language', () => {
  assert.equal(chooseLanguage(null, 'fr-FR'), 'en');
  assert.equal(chooseLanguage(null, ''), 'en');
  assert.equal(chooseLanguage(null, undefined), 'en');
});

test('theme policy supports light, dark, and system choices', () => {
  assert.equal(resolvePreferences({ storedTheme: 'light' }).theme, 'light');
  assert.equal(resolvePreferences({ storedTheme: 'dark' }).theme, 'dark');
  assert.equal(resolvePreferences({ storedTheme: 'system', systemTheme: 'dark' }).theme, 'system');
  assert.equal(effectiveTheme('system', 'dark'), 'dark');
  assert.equal(effectiveTheme('system', 'light'), 'light');
  assert.equal(effectiveTheme('system', 'sepia'), 'light');
  assert.equal(resolvePreferences({ storedTheme: 'unknown' }).theme, 'light');
});

test('persistence distinguishes explicit selections from browser fallback', () => {
  assert.deepEqual(persistenceDecision('language', 'es'), {
    persist: true, key: 'accept-language', value: 'es',
  });
  assert.deepEqual(persistenceDecision('theme', 'system'), {
    persist: true, key: 'accept-theme', value: 'system',
  });
  assert.deepEqual(inferredLanguageDecision('pt-BR'), {
    persist: false, key: null, value: 'pt',
  });
  assert.equal(persistenceDecision('language', 'fr').persist, false);
});

test('preference updates preserve route and application state', () => {
  const state = {
    route: { kind: 'dated', date: '2026-09-17' },
    date: '2026-09-17',
    ladder: { id: 'fixture' },
    verification: new Map([['355:A', 'accepted']]),
    preferences: { language: 'en', theme: 'light' },
  };
  const next = withPreferences(state, { language: 'pt', theme: 'dark' });
  assert.equal(next.route, state.route);
  assert.equal(next.date, state.date);
  assert.equal(next.ladder, state.ladder);
  assert.equal(next.verification, state.verification);
  assert.deepEqual(next.preferences, { language: 'pt', theme: 'dark' });
  assert.notEqual(next, state);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { isCleanPublicRoute, isRouteDate, localizedRoute, parseRoute, routePath } from '../js/routes.js';
import { challengeUrl } from '../application/navigation.js';

test('clean locale routes have explicit page ownership', () => {
  assert.deepEqual(parseRoute('/pt/'), { kind: 'home', language: 'pt', path: '/pt/' });
  assert.deepEqual(parseRoute('/en/daily/'), { kind: 'daily', language: 'en', path: '/en/daily/' });
  assert.deepEqual(parseRoute('/es/previous/'), { kind: 'challenges', language: 'es', legacy: true, path: '/es/previous/' });
  assert.deepEqual(parseRoute('/en/challenges/'), { kind: 'challenges', language: 'en', path: '/en/challenges/' });
  assert.deepEqual(parseRoute('/pt/challenges/2026-09-15/'), { kind: 'dated', language: 'pt', date: '2026-09-15', path: '/pt/challenges/2026-09-15/' });
});

test('dated routes require real canonical calendar dates', () => {
  assert.equal(isRouteDate('2026-09-15'), true);
  assert.equal(isRouteDate('2026-02-30'), false);
  assert.equal(parseRoute('/pt/challenges/2026-02-30/').kind, 'not-found');
});

test('home-origin dated navigation preserves the return context', () => {
  const target = challengeUrl({
    url: 'http://127.0.0.1:4000/pt/',
    date: '2026-09-22',
    today: '2026-09-23',
    source: 'home',
  });
  assert.equal(target.pathname, '/pt/challenges/2026-09-22/');
  assert.equal(target.search, '');
});
test('route generation and language switching preserve context', () => {
  assert.equal(routePath('es', 'dated', '2026-09-15'), '/es/challenges/2026-09-15/');
  assert.equal(localizedRoute('/en/challenges/2026-09-15/', 'pt'), '/pt/challenges/2026-09-15/');
  assert.equal(localizedRoute('/en/daily/', 'pt'), '/pt/daily/');
  assert.equal(localizedRoute('/en/challenges/', 'pt'), '/pt/challenges/');
  assert.equal(isCleanPublicRoute('/en/challenges/'), true);
  assert.equal(isCleanPublicRoute('/en/previous/'), false);
  assert.equal(isCleanPublicRoute('/previous.html'), false);
});

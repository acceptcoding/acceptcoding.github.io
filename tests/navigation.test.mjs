import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalDateUrl,
  canonicalStateUrl,
  calendarDateUrl,
  calendarUrl,
  challengePath,
  challengeUrl,
  clearTransientChallengeState,
  createNavigationCoordinator,
  getDevelopmentToday,
  isDevelopmentHost,
  navigate,
  readNavigationState,
} from '../application/navigation.js';

const TODAY = '2026-09-18';

 test('reads valid dates and rejects invalid dates through the shared boundary', () => {
  assert.deepEqual(
    readNavigationState('https://accept.invalid/en/daily/?date=2026-09-17&level=expert', TODAY),
    { date: '2026-09-17', level: 'expert', view: 'window' },
  );
  assert.equal(readNavigationState('https://accept.invalid/en/daily/?date=2026-02-30', TODAY).date, TODAY);
  assert.equal(readNavigationState('https://accept.invalid/en/daily/?date=2026-09-19', TODAY).date, TODAY);
});

test('canonicalizes legacy level aliases and the all view', () => {
  assert.equal(
    canonicalStateUrl('https://accept.invalid/pt/daily/?date=2026-09-17&level=specialist', TODAY).search,
    '?date=2026-09-17&level=special',
  );
  assert.equal(
    canonicalStateUrl('https://accept.invalid/pt/daily/?level=all', TODAY).search,
    '?view=all',
  );
});

test('canonicalizes duplicate date query parameters without changing other URL parts', () => {
  assert.equal(canonicalDateUrl('https://accept.invalid/en/daily/?date=2026-09-17&date=2026-09-16#x', TODAY).href, 'https://accept.invalid/en/daily/?date=2026-09-18#x');
});

test('refresh reset removes transient level and view state but preserves date context', () => {
  const cleared = clearTransientChallengeState('https://accept.invalid/pt/challenges/2026-09-17/?date=2026-09-17&level=pupil&level-source=inferred&view=all&dev-now=2026-09-17#top');
  assert.equal(cleared.pathname, '/pt/challenges/2026-09-17/');
  assert.equal(cleared.search, '?date=2026-09-17&dev-now=2026-09-17');
  assert.equal(cleared.hash, '#top');
});
test('centralizes calendar link and calendar-cell URL policy', () => {
  assert.equal(calendarUrl({ url: 'https://accept.invalid/en/daily/?dev-now=2026-09-18', date: '2026-09-17', level: 'specialist', source: 'inferred', view: 'window' }).pathname + calendarUrl({ url: 'https://accept.invalid/en/daily/', date: '2026-09-17', level: 'specialist', source: 'inferred' }).search, '/en/challenges/?date=2026-09-17&level=special&level-source=inferred');
  assert.equal(calendarDateUrl({ url: 'https://localhost/en/challenges/?level=specialist&level-source=inferred&dev-now=2026-09-18', date: '2026-09-16', context: { level: 'specialist', levelSource: 'inferred' }, language: 'en' }).href, 'https://localhost/en/challenges/2026-09-16/?level=special&level-source=inferred&dev-now=2026-09-18');
});

test('constructs daily and dated challenge paths with the route language', () => {
  assert.equal(challengePath({ pathname: '/es/challenges/', date: TODAY, today: TODAY }), '/es/daily/');
  assert.equal(challengePath({ pathname: '/es/challenges/', date: '2026-09-17', today: TODAY }), '/es/challenges/2026-09-17/');
});

test('changing level on a dated challenge keeps the clean route', () => {
  const target = challengeUrl({
    url: 'https://accept.invalid/pt/challenges/2026-09-17/',
    date: '2026-09-17',
    today: TODAY,
    level: 'pupil',
  });
  assert.equal(target.pathname, '/pt/challenges/2026-09-17/');
  assert.equal(target.search, '?level=pupil');
});
test('returns explicit push and replace history policies without touching browser globals', () => {
  const pushed = navigate({ url: 'https://accept.invalid/en/daily/', date: TODAY, today: TODAY, level: 'pupil' });
  assert.deepEqual(pushed, { accepted: true, history: 'push', url: '/en/daily/?level=pupil' });
  const replaced = navigate({ url: 'https://accept.invalid/en/daily/', date: TODAY, today: TODAY, replace: true, view: 'all' });
  assert.deepEqual(replaced, { accepted: true, history: 'replace', url: '/en/daily/?view=all' });
  assert.equal(navigate({ url: 'https://accept.invalid/en/daily/', date: '2026-02-30', today: TODAY }).accepted, false);
});

test('development-now is host-gated and propagated only on development hosts', () => {
  assert.equal(isDevelopmentHost('localhost'), true);
  assert.equal(isDevelopmentHost('example.com'), false);
  assert.equal(getDevelopmentToday('https://localhost/en/daily/?dev-now=2026-09-12', 'localhost', TODAY), '2026-09-12');
  assert.equal(getDevelopmentToday('https://example.com/en/daily/?dev-now=2026-09-12', 'example.com', TODAY), TODAY);
  assert.equal(challengeUrl({ url: 'https://localhost/en/daily/?dev-now=2026-09-12', date: TODAY, today: TODAY }).searchParams.get('dev-now'), '2026-09-12');
  assert.equal(challengeUrl({ url: 'https://example.com/en/daily/?dev-now=2026-09-12', date: TODAY, today: TODAY }).searchParams.has('dev-now'), false);
});

test('coordinator applies canonical replacement and navigation state transitions', () => {
  const coordinator = createNavigationCoordinator({
    url: 'https://localhost/es/daily/?level=specialist&dev-now=2026-09-18',
    today: TODAY,
  });
  assert.equal(coordinator.canonicalize().url, '/es/daily/?level=special&dev-now=2026-09-18');
  const result = coordinator.navigate('2026-09-17', 'special', true);
  assert.equal(result.history, 'replace');
  assert.equal(result.url, '/es/challenges/2026-09-17/?level=special&dev-now=2026-09-18');
  assert.equal(coordinator.getState().date, '2026-09-17');
});

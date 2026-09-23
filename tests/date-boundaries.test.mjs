import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from '../core.js';
import { createLadderRepository, LADDER_CACHE_BOUNDARY, LADDER_CACHE_NAMESPACE, LADDER_CACHE_VERSION } from '../js/ladder-repository.js';
import { CANONICAL_HISTORY_MANIFEST } from '../data/canonical-history-manifest.js';
import { RUNTIME_CORPUS } from '../data/runtime-corpus.js';

const [app, storage, codeforces, previous, readme] = await Promise.all([
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/storage.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/codeforces.js', import.meta.url), 'utf8'),
  readFile(new URL('../previous.html', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
]);

const today = '2026-09-09';

 test('canonical epoch and cache identity are migrated together', () => {
  assert.equal(core.LAUNCH_DATE, '2026-09-21');
  assert.equal(core.SITE_SALT, 'accept-daily-selection-v5-language-aware-whole-rating');
  assert.equal(LADDER_CACHE_NAMESPACE, 'daily-ladder-v16');
  assert.equal(LADDER_CACHE_VERSION, 'v16');
  assert.equal(LADDER_CACHE_BOUNDARY, 'utc-midnight');
  assert.match(app, /ladder-v17-feature-wave/);
});

test('selection indices are zero-based from September 1', () => {
  assert.deepEqual(
    ['2026-09-01', '2026-09-02', '2026-09-07', '2026-09-08'].map((date) => core.dayIndexForDate(date, today)),
    [0, 1, 6, 7],
  );
  assert.throws(() => core.dayIndexForDate('2026-08-31', today), RangeError);
});

test('URL attack matrix canonicalizes to the safe endpoint', () => {
  const cases = new Map([
    ['2026-08-31', '2026-09-01'], ['2026-09-10', today], ['2099-01-01', today],
    ['1900-01-01', '2026-09-01'], ['banana', today], ['', today], ['2026-02-30', today], ['2026-13-99', today],
  ]);
  for (const [requested, expected] of cases) {
    assert.equal(core.parseUrlState(`https://accept.invalid/?date=${requested}&level=specialist`, today).date, expected);
  }
  assert.equal(core.parseUrlState('https://accept.invalid/?date=2026-09-10&level=master', today).level, 'master');
});

test('history canonicalization runs before home rendering', () => {
  assert.match(app, /const parsed = compositionRoot\.navigation\.readState\(location\.href, state\.today\);/);
  assert.doesNotMatch(app, /searchParams\.delete\('level'\)/);
  assert.doesNotMatch(app, /resetHomeOnReload/);
  assert.match(app, /canonicalizeDateUrl\(parsed\.date\);/);
});

test('ladder repository validates dates, prefers cache, and uses bundled data', async () => {
  const values = new Map();
  let reads = 0;
  const repository = createLadderRepository({
    readSessionValue(key, fallback) { reads += 1; return values.get(key) ?? fallback; },
    writeSessionValue(key, value) { values.set(key, value); },
  });
  await assert.rejects(repository.resolve('2026-08-31', today), RangeError);
  assert.equal(reads, 0);
  const ladder = await repository.resolve('2026-09-09', today);
  assert.equal(ladder.length, core.LADDER_SIZE);
  const cachedRepository = createLadderRepository({
    readSessionValue(key, fallback) { return values.get(key) ?? fallback; },
    writeSessionValue() { throw new Error('cache should not be rewritten'); },
  });
  assert.deepEqual(await cachedRepository.resolve('2026-09-09', today), ladder);
  assert.match(codeforces, /if \(!isSelectableDate\(date, today\)\) return Promise\.reject/);
});

test('ladder repository keeps canonical history ahead of cache', async () => {
  const date = '2026-09-09';
  const ids = RUNTIME_CORPUS.problems.slice(0, core.LADDER_SIZE).map(core.stableProblemId);
  const repository = createLadderRepository({
    manifest: { ...CANONICAL_HISTORY_MANIFEST, entries: { [date]: { ids } } },
  });
  const ladder = await repository.resolve(date, '2026-09-10');
  repository.write(date, '2026-09-10', ladder);
  assert.deepEqual(ladder.map(core.stableProblemId), ids);
  assert.equal(repository.read(date, '2026-09-10'), null);
});

test('Codeforces preserves API comments and classifies missing user handles', () => {
  assert.match(codeforces, /API_MIN_INTERVAL_MS = 2000/);
  assert.match(codeforces, /requestQueue/);
  assert.match(codeforces, /let data = null/);
  assert.match(codeforces, /const comment = String\(data\?\.comment \|\| ''\)\.trim\(\)/);
  assert.match(codeforces, /method === 'user\.info' && \/User with handle \.\* not found\/i\.test\(comment\)/);
  assert.match(codeforces, /error\.code = 'HANDLE_NOT_FOUND'/);
});

test('cache reads and writes reject illegal dates before session storage', () => {
  let reads = 0;
  let writes = 0;
  const repository = createLadderRepository({
    readSessionValue() { reads += 1; return 'null'; },
    writeSessionValue() { writes += 1; },
  });
  assert.equal(repository.read('2026-08-31', today), null);
  repository.write('2026-08-31', today, []);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.match(storage, /sessionStorage\?\.getItem/);
  assert.match(storage, /sessionStorage\?\.setItem/);
});

test('cached ladders require thirteen unique eligible records with required fields', () => {
  const repository = createLadderRepository();
  const valid = RUNTIME_CORPUS.problems.slice(0, core.LADDER_SIZE);
  assert.equal(repository.isValidLadder(valid), true);
  assert.equal(repository.isValidLadder(valid.slice(1)), false);
  assert.equal(repository.isValidLadder(valid.map((problem) => ({ ...problem, name: '' }))), false);
});

test('calendar is clamped to September 2026 through the current month', () => {
  assert.match(app, /const monthBounds = compositionRoot\.calendar\.monthBounds\(today\)/);
  assert.match(app, /const minMonth = monthBounds\.minMonth/);
  assert.match(app, /const maxMonth = monthBounds\.maxMonth/);
  assert.match(app, /const canGoPrevious = monthKey > minMonth/);
  assert.match(app, /const canGoNext = monthKey < maxMonth/);
  assert.match(app, /if \(nextKey < minMonth \|\| nextKey > maxMonth\) return/);
  assert.doesNotMatch(previous, /id="prev-year"|id="next-year"/);
  assert.match(previous, /id="prev-month"/);
  assert.match(previous, /id="next-month"/);
  assert.match(previous, /id="month-picker-toggle"/);
  assert.match(previous, /id="month-picker"/);
});

test('calendar cells use real links for selectable dates and context for unavailable dates', () => {
  assert.match(app, /const selectable = core\.isSelectableDate\(date, today\)/);
  assert.match(app, /document\.createElement\(selectable \? 'a' : 'span'\)/);
  assert.match(app, /date < core\.LAUNCH_DATE \? t\('unavailableDate'\)/);
  assert.match(app, /date > today \? t\('future'\)/);
  assert.match(app, /dateElement\.setAttribute\('aria-label'/);
});

test('first Sunday-first launch week contains two disabled pre-launch cells', () => {
  assert.equal(core.sundayStart('2026-09-01'), '2026-08-30');
  const week = Array.from({ length: 7 }, (_, index) => core.shiftDate('2026-08-30', index));
  assert.deepEqual(week, ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
  assert.deepEqual(week.map((date) => core.isSelectableDate(date, today)), [false, false, true, true, true, true, true]);
});

test('Today uses the local browser date and dev-now has a host gate', () => {
  assert.equal(core.todayAtLocal(new Date(2026, 8, 10, 0, 0, 0)), '2026-09-10');
  assert.equal(core.todayAtLocal(new Date(2026, 8, 10, 23, 59, 59)), '2026-09-10');
  assert.match(app, /getToday as resolveToday/);
  assert.match(app, /return resolveToday\(location\.href, location\.hostname\)/);
  assert.match(app, /canonicalStateUrl|challengeUrl/);
});

test('no future prefetch or public preview backdoor exists', () => {
  assert.doesNotMatch(app, /prefetch|preview=true|admin=true|tomorrow=true/);
  assert.doesNotMatch(readme, /preview=true|admin=true|tomorrow=true/);
  assert.match(app, /if \(dateChanged \|\| !state\.ladder\) loadLadder\(\)/);
});

test('launch documentation states the UI-hardening secrecy boundary', () => {
  assert.match(readme, /Public URL\/UI\/cache paths do not expose future ladders/);
  assert.match(readme, /not cryptographic secrecy/);
  assert.match(readme, /2026-09-01/);
});

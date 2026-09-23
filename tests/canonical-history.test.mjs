import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import { CANONICAL_HISTORY_MANIFEST } from '../data/canonical-history-manifest.js';

const ids = Array.from({ length: core.LADDER_SIZE }, (_, index) => `355:${String.fromCharCode(65 + index)}`);
const manifest = {
  ...CANONICAL_HISTORY_MANIFEST,
  manifestRevision: 'fixture-v1',
  entries: { '2026-09-06': { ids } },
};

test('empty launch manifest is valid and leaves all dates on deterministic fallback', () => {
  assert.deepEqual(core.validateCanonicalHistoryManifest(CANONICAL_HISTORY_MANIFEST), { valid: true, reason: null });
  assert.equal(CANONICAL_HISTORY_MANIFEST.resolverVersion, core.SELECTOR_VERSION);
  assert.equal(core.canonicalHistoryIds(CANONICAL_HISTORY_MANIFEST, '2026-09-06'), null);
});

test('canonical history returns stored order without consulting live ratings', () => {
  assert.deepEqual(core.canonicalHistoryIds(manifest, '2026-09-06'), ids);
  const changed = { ...manifest, entries: { '2026-09-06': { ids: [...ids].reverse() } } };
  assert.deepEqual(core.canonicalHistoryIds(changed, '2026-09-06'), [...ids].reverse());
});

test('canonical history rejects malformed entries but remains independent of selector upgrades', () => {
  assert.equal(core.validateCanonicalHistoryManifest({ ...manifest, entries: { '2026-09-06': { ids: ids.slice(0, 10) } } }).valid, false);
  assert.equal(core.validateCanonicalHistoryManifest({ ...manifest, entries: { '2026-09-06': { ids: [...ids.slice(0, 10), ids[0]] } } }).valid, false);
  assert.equal(core.validateCanonicalHistoryManifest({ ...manifest, resolverVersion: 'old-selector' }).valid, false);
  assert.equal(core.validateCanonicalHistoryManifest({ ...manifest, resolverVersion: 'j4-capacity-aware-v1' }).valid, true);
  assert.throws(() => core.canonicalHistoryIds({ ...manifest, selectionSalt: 'wrong' }, '2026-09-06'), /provenance/);
});

test('canonical IDs are independent of current live metadata', () => {
  const live = ids.map((id, index) => ({ contestId: id.split(':')[0], index: id.split(':')[1], name: `Live ${index}`, rating: 4000 - index * 100, type: 'PROGRAMMING', tags: [] }));
  const hydrated = core.hydrateCanonicalProblems(core.canonicalHistoryIds(manifest, '2026-09-06'), live);
  assert.deepEqual(hydrated.map(core.stableProblemId), ids);
  assert.equal(hydrated[0].rating, 4000);
  assert.throws(() => core.hydrateCanonicalProblems(ids, live.slice(1)), /metadata is unavailable/);
});

test('canonical history cannot bypass eligibility or approved-contest policy', () => {
  const excludedIds = [...ids.slice(0, -1), '524:A'];
  const records = excludedIds.map((id, index) => ({
    contestId: id.split(':')[0], index: id.split(':')[1], name: `Record ${index}`,
    rating: 800 + index * 100, type: 'PROGRAMMING', tags: [],
  }));
  assert.equal(core.validateCanonicalHistoryManifest({ ...manifest, entries: { '2026-09-06': { ids: excludedIds } } }, records).valid, false);
  assert.throws(() => core.hydrateCanonicalProblems(excludedIds, records), /metadata is unavailable/);
});

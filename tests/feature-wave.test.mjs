import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';

test('share URL contains only the canonical challenge context', () => {
  const shared = core.shareUrlState(
    'https://accept.example/?handle=tourist&score=10#private',
    '2026-09-09',
    'specialist',
    '2026-09-10',
  );
  assert.equal(shared.href, 'https://accept.example/?date=2026-09-09&level=special');
  assert.deepEqual(core.parseUrlState(shared.href, '2026-09-10'), {
    date: '2026-09-09', level: 'special', view: 'window',
  });
  const sharedAll = core.shareUrlState(
    'https://accept.example/?date=2026-09-09&level=newbie',
    '2026-09-09',
    'newbie',
    '2026-09-10',
    core.ALL_PROBLEMS_VIEW,
  );
  assert.equal(sharedAll.href, 'https://accept.example/?date=2026-09-09&level=newbie&view=all');
  assert.deepEqual(core.parseUrlState(sharedAll.href, '2026-09-10'), {
    date: '2026-09-09', level: 'newbie', view: 'all',
  });
});

test('explicit URL level survives a later inferred profile', () => {
  assert.equal(core.resolveLevel({
    currentLevel: 'expert',
    provenance: core.LEVEL_PROVENANCE.MANUAL,
    profile: { rating: 900 },
  }), 'expert');
  assert.equal(core.resolveLevel({ profile: { rating: 1472 } }), 'special');
  assert.deepEqual(core.levelInferenceState({ rating: 1472 }, 'expert', core.LEVEL_PROVENANCE.MANUAL), {
    inferredLevel: 'special', selectedLevel: 'expert', provenance: 'manual', isSuggestion: true, differs: true,
  });
});

test('completion history is normalized, boolean, and isolated by handle', () => {
  const history = core.recordCompletion({}, ' Tourist ', '2026-09-07');
  const updated = core.recordCompletion(history, 'OTHER', '2026-09-08');
  assert.deepEqual(updated, {
    tourist: { '2026-09-07': true },
    other: { '2026-09-08': true },
  });
  assert.equal(core.hasCompletion(updated, 'TOURIST', '2026-09-07'), true);
  assert.equal(core.hasCompletion(updated, 'tourist', '2026-09-08'), false);
  assert.deepEqual(core.parseCompletionHistory(JSON.stringify({
    Tourist: { '2026-09-07': true, 'not-a-date': true, '2026-09-08': false },
    other: ['2026-09-08'],
  })), { tourist: { '2026-09-07': true } });
});

test('a history date is written only for a qualifying accepted problem', () => {
  const result = core.verifySubmissions([
    { creationTimeSeconds: core.submissionDayBounds('2026-09-09').start / 1000, verdict: 'OK', problem: { contestId: 1, index: 'A' } },
  ], { day: '2026-09-09', problemIds: ['1:A'] });
  assert.equal(core.completionEstablished(result, ['1:A']), true);
  assert.equal(core.completionEstablished({ ...result, status: 'UNAVAILABLE' }, ['1:A']), false);
  assert.equal(core.completionEstablished(result, ['2:B']), false);
});

test('visible completion history follows the current Sunday-first week', () => {
  assert.deepEqual(core.weekDates('2026-09-09'), [
    '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09',
    '2026-09-10', '2026-09-11', '2026-09-12',
  ]);
  assert.deepEqual(core.weekDates('2026-09-06').slice(0, 2), ['2026-09-06', '2026-09-07']);
});

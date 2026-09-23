import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import { SELECTED_DATE, PROBLEM_IDS, fixtures, submission, evaluateStatus } from './fixtures/status-fixtures.mjs';

const expected = (fixture, status, done = false, date = SELECTED_DATE) => {
  const result = evaluateStatus(fixture, '1:A', date);
  assert.equal(result.status, status);
  assert.equal(result.done, done);
};

test('deterministic status fixtures cover blank, faint, current, and precedence states', () => {
  expected(fixtures.noSubmissions, 'none');
  expected(fixtures.historicalWa, 'known-wrong');
  expected(fixtures.historicalAc, 'known');
  expected(fixtures.currentWa, 'current-wrong');
  expected(fixtures.historicalAcCurrentWa, 'current-wrong');
  expected(fixtures.currentWaCurrentAc, 'current', true);
  expected(fixtures.currentAcLaterWa, 'current', true);
  expected(fixtures.laterAc, 'known', false, '2026-09-09');
});

test('mixed activity leaves blank, faint, red, and green markers distinct', () => {
  const submissions = [
    submission('2:A', 'OK', '2026-09-08'),
    submission('3:A', 'WRONG_ANSWER', '2026-09-08'),
    submission('4:A', 'WRONG_ANSWER'),
    submission('5:A', 'OK'),
    submission('5:A', 'WRONG_ANSWER'),
  ];
  const result = core.verifySubmissions(submissions, { day: SELECTED_DATE, problemIds: PROBLEM_IDS });
  const cache = core.mergeKnownActivity({}, 'fixture-user', core.activityFromSubmissions(submissions));
  const statuses = PROBLEM_IDS.map(id => core.problemStatus(id, new Set(result.solvedIds), new Set(result.unsuccessfulIds), core.knownSolvedIds(cache, 'fixture-user'), core.knownUnsuccessfulIds(cache, 'fixture-user')));
  assert.deepEqual(statuses, ['none', 'known', 'known-wrong', 'current-wrong', 'current']);
  assert.equal(result.done, true);
});

test('green accepted state is Done, red-only and faint-only are not Done', () => {
  assert.equal(evaluateStatus(fixtures.currentWa, '1:A').done, false);
  assert.equal(evaluateStatus(fixtures.historicalAc, '1:A').done, false);
  assert.equal(evaluateStatus(fixtures.currentAcLaterWa, '1:A').done, true);
  assert.equal(core.verifySubmissions(fixtures.currentWa, { day: SELECTED_DATE, problemIds: ['1:A'] }).done, false);
});

test('transient verdicts are not unsuccessful attempts', () => {
  const result = core.verifySubmissions([submission('1:A', 'TESTING'), submission('1:A', undefined)], { day: SELECTED_DATE, problemIds: ['1:A'] });
  assert.deepEqual(result.unsuccessfulIds, []);
  assert.equal(core.isUnsuccessfulVerdict('TESTING'), false);
});

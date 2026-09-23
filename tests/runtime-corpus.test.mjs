import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import { RUNTIME_CORPUS } from '../data/runtime-corpus.js';

test('runtime corpus is a non-empty, validated static ladder source', async () => {
  assert.equal(RUNTIME_CORPUS.schema, 'accept-runtime-corpus-v1');
  assert.match(RUNTIME_CORPUS.sourceProvenance.problemsSha256, /^[0-9a-f]{64}$/);
  assert.match(RUNTIME_CORPUS.sourceProvenance.contestsSha256, /^[0-9a-f]{64}$/);
  assert.ok(RUNTIME_CORPUS.problems.length >= 8000);
  assert.ok(RUNTIME_CORPUS.contests.length >= 2000);
  assert.ok(RUNTIME_CORPUS.problems.every(core.isEligibleProblem));
  assert.ok(RUNTIME_CORPUS.contests.every((contest) => Number.isInteger(Number(contest.id)) && Number.isFinite(contest.startTimeSeconds) && Number.isFinite(contest.durationSeconds)));

  const eligible = core.filterHistoricalProblems(RUNTIME_CORPUS.problems, RUNTIME_CORPUS.contests, '2026-09-15', '2026-09-15');
  const ladder = await core.buildLadder(eligible, '2026-09-15', core.SITE_SALT, '2026-09-15');
  assert.equal(ladder.length, core.LADDER_SIZE);
  assert.equal(new Set(ladder.map(core.stableProblemId)).size, core.LADDER_SIZE);
});

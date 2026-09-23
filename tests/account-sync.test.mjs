import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_PROVENANCE } from '../domain/config.js';
import { createAccountSync, ACCOUNT_SYNC_STATUS, PROFILE_ERROR_CODES } from '../application/account-sync.js';

const ladder = [{ contestId: 1, index: 'A' }];
const profile = (handle, rating = 1200) => ({ handle, rating });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('account sync calls userInfo before userStatus and commits completion activity', async () => {
  const calls = [];
  const persisted = [];
  const coordinator = createAccountSync({
    initialState: { date: '2026-09-18', handle: 'alice', ladder, ladderStatus: 'ready' },
    ports: {
      userInfo: async (handle) => { calls.push(`info:${handle}`); return [profile('Alice', 1500)]; },
      userStatus: async (handle, options) => { calls.push(`status:${handle}:${options.beforeSeconds}`); return [{ creationTimeSeconds: 1, verdict: 'OK', problem: ladder[0] }]; },
      verifySubmissions: () => ({ status: 'CHECKED', solvedIds: ['1:A'], unsuccessfulIds: [], problemIds: ['1:A'] }),
      learnKnownActivity: (handle) => ({ handle, accepted: new Set(['1:A']) }),
      rememberCompletion: (...args) => persisted.push(['completion', ...args]),
      rememberRecentHandle: (...args) => persisted.push(['recent', ...args]),
      problemId: (problem) => `${problem.contestId}:${problem.index}`,
      visibleProblemIds: () => ['1:A'],
    },
  });

  const result = await coordinator.syncHandle('alice');
  assert.equal(result.status, ACCOUNT_SYNC_STATUS.COMPLETE);
  assert.equal(calls[0], 'info:alice');
  assert.match(calls[1], /^status:alice:/);
  assert.deepEqual(persisted, [['recent', 'Alice'], ['completion', 'Alice', '2026-09-18']]);
  assert.equal(coordinator.getState().loadedHandle, 'alice');
});

test('manual level ownership is retained only for its owning handle', async () => {
  const seen = [];
  const coordinator = createAccountSync({
    initialState: { date: '2026-09-18', handle: '', ladder, ladderStatus: 'ready', level: 'legend', levelProvenance: LEVEL_PROVENANCE.MANUAL, levelOwnerHandle: 'alice' },
    ports: {
      userInfo: async (handle) => [profile(handle, 1200)],
      userStatus: async () => [],
      verifySubmissions: (_s, options) => { seen.push(options); return { status: 'CHECKED', solvedIds: [], unsuccessfulIds: [], problemIds: ['1:A'] }; },
      problemId: (problem) => `${problem.contestId}:${problem.index}`,
      visibleProblemIds: (_ladder, level) => { seen.push(level); return ['1:A']; },
    },
  });
  await coordinator.syncHandle('alice');
  assert.equal(coordinator.getState().level, 'legend');
  await coordinator.syncHandle('bob');
  assert.equal(coordinator.getState().level, 'pupil');
  assert.equal(coordinator.getState().levelProvenance, LEVEL_PROVENANCE.INFERRED);
});

test('manual level selected through live context survives a refresh of the same handle', async () => {
  const context = { date: '2026-09-18', handle: 'alice', loadedHandle: 'alice', ladder, ladderStatus: 'ready', level: 'legend', levelProvenance: LEVEL_PROVENANCE.MANUAL, levelOwnerHandle: 'alice' };
  const coordinator = createAccountSync({
    initialState: { ...context, profile: profile('Alice') },
    ports: {
      getContext: () => context,
      userInfo: async () => [profile('Alice', 1200)],
      userStatus: async () => [],
      visibleProblemIds: (_ladder, level) => { assert.equal(level, 'legend'); return ['1:A']; },
      verifySubmissions: () => ({ status: 'CHECKED', solvedIds: [], unsuccessfulIds: [], problemIds: ['1:A'] }),
    },
  });
  await coordinator.syncHandle('alice');
  assert.equal(coordinator.getState().level, 'legend');
  assert.equal(coordinator.getState().levelProvenance, LEVEL_PROVENANCE.MANUAL);
});

test('ladder loading failure clears syncing state', async () => {
  const coordinator = createAccountSync({
    initialState: { date: '2026-09-18', ladder: null, ladderStatus: 'unavailable' },
    ports: {
      userInfo: async () => [profile('alice')],
      userStatus: async () => [],
      loadLadder: async () => { throw new Error('ladder failed'); },
    },
  });
  const result = await coordinator.syncHandle('alice');
  assert.equal(result.status, ACCOUNT_SYNC_STATUS.UNAVAILABLE);
  assert.equal(coordinator.getState().syncing, false);
  assert.equal(coordinator.getState().syncTarget, '');
});

test('recommendation status is emitted only when a new handle receives an inferred level', async () => {
  const commits = [];
  const coordinator = createAccountSync({
    initialState: { date: '2026-09-18', handle: 'alice', loadedHandle: 'alice', profile: profile('Alice', 1500), level: 'expert', levelProvenance: LEVEL_PROVENANCE.INFERRED, levelOwnerHandle: 'alice', ladder, ladderStatus: 'ready' },
    ports: {
      commit: (_patch, meta) => { if (meta.phase === 'profile') commits.push(meta.recommendationApplied); },
      userInfo: async (handle) => [profile(handle, handle === 'alice' ? 1500 : 1200)],
      userStatus: async () => [],
      verifySubmissions: () => ({ status: 'CHECKED', solvedIds: [], unsuccessfulIds: [], problemIds: ['1:A'] }),
      problemId: (problem) => `${problem.contestId}:${problem.index}`,
      visibleProblemIds: () => ['1:A'],
    },
  });
  await coordinator.syncHandle('alice');
  await coordinator.syncHandle('bob');
  assert.deepEqual(commits, [false, true]);
});


test('stale requests cannot commit profile or persist activity', async () => {
  const requests = new Map();
  const persisted = [];
  const coordinator = createAccountSync({
    initialState: { date: '2026-09-18', handle: '', ladder, ladderStatus: 'ready' },
    ports: {
      userInfo: (handle) => { const d = deferred(); requests.set(handle, d); return d.promise; },
      userStatus: async () => [],
      verifySubmissions: () => ({ status: 'CHECKED', solvedIds: [], unsuccessfulIds: [], problemIds: ['1:A'] }),
      rememberRecentHandle: (handle) => persisted.push(handle),
      problemId: (problem) => `${problem.contestId}:${problem.index}`,
    },
  });
  const first = coordinator.syncHandle('alice');
  const second = coordinator.syncHandle('bob');
  requests.get('bob').resolve([profile('Bob')]);
  await second;
  requests.get('alice').resolve([profile('Alice')]);
  const stale = await first;
  assert.equal(stale.status, ACCOUNT_SYNC_STATUS.STALE);
  assert.equal(coordinator.getState().loadedHandle, 'bob');
  assert.deepEqual(persisted, ['Bob']);
});

test('date or ladder context changes make an in-flight request stale', async () => {
  const info = deferred();
  let context = { handle: 'alice', date: '2026-09-18', ladder, ladderStatus: 'ready' };
  const coordinator = createAccountSync({
    initialState: context,
    ports: {
      getContext: () => context,
      userInfo: () => info.promise,
      userStatus: async () => [],
    },
  });
  const pending = coordinator.syncHandle('alice');
  context = { ...context, date: '2026-09-17', ladder: [{ contestId: 2, index: 'B' }] };
  info.resolve([profile('Alice')]);
  assert.equal((await pending).status, ACCOUNT_SYNC_STATUS.STALE);
});

test('profile failures are typed and ladder/status unavailability is explicit', async () => {
  const notFound = createAccountSync({ ports: { userInfo: async () => { throw Object.assign(new Error('missing'), { code: 'HANDLE_NOT_FOUND' }); }, userStatus: async () => [] } });
  const failed = await notFound.syncHandle('missing');
  assert.equal(failed.status, ACCOUNT_SYNC_STATUS.PROFILE_ERROR);
  assert.equal(failed.error.code, PROFILE_ERROR_CODES.HANDLE_NOT_FOUND);

  let statusCalls = 0;
  const unavailable = createAccountSync({ initialState: { date: '2026-09-18', ladder: null, ladderStatus: 'unavailable' }, ports: {
    userInfo: async () => [profile('alice')],
    userStatus: async () => { statusCalls += 1; return []; },
  } });
  const result = await unavailable.syncHandle('alice');
  assert.equal(result.status, ACCOUNT_SYNC_STATUS.UNAVAILABLE);
  assert.equal(result.reason, 'unavailable');
  assert.equal(statusCalls, 0);
});

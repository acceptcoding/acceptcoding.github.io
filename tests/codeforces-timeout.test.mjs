import test from 'node:test';
import assert from 'node:assert/strict';
import { API_TIMEOUT_MS, problemsetProblems } from '../js/codeforces.js';

test('Codeforces catalog requests abort instead of leaving the ladder loading forever', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let observedSignal;
  globalThis.setTimeout = (callback) => {
    callback();
    return 1;
  };
  globalThis.fetch = (_url, options) => {
    observedSignal = options.signal;
    return observedSignal.aborted
      ? Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      : new Promise(() => {});
  };
  try {
    await assert.rejects(problemsetProblems(), new RegExp(`timed out after ${API_TIMEOUT_MS / 1000}s`));
    assert.equal(observedSignal?.aborted, true);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

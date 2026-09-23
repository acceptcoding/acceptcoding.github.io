import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShareCommand,
  createShareViewModel,
  executeShare,
  SHARE_RESULT,
} from '../application/share.js';

const date = '2026-09-17';

function checked(...ids) {
  return { status: 'CHECKED', solvedIds: new Set(ids) };
}

test('share view model preserves the current public URL and solved count', () => {
  const model = createShareViewModel({ language: 'en', date, verification: checked('1:A', '2:B', '3:C') });

  assert.equal(model.solvedCount, 3);
  assert.equal(model.payload.url, `https://acceptcoding.github.io/en/challenges/${date}/`);
  assert.match(model.payload.text, /I solved 3 problems/);
  assert.match(model.payload.text, new RegExp(`https://acceptcoding\\.github\\.io/en/challenges/${date}/`));
});

test('share view model reports zero when verification is not checked', () => {
  const model = createShareViewModel({ language: 'pt', date, verification: { status: 'UNAVAILABLE', solvedIds: new Set(['1:A']) } });

  assert.equal(model.solvedCount, 0);
  assert.match(model.payload.text, /Desafio ACCEPT de 17\/09\/2026\. 💻/);
  assert.doesNotMatch(model.payload.text, /Resolvi/);
});

test('share command uses native share first and clipboard as the fallback port', async () => {
  const model = createShareViewModel({ language: 'en', date, verification: checked('1:A') });
  const command = createShareCommand({ title: 'ACCEPT Coding Club', payload: model.payload });
  const calls = [];

  const result = await executeShare(command, {
    nativeShare: async (value) => { calls.push(['native', value]); throw new Error('unsupported'); },
    clipboardWriteText: async (value) => { calls.push(['clipboard', value]); },
  });

  assert.equal(result, SHARE_RESULT.COPIED);
  assert.deepEqual(calls.map(([kind]) => kind), ['native', 'clipboard']);
  assert.equal(calls[1][1], command.text);
});

test('cancelled native share does not write to clipboard', async () => {
  const command = createShareCommand({
    title: 'ACCEPT Coding Club',
    payload: createShareViewModel({ language: 'en', date }).payload,
  });
  let clipboardCalls = 0;
  const result = await executeShare(command, {
    nativeShare: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); },
    clipboardWriteText: async () => { clipboardCalls += 1; },
  });

  assert.equal(result, SHARE_RESULT.CANCELLED);
  assert.equal(clipboardCalls, 0);
});

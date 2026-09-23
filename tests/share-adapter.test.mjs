import test from 'node:test';
import assert from 'node:assert/strict';
import { createShareAdapter } from '../ui/share-adapter.js';
import { createShareCommand, createShareViewModel, SHARE_RESULT } from '../application/share.js';

function fakeElement() {
  const classes = new Set();
  return {
    dataset: {},
    innerHTML: '<svg><path /></svg><span>Share</span>',
    textContent: '',
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
  };
}

function command() {
  return createShareCommand({
    title: 'ACCEPT Coding Club',
    payload: createShareViewModel({ language: 'en', date: '2026-09-17' }).payload,
  });
}

test('share adapter delegates native share and updates shared feedback', async () => {
  const button = fakeElement();
  const status = fakeElement();
  const timers = [];
  const calls = [];
  const adapter = createShareAdapter({
    document: { querySelector: (selector) => selector === '#share-challenge' ? button : status },
    translate: (key) => ({ shareChallenge: 'Share', shareShared: 'Challenge shared.' })[key],
    ports: {
      nativeShare: async (value) => { calls.push(value); },
    },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: () => {},
  });

  const result = await adapter.execute(command());

  assert.equal(result, SHARE_RESULT.SHARED);
  assert.deepEqual(calls, [{ title: 'ACCEPT Coding Club', text: command().text }]);
  assert.equal(button.dataset.defaultLabel, 'Share');
  assert.equal(button.classList.contains('is-success'), true);
  assert.equal(status.textContent, 'Challenge shared.');
  assert.equal(timers[0].delay, 1100);

  timers[0].callback();
  assert.equal(button.classList.contains('is-success'), false);
  assert.match(button.innerHTML, /Share/);
  assert.equal(status.textContent, '');
});

test('share adapter preserves clipboard fallback and cancelled native share', async () => {
  const button = fakeElement();
  const status = fakeElement();
  const calls = [];
  const adapter = createShareAdapter({
    document: { querySelector: (selector) => selector === '#share-challenge' ? button : status },
    translate: (key) => key,
    ports: {
      nativeShare: async () => { throw new Error('unsupported'); },
      clipboardWriteText: async (text) => { calls.push(text); },
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
  });

  assert.equal(await adapter.execute(command()), SHARE_RESULT.COPIED);
  assert.deepEqual(calls, [command().text]);

  const cancelled = createShareAdapter({
    document: { querySelector: (selector) => selector === '#share-challenge' ? button : status },
    ports: { nativeShare: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); }, clipboardWriteText: async () => { throw new Error('must not run'); } },
    translate: (key) => key,
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  assert.equal(await cancelled.execute(command()), SHARE_RESULT.CANCELLED);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { balloonRepresentation, createSharePayload, formatShareDate, PUBLIC_ORIGIN, shareUrl } from '../js/share.js';

test('share visual progression uses 💻 for zero and balloons thereafter', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7, 10, 13].map(balloonRepresentation), [
    '💻', '🎈', '🎈🎈', '🎈🎈🎈', '4️⃣🎈', '7️⃣🎈', '1️⃣0️⃣🎈', '1️⃣3️⃣🎈',
  ]);
});

test('share URLs always use the public HTTPS ACCEPT origin', () => {
  assert.equal(PUBLIC_ORIGIN, 'https://acceptcoding.github.io');
  assert.equal(shareUrl('en', '2026-09-17'), 'https://acceptcoding.github.io/en/challenges/2026-09-17/');
  assert.equal(createSharePayload({ language: 'en', date: '2026-09-17', solvedCount: 7 }).url, 'https://acceptcoding.github.io/en/challenges/2026-09-17/');
});

test('zero solved state is a neutral localized invitation without a score line', () => {
  assert.equal(createSharePayload({ language: 'pt', date: '2026-09-17', solvedCount: 0 }).text, 'Desafio ACCEPT de 17/09/2026. 💻\n\nE aí, bora codar?\nhttps://acceptcoding.github.io/pt/challenges/2026-09-17/');
  assert.equal(createSharePayload({ language: 'en', date: '2026-09-17', solvedCount: 0 }).text, 'ACCEPT challenge for September 17, 2026. 💻\n\nUp for some coding?\nhttps://acceptcoding.github.io/en/challenges/2026-09-17/');
  assert.equal(createSharePayload({ language: 'es', date: '2026-09-17', solvedCount: 0 }).text, 'Desafío ACCEPT del 17/09/2026. 💻\n\n¿Te animas a programar?\nhttps://acceptcoding.github.io/es/challenges/2026-09-17/');
});

test('solved state keeps localized accessible result text and CTA', () => {
  assert.equal(createSharePayload({ language: 'pt', date: '2026-09-17', solvedCount: 1 }).text, 'Fiz o desafio ACCEPT de 17/09/2026.\nResolvi 1 problema. 🎈\n\nE aí, bora codar?\nhttps://acceptcoding.github.io/pt/challenges/2026-09-17/');
  assert.equal(createSharePayload({ language: 'pt', date: '2026-09-17', solvedCount: 7 }).text, 'Fiz o desafio ACCEPT de 17/09/2026.\nResolvi 7 problemas. 7️⃣🎈\n\nE aí, bora codar?\nhttps://acceptcoding.github.io/pt/challenges/2026-09-17/');
  assert.equal(createSharePayload({ language: 'en', date: '2026-09-17', solvedCount: 7 }).text, 'I did the ACCEPT challenge for September 17, 2026.\nI solved 7 problems. 7️⃣🎈\n\nUp for some coding?\nhttps://acceptcoding.github.io/en/challenges/2026-09-17/');
  assert.equal(createSharePayload({ language: 'es', date: '2026-09-16', solvedCount: 7 }).text, 'Hice el desafío ACCEPT del 16/09/2026.\nResolví 7 problemas. 7️⃣🎈\n\n¿Te animas a programar?\nhttps://acceptcoding.github.io/es/challenges/2026-09-16/');
});

test('share grammar and English date format are exact', () => {
  assert.equal(formatShareDate('2026-09-17', 'en'), 'September 17, 2026');
  for (const language of ['pt', 'en', 'es']) {
    const one = createSharePayload({ language, date: '2026-09-17', solvedCount: 1 }).text;
    const two = createSharePayload({ language, date: '2026-09-17', solvedCount: 2 }).text;
    assert.match(one, /1 (problema|problem)\./);
    assert.match(two, /2 (problemas|problems)\./);
    assert.doesNotMatch(one, /💻/);
  }
});

test('historical date remains the resource shared from the same centralized function', () => {
  const payload = createSharePayload({ language: 'pt', date: '2026-09-16', solvedCount: 0 });
  assert.match(payload.text, /16\/09\/2026/);
  assert.match(payload.text, /challenges\/2026-09-16\//);
  assert.doesNotMatch(payload.text, /2026-09-17/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl } from '../domain/url-state.js';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

function canonical(input) {
  return canonicalizeUrl(input, '2026-09-17').href;
}

test('canonicalizes legacy level aliases without changing the route', () => {
  assert.equal(
    canonical('https://accept.invalid/pt/daily/?date=2026-09-17&level=specialist#focus'),
    'https://accept.invalid/pt/daily/?date=2026-09-17&level=special#focus',
  );
});

test('canonicalizes the legacy all level to the separate all view', () => {
  assert.equal(
    canonical('https://accept.invalid/pt/daily/?date=2026-09-17&level=all'),
    'https://accept.invalid/pt/daily/?date=2026-09-17&view=all',
  );
});

test('removes invalid level and view values', () => {
  assert.equal(
    canonical('https://accept.invalid/pt/daily/?date=2026-09-17&level=../../x&view=broken'),
    'https://accept.invalid/pt/daily/?date=2026-09-17',
  );
});

test('preserves valid canonical state and unrelated query parameters', () => {
  assert.equal(
    canonical('https://accept.invalid/pt/daily/?date=2026-09-17&level=expert&dev-now=2026-09-17&x=keep'),
    'https://accept.invalid/pt/daily/?date=2026-09-17&level=expert&dev-now=2026-09-17&x=keep',
  );
});

test('application integrates URL canonicalization with replacement history', () => {
  assert.match(app, /compositionRoot\.navigation\.canonicalStateUrl\(location\.href, today\)/);
  assert.match(app, /history\.replaceState\(history\.state, ''/);
});

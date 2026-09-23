import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('public pages keep only Home, Daily and Previous', async () => {
  const [home, i18n] = await Promise.all([
    read('index.html'), read('js/i18n.js'),
  ]);
  assert.doesNotMatch(home, /first-ac\.html|materials\.html|firstAcLink|materialsLink/);
  assert.doesNotMatch(i18n, /firstAc|materials|feedback/i);
});

test('How-to is removed from the public surface', async () => {
  await assert.rejects(import('node:fs/promises').then(({ access }) => access(new URL('../how-to.html', import.meta.url))));
  for (const language of ['pt', 'en', 'es']) {
    await assert.rejects(import('node:fs/promises').then(({ access }) => access(new URL(`../${language}/how-to.html`, import.meta.url))));
  }
});

test('404 fallback remains explicit and safe for localized copy', async () => {
  const [fallback, i18n] = await Promise.all([read('404.html'), read('js/i18n.js')]);
  assert.match(fallback, /data-route-fallback="true"/);
  assert.match(fallback, /Page not found/);
  assert.match(fallback, /Página não encontrada/);
  assert.match(fallback, /data-404-text="/);
  assert.doesNotMatch(fallback, /data-404-text='[^']*Today's/);
  assert.match(fallback, /classList\.remove\('language-pending'\)/);
  assert.doesNotMatch(fallback, /First AC|Materials|first-ac|materials/i);
  assert.doesNotMatch(i18n, /First AC|Materials|first-ac|materials/i);
  for (const label of ['data-i18n="homeNav"', 'data-i18n="dailyNav"', 'data-i18n="challengesNav"']) assert.match(fallback, new RegExp(label));
});


test('404 fallback has no canonical while generated public routes retain route canonicals', async () => {
  const pages = await Promise.all([
    read('404.html'),
    read('en/index.html'),
    read('en/daily/index.html'),
    read('en/challenges/index.html'),
    read('en/challenges/2026-09-23/index.html'),
  ]);
  assert.doesNotMatch(pages[0], /rel="canonical"/);
  for (const [page, canonical] of pages.slice(1).map((page, index) => [page, ['/en/', '/en/daily/', '/en/challenges/', '/en/challenges/2026-09-23/'][index]])) {
    assert.equal(page.match(/rel="canonical"/g)?.length, 1);
    assert.match(page, new RegExp(`<link rel="canonical" href="${canonical.replaceAll('/', '\\/')}">`));
  }
});

test('generated locale controls match each route language before runtime boot', async () => {
  for (const language of ['pt', 'en', 'es']) {
    const page = await read(`${language}/daily/index.html`);
    assert.match(page, new RegExp(`<html lang="${language}"[^>]*data-route-language="${language}"`));
    assert.match(page, new RegExp(`<span class="language-current">${language.toUpperCase()}</span>`));
    for (const option of ['pt', 'en', 'es']) {
      assert.match(page, new RegExp(`data-language="${option}"[^>]*aria-pressed="${String(option === language)}"`));
    }
  }
});
test('404 masthead and primary navigation links follow the requested locale', async () => {
  const fallback = await read('404.html');
  assert.match(fallback, /<header class="masthead"[\s\S]*data-404-link="home" href="\/en\/"/);
  assert.match(fallback, /<nav class="primary-nav" data-404-nav[\s\S]*data-404-link="home"/);
  assert.match(fallback, /querySelectorAll\('\[data-404-link\]'\)/);
  assert.match(fallback, /e\.href='\/'\+l\+'\/'\+\(\{home:''/);
});

test('public metadata declares authorship, MIT, and one authoritative alpha version', async () => {
  const [readme, license, packageJson] = await Promise.all([read('README.md'), read('LICENSE'), read('package.json')]);
  assert.match(readme, /Leonardo Deliyannis Constantin/);
  assert.match(readme, /@leodeliyannis/);
  assert.match(readme, /Passo Fundo, RS, Brasil/);
  assert.match(license, /MIT License/);
  assert.equal(JSON.parse(packageJson).version, '0.0.1');
});

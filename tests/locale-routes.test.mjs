import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expected = {
  en: { meta: ['Daily programming practice', 'Daily training', 'The ACCEPT challenge archive'], nav: 'Primary navigation', not: ['Início', 'Navegação principal', 'Mudar idioma. Idioma atual: Português.'] },
  es: { meta: ['Práctica diaria de programación', 'Entrenamiento diario', 'Calendario de desafíos'], nav: 'Navegación principal', not: ['Início', 'Navegação principal', 'Mudar idioma. Idioma atual: Português.'] },
};

test('generated locale routes have localized first-paint metadata and navigation', async () => {
  for (const [language, copy] of Object.entries(expected)) {
    const pages = await Promise.all([
      readFile(new URL(`../${language}/index.html`, import.meta.url), 'utf8'),
      readFile(new URL(`../${language}/daily/index.html`, import.meta.url), 'utf8'),
      readFile(new URL(`../${language}/challenges/index.html`, import.meta.url), 'utf8'),

    ]);
    for (const [index, page] of pages.entries()) {
      assert.match(page, new RegExp(`<html lang="${language}"`));
      assert.ok(copy.meta.some((marker) => page.includes(`<meta name="description" content="${marker}`)));
      assert.doesNotMatch(page, /class="primary-nav"/);
      for (const forbidden of copy.not) assert.doesNotMatch(page, new RegExp(forbidden));
    }
  }
});

test('problem rows expose table cells while preserving one link for title and id', async () => {
  const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /box\.setAttribute\('role', 'table'\)/);
  assert.match(app, /row\.setAttribute\('role', 'row'\)/);
  assert.match(app, /problemCell\.setAttribute\('role', 'cell'\)/);
  assert.match(app, /link\.append\(title\)/);
  assert.match(app, /row\.append\(problemCell, rating, statusCell\)/);
});

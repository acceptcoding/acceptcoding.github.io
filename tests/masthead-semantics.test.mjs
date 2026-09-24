import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COPY } from '../js/i18n.js';

const [html, css, app, shape, favicon] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../balloon-shape.svg', import.meta.url), 'utf8'),
  readFile(new URL('../balloon.svg', import.meta.url), 'utf8'),
]);

test('header wordmark is accessible text beside a decorative plain balloon', () => {
  assert.match(html, /class="brand-block"[^>]*aria-label="ACCEPT Coding Club"/);
  assert.match(html, /class="brand-lockup"/);
  assert.match(html, /class="brand-name">ACCEPT<\/span>/);
  assert.match(html, /class="brand-club">CODING CLUB<\/span>/);
  assert.match(html, /class="brand-tagline"[^>]*href="\.\/"[^>]*role="group"[^>]*data-i18n-aria="tagline"/);
  assert.deepEqual(Object.values(COPY).map(copy => [copy.taglineLine1, copy.taglineLine2, copy.taglineLine3]), [
    ['Exercícios,', 'Prática &', 'Técnica'], ['Everyday', 'Practice &', 'Training'], ['Ejercicios,', 'Práctica y', 'Técnica'],
  ]);
  assert.equal((html.match(/class="brand-tagline-line"/g) || []).length, 3);
  assert.match(html, /class="brand-divider"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /class="brand-tagline"[^>]*>[^<]*\|/);
  assert.doesNotMatch(`${html}${shape}${favicon}`, /<text|letter-a|brand-a|>A<\/text>/i);
  assert.match(css, /\.brand-name \{[^}]*letter-spacing: \.04em/);
  assert.match(css, /\.brand-club \{[^}]*letter-spacing: \.08em/);
  assert.match(css, /\.brand-lockup \{[^}]*align-items: center/);
  assert.match(css, /\.brand-tagline \{[^}]*display: flex[^}]*flex-direction: column[^}]*align-items: flex-start/);
  assert.match(css, /\.brand-divider \{[^}]*height: 38px[^}]*background: var\(--line\)/);
});

test('header balloon uses a longer curved tail while favicon stays independent', () => {
  assert.match(shape, /class="knot"/);
  assert.ok(shape.includes('M12 23.1c-.1 1.5.55 2.35'));
  assert.ok(shape.includes('1.5-.35 2.3'));
  assert.match(shape, /stroke-linecap="round"/);
  assert.match(favicon, /viewBox="0 0 24 30"/);
  assert.doesNotMatch(`${shape}${favicon}`, /linearGradient|radialGradient|filter=/);
});

test('localized problem headers and mobile difficulty abbreviations are explicit', () => {
  assert.deepEqual(Object.values(COPY).map(copy => [copy.problemHeaderDifficulty, copy.problemHeaderDifficultyShort, copy.problemHeaderProblem, copy.problemHeaderId, copy.problemHeaderDone]), [
    ['Dificuldade', 'Rating', 'Problema', 'ID', 'Feito?'],
    ['Codeforces rating', 'Rating', 'Problem', 'ID', 'Done?'],
    ['Dificultad', 'Rating', 'Problema', 'ID', '¿Listo?'],
  ]);
  assert.match(app, /function renderProblemHeader\(box\)/);
  assert.match(app, /setAttribute\('role', 'columnheader'\)/);
  assert.match(app, /headerLabel\(t\('problemHeaderDifficulty'\), t\('problemHeaderDifficultyShort'\)\)/);
  assert.match(css, /\.header-label-full \{ display: none; \}/);
  assert.match(css, /\.header-label-short \{ display: inline; \}/);
});

test('the problem list exposes only named difficulty levels', () => {
  assert.doesNotMatch(css, /\.level-all\b/);
  assert.doesNotMatch(html, /all-problems|level-all/);
  assert.doesNotMatch(app, /allButton|level-all/);
});

test('status rendering has filled, hollow, and neutral structural states', () => {
  assert.match(css, /\.status-none \{ display: grid; border-color: var\(--line\); color: var\(--muted\); \}/);
  assert.match(css, /\.status-current \{[^}]*background: var\(--success\)[^}]*color: var\(--accent-ink\)/);
  assert.match(css, /\.status-current-wrong \{[^}]*background: var\(--cf-red\)[^}]*color: var\(--accent-ink\)/);
  assert.match(css, /\.status-known, \.status-known-wrong \{[^}]*background: transparent[^}]*color: var\(--muted\)/);
  assert.match(app, /statusLabel\(status\)/);
  assert.match(app, /status === 'none' \? '—' : statusGlyph\(status\)/);
  assert.match(app, /current: t\('statusSolvedToday'\)/);
  assert.match(app, /'current-wrong': t\('statusTriedToday'\)/);
  assert.match(app, /known: t\('statusSolvedOtherDate'\)/);
  assert.match(app, /'known-wrong': t\('statusTriedOtherDate'\)/);
  assert.match(app, /none: t\('statusNotTried'\)/);
});

test('header and problem rows preserve title, rating, then status order', () => {
  assert.match(app, /header\.id = 'problem-headers'/);
  assert.match(app, /header\.append\(problem, difficulty, done\)/);
  assert.match(app, /row\.append\(problemCell, rating, statusCell\)/);
  assert.match(app, /header\.className = 'problem-grid problem-header'/);
  assert.match(app, /row\.classList\.add\('problem-grid'\)/);
  assert.match(css, /\.problem-grid \{ display: grid; grid-template-columns: var\(--problem-grid-columns\); column-gap: var\(--problem-grid-gap\); padding-right: var\(--problem-grid-inset\); \}/);
  assert.match(css, /\.problem-header-difficulty \{ grid-column: 2; text-align: right; \}/);
  assert.match(css, /\.problem-header-problem \{ grid-column: 1; text-align: left; \}/);
  assert.match(css, /\.problem-header-done \{ grid-column: 3; text-align: center; \}/);
  assert.match(css, /\.problem-cell \{ grid-column: 1 \/ 2; min-width: 0; \}/);
});

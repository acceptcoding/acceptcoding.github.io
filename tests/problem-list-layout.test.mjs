import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COPY } from '../js/i18n.js';

const [html, previous, css, app, i18n] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../previous.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/i18n.js', import.meta.url), 'utf8'),
]);

test('problem list has one canonical responsive three-column grid', () => {
  assert.match(css, /--problem-grid-columns: minmax\(0, 1fr\) 50px 44px/);
  assert.match(css, /--problem-grid-gap: 5px/);
  assert.doesNotMatch(css, /\.problem-header-done, \.problem-status \{ transform: translateX\(7px\); \}/);
  assert.match(css, /--problem-grid-columns: minmax\(0, 1fr\) 48px 44px/);
  assert.match(css, /\.problem-grid \{ display: grid; grid-template-columns: var\(--problem-grid-columns\); column-gap: var\(--problem-grid-gap\); padding-right: var\(--problem-grid-inset\); \}/);
  assert.match(css, /\.problem-header \{[^}]*padding: 0 var\(--problem-grid-inset\) 8px 0/);
  assert.match(css, /\.problem \{[^}]*padding: 9px var\(--problem-grid-inset\) 9px 0/);

  assert.match(app, /header\.className = 'problem-grid problem-header'/);
  assert.match(app, /row\.classList\.add\('problem-grid'\)/);
  assert.match(css, /\.problem-cell \{ grid-column: 1 \/ 2; min-width: 0; \}/);
  assert.match(css, /\.problem-status-cell \{ grid-column: 3; min-width: 0; \}/);
});

test('visible headers are concise while accessible labels stay expanded', () => {
  assert.deepEqual(Object.values(COPY).map(copy => [copy.problemHeaderDifficultyShort, copy.problemHeaderDifficulty]), [
    ['Rating', 'Dificuldade'],
    ['Rating', 'Codeforces rating'],
    ['Rating', 'Dificultad'],
  ]);
  assert.doesNotMatch(i18n, /problemHeaderDifficulty: 'Difficulty'|problemHeaderDifficulty: 'Dificuldade'[^,]*problemHeaderDifficultyShort: 'Dificuldade'/);
  assert.match(app, /cell\.setAttribute\('aria-label', full\)/);
  assert.match(css, /\.header-label-full \{ display: none; \}/);
  assert.match(css, /\.header-label-short \{ display: inline; \}/);
});

test('grid headings and row fields use the same logical alignment', () => {
  assert.match(css, /\.problem-header-difficulty \{ grid-column: 2; text-align: right; \}/);
  assert.match(css, /\.problem-header-problem \{ grid-column: 1; text-align: left; \}/);
  assert.match(css, /\.problem-header-done \{ grid-column: 3; text-align: center; \}/);
  assert.match(css, /\.rating \{ grid-column: 2;/);
  assert.match(css, /\.problem-cell \{ grid-column: 1 \/ 2; min-width: 0; \}/);
  assert.match(css, /\.problem-link \{[^}]*align-items: center/);
});

test('Daily has no calendar navigation and the footer has no timezone label', () => {
  assert.doesNotMatch(html, /class="week-side|id="week"|id="prev-week"|id="next-week"|id="today-link"/);
  assert.match(html, /class="daily-back"/);
  assert.doesNotMatch(`${html}${previous}${app}`, /UTC[−-]3|utc3/);
  assert.match(css, /\.week-row \{[^}]*grid-template-columns: 44px minmax\(0, 1fr\) 44px/);
  assert.match(css, /\.week-side \{[^}]*align-self: center/);
});

test('session row owns account and completion, with exact localized copy', () => {
  assert.match(html, /<div class="session-state">[\s\S]*id="profile"[\s\S]*id="completion-result"/);
  assert.ok(html.indexOf('class="identity"') < html.indexOf('class="session-state"'));
  assert.deepEqual(Object.values(COPY).map(copy => copy.completionDone), ['✓ Feito!', '✓ Done!', '✓ ¡Listo!']);
  assert.doesNotMatch(app, /profile-handle/);
  assert.match(app, /profile-metric/);
  assert.match(app, /profile-rank/);
  assert.match(app, /profile-rating/);
  assert.match(css, /\.session-state \{ display: flex;[^}]*justify-content: space-between/);
  assert.match(css, /\.profile \{[^}]*font-size: 14px/);
  assert.match(css, /\.completion-done \{ color: var\(--success\); \}/);
  assert.doesNotMatch(app, /completionNotYet/);
  assert.match(i18n, /goForIt: 'Bora!'|goForIt: 'Go for it!'|goForIt: '¡Dale!'/);
});

test('completion is not duplicated and unavailable verification stays neutral', () => {
  assert.equal((html.match(/id="completion-result"/g) || []).length, 1);
  assert.doesNotMatch(html, /context-description|translation-hint|data-i18n="description"|data-i18n="translationHint"/);
  assert.match(app, /result\?\.status === 'CHECKED'/);
  assert.match(app, /: '';/);
  assert.match(app, /statusUnavailable/);
});

test('homepage removes the secondary Codeforces help line', () => {
  assert.doesNotMatch(html, /class="help-line"|data-i18n="help(?:Lead|Codeforces|Tail)"/);
  assert.doesNotMatch(`${html}${i18n}`, /Treino diário com problemas do Codeforces|Daily practice with Codeforces problems|Práctica diaria con problemas de Codeforces|tradução integrada|built-in translation/);
});

test('problem link remains one title anchor and statuses retain semantics', () => {
  assert.match(app, /link\.append\(title\)/);
  assert.match(app, /row\.append\(problemCell, rating, statusCell\)/);
  assert.match(css, /\.status-current \{[^}]*background: var\(--success\)/);
  assert.match(css, /\.status-current-wrong \{[^}]*background: var\(--cf-red\)/);
  assert.match(css, /\.status-known, \.status-known-wrong \{[^}]*background: transparent/);
  assert.match(css, /\.status-none \{ display: grid; border-color: var\(--line\); color: var\(--muted\); \}/);
});

test('typography floors keep metadata readable at the default zoom', () => {
  assert.match(css, /body \{[^}]*font-size: 16\.5px/);
  assert.match(css, /\.problem-title \{[^}]*overflow-wrap: anywhere[^}]*font-size: 16px/);
  assert.match(css, /\.profile \{[^}]*font-size: 14px/);
  assert.match(css, /\.level \{[^}]*font-family: 'Roboto Condensed'[^}]*font-size: 12px[^}]*font-weight: 700/);
  assert.match(css, /\.level \{[^}]*flex: 1 1 0[^}]*min-width: max-content[^}]*min-height: 34px/);
  assert.match(css, /\.day \{[^}]*font-size: 13\.2px/);
  assert.match(css, /\.day \.weekday \{[^}]*font-size: 13\.2px/);
  assert.match(css, /\.problem-header \{[^}]*font-size: 13\.2px/);
  assert.match(css, /\.rating \{[^}]*font: 600 13\.2px/);

  assert.match(css, /footer \{[^}]*font-size: 13\.5px/);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|10(?:\.[0-9]+)?)(?:px|rem)/);
});

test('level strip remains a native horizontal scroller without text clipping', () => {
  assert.match(css, /\.levels \{[^}]*display: flex;[^}]*overflow-x: auto;[^}]*overflow-y: hidden;[^}]*padding: 0 0 5px;[^}]*scroll-padding-inline-end: 16px/);
  assert.match(css, /\.level \{[^}]*flex: 1 1 0[^}]*min-width: max-content[^}]*min-height: 34px[^}]*font-size: 12px/);
  assert.doesNotMatch(css, /\.levels \{[^}]*overflow: hidden/);
  assert.doesNotMatch(css, /\.level-navigation\.has-overflow/);
  assert.doesNotMatch(css, /@media[\s\S]*\.levels \{ display: grid/);
  assert.doesNotMatch(css, /\.levels \.level \{/);
});

test('expert level keeps its canonical identifier and visible meaning', () => {
  assert.match(app, /expert: 'expert'/);
  assert.match(app, /accessibleLevelLabel/);
  assert.deepEqual(Object.values(COPY).map(copy => copy.expertBucket), [
    'Expert e Candidate Master',
    'Expert and Candidate Master',
    'Expert y Candidate Master',
  ]);
  assert.match(app, /state\.level = level/);
  assert.doesNotMatch(app, /level === 'expert\+'/);
});

test('font delivery is local, licensed, and limited to first-paint preloads', async () => {
  const fonts = [
    'assets/fonts/roboto/roboto-latin-ext.woff2',
    'assets/fonts/roboto-condensed/roboto-condensed-latin-ext.woff2',
    'assets/fonts/roboto-mono/roboto-mono-latin-ext.woff2',
  ];
  for (const path of fonts) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', path);
    assert.ok(bytes.length > 1000, path);
  }
  const production = `${html}${previous}${css}`;
  assert.doesNotMatch(production, /fonts\.(?:googleapis|gstatic)\.com|@import[^;]*https?:/i);
  assert.ok(css.includes("font-family: 'Roboto';") && css.includes('font-weight: 100 900') && css.includes('font-display: swap'));
  assert.ok(css.includes("font-family: 'Roboto Condensed';") && css.includes('font-family: \'Roboto Mono\';'));
  assert.ok(html.includes('rel="preload" href="assets/fonts/roboto/roboto-latin-ext.woff2" as="font" type="font/woff2"'));
  assert.ok(html.includes('rel="preload" href="assets/fonts/roboto-condensed/roboto-condensed-latin-ext.woff2" as="font" type="font/woff2"'));
  assert.doesNotMatch(html, /rel="preload"[^>]+roboto-mono/);
  assert.ok(css.includes(".brand-name { color: var(--ink); font-family: 'Roboto Condensed'") && css.includes(".brand-club { margin-top: 3px; color: var(--accent); font-family: 'Roboto Condensed'") && css.includes(".brand-tagline { display: flex; min-width: 0; flex-direction: column") && css.includes(".intro { margin: 8px 0 16px; color: var(--ink); font-family: 'Roboto Condensed'"));
  assert.ok(css.includes("html { background: var(--bg); color: var(--ink); font-family: 'Roboto', system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"));
  assert.ok(css.includes("font: 600 13.2px/1.2 'Roboto Mono', ui-monospace"));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import * as core from '../core.js';
import { COPY, LANGUAGES } from '../js/i18n.js';
import { createLadderRepository } from '../js/ladder-repository.js';

const [html, css, app, storage, previous, howTo, codeforces, i18n, renderer] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/storage.js', import.meta.url), 'utf8'),
  readFile(new URL('../previous.html', import.meta.url), 'utf8'),
  readFile(new URL('../tools/templates/home-template.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/codeforces.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/i18n.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/problem-list-renderer.js', import.meta.url), 'utf8'),
]);

test('refined masthead and copy are singular and exact', async () => {
  assert.doesNotMatch(`${html}${app}`, /daily problems|problemas diarios|E aí\?|Ready for today's one|¿Ya hiciste/);
  assert.match(html, /aria-label="ACCEPT Coding Club"/);
  assert.match(html, /class="brand-club">CODING CLUB<\/span>/);
  assert.doesNotMatch(`${html}${previous}${i18n}`, /Algorithms, Code &amp; Competitions|Algoritmos, Código &amp; Competições|Algoritmos, Código y Competiciones/);
  assert.deepEqual(Object.values(COPY).map(copy => copy.tagline), ['Exercícios, Prática & Técnica', 'Everyday Practice & Training', 'Ejercicios, Práctica y Técnica']);
  assert.doesNotMatch(`${html}${i18n}`, /Treino diário com problemas do Codeforces|Daily practice with Codeforces problems|Práctica diaria con problemas de Codeforces|tradução integrada|built-in translation/);
  assert.match(html, /id="challenge-date"/);
  assert.match(html, /data-i18n="gameTitle"/);
  assert.deepEqual(Object.values(COPY).map(copy => copy.homeChallengesAction), ['Desafios anteriores', 'Previous challenges', 'Desafíos anteriores']);
  assert.ok(Object.values(COPY).every(copy => copy.helpHeading && copy.helpNote));
});

test('home hierarchy and guide translation instructions are explicit', () => {
  assert.doesNotMatch(html, /class="week-row"|id="week"|id="prev-week"|id="next-week"/);
  assert.match(html, /id="help"[\s\S]*data-i18n="howToHeading"/);
  assert.match(html, /class="help-popover"[\s\S]*class="help-steps"/);
  assert.match(html, /data-i18n="howToStep2Before"[\s\S]*data-i18n="howToStep4Item2"/);
  assert.match(html, /class="identity-kicker" role="status" aria-live="polite" data-i18n="handleLabel"/);
  assert.doesNotMatch(`${html}${app}${i18n}`, /problem-list-heading|problemListToday|problemListDatePrefix|renderProblemListHeading/);
  assert.match(html, /id="share-challenge"/);
  assert.match(html, /id="share-status"[^>]*role="status"/);
  assert.match(howTo, /<h1 id="how-to-title" data-i18n="howToHeading">Como usar o ACCEPT\?<\/h1>/);
  assert.doesNotMatch(howTo, /how-to-lead|howToLead|Three Codeforces problems each day\. Just solve one\.|Três problemas do Codeforces por dia\. É só fazer um\.|Tres problemas de Codeforces al día\. Solo tienes que resolver uno\./);
  assert.ok(Object.values(COPY).every(copy => !('howToLead' in copy)));
  assert.equal((howTo.match(/<ol class="how-to-steps">/g) || []).length, 1);
  assert.equal((howTo.match(/<ul>/g) || []).length, 3);
  assert.doesNotMatch(`${howTo}${i18n}`, /howToStep1|Data e nível|Date and level|Fecha y nivel/);
  assert.match(howTo, /data-i18n="howToStep2Before"[\s\S]*data-i18n="howToStep2After"[\s\S]*data-i18n="howToStep2Item2"/);
  assert.deepEqual(Object.values(COPY).map(copy => [copy.howToStep2Title, copy.howToStep2After]), [
    ['Enunciado do problema', '.'],
    ['Problem statement', '.'],
    ['Enunciado del problema', '.'],
  ]);
});

test('shared balloon asset is linked as the favicon and masthead', async () => {
  await access(new URL('../balloon.svg', import.meta.url));
  await access(new URL('../balloon-shape.svg', import.meta.url));
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="balloon\.svg\?wordmark-pass-2">/);
  assert.match(html, /<img class="balloon-icon" src="balloon-shape\.svg\?wordmark-pass-3"/);
  assert.equal((html.match(/balloon\.svg/g) || []).length, 1);
});

test('reload remains a submit icon button with localized accessible states', () => {
  const button = html.slice(html.indexOf('id="sync-handle"'), html.indexOf('</button>', html.indexOf('id="sync-handle"')));
  assert.match(button, /class="icon-button"/);
  assert.match(button, /type="submit"/);
  assert.match(button, /<svg/);
  assert.doesNotMatch(button, />\s*(Usar|Atualizar|Use|Refresh|Actualizar)\s*</);
  assert.match(app, /state\.syncing \? t\(state\.syncKind === 'refresh' \? 'syncRefreshing' : 'syncLoading'\)/);
  assert.match(app, /button\.setAttribute\('aria-label', label\)/);
  assert.match(app, /button\.disabled = state\.syncing/);
});

test('theme and language preference changes are local and preserve data state', () => {
  assert.doesNotMatch(app, /location\.reload/);
  assert.match(app, /persistenceDecision\('language', language\)/);
  assert.match(app, /persistenceDecision\('theme', choice\)/);
  assert.match(storage, /localStorage\?\.setItem/);
  const localized = app.slice(app.indexOf('function renderLocalizedState'), app.indexOf('\nfunction renderHome()'));
  assert.doesNotMatch(localized, /loadLadder|problemsetProblems|contestsBefore|userInfo|userStatus|state\.ladder\s*=/);
  assert.match(localized, /renderWeek\(\); renderLevels\(\); renderLadder\(\);/);
  assert.match(app, /state\.ladder/);
  assert.match(app, /state\.verification/);
});

test('loading and date presentation have explicit accessible behavior', () => {
  assert.match(`${html}${app}${i18n}`, /Carregando problemas\.\.\.|Loading problems\.\.\.|Cargando problemas\.\.\./);
  assert.match(app, /className = 'loader'/);
  assert.match(app, /setAttribute\('aria-busy', 'true'\)/);
  assert.match(css, /\.loader \{/);
  assert.match(css, /\.loader, \.icon-button\.is-loading svg \{ animation: none; \}/);
  assert.doesNotMatch(html, /id="date-label"/);
  assert.match(app, /Intl\.DateTimeFormat\(currentLanguage\(\), \{ month: 'short'/);
  assert.match(app, /<small>\$\{monthLabel\(date\)\}<\/small>/);
  assert.match(app, /weekday: 'long'/);
  assert.match(css, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
});

test('week order and month/year boundary inputs remain deterministic', () => {
  assert.equal(core.sundayStart('2026-09-02'), '2026-08-30');
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => core.shiftDate('2026-08-30', index)), ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => core.shiftDate('2026-12-27', index)), ['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.match(app, /date === state\.today/);
  assert.match(app, /date === state\.date/);
});

test('all routes use the constant browser tab title', () => {
  for (const page of [html, previous, howTo]) assert.match(page, /<title>ACCEPT Coding Club<\/title>/);
  assert.match(app, /const DOCUMENT_TITLE = 'ACCEPT Coding Club'/);
  assert.match(app, /document\.title = DOCUMENT_TITLE/);
  assert.match(`${html}${previous}${howTo}`, /document\.title='ACCEPT Coding Club'/);
  assert.doesNotMatch(`${html}${app}`, /🐴 ACCEPT/);
  assert.match(app, /updateDocumentTitle\(\);/);
});

test('canonical level vocabulary and visible presentation are singular', () => {
  assert.match(app, /special: 'special'/);
  assert.match(app, /accessibleLevelLabel/);
  assert.doesNotMatch(`${html}${app}${i18n}`, /div\.4|div\.3|div\.2|div\.1/);
  assert.doesNotMatch(html, /launch|2026-09-07/);
  assert.doesNotMatch(html, /class="help-line"|data-i18n="help(?:Lead|Codeforces|Tail)"/);
  assert.doesNotMatch(`${html}${i18n}`, /context-description|translation-hint|data-i18n="description"|data-i18n="translationHint"/);
});

test('canonical wordmark is a plain balloon beside the two-line text lockup', () => {
  for (const page of [html, previous]) {
    assert.match(page, /aria-label="ACCEPT Coding Club"/);
    assert.match(page, /class="balloon-icon"[^>]+alt=""/);
    assert.match(page, /class="brand-name">ACCEPT<\/span>/);
    assert.match(page, /class="brand-club">CODING CLUB<\/span>/);
    assert.doesNotMatch(page, /brand-a|wordmark-rest/);
  }
  assert.match(css, /--brand-name-size: 25px/);
  assert.match(css, /--brand-club-size: 14px/);
  assert.match(css, /\.brand-name \{[^}]*font-family: 'Roboto Condensed'[^}]*font-size: var\(--brand-name-size\)[^}]*font-weight: 700/);
  assert.match(css, /\.brand-club \{[^}]*font-size: var\(--brand-club-size\)[^}]*font-weight: 600/);
  assert.match(css, /\.brand-block \{ display: grid; grid-template-columns: var\(--brand-balloon-width\) max-content; column-gap: var\(--brand-lockup-gap\)/);
  assert.match(css, /\.brand-tagline \{[^}]*font-family: 'Roboto Condensed'[^}]*font-size: 12\.5px[^}]*line-height: 1\.15/);
  assert.doesNotMatch(css, /\.wordmark span/);
  assert.match(i18n, /tagline:/);
});

test('balloon assets are flat standalone icons with one optional highlight', async () => {
  for (const asset of ['balloon.svg', 'balloon-shape.svg']) {
    const svg = await readFile(new URL(`../${asset}`, import.meta.url), 'utf8');
    assert.doesNotMatch(svg, /letter-a|<text|>A<\/text>/i);
    assert.doesNotMatch(svg, /linearGradient|radialGradient|filter=/);
    assert.equal((svg.match(/class="highlight"/g) || []).length, 1);
    assert.match(svg, /class="balloon"/);
    assert.match(svg, /class="knot"/);
  }
});

test('identity copy is left-aligned and generic focus uses teal without amber leakage', () => {
  assert.match(html, /class="brand-block"/);
  assert.match(css, /\.identity \{ position: relative; z-index: 2; margin: 0 0 18px; text-align: left; \}/);
  assert.match(css, /\.help-line \{[^}]*font-size: 13\.8px[^}]*text-align: center;/);
  assert.match(css, /\.masthead \{ position: relative; display: flex; width: min\(100%, 500px\); align-items: center; justify-content: center;/);
  assert.match(css, /\.masthead \{[^}]*margin-bottom: 14px/);
  assert.match(css, /\.handle-row input:focus \{ border-color: var\(--accent\); outline: none; box-shadow: none; \}/);
  assert.match(css, /\.handle-row input:focus-visible \{ outline: 1px solid var\(--accent\); outline-offset: 0; \}/);
  assert.match(css, /\.brand-tagline \{[^}]*display: flex[^}]*flex-direction: column/);
  assert.match(css, /--focus-ring: #0f766e/);
  assert.match(css, /:focus-visible \{ outline: 3px solid var\(--focus-ring\)/);
  assert.match(css, /--focus-ring: #66d1c5/);
  assert.doesNotMatch(css, /--focus:|outline: 3px solid var\(--focus\)|#a45b00/);
  assert.doesNotMatch(css, /\.level:hover,\.level:focus-visible/);
});

test('level state uses provenance instead of the selected string alone', () => {
  assert.match(app, /levelProvenance: core\.LEVEL_PROVENANCE\.DEFAULT/);
  assert.match(app, /state\.levelProvenance === core\.LEVEL_PROVENANCE\.MANUAL/);
  assert.match(app, /state\.levelProvenance === core\.LEVEL_PROVENANCE\.INFERRED/);
  assert.match(app, /state\.levelProvenance/);
  assert.doesNotMatch(app, /explicitLevel/);
});

test('theme control exposes light and dark choices with localized labels', () => {
  assert.match(app, /function effectiveTheme\(\)/);
  assert.match(app, /THEME_CHOICES = Object\.freeze\(\['light', 'dark'\]\)/);
  assert.match(app, /function themePreference\(\)/);
  assert.match(app, /persistenceDecision\('theme', choice\)/);
  assert.match(app, /function themeOptionIcon\(theme\)/);
  assert.match(app, /function paletteIcon\(\)/);
  assert.match(app, /function renderThemeControl\(preference = themePreference\(\)\)/);
  assert.match(app, /button\.setAttribute\('aria-pressed', String\(choice === preference\)\)/);
  assert.match(app, /document\.documentElement\.style\.colorScheme = theme/);
  assert.match(app, /themeDark/);
  assert.match(html, /class="challenge-heading"[\s\S]*id="share-challenge"/);
  assert.doesNotMatch(html, /<div class="game-actions">/);
  for (const page of [html, previous, howTo]) {
    assert.match(page, /data-theme-choice="light"/);
    assert.match(page, /data-theme-choice="dark"/);
    assert.doesNotMatch(page, /data-theme-choice="system"/);
    assert.deepEqual([...page.matchAll(/data-theme-choice="(light|dark)"/g)].map(([, choice]) => choice), ['light', 'dark']);
  }
  assert.deepEqual([COPY.pt.themeLight, COPY.pt.themeDark], ['Claro', 'Escuro']);
  assert.deepEqual([COPY.en.themeLight, COPY.en.themeDark], ['Light', 'Dark']);
  assert.deepEqual([COPY.es.themeLight, COPY.es.themeDark], ['Claro', 'Oscuro']);
});

test('locale bootstrap and runtime use exact language codes and primary-language fallback', () => {
  for (const page of [html, previous, howTo]) {
    assert.match(page, /<html lang="en">/);
    assert.match(page, /navigator\.languages&&navigator\.languages\[0\]/);
    assert.doesNotMatch(page, /l==='pt'\?'pt-BR'/);
  }
  assert.doesNotMatch(app, /pt-BR/);
  assert.match(app, /document\.documentElement\.lang = language/);
});

test('latest handle intent can supersede a different in-flight request', () => {
  assert.match(app, /syncTarget: ''/);
  assert.match(app, /if \(state\.syncing && normalized === state\.syncTarget\) return false/);
  assert.match(app, /createAccountSync/);
  assert.match(app, /accountSync\.syncHandle\(value\)/);
  assert.match(app, /createAccountSync/);
  assert.match(app, /accountSync\.syncHandle\(value\)/);
});

test('daily ladder cache is versioned, session-backed, lazy, and failure-safe', async () => {
  assert.match(app, /createLadderRepository/);
  assert.doesNotMatch(app, /RUNTIME_CORPUS|CANONICAL_HISTORY_MANIFEST|function validLadder/);
  assert.match(storage, /sessionStorage\?\.getItem/);
  assert.match(storage, /sessionStorage\?\.setItem/);
  assert.doesNotMatch(app, /accept-daily-selection-v2/);
  const values = new Map();
  const repository = createLadderRepository({
    readSessionValue(key, fallback) { return values.get(key) ?? fallback; },
    writeSessionValue(key, value) { values.set(key, value); },
  });
  const ladder = await repository.resolve('2026-09-09', '2026-09-10');
  assert.equal(ladder.length, core.LADDER_SIZE);
  assert.deepEqual(await createLadderRepository({
    readSessionValue(key, fallback) { return values.get(key) ?? fallback; },
    writeSessionValue() { throw new Error('cached ladder should not be rewritten'); },
  }).resolve('2026-09-09', '2026-09-10'), ladder);
});

test('shared Codeforces catalog promises reuse success and retry failures', () => {
  assert.match(codeforces, /let problemsetPromise/);
  assert.match(codeforces, /let contestsPromise/);
  assert.match(codeforces, /return problemsetPromise/);
  assert.match(codeforces, /return contestsPromise\.then/);
  assert.match(codeforces, /problemsetPromise = undefined/);
  assert.match(codeforces, /contestsPromise = undefined/);
});

test('problem resource uses one link and excludes rating/status', () => {
  assert.match(app, /const link = document\.createElement\('a'\); link\.className = 'problem-link'/);
  assert.match(renderer, /link\.append\(id, title\)/);
  assert.match(app, /row\.append\(problemCell, rating, statusCell\)/);
  assert.doesNotMatch(app, /link\.title = t\('official'\)/);
  assert.match(css, /\.problem-link:hover \.problem-title/);
  assert.match(css, /\.problem-link:focus-visible/);
});

test('help close restores focus and theme control is content-sized', () => {
  assert.match(app, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*help\.open = false/);
  assert.match(css, /\.theme-control \.preference-trigger \{[^}]*width: auto;[^}]*justify-content: flex-start;[^}]*gap: 5px;/);
  assert.doesNotMatch(css, /\.theme-control \.preference-trigger \{[^}]*width: 70px/);
});

test('date navigation and history micro-UX remain focused', () => {
  assert.doesNotMatch(html, /class="week-side|id="prev-week"|id="next-week"|id="today-link"/);
  assert.match(html, /class="daily-back" id="daily-back"[\s\S]*data-i18n-aria="homeNav"/);
  assert.match(app, /back\.href = routePath\(language, 'challenges'\);[\s\S]*sameOriginReferrer = Boolean\(document\.referrer[\s\S]*history\.back\(\)/);
  assert.match(app, /resolveLanguage\(\{[\s\S]*routeLanguage: parseRoute\(location\.pathname\)\.language,[\s\S]*storedLanguage: readLocal\('accept-language'\)/);
  assert.match(app, /window\.addEventListener\('pageshow',[\s\S]*applyPrefs\(\);[\s\S]*renderLocalizedState\(\)/);
  assert.match(app, /onPopstate: \(\) => \{ applyPrefs\(\); renderHome\(\); \}/);
  assert.match(app, /onLanguageChange: \(language\) => \{[\s\S]*history\.replaceState\(\{\}, '', `\$\{target\.pathname\}/);
  assert.doesNotMatch(app, /onLanguageChange: \(language\) => \{[\s\S]*history\.pushState/);

  assert.doesNotMatch(previous, /class="eyebrow"/);
  assert.match(previous, /class="calendar-page-head"/);
  assert.match(previous, /calendar-shell/);
  assert.doesNotMatch(previous, /class="calendar-today"/);
  assert.doesNotMatch(previous, /class="back"|class="history-brand"/);
  assert.doesNotMatch(css, /\.eyebrow/);
  assert.match(app, /configureWeekButton/);
  assert.match(app, /core\.weekNavigationTarget\(state\.date, -1, state\.today\)/);
  assert.match(app, /core\.weekNavigationTarget\(state\.date, 1, state\.today\)/);
  assert.match(app, /todayLink\.onclick = \(\) => \{ if \(state\.date !== state\.today\) navigate\(state\.today\); \}/);
  assert.match(css, /\.day\.today:not\(\.current\)::after \{[^}]*width: 5px; height: 5px; border-radius: 50%; background: var\(--accent\)/);
  assert.doesNotMatch(css, /\.day\.today:not\(\.current\)::after \{[^}]*border-top/);
});

test('brand and every training level own explicit semantic color tokens', () => {
  assert.match(css, /--accent: #0f766e/);
  assert.match(css, /--cf-gray: #626b70/);
  assert.match(css, /--cf-green: #2f8648/);
  for (const level of ['newbie', 'pupil', 'special', 'expert', 'master', 'legend']) {
    assert.match(css, new RegExp(`\\.level-${level} \\{ --level-fg:`));
    assert.match(css, new RegExp(`\\.level-${level} \\{[^}]*--level-soft:`));
    assert.match(css, new RegExp(`\\.level-${level} \\{[^}]*--level-edge:`));
    assert.match(css, new RegExp(`\\.level-${level} \\{[^}]*--level-hover:`));
  }
  assert.doesNotMatch(css, /level-div[1-4]|level-accent/);
});

test('problem ratings distinguish Legendary Grandmaster from ordinary red', () => {
  assert.match(css, /--cf-legendary: #c1122f/);
  assert.match(css, /--cf-legendary: #ff756f/);
  assert.match(css, /\.rating-legendary \{ color: var\(--cf-legendary\); \}/);
  assert.match(app, /rating-\$\{core\.codeforcesRatingCategory\(problem\.rating\)\}/);
});

test('completion feedback is not rendered under the handle control', () => {
  assert.match(html, /class="session-state"/);
  assert.doesNotMatch(`${html}${css}`, /completion-result|class="completion"|\.completion-done/);
  assert.doesNotMatch(html, /id="verify"/);
});

test('guide and account controls preserve the requested scale and alignment', () => {
  assert.match(css, /\.how-to-link a \{ font-size: 16px; font-weight: 700; \}/);
  assert.match(css, /\.how-to-return \{[^}]*font-size: 16px/);
  assert.match(css, /\.back-link \{[^}]*font-size: 16px[^}]*font-weight: 700/);
  assert.match(css, /\.how-to-steps ul \{[^}]*padding-left: 10px[^}]*font-size: 13\.5px[^}]*line-height: 1\.32/);
  assert.match(css, /\.how-to-steps ul li \{ padding-left: 0; \}/);
  assert.match(css, /\.masthead \{ position: relative; display: flex; width: min\(100%, 500px\); align-items: center; justify-content: center;/);
  assert.match(css, /\.handle-row input \{[^}]*font-size: 15px/);
  assert.match(app, /COPY\[currentLanguage\(\)\]\[key\] \?\? key/);
});

test('calendar and footer converge with the main page', () => {
  assert.match(previous, /class="brand-block"/);
  assert.match(previous, /class="calendar-page-head"/);
  assert.match(previous, /calendar-shell/);
  assert.match(previous, /id="calendar-title"/);
  assert.doesNotMatch(previous, /class="calendar-today"/);
  for (const page of [html, previous, howTo]) {
    assert.match(page, /<footer><span class="footer-copyright">© ACCEPT Group — 2026<\/span>/);
    assert.match(page, /class="github-link" href="https:\/\/github\.com\/acceptcoding"/);
    assert.match(page, /class="github-icon"[^>]+aria-hidden="true"/);
    assert.match(page, />GitHub<\/span><\/a><\/footer>/);
  }
  const githubPaths = [html, previous, howTo].map(page => page.match(/class="github-icon"[^>]*><path d="([^"]+)"/)?.[1]);
  assert.equal(new Set(githubPaths).size, 1);
  assert.doesNotMatch(html, /2026-09-07|Previous days calendar|Calendário de dias anteriores/);
  assert.match(previous, /Desafios anteriores|Previous challenges/);
});

test('Coding Club uses parallel compact accessible preference disclosures', () => {
  assert.doesNotMatch(`${html}${previous}`, /<select\b|language-picker|role="menu"/);
  assert.equal((html.match(/<details class="preference-menu language-control"/g) || []).length, 1);
  assert.equal((html.match(/<details class="preference-menu theme-control"/g) || []).length, 1);
  assert.match(html, /<summary class="preference-trigger"[^>]+aria-expanded="false"[^>]*><span class="language-icon"/);
  assert.match(html, /<summary class="preference-trigger"[^>]+aria-expanded="false"[^>]*><span class="theme-current-icon">/);
  assert.match(html, /aria-controls="language-options"/);
  assert.match(html, /aria-controls="theme-options"/);
  assert.equal((html.match(/class="language-option"/g) || []).length, 3);
  assert.equal((html.match(/class="theme-option"/g) || []).length, 2);
  assert.match(html, /data-language="pt"[^>]+aria-label="Português"[^>]+aria-pressed="true"/);
  assert.match(html, /data-language="en"[^>]+aria-label="English"[^>]+aria-pressed="false"/);
  assert.match(html, /data-language="es"[^>]+aria-label="Español"[^>]+aria-pressed="false"/);
  assert.match(html, /data-theme-choice="light"[^>]+aria-pressed="false"/);
  assert.match(html, /data-theme-choice="dark"[^>]+aria-pressed="false"/);
  assert.doesNotMatch(html, /data-theme-choice="system"/);
  assert.match(app, /LANGUAGES\.includes\(language\)/);
  assert.match(app, /querySelectorAll\('\.language-option'\)/);
  assert.match(app, /button\.setAttribute\('aria-pressed', String\(option === language\)\)/);
  assert.match(app, /querySelectorAll\('\.preference-menu'\)/);
  assert.match(app, /event\.key !== 'Escape'/);
  assert.match(app, /if \(!menu\.contains\(event\.target\)\) \{ menu\.open = false; syncExpanded\(menu\); \}/);
  assert.match(css, /\.preference-menu \{ position: relative; flex: 0 0 auto; \}/);
  assert.match(css, /\.preference-trigger \{[^}]*list-style: none/);
  assert.match(css, /\.language-control \.preference-options \{ right: auto; left: 0; min-width: 0; width: max-content; \}/);
  assert.match(css, /\.preference-trigger:focus-visible, \.preference-options button:focus-visible/);
  assert.ok(Object.values(COPY).every(copy => copy.languageCurrent));
});

test('preference chevrons use the same valid down-arrow path on every route', () => {
  for (const page of [html, previous, howTo]) {
    assert.match(page, /<svg class="preference-chevron"[^>]*><path d="m6 9 6 6 6-6"\/><\/svg>/);
    assert.doesNotMatch(page, /m6 9 6 6-6-6/);
  }
});

test('both pages use a progressive first-paint shell and pre-paint theme bootstrap', () => {
  for (const page of [html, previous]) {
    assert.match(page, /<style id="critical-shell">/);
    assert.match(page, /localStorage\.getItem\('accept-theme'\)/);
    assert.doesNotMatch(app, /prefers-color-scheme: dark/);
    assert.match(page, /language-pending \.theme-current-icon\{visibility:hidden\}/);
    assert.match(page, /<link rel="stylesheet" href="styles\.css\?v=ui-polish-56">/);
    assert.doesNotMatch(page, /body\s*\{[^}]*?(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)/);
    assert.ok(page.includes('rel="preload" href="assets/fonts/roboto/roboto-latin-ext.woff2"'));
  }
  assert.doesNotMatch(css, /^\s*@import/m);
  assert.doesNotMatch(`${html}${previous}`, /fonts\.(?:googleapis|gstatic)\.com/);
});

test('all routes invalidate module cache and identify the guide before first paint', () => {
  for (const page of [html, previous, howTo]) {
    assert.match(page, /<script type="module" src="js\/app\.js\?v=ladder-v27-preferences-history"><\/script>/);
    assert.match(page, /document\.title='ACCEPT Coding Club'/);
  }
    assert.match(app, /core\.js\?v=ladder-v17-feature-wave/);
  assert.match(app, /i18n\.js\?v=ui-polish-33/);
  assert.match(app, /codeforces\.js\?v=ui-polish-29/);
  assert.doesNotMatch(`${html}${previous}${howTo}`, /h\?'How to use ACCEPT\?'/);
});

test('historical failures are unavailable rather than empty-level results', () => {
  assert.deepEqual(Object.values(COPY).map(copy => copy.historicalUnavailable), [
    'Não foi possível carregar os problemas desta data.',
    'Could not load problems for this date.',
    'No se pudieron cargar los problemas de esta fecha.',
  ]);
  assert.match(app, /state\.ladderError && state\.date < state\.today \? t\('historicalUnavailable'\)/);
});

test('previous dates do not render a submission-date notice', () => {
  assert.doesNotMatch(app, /historicalPrefix/);
  for (const copy of Object.values(COPY)) assert.equal(copy.historicalPrefix, undefined);
});

test('non-Daily user-facing pages establish language state and localize footer navigation', async () => {
  const daily = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(daily, /class="footer-links"|level-scroll-hint|id="level-explanation"/);
  const pages = [await readFile(new URL('../previous.html', import.meta.url), 'utf8')];
  for (const page of pages) {
    assert.match(page, /document\.documentElement\.dataset\.language=l/);
    const footer = page.match(/<footer>[\s\S]*?<\/footer>/)?.[0] || '';
    assert.doesNotMatch(footer, /class="footer-links"/);
  }
});

test('calendar completion state is part of the date button accessible name', () => {
  assert.match(app, /const historyLabel = hasSelectableHistory \? `, \$\{completionForDate\(historyHandle, date\) \? t\('dayAcRecorded'\) : t\('dayNoRecordedAc'\)\}` : ''/);
  assert.match(app, /button\.setAttribute\('aria-label', `\$\{fullDateText\(date\)\}/);
});

test('calendar uses one year-centered selector and readable month options', () => {
  assert.match(app, /\$\('#month-label'\)\.textContent = monthPicker\?\.hidden === false \? String\(year\) : monthName\(monthKey\)/);
  assert.doesNotMatch(app, /month-picker-year-button/);
  assert.match(app, /if \(date === initial && date !== today\) \{ dateElement\.classList\.add\('selected'\)/);
  assert.match(css, /\.month-option \{[^}]*min-height: 44px[^}]*font-size: 16px/);
  assert.match(css, /\.month-picker-toggle \{[^}]*font: 600 15px\/1\.2 Roboto/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from '../core.js';
import { COPY } from '../js/i18n.js';

const [html, previous, css, app, persistence, accountSync, accountRenderer] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../previous.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/persistence.js', import.meta.url), 'utf8'),
  readFile(new URL('../application/account-sync.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/account-renderer.js', import.meta.url), 'utf8'),
]);

for (const [name, page] of [['index', html], ['previous', previous]]) {
  test(`${name} uses one stable three-part brand lockup`, () => {
    assert.match(page, /class="brand-lockup"/);
    assert.match(page, /class="brand-block"[^>]*aria-label="ACCEPT Coding Club"/);
    assert.match(page, /class="balloon-icon"[^>]+alt=""/);
    assert.match(page, /class="brand-name">ACCEPT<\/span>/);
    assert.match(page, /class="brand-club">CODING CLUB<\/span>/);
    assert.match(page, /class="brand-divider"[^>]*aria-hidden="true"/);
    assert.equal((page.match(/class="brand-tagline-line"/g) || []).length, 3);
    assert.doesNotMatch(page, /class="brand-tagline"[^>]*>[^<]*\|/);
    assert.doesNotMatch(page, /<text|letter-a|brand-a|>A<\/text>/i);
  });
}

test('EPT line structures are exact in PT, EN, and ES', () => {
  assert.deepEqual(Object.values(COPY).map(copy => [copy.taglineLine1, copy.taglineLine2, copy.taglineLine3]), [
    ['Exercícios,', 'Prática &', 'Técnica'],
    ['Everyday', 'Practice &', 'Training'],
    ['Ejercicios,', 'Práctica y', 'Técnica'],
  ]);
});

test('legendary handle overlay is visible when populated', () => {
  assert.match(css, /\.handle-display \{[\s\S]*display: none/);
  assert.match(css, /\.handle-display\.is-visible \{ display: flex; \}/);
  assert.match(css, /\.handle-row\.rank-legendary \.handle-display-rest/);
});

test('loaded account projection is owner-gated and never repeats the handle', () => {
  assert.match(app, /loadedHandle: ''/);
  assert.match(app, /function loadedProjectionHandle\(\)/);
  assert.match(app, /if \(!state\.profile \|\| !loadedProjectionHandle\(\)\) \{/);
  assert.match(app, /profile-placeholder/);
  assert.match(app, /const metric = document\.createElement\('span'\); metric\.className = 'profile-metric'/);
  assert.doesNotMatch(app, /profile-handle/);
  assert.match(app, /function verificationForSelectedDate\(\) \{ const handle = loadedProjectionHandle\(\)/);
  assert.match(app, /knownActivityForHandle\(loadedProjectionHandle\(\)\)/);
});

test('recent handle history is local, successful-sync-only, and keyboard-addressable', () => {
  assert.match(html, /aria-autocomplete="list" aria-controls="handle-suggestions" aria-expanded="false"/);
  assert.match(html, /id="handle-suggestions" role="listbox"/);
  assert.match(html, /id="clear-recent-handles"[^>]*type="button"/);
  assert.deepEqual(Object.values(COPY).map(copy => copy.clearRecentHandles), ['Limpar handles recentes', 'Clear recent handles', 'Limpiar handles recientes']);
  assert.match(persistence, /RECENT_HANDLES_STORAGE_KEY = 'accept-recent-handles-v1'/);
  assert.match(persistence, /MAX_RECENT_HANDLES = 12/);
  assert.match(persistence, /function readRecentHandles\(\)/);
  assert.match(persistence, /function rememberRecentHandle\(handle\)/);
  assert.match(persistence, /function recentHandleMatches\(value\)/);
  assert.match(persistence, /startsWith\(query\)/);
  assert.match(persistence, /lastUsed/);
  assert.match(accountSync, /const canonicalHandle = String\(user\.handle \|\| displayHandle\)\.trim\(\)/);
  assert.match(app, /state\.handle/);
  assert.match(app, /rememberRecentHandle: \(handle\) => persistence\.rememberRecentHandle\(handle\)/);
  assert.match(app, /event\.key === 'ArrowDown'/);
  assert.match(app, /event\.key === 'ArrowUp'/);
  assert.match(app, /event\.key === 'Escape'/);
  assert.match(app, /async function syncHandle\(handleValue\) \{[\s\S]*accountSync\.syncHandle\(value\)/);
  assert.match(app, /chooseRecentHandle\(options\[suggestionIndex\]\.dataset\.handle\)/);
  assert.match(app, /function clearRecentHandles\(\)/);
  assert.match(app, /function renderHandleSuggestions\(\) \{[\s\S]*box\.replaceChildren\(\); suggestionIndex = -1; input\.removeAttribute\('aria-activedescendant'\)/);
  assert.match(app, /persistence\.clearRecentHandles\(\)/);
  assert.match(app, /\$\('#clear-recent-handles'\)\?\.addEventListener\('click', clearRecentHandles\)/);
  assert.match(app, /rememberRecentHandle: \(handle\) => persistence\.rememberRecentHandle\(handle\)/);
  const inputHandler = app.slice(app.indexOf("handle.addEventListener('input'"), app.indexOf("form.addEventListener('submit'"));
  assert.doesNotMatch(inputHandler, /userInfo|userStatus|fetch|syncHandle/);
});

test('unrated accounts use the official rank name in every language', () => {
  assert.deepEqual(Object.values(COPY).map(copy => [copy.ratingPlaceholder, copy.unrated]), [['—', 'unrated'], ['—', 'unrated'], ['—', 'unrated']]);
  assert.match(app, /const hasRating = ratingValue !== undefined && ratingValue !== null && ratingValue !== '' && Number\.isFinite\(Number\(ratingValue\)\)/);
  assert.match(app, /if \(!hasRating\) \{[\s\S]*status\.className = `profile-rank profile-unrated`/);
  assert.match(app, /status\.textContent = rankName/);
  assert.match(app, /metric\.append\(status, document\.createTextNode\('\ · '\), rating\)/);
  assert.doesNotMatch(app, /rating\.textContent = '\-\-\-'/);
  assert.doesNotMatch(app, /state\.profile\.rating \?\? '—'/);
});

test('empty account state has a neutral rating metric without leaking loaded data', () => {
  assert.deepEqual(Object.values(COPY).map(copy => [copy.ratingLabel, copy.ratingPlaceholder]), [['rating', '—'], ['rating', '—'], ['rating', '—']]);
  assert.match(app, /profile-placeholder/);
  assert.match(app, /label\.className = 'profile-rating-label'; label\.textContent = t\('ratingLabel'\)/);
  assert.match(app, /metric\.append\(label, document\.createTextNode\('\ · '\), rating\)/);
  assert.match(app, /ratingPlaceholder/);
  assert.match(app, /if \(!state\.profile \|\| !loadedProjectionHandle\(\)\) \{/);
});

test('profile lookup failures replace the neutral metric with a localized error', () => {
  assert.match(app, /syncError: ''/);
  assert.match(app, /metric\.className = 'profile-metric profile-error'/);
  assert.match(app, /metric\.setAttribute\('role', 'status'\)/);
  assert.match(app, /state\.syncError = patch\.syncError\?\.code === 'HANDLE_NOT_FOUND' \? 'handleNotFound' : 'apiError'/);
  assert.match(app, /state\.identityStatus = 'accountDataError'; renderProfile\(\); renderCompletion\(\)/);
  assert.match(css, /\.profile-metric\.profile-error \{[^}]*display: inline-block[^}]*color: var\(--cf-red\)[^}]*white-space: normal/);
  assert.deepEqual(Object.values(COPY).map(copy => copy.handleNotFound), [
    'Handle não encontrado. Confira a grafia e tente novamente.',
    'Handle not found. Check the spelling and try again.',
    'No se encontró el handle. Comprueba la escritura e inténtalo de nuevo.',
  ]);
});

test('account metrics show the regular rank before the rating value', () => {
  assert.match(app, /const rating = document\.createElement\('span'\); rating\.className = 'profile-rating'; rating\.textContent = ratingValue/);
  assert.match(app, /const rankText = document\.createElement\('span'\); rankText\.className = 'profile-rank'/);
  assert.match(app, /metric\.append\(rankText, document\.createTextNode\('\ · '\), rating\)/);
  assert.match(css, /\.profile-rank \{ display: inline-block; font-weight: 500; \}/);
  assert.match(css, /\.handle-row\[class\*='rank-'\]:not\(\.rank-unknown\):not\(\.rank-unrated\) input \{[^}]*color: var\(--handle-rank-text, var\(--ink\)\)/);
  assert.match(css, /\.session-state\.is-empty \{[^}]*min-height: 30px[^}]*visibility: hidden/);
  assert.match(css, /\.profile-metric \{[^}]*display: inline-flex[^}]*gap: 6px[^}]*padding: 5px 10px[^}]*border: 1px solid var\(--line\)[^}]*background: var\(--soft\)/);
});

test('footer is split left and right on mobile and refresh motion is clockwise', () => {
  assert.match(css, /footer \{ display: flex; align-items: center; justify-content: space-between;/);
  assert.match(css, /footer \{[^}]*margin-top: 18px/);
  assert.match(css, /\.footer-copyright \{ white-space: nowrap; \}/);
  assert.match(css, /\.github-link \{ display: inline-flex; align-items: center;/);
  assert.match(css, /\.session-state \{ display: flex; flex-wrap: nowrap;/);
  assert.doesNotMatch(css, /\.session-state:not\(\.is-empty\) \{ display: grid; grid-template-columns: 1fr;/);
  assert.doesNotMatch(css, /footer \{ display: block; \}/);
  assert.match(css, /\.icon-button\.is-loading svg \{ animation: spin \.9s linear infinite; \}/);
  assert.match(css, /@keyframes spin \{ to \{ transform: rotate\(360deg\); \} \}/);
});

test('rank colors and bold handle names are applied only to loaded rated handles', async () => {
  assert.match(app, /from '..\/application\/account-view-model\.js'/);
  const accountViewModel = await readFile(new URL('../application/account-view-model.js', import.meta.url), 'utf8');
  assert.match(accountViewModel, /mikemirzayanov: 'Headquarters'/);
  assert.match(accountViewModel, /if \(value === 'tourist' \|\| Number\.isFinite\(rating\) && rating >= 4000\) return 'tourist'/);
  assert.match(app, /function renderHandleRank\(\)/);
  assert.match(app, /if \(state\.profile && loadedProjectionHandle\(\)\) row\.classList\.add\(rankClass\(officialRankName\(state\.profile\)\)\)/);
  assert.match(css, /\.profile\.rank-legendary \.profile-rank \{ color: var\(--rank-grandmaster\); \}/);
  assert.match(css, /\.profile\.rank-tourist \.profile-rank \{ color: var\(--ink\); font-weight: 700; \}/);
  assert.match(css, /\.handle-row\.has-colored-handle input \{ color: transparent !important; caret-color: var\(--ink\); \}/);
  assert.match(css, /\.handle-row\.rank-legendary \.handle-display-prefix, \.handle-row\.rank-tourist \.handle-display-rest \{ color: var\(--ink\); \}/);
  assert.match(css, /\.handle-row\.rank-legendary \.handle-display-rest, \.handle-row\.rank-tourist \.handle-display-prefix \{ color: var\(--rank-grandmaster\); \}/);
  assert.match(css, /\.handle-row\.has-colored-handle input \{ color: transparent; caret-color: var\(--ink\); \}/);
  assert.match(css, /\.handle-row\.has-colored-handle input::selection \{ color: transparent; background: var\(--soft\); \}/);
  assert.doesNotMatch(css, /\.profile\.rank-(?:legendary|tourist) \.profile-rank::first-letter/);
  assert.match(css, /--rank-grandmaster: #b34e5b/);
  assert.match(css, /\.profile\.rank-grandmaster \.profile-rank \{ color: var\(--rank-grandmaster\); \}/);
  assert.match(css, /\.handle-row\[class\*='rank-'\]:not\(\.rank-unknown\):not\(\.rank-unrated\) input \{ color: var\(--handle-rank-text, var\(--ink\)\); font-weight: 700; \}/);
  assert.match(css, /--rank-headquarters: var\(--ink\);/);
  assert.match(css, /:root\[data-theme='dark'\][^}]*--rank-headquarters: var\(--ink\);/);
  assert.doesNotMatch(css, /\.handle-row\[class\*='rank-'\] input \{ border-color:|box-shadow: 0 0 0 2px var\(--soft\)/);
  assert.match(css, /\.session-state\.is-empty \{ min-height: 30px; visibility: hidden; \}/);
});

test('handle suggestions touch the search field without a dead gap', () => {
  assert.match(css, /\.handle-suggestions-panel \{ position: absolute; z-index: 3; top: calc\(100% \+ 4px\); right: 53px;/);
});

test('dirty input re-renders every derived projection locally', () => {
  const inputHandler = app.slice(app.indexOf("handle.addEventListener('input'"), app.indexOf("form.addEventListener('submit'"));
  assert.match(inputHandler, /renderProfile\(\)/);
  assert.match(inputHandler, /renderLadder\(\)/);
  assert.match(inputHandler, /renderCompletion\(\)/);
  assert.match(inputHandler, /renderSyncButton\(\)/);
  assert.match(inputHandler, /syncStatus\.textContent = ''/);
  assert.doesNotMatch(inputHandler, /userInfo|userStatus|fetch|syncHandle/);
  assert.match(app, /function currentHandle\(\) \{ return inputHandle\(\); \}/);
  assert.match(app, /if \(handle && firstRender\) handle\.value = '';/);
  assert.doesNotMatch(app, /localStorage\.(?:getItem|setItem|removeItem)\('accept-handle'\)/);
});

test('new and different handles infer their own level and owner', () => {
  assert.match(app, /createAccountSync/);
  assert.match(app, /inferLevel: core\.inferLadder/);
  assert.match(app, /application\.dispatch\(\{ type: 'infer-level', level: state\.level \}\)/);
  assert.match(accountSync, /const nextLevel = preserveManualLevel \? context\.level : \(ports\.inferLevel \|\| inferLadder\)\(user\)/);
  assert.match(accountSync, /levelOwnerHandle: normalized/);
  assert.equal(core.inferLadder({ rank: 'master', rating: 2249 }), 'master');
  assert.equal(core.inferLadder({ rank: 'expert', rating: 1813 }), 'expert');
  assert.equal(core.inferLadder({ rank: 'newbie', rating: 900 }), 'newbie');
  assert.equal(core.canonicalView('all'), 'all');
  assert.notEqual(core.inferLadder({ rank: 'master' }), 'all');
});

test('identity status reflects loaded progress and editing intent', () => {
  assert.match(html, /<p class="identity-kicker" role="status" aria-live="polite" data-i18n="handleLabel">Digite um handle do Codeforces\.\.\.<\/p>/);
  assert.match(accountRenderer, /state\.identityStatus \|\| \(complete && !hasVisibleSolved \? 'goForIt' : 'handleLabel'\)/);
  assert.match(app, /onHandleFocus: \(\) => \{[\s\S]*state\.identityStatus = 'handleLabel'/);
  assert.match(app, /onHandleInput: \(\) => \{[\s\S]*accountSync\.invalidate\(\);[\s\S]*state\.syncing = false;[\s\S]*state\.syncTarget = ''/);
  assert.match(css, /\.profile\.rank-legendary \.profile-rating \{ color: var\(--rank-grandmaster\); \}/);
  assert.deepEqual(Object.values(COPY).map(copy => copy.goForIt), ['Bora!', 'Go for it!', '¡Dale!']);
  assert.deepEqual(Object.values(COPY).map(copy => copy.handleLabel), [
    'Digite um handle do Codeforces...',
    'Enter a Codeforces handle...',
    'Escribe un handle de Codeforces...',
  ]);
});
test('manual selection belongs to the loaded handle and refresh preserves it only for that owner', () => {
  assert.match(app, /levelOwnerHandle: ''/);
  assert.match(accountSync, /recommendationApplied: !sameHandle && !preserveManualLevel/);
  assert.match(app, /state\.identityStatus = meta\.recommendationApplied[\s\S]*state\.syncKind === 'refresh' \? 'syncRefreshing' : 'syncLoading'/);
  assert.match(app, /state\.syncing = false;[\s\S]*state\.syncTarget = '';/);
  assert.match(app, /if \(dateChanged\) \{ state\.ladder = null;/);
  const dateBranch = app.slice(app.indexOf('if (dateChanged)'), app.indexOf("const notice = $('#notice')"));
  assert.doesNotMatch(dateBranch, /state\.level\s*=/);
});

test('failed different-handle sync retains old state internally but cannot project it', () => {
  const sync = app.slice(app.indexOf('async function syncHandle'), app.indexOf('function wireSync'));
  assert.match(sync, /accountSync\.syncHandle\(value\)/);
  assert.match(app, /profile: null/);
  assert.match(app, /loadedProjectionHandle\(\) \{ const input = inputHandle\(\); return state\.loadedHandle && input === state\.loadedHandle \? state\.loadedHandle : ''/);
});

test('special and expert selector tokens are separate from CF rating tokens', () => {
  const specialist = css.match(/\.level-special \{[^}]+\}/)?.[0] || '';
  const expert = css.match(/\.level-expert \{[^}]+\}/)?.[0] || '';
  assert.match(specialist, /--level-fg: #087f8c/);
  assert.match(specialist, /--level-soft: #d7f1f2/);
  assert.match(specialist, /--level-edge: #18a9b5/);
  assert.match(expert, /--level-fg: #3155b7/);
  assert.match(expert, /--level-soft: #e1e7fa/);
  assert.match(expert, /--level-edge: #4f6ed3/);
  assert.match(css, /\.level-special \{ --level-fg: #55d6df; --level-soft: #15383c/);
  assert.match(css, /\.level-expert \{ --level-fg: #8ea9ff; --level-soft: #202b4e/);
  assert.match(css, /--cf-cyan: #007f9c/);
  assert.match(css, /--cf-blue: #2864b2/);
  assert.match(css, /\.rating-specialist \{ color: var\(--cf-cyan\); \}/);
  assert.match(css, /\.rating-expert \{ color: var\(--rank-expert\); \}/);
  assert.match(css, /\.rating-candidate \{ color: var\(--rank-candidate\); \}/);
});

test('brand, session, and problem-link readability constraints remain explicit', () => {
  assert.match(css, /\.brand-copy \{[^}]*transform: translateX\(-2px\)/);
  assert.match(css, /\.balloon-icon \{[^}]*transform: translateY\(-2px\);[^}]*transform-origin: center/);
  assert.match(css, /\.brand-tagline \{[^}]*font-size: 12\.5px[^}]*line-height: 1\.15/);
  assert.match(css, /\.profile \{[^}]*font-size: 14px/);
  assert.match(css, /\.profile-metric \{[^}]*display: inline-flex[^}]*white-space: nowrap; \}/);
  assert.match(css, /\.problem-link \{[^}]*text-decoration: none/);
  assert.match(css, /\.problem-title \{ text-decoration: underline/);
  assert.match(css, /\.brand-divider \{[^}]*height: 38px[^}]*background: var\(--line\)/);
  assert.match(app, /link\.append\(title\)/);
  assert.match(app, /row\.append\(problemCell, rating, statusCell\)/);
});

test('responsive rules preserve one internal brand geometry and reflow utilities first', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 520px)'), css.indexOf('@media (max-width: 370px)'));
  assert.match(mobile, /\.brand-lockup \{ grid-template-columns: max-content 1px minmax\(0, max-content\); column-gap: 5px; \}/);
  assert.doesNotMatch(mobile, /\.brand-block \{[^}]*--brand-(?:balloon-width|lockup-gap|name-size|club-size):/);
  assert.doesNotMatch(css.slice(css.indexOf('@media (max-width: 370px)'), css.indexOf('@media (max-width: 400px)')), /\.brand-block \{[^}]*--brand-/);
  assert.match(mobile, /\.masthead \{ min-height: 64px; margin-bottom: 14px; \}/);
  assert.match(mobile, /\.tools \{ gap: 6px; \}/);
  assert.match(css, /\.preference-menu \{[^}]*position: relative; flex: 0 0 auto/);
  assert.match(css, /\.preference-trigger \{[^}]*list-style: none/);
  assert.match(mobile, /\.masthead \{ min-height: 64px; margin-bottom: 14px; \}/);
  const narrow = css.slice(css.indexOf('@media (max-width: 400px)'));
  assert.match(css.slice(css.indexOf('@media (max-width: 400px)'), css.indexOf('@media (prefers-reduced-motion')), /\.brand-lockup \{ grid-template-columns: max-content 1px minmax\(0, max-content\); column-gap: 5px; \}/);
  assert.match(narrow, /\.brand-divider \{ display: block; height: 34px; \}/);
});

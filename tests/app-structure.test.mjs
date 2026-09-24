import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, persistence, accountSync, renderer] = await Promise.all([
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/persistence.js', import.meta.url), 'utf8'),
  readFile(new URL('../application/account-sync.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/problem-list-renderer.js', import.meta.url), 'utf8'),
]);
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const i18n = await readFile(new URL('../js/i18n.js', import.meta.url), 'utf8');
const ladderRepository = await readFile(new URL('../js/ladder-repository.js', import.meta.url), 'utf8');

test('one sync transaction delegates ordered account work to the coordinator', () => {
  assert.match(app, /createAccountSync/);
  assert.match(app, /userInfo,\n\s+userStatus/);
  assert.match(accountSync, /const users = await ports\.userInfo/);
  assert.match(accountSync, /submissions = await ports\.userStatus/);
  assert.ok(accountSync.indexOf('ports.userInfo') < accountSync.indexOf('ports.userStatus'));
  assert.doesNotMatch(app, /wireVerification|#verify|verify\.addEventListener/);
});

test('stateful sync button is present without a completion message', () => {
  assert.match(app, /renderSyncButton/);
  assert.match(app, /t\('use'\)/);
  assert.match(app, /t\('refresh'\)/);
  assert.match(app, /syncRefreshing/);
  assert.match(html, /id="sync-handle"/);
  assert.doesNotMatch(html, /id="completion-result"|class="completion"/);
  assert.doesNotMatch(html, /id="verify"/);
});

test('row renderer keeps one combined ID-and-problem link, rating, then fixed status', () => {
  assert.match(renderer, /link\.append\(id, title\)/);
  assert.match(app, /row\.append\(problemCell, rating, statusCell\)/);
  assert.doesNotMatch(app, /idLink/);
  assert.match(app, /problem-link/);
  assert.match(app, /statusGlyph/);
  assert.match(app, /'current-wrong'/);
  assert.doesNotMatch(html, /class="completion"/);
});

test('one canonical activity key and coordinator-owned request generations are used', () => {
  assert.ok((persistence.match(/KNOWN_SOLVED_STORAGE_KEY/g) || []).length >= 2);
  assert.match(persistence, /KNOWN_SOLVED_STORAGE_KEY/);
  assert.match(app, /createPersistence/);
  assert.match(app, /createAccountSync/);
  assert.match(app, /accountSync\.syncHandle/);
});

test('runtime corpus is deferred and ladder requests use their explicit date', () => {
  assert.doesNotMatch(ladderRepository, /from ['"]\.\.\/data\/runtime-corpus/);
  assert.match(ladderRepository, /import\(['"]\.\.\/data\/runtime-corpus\.js\?v=/);
  assert.match(app, /function loadLadder\(\{ date = state\.date \} = \{\}\)/);
  assert.match(app, /loadLadder: \(\{ date \}\) => loadLadder\(\{ date \}\)/);
});

test('date and level changes stay local without clearing retained date status', () => {
  const levels = app.slice(app.indexOf('function renderLevels'), app.indexOf('function verificationForSelectedDate'));
  assert.doesNotMatch(levels, /userInfo|userStatus|fetch|loadLadder|problemsetProblems|contestsBefore/);
  const dateBranch = app.slice(app.indexOf('if (dateChanged)'), app.indexOf("$('#launch')"));
  assert.doesNotMatch(dateBranch, /state\.verification\.clear/);
  assert.match(app, /if \(dateChanged \|\| !state\.ladder\) loadLadder\(\)/);
});

test('training stages expose only the named difficulty levels', () => {
  assert.match(app, /core\.TRAINING_STAGE_KEYS\.forEach\(\(level\) =>/);
  assert.doesNotMatch(app, /Object\.keys\(core\.LEVEL_STARTS\)/);
  assert.match(app, /special: 'special'/);
  assert.doesNotMatch(html, /all-problems|level-all/);
  assert.doesNotMatch(app, /allButton|level-all/);
});

test('level navigation is the same horizontal strip on desktop and mobile', () => {
  assert.match(html, /<nav class="level-navigation"[\s\S]*<div class="levels" id="levels">/);
  assert.match(app, /core\.TRAINING_STAGE_KEYS\.forEach\(\(level\) =>/);
  assert.match(app, /box\.append\(button\);/);
  assert.match(app, /const active = box\.querySelector\('\.level\.active'\)/);
  assert.match(app, /box\.scrollLeft = Math\.max\(0, Math\.min\(box\.scrollWidth - box\.clientWidth, desired\)\)/);
  assert.doesNotMatch(app, /allButton|level-all/);
});

test('obsolete controls and copy are absent', () => {
  assert.doesNotMatch(`${app}\n${html}\n${i18n}`, /Contestify|Mashup|Acompanhar|Track|Um já basta\.|One is enough\.|Uno basta\./);
});

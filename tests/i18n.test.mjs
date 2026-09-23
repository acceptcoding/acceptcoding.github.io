import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import { problemUrl } from '../js/codeforces.js';
import { resolveLanguage } from '../application/preferences.js';

test('sync and completion vocabulary is correct in all supported languages', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  const { COPY } = await import('../js/i18n.js');
  assert.deepEqual([COPY.pt.handle, COPY.en.handle, COPY.es.handle], ['Seu handle (ex.: tourist)…', 'Your handle (e.g. tourist)…', 'Tu handle (p. ej., tourist)…']);
  assert.deepEqual([COPY.pt.howToCodeforcesBefore, COPY.en.howToCodeforcesBefore, COPY.es.howToCodeforcesBefore], ['O ', '', '']);
  assert.deepEqual([COPY.pt.use, COPY.pt.refresh, COPY.pt.syncLoading, COPY.pt.syncRefreshing, COPY.pt.completionDone, COPY.pt.statusUnavailable, COPY.pt.apiError, COPY.pt.handleNotFound, COPY.pt.expertBucket], ['Carregar handle do Codeforces', 'Atualizar dados do Codeforces', 'Carregando dados...', 'Atualizando dados...', '✓ Feito!', 'Não foi possível atualizar os envios.', 'Codeforces não respondeu. Tente novamente.', 'Handle não encontrado. Confira a grafia e tente novamente.', 'Expert e Candidate Master']);
  assert.deepEqual([COPY.en.use, COPY.en.refresh, COPY.en.syncLoading, COPY.en.syncRefreshing, COPY.en.completionDone, COPY.en.statusUnavailable, COPY.en.apiError, COPY.en.handleNotFound, COPY.en.expertBucket], ['Load Codeforces handle', 'Refresh Codeforces data', 'Loading data...', 'Refreshing data...', '✓ Done!', 'Could not refresh submissions.', 'Codeforces did not respond. Try again.', 'Handle not found. Check the spelling and try again.', 'Expert and Candidate Master']);
  assert.deepEqual([COPY.es.use, COPY.es.refresh, COPY.es.syncLoading, COPY.es.syncRefreshing, COPY.es.completionDone, COPY.es.statusUnavailable, COPY.es.apiError, COPY.es.handleNotFound, COPY.es.expertBucket], ['Cargar handle de Codeforces', 'Actualizar datos de Codeforces', 'Cargando datos...', 'Actualizando datos...', '✓ ¡Listo!', 'No se pudieron actualizar los envíos.', 'Codeforces no respondió. Inténtalo de nuevo.', 'No se encontró el handle. Comprueba la escritura e inténtalo de nuevo.', 'Expert y Candidate Master']);
  assert.deepEqual([COPY.pt.legend, COPY.en.legend, COPY.es.legend], ['legend', 'legend', 'legend']);
  assert.ok(!Object.values(COPY).some(copy => /Acompanhar|Track|Monitorar|Pesquisar|Search/.test(Object.values(copy).join(' '))));
});

test('locale preference uses explicit choice, then only the primary browser language, then English', async () => {
  const { languageFromPreferences } = await import('../js/i18n.js');
  const cases = [
    ['pt', 'es-MX', 'pt'],
    ['en', 'pt-BR', 'en'],
    ['es', 'en-US', 'es'],
    [null, 'pt-BR', 'pt'],
    [null, 'es-419', 'es'],
    [null, 'fr-FR', 'en'],
    [null, '', 'en'],
    [null, 'fr-FR', 'en'],
    ['invalid', 'es-MX', 'es'],
    ['invalid', 'de-DE', 'en'],
  ];
  for (const [saved, primary, expected] of cases) assert.equal(languageFromPreferences(saved, primary), expected);
  assert.equal(languageFromPreferences(null, 'fr-FR'), 'en');
  assert.notEqual(languageFromPreferences(null, 'fr-FR'), languageFromPreferences(null, 'pt-BR'));
});

test('locale route overrides saved language while root uses saved language', () => {
  const cases = [
    [{ routeLanguage: 'en', storedLanguage: 'pt', primaryLanguage: 'es-MX' }, 'en'],
    [{ routeLanguage: 'es', storedLanguage: 'pt', primaryLanguage: 'en-US' }, 'es'],
    [{ routeLanguage: 'pt', storedLanguage: 'en', primaryLanguage: 'es-MX' }, 'pt'],
    [{ routeLanguage: null, storedLanguage: 'es', primaryLanguage: 'en-US' }, 'es'],
    [{ routeLanguage: null, storedLanguage: null, primaryLanguage: 'pt-BR' }, 'pt'],
    [{ routeLanguage: 'invalid', storedLanguage: 'invalid', primaryLanguage: 'de-DE' }, 'en'],
  ];
  for (const [input, expected] of cases) assert.equal(resolveLanguage(input), expected);
});


test('locale changes presentation copy only, not ladder, URLs, or verification semantics', async () => {
  const { COPY } = await import('../js/i18n.js');
  const problems = Array.from({ length: 14 }, (_, index) => ({
    contestId: 355 + index,
    index: 'A',
    name: `Locale fixture ${index}`,
    rating: 800 + index * 100,
    type: 'PROGRAMMING',
    tags: [],
  }));
  const submissions = [{
    creationTimeSeconds: Date.UTC(2026, 8, 9, 12) / 1000,
    verdict: 'OK',
    problem: { contestId: problems[0].contestId, index: 'A' },
  }];
  const results = [];
  for (const language of ['en', 'pt', 'es']) {
    const ladder = await core.buildLadder(problems, '2026-09-09', core.SITE_SALT, '2026-09-10');
    const ids = ladder.map(core.stableProblemId);
    const verification = core.verifySubmissions(submissions, { day: '2026-09-09', problemIds: ids });
    results.push({
      language,
      ids,
      urls: ladder.map(problemUrl),
      verification,
      copy: COPY[language].completionDone,
    });
  }
  assert.deepEqual(results.map(({ ids }) => ids), [results[0].ids, results[0].ids, results[0].ids]);
  assert.deepEqual(results.map(({ urls }) => urls), [results[0].urls, results[0].urls, results[0].urls]);
  assert.deepEqual(results.map(({ verification }) => verification), [results[0].verification, results[0].verification, results[0].verification]);
  assert.equal(new Set(results.map(({ copy }) => copy)).size, 3);
});

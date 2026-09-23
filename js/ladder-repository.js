import { LADDER_SIZE, SITE_SALT } from '../domain/config.js';
import { isSelectableDate } from '../domain/dates.js';
import { canonicalHistoryIds, hydrateCanonicalProblems } from '../domain/history.js';
import {
  filterEligibleProblems,
  filterHistoricalProblems,
  isCanonicalHistoryProblem,
  stableProblemId,
} from '../domain/problems.js';
import { buildLadder } from '../domain/selector.js';
import { CANONICAL_HISTORY_MANIFEST } from '../data/canonical-history-manifest.js';
import { readSession, writeSession } from './storage.js?v=storage-v1';

export const LADDER_CACHE_NAMESPACE = 'daily-ladder-v16';
export const LADDER_CACHE_VERSION = 'v16';
export const LADDER_CACHE_BOUNDARY = 'utc-midnight';

const cachePrefix = `${SITE_SALT}:${LADDER_CACHE_NAMESPACE}:`;

function cacheKey(date) {
  return `${cachePrefix}${date}`;
}

function isValidLadder(value) {
  if (!Array.isArray(value) || value.length !== LADDER_SIZE) return false;
  const ids = value.map(stableProblemId);
  if (new Set(ids).size !== LADDER_SIZE || ids.some((id) => !id || id.startsWith('undefined:'))) return false;
  return value.every((problem) => {
    const hasIdentity = (typeof problem?.contestId === 'number' || typeof problem?.contestId === 'string')
      && String(problem.contestId).trim()
      && typeof problem?.index === 'string'
      && problem.index.trim();
    const hasRequiredFields = typeof problem?.name === 'string'
      && problem.name.trim()
      && typeof problem?.rating === 'number'
      && Number.isFinite(problem.rating)
      && problem.type === 'PROGRAMMING'
      && Array.isArray(problem.tags);
    return hasIdentity && hasRequiredFields && isCanonicalHistoryProblem(problem);
  });
}

export function createLadderRepository({
  readSessionValue = readSession,
  writeSessionValue = writeSession,
  manifest = CANONICAL_HISTORY_MANIFEST,
  corpus = null,
} = {}) {
  const memory = new Map();
  const inflight = new Map();
  let corpusPromise = corpus ? Promise.resolve(corpus) : null;

  function loadCorpus() {
    if (!corpusPromise) {
      corpusPromise = import('../data/runtime-corpus.js?v=runtime-corpus-c6be2311-89941fea')
        .then(({ RUNTIME_CORPUS }) => RUNTIME_CORPUS);
    }
    return corpusPromise;
  }

  function read(date, today, runtimeCorpus = corpus) {
    if (!isSelectableDate(date, today)) return null;
    if (!runtimeCorpus || canonicalHistoryIds(manifest, date, runtimeCorpus.problems, runtimeCorpus.sourceProvenance)) return null;
    if (memory.has(date)) return memory.get(date);
    try {
      const stored = JSON.parse(readSessionValue(cacheKey(date), 'null'));
      if (stored?.version !== LADDER_CACHE_VERSION
        || stored.boundary !== LADDER_CACHE_BOUNDARY
        || stored.date !== date
        || !isValidLadder(stored.ladder)) return null;
      memory.set(date, stored.ladder);
      return stored.ladder;
    } catch {
      return null;
    }
  }

  function write(date, today, ladder) {
    if (!isSelectableDate(date, today) || !isValidLadder(ladder)) return;
    memory.set(date, ladder);
    writeSessionValue(cacheKey(date), JSON.stringify({
      version: LADDER_CACHE_VERSION,
      boundary: LADDER_CACHE_BOUNDARY,
      date,
      ladder,
    }));
  }

  function resolve(date, today) {
    if (!isSelectableDate(date, today)) return Promise.reject(new RangeError('Illegal ACCEPT training date'));
    if (inflight.has(date)) return inflight.get(date);

    const promise = (async () => {
      const runtimeCorpus = await loadCorpus();
      const canonicalIds = canonicalHistoryIds(manifest, date, runtimeCorpus.problems, runtimeCorpus.sourceProvenance);
      if (canonicalIds) return hydrateCanonicalProblems(canonicalIds, runtimeCorpus.problems);

      const cached = read(date, today, runtimeCorpus);
      if (cached) return cached;
      const eligible = filterHistoricalProblems(
        filterEligibleProblems(runtimeCorpus.problems),
        runtimeCorpus.contests,
        date,
        today,
      );
      const ladder = await buildLadder(eligible, date, SITE_SALT, today);
      if (!isValidLadder(ladder)) throw new Error('Incomplete daily ladder');
      write(date, today, ladder);
      return ladder;
    })();

    inflight.set(date, promise);
    promise.then(
      () => { if (inflight.get(date) === promise) inflight.delete(date); },
      () => { if (inflight.get(date) === promise) inflight.delete(date); },
    );
    return promise;
  }

  return Object.freeze({ read, resolve, write, isValidLadder });
}

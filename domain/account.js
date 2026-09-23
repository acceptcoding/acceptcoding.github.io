import { LEVEL_PROVENANCE } from './config.js';
import { isValidDateString, localDayBounds } from './dates.js';
import { stableProblemId } from './problems.js';
import { canonicalLevel } from './url-state.js';

const RANK_LADDERS = new Map([
  ['newbie', 'newbie'],
  ['pupil', 'pupil'],
  ['specialist', 'special'],
  ['special', 'special'],
  ['expert', 'expert'],
  ['candidate master', 'expert'],
  ['master', 'master'],
  ['international master', 'master'],
  ['grandmaster', 'master'],
  ['international grandmaster', 'master'],
  ['legendary grandmaster', 'legend'],
]);

export function rankToLadder(rank) {
  if (typeof rank === 'string') {
    const text = rank.trim().toLowerCase();
    if (RANK_LADDERS.has(text)) return RANK_LADDERS.get(text);
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
    rank = Number(text);
  }
  if (typeof rank !== 'number' || !Number.isFinite(rank)) return null;
  if (rank < 1200) return 'newbie';
  if (rank < 1400) return 'pupil';
  if (rank < 1600) return 'special';
  if (rank < 2100) return 'expert';
  if (rank < 3000) return 'master';
  return 'legend';
}

export function inferLadder(profile = {}) {
  return rankToLadder(profile.rank) || rankToLadder(profile.rating) || 'newbie';
}

export function isExplicitLevelProvenance(provenance) {
  return provenance === LEVEL_PROVENANCE.MANUAL;
}

export function resolveLevel({ currentLevel = 'newbie', explicit = false, provenance = LEVEL_PROVENANCE.DEFAULT, profile = null } = {}) {
  if (explicit || isExplicitLevelProvenance(provenance)) return canonicalLevel(currentLevel) || 'newbie';
  return inferLadder(profile || {});
}

export function levelInferenceState(profile = {}, selectedLevel = 'newbie', provenance = LEVEL_PROVENANCE.DEFAULT) {
  const inferredLevel = inferLadder(profile);
  const selected = canonicalLevel(selectedLevel) || inferredLevel;
  return {
    inferredLevel,
    selectedLevel: selected,
    provenance,
    isSuggestion: isExplicitLevelProvenance(provenance),
    differs: selected !== inferredLevel,
  };
}


export const UNSUCCESSFUL_VERDICTS = Object.freeze(new Set([
  'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR',
  'COMPILATION_ERROR', 'PRESENTATION_ERROR', 'IDLENESS_LIMIT_EXCEEDED',
  'SECURITY_VIOLATED', 'CRASHED', 'INPUT_PREPARATION_CRASHED', 'CHALLENGED',
  'REJECTED', 'FAILED', 'PARTIAL',
]));

export function isUnsuccessfulVerdict(verdict) {
  return UNSUCCESSFUL_VERDICTS.has(String(verdict || '').toUpperCase());
}

export function verifySubmissions(submissions, { day, problemIds } = {}) {
  const ids = new Set(problemIds || []);
  const bounds = localDayBounds(day);
  const solved = new Set();
  const unsuccessful = new Set();
  for (const submission of [...(Array.isArray(submissions) ? submissions : [])]
    .sort((a, b) => (b.creationTimeSeconds || 0) - (a.creationTimeSeconds || 0))) {
    const time = submission?.creationTimeSeconds;
    const id = submission?.problem ? stableProblemId(submission.problem) : '';
    if (!Number.isFinite(time) || time * 1000 < bounds.start || time * 1000 >= bounds.end || !ids.has(id)) continue;
    if (submission?.verdict === 'OK') solved.add(id);
    else if (isUnsuccessfulVerdict(submission?.verdict)) unsuccessful.add(id);
  }
  const solvedIds = [...solved];
  const unsuccessfulIds = [...unsuccessful];
  const problemIdList = [...ids];
  const done = problemIdList.some(id => solved.has(id));
  return {
    status: 'CHECKED',
    solvedIds,
    unsuccessfulIds,
    done,
    solved: done,
    problemIds: problemIdList,
  };
}

export function completionEstablished(result, problemIds = undefined) {
  if (result?.status !== 'CHECKED') return false;
  const solved = new Set(Array.isArray(result.solvedIds) ? result.solvedIds : []);
  const visibleIds = problemIds || result.problemIds || [];
  return Array.isArray(visibleIds) && visibleIds.some((id) => solved.has(id));
}

export function verificationUnavailable(error) {
  return { status: 'UNAVAILABLE', solvedIds: [], unsuccessfulIds: [], error };
}

export function normalizeHandle(handle) {
  return String(handle ?? '').trim().toLowerCase();
}

function cleanIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [])
    .filter(id => typeof id === 'string' && id.trim()))];
}

function cacheEntry(entry) {
  if (Array.isArray(entry)) return { accepted: cleanIds(entry), unsuccessful: [] };
  if (!entry || typeof entry !== 'object') return { accepted: [], unsuccessful: [] };
  return {
    accepted: cleanIds(entry.accepted),
    unsuccessful: cleanIds(entry.unsuccessful),
  };
}

export function parseKnownSolved(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed)
      .map(([handle, entry]) => [normalizeHandle(handle), cacheEntry(entry)])
      .filter(([handle, entry]) => handle && (entry.accepted.length || entry.unsuccessful.length)));
  } catch {
    return {};
  }
}

export function serializeKnownSolved(cache = {}) {
  return JSON.stringify(parseKnownSolved(JSON.stringify(cache)));
}

export function knownSolvedIds(cache = {}, handle) {
  return new Set(cacheEntry(cache[normalizeHandle(handle)]).accepted);
}

export function knownUnsuccessfulIds(cache = {}, handle) {
  return new Set(cacheEntry(cache[normalizeHandle(handle)]).unsuccessful);
}

export function mergeKnownActivity(cache = {}, handle, activity = {}) {
  const key = normalizeHandle(handle);
  const result = parseKnownSolved(JSON.stringify(cache));
  if (!key) return result;
  const current = cacheEntry(result[key]);
  result[key] = {
    accepted: cleanIds([...current.accepted, ...(activity.accepted || [])]),
    unsuccessful: cleanIds([...current.unsuccessful, ...(activity.unsuccessful || [])]),
  };
  return result;
}

export function mergeKnownSolved(cache = {}, handle, ids = []) {
  return mergeKnownActivity(cache, handle, { accepted: ids });
}

export function activityFromSubmissions(submissions = []) {
  const accepted = new Set();
  const unsuccessful = new Set();
  for (const item of Array.isArray(submissions) ? submissions : []) {
    const problem = item?.problem;
    if (!problem || !String(problem.contestId ?? problem.id ?? '').trim() || !String(problem.index ?? '').trim()) continue;
    const id = stableProblemId(problem);
    if (item.verdict === 'OK') accepted.add(id);
    else if (isUnsuccessfulVerdict(item.verdict)) unsuccessful.add(id);
  }
  return { accepted: [...accepted], unsuccessful: [...unsuccessful] };
}

export function solvedProblemIdsFromSubmissions(submissions = []) {
  return activityFromSubmissions(submissions).accepted;
}

export function problemStatus(problemId, acceptedOnDate = new Set(), unsuccessfulOnDate = new Set(), knownSolved = new Set(), knownUnsuccessful = new Set()) {
  if (acceptedOnDate.has(problemId)) return 'current';
  if (unsuccessfulOnDate.has(problemId)) return 'current-wrong';
  if (knownSolved.has(problemId)) return 'known';
  if (knownUnsuccessful.has(problemId)) return 'known-wrong';
  return 'none';
}

function completionHistoryEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([date, completed]) => isValidDateString(date) && completed === true));
}

export function parseCompletionHistory(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .map(([handle, dates]) => [normalizeHandle(handle), completionHistoryEntry(dates)])
      .filter(([handle, dates]) => handle && Object.keys(dates).length));
  } catch {
    return {};
  }
}

export function serializeCompletionHistory(history = {}) {
  return JSON.stringify(parseCompletionHistory(JSON.stringify(history)));
}

export function recordCompletion(history = {}, handle, date) {
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle || !isValidDateString(date)) return parseCompletionHistory(JSON.stringify(history));
  const result = parseCompletionHistory(JSON.stringify(history));
  result[normalizedHandle] = { ...(result[normalizedHandle] || {}), [date]: true };
  return result;
}

export function hasCompletion(history = {}, handle, date) {
  const normalizedHandle = normalizeHandle(handle);
  return Boolean(normalizedHandle && isValidDateString(date)
    && parseCompletionHistory(JSON.stringify(history))[normalizedHandle]?.[date]);
}

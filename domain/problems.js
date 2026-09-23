import { EXCLUDED_CONTEST_ID_SET, EXCLUDED_PROBLEM_ID_SET } from '../data/english-statement-exclusions.js';
import { APPROVED_CONTEST_IDS, APPROVED_CONTEST_POLICY } from '../data/approved-contest-ids.js';
import { LAUNCH_DATE, MIN_CONTEST_ID } from './config.js';
import { assertTrainingDate, localDayBounds } from './dates.js';

export const MANUAL_EXCLUSIONS = Object.freeze([...EXCLUDED_PROBLEM_ID_SET]);
export const MANUAL_EXCLUDED_CONTESTS = Object.freeze([...EXCLUDED_CONTEST_ID_SET]);
export { APPROVED_CONTEST_IDS, APPROVED_CONTEST_POLICY };

const usable = value => value !== undefined && value !== null && String(value).trim() !== '';
export function stableProblemId(problem) { return `${problem?.contestId ?? problem?.id}:${problem?.index}`; }
function excludedTag(tag) { const normalized = String(tag).toLowerCase(); return normalized === 'interactive' || normalized.startsWith('interactive/') || normalized === 'special' || normalized === '*special' || normalized.startsWith('special/') || normalized.startsWith('*special/') || normalized === 'output-only' || normalized.startsWith('output-only/'); }
export function isEligibleProblem(problem) {
  const id = problem?.contestId ?? problem?.id;
  const stableId = usable(id) && usable(problem?.index) ? `${id}:${problem.index}` : '';
  const numericContestId = Number(id);
  return usable(id) && Number.isInteger(numericContestId) && numericContestId >= MIN_CONTEST_ID && usable(problem?.index) && usable(problem?.name) && typeof problem?.rating === 'number' && Number.isFinite(problem.rating) && problem.type === 'PROGRAMMING' && !(Array.isArray(problem.tags) ? problem.tags : []).some(excludedTag) && !EXCLUDED_PROBLEM_ID_SET.has(stableId) && !EXCLUDED_CONTEST_ID_SET.has(String(id));
}
export function filterEligibleProblems(problems) { return (Array.isArray(problems) ? problems : []).filter(isEligibleProblem); }
export const isEligibleContest = isEligibleProblem;
export const filterEligibleContests = filterEligibleProblems;
// Codeforces rank colors: gray <1200, green 1200, cyan 1400, blue 1600,
// violet 1900, orange 2100, red 2400, legendary red 3000.
export function codeforcesRatingCategory(rating) { const value = Number(rating); if (!Number.isFinite(value)) return 'unknown'; if (value < 1200) return 'newbie'; if (value < 1400) return 'pupil'; if (value < 1600) return 'specialist'; if (value < 1900) return 'expert'; if (value < 2100) return 'candidate'; if (value < 2400) return 'master'; if (value < 3000) return 'grandmaster'; return 'legendary'; }

function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
const APPROVED_CONTEST_ID_SET = new Set(APPROVED_CONTEST_IDS);

export function problemMetadataFingerprint(problem) {
  return JSON.stringify([
    String(problem.name),
    problem.rating,
    String(problem.type),
    [...(Array.isArray(problem.tags) ? problem.tags : [])].map(String).sort(compareText),
  ]);
}
function compareProblems(a, b) {
  return a.rating - b.rating
    || compareText(stableProblemId(a), stableProblemId(b))
    || compareText(problemMetadataFingerprint(a), problemMetadataFingerprint(b));
}
export function canonicalizeEligibleProblems(problems) {
  const groups = new Map();
  for (const item of filterEligibleProblems(problems)) {
    const id = stableProblemId(item);
    const group = groups.get(id) || [];
    group.push(item);
    groups.set(id, group);
  }
  return [...groups.values()]
    .map(group => group.sort((a, b) => compareText(problemMetadataFingerprint(a), problemMetadataFingerprint(b)))[0])
    .sort(compareProblems);
}
export function buildRatingBuckets(problems) {
  const sorted = canonicalizeEligibleProblems(problems);
  const buckets = [];
  for (const item of sorted) {
    const previous = buckets.at(-1);
    if (previous?.rating === item.rating) previous.items.push(item);
    else buckets.push({ rating: item.rating, items: [item] });
  }
  return buckets;
}
export function selectPoolItem(items, seed) { if (!items?.length) return null; const value = Number.isFinite(seed) ? Math.trunc(seed) : 0; return items[((value % items.length) + items.length) % items.length]; }

export function filterHistoricalProblems(problems, contests, date, today = date) {
  assertTrainingDate(date, today);
  const cutoff = localDayBounds(date).start / 1000;
  const contestById = new Map();
  for (const contest of Array.isArray(contests) ? contests : []) {
    const id = contest?.id ?? contest?.contestId;
    const numericId = Number(id);
    if (Number.isInteger(numericId)) contestById.set(numericId, contest);
  }
  return canonicalizeEligibleProblems(problems).filter((problem) => {
    const numericId = Number(problem.contestId ?? problem.id);
    if (!APPROVED_CONTEST_ID_SET.has(numericId)) return false;
    const contest = contestById.get(numericId);
    const start = contest?.startTimeSeconds;
    const duration = contest?.durationSeconds;
    if (!Number.isFinite(start) || !Number.isFinite(duration)) return false;
    const end = start + duration;
    return Number.isFinite(end) && end <= cutoff;
  });
}
export function isApprovedProblem(problem) {
  const id = Number(problem?.contestId ?? problem?.id);
  return Number.isInteger(id) && APPROVED_CONTEST_ID_SET.has(id);
}
export function isCanonicalHistoryProblem(problem) {
  return isEligibleProblem(problem) && isApprovedProblem(problem);
}

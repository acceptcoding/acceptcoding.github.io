import * as core from '../../core.js';

export const SELECTED_DATE = '2026-09-09';
export const PROBLEM_IDS = ['1:A', '2:A', '3:A', '4:A', '5:A'];

export function submission(problemId, verdict, date = SELECTED_DATE, hour = 12) {
  const [contestId, index] = problemId.split(':');
  const bounds = core.localDayBounds(date);
  return { verdict, creationTimeSeconds: bounds.start / 1000 + hour * 3600, problem: { contestId: Number(contestId), index } };
}

export function evaluateStatus(submissions, problemId, date = SELECTED_DATE) {
  const result = core.verifySubmissions(submissions, { day: date, problemIds: [problemId] });
  const cache = core.mergeKnownActivity({}, 'fixture-user', core.activityFromSubmissions(submissions));
  const status = core.problemStatus(
    problemId,
    new Set(result.solvedIds),
    new Set(result.unsuccessfulIds),
    core.knownSolvedIds(cache, 'fixture-user'),
    core.knownUnsuccessfulIds(cache, 'fixture-user'),
  );
  return { ...result, status };
}

export const fixtures = {
  noSubmissions: [],
  historicalWa: [submission('1:A', 'WRONG_ANSWER', '2026-09-08')],
  historicalAc: [submission('1:A', 'OK', '2026-09-08')],
  currentWa: [submission('1:A', 'WRONG_ANSWER')],
  historicalAcCurrentWa: [submission('1:A', 'OK', '2026-09-08'), submission('1:A', 'WRONG_ANSWER')],
  currentWaCurrentAc: [submission('1:A', 'WRONG_ANSWER'), submission('1:A', 'OK', SELECTED_DATE, 13)],
  currentAcLaterWa: [submission('1:A', 'OK', SELECTED_DATE, 13), submission('1:A', 'WRONG_ANSWER', SELECTED_DATE, 14)],
  laterAc: [submission('1:A', 'OK', '2026-09-10')],
};

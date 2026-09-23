import { ALL_PROBLEMS_VIEW, LADDER_STATUS } from './session.js';
import { isSelectableDate } from '../domain/dates.js';
import { problemStatus } from '../domain/account.js';
import { stableProblemId } from '../domain/problems.js';
import { visibleProblems } from '../domain/selector.js';

export function createChallengeViewModel({ state, knownActivity = { accepted: new Set(), unsuccessful: new Set() }, verification = null }) {
  const accepted = verification?.solvedIds || new Set();
  const unsuccessful = verification?.unsuccessfulIds || new Set();
  const items = state.ladder ? visibleProblems(state.ladder, { level: state.level, view: state.view }) : [];
  return Object.freeze({
    status: !isSelectableDate(state.date, state.today) ? 'unavailable' : state.ladderStatus,
    isAllView: state.view === ALL_PROBLEMS_VIEW,
    items,
    rows: items.filter(Boolean).map((problem) => ({
      problem,
      id: stableProblemId(problem),
      status: problemStatus(stableProblemId(problem), accepted, unsuccessful, knownActivity.accepted, knownActivity.unsuccessful),
    })),
    error: state.error,
    loading: state.ladderStatus === LADDER_STATUS.LOADING,
  });
}

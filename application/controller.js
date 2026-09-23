import {
  createInitialSession,
  inferLevel,
  receiveError,
  receiveLadder,
  receiveUnavailable,
  resetLevel,
  selectAllView,
  selectDate,
  selectLevel,
  startLadderLoading,
} from './session.js';

export function createApplicationController({ today, initialState, ladderRepository }) {
  if (!ladderRepository || typeof ladderRepository.resolve !== 'function') throw new TypeError('A ladder repository is required');
  let state = initialState || createInitialSession({ today });
  let generation = 0;

  function dispatch(action) {
    switch (action?.type) {
      case 'select-date': generation += 1; state = selectDate(state, action.date, action.today); break;
      case 'select-level': state = selectLevel(state, action.level); break;
      case 'infer-level': state = inferLevel(state, action.level); break;
      case 'reset-level': state = resetLevel(state); break;
      case 'select-all-view': state = selectAllView(state); break;
      case 'start-ladder-loading': state = startLadderLoading(state); break;
      case 'receive-ladder': state = receiveLadder(state, action.ladder); break;
      case 'receive-unavailable': state = receiveUnavailable(state, action.reason); break;
      case 'receive-error': state = receiveError(state, action.error); break;
      default: throw new RangeError(`Unknown application action: ${action?.type}`);
    }
    return state;
  }

  async function loadLadder() {
    const request = ++generation;
    dispatch({ type: 'start-ladder-loading' });
    try {
      const result = await ladderRepository.resolve(state.date, state.today);
      if (request !== generation) return state;
      if (Array.isArray(result)) return dispatch({ type: 'receive-ladder', ladder: result });
      if (result?.status === 'ready') return dispatch({ type: 'receive-ladder', ladder: result.ladder });
      return dispatch({ type: 'receive-unavailable', reason: result?.reason || 'LADDER_UNAVAILABLE' });
    } catch (error) {
      if (request !== generation) return state;
      return dispatch({ type: 'receive-error', error });
    }
  }

  return Object.freeze({
    getState: () => state,
    dispatch,
    loadLadder,
    supersede: () => { generation += 1; },
  });
}

import {
  ALL_PROBLEMS_VIEW,
  LADDER_WINDOWS,
  LEVEL_PROVENANCE,
  TRAINING_STAGE_KEYS,
  VIEW_PROVENANCE,
} from '../domain/config.js';
import { canonicalTrainingDate, isValidDateString, todayAtLocal, validateTrainingDate } from '../domain/dates.js';

export const LADDER_STATUS = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', UNAVAILABLE: 'unavailable', ERROR: 'error' });

function assertLevel(level) {
  if (!TRAINING_STAGE_KEYS.includes(level)) throw new RangeError(`Unknown training level: ${level}`);
  return level;
}

function resetLadder(state) {
  return { ...state, ladder: null, ladderDate: '', ladderStatus: LADDER_STATUS.IDLE, error: null };
}

export function createInitialSession({ today = todayAtLocal(), date = today, level = 'newbie', view = VIEW_PROVENANCE.WINDOW } = {}) {
  if (!isValidDateString(today)) throw new RangeError(`Invalid session today: ${today}`);
  const boundary = validateTrainingDate(date, today);
  return {
    today,
    date: boundary.date,
    level: assertLevel(level),
    view: view === ALL_PROBLEMS_VIEW ? ALL_PROBLEMS_VIEW : VIEW_PROVENANCE.WINDOW,
    levelProvenance: LEVEL_PROVENANCE.DEFAULT,
    ladder: null,
    ladderDate: '',
    ladderStatus: LADDER_STATUS.IDLE,
    error: null,
  };
}

export function selectDate(state, date, today = state.today) {
  if (!isValidDateString(today)) throw new RangeError(`Invalid session today: ${today}`);
  return resetLadder({ ...state, today, date: canonicalTrainingDate(date, today) });
}

export function selectLevel(state, level) {
  return { ...state, level: assertLevel(level), view: VIEW_PROVENANCE.WINDOW, levelProvenance: LEVEL_PROVENANCE.MANUAL, error: null };
}

export function inferLevel(state, level) {
  return { ...state, level: assertLevel(level), view: VIEW_PROVENANCE.WINDOW, levelProvenance: LEVEL_PROVENANCE.INFERRED, error: null };
}

export function selectAllView(state) {
  return { ...state, view: ALL_PROBLEMS_VIEW, error: null };
}

export function resetLevel(state) {
  return { ...state, level: 'newbie', view: VIEW_PROVENANCE.WINDOW, levelProvenance: LEVEL_PROVENANCE.DEFAULT, error: null };
}

export function startLadderLoading(state) {
  return { ...state, ladder: null, ladderDate: state.date, ladderStatus: LADDER_STATUS.LOADING, error: null };
}

export function receiveLadder(state, ladder) {
  if (!Array.isArray(ladder) || ladder.length !== 13 || ladder.some((item) => !item) || new Set(ladder.map((item) => item.id || `${item.contestId}:${item.index}`)).size !== 13) {
    throw new RangeError('A complete ladder must contain thirteen distinct problems');
  }
  return { ...state, ladder, ladderDate: state.date, ladderStatus: LADDER_STATUS.READY, error: null };
}

export function receiveUnavailable(state, reason = 'LADDER_UNAVAILABLE') {
  return { ...state, ladder: null, ladderDate: state.date, ladderStatus: LADDER_STATUS.UNAVAILABLE, error: { code: 'LADDER_UNAVAILABLE', message: String(reason) } };
}

export function receiveError(state, error) {
  return { ...state, ladder: null, ladderDate: state.date, ladderStatus: LADDER_STATUS.ERROR, error: { code: error?.code || 'APPLICATION_ERROR', message: String(error?.message || error) } };
}

export { ALL_PROBLEMS_VIEW, LADDER_WINDOWS, LEVEL_PROVENANCE, TRAINING_STAGE_KEYS, VIEW_PROVENANCE };

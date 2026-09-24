import { LEVEL_PROVENANCE } from '../domain/config.js';
import { inferLadder } from '../domain/account.js';
import { normalizeHandle, verifySubmissions, completionEstablished } from '../domain/account.js';
import { submissionDayBounds } from '../domain/dates.js';

export const PROFILE_ERROR_CODES = Object.freeze({
  HANDLE_NOT_FOUND: 'HANDLE_NOT_FOUND',
  PROFILE_UNAVAILABLE: 'PROFILE_UNAVAILABLE',
});

export const ACCOUNT_SYNC_STATUS = Object.freeze({
  COMPLETE: 'complete',
  PROFILE_ERROR: 'profile-error',
  UNAVAILABLE: 'unavailable',
  STALE: 'stale',
});

function copyResult(result) {
  if (!result || typeof result !== 'object') return result;
  return {
    ...result,
    solvedIds: new Set(result.solvedIds || []),
    unsuccessfulIds: new Set(result.unsuccessfulIds || []),
  };
}

function profileError(error) {
  const code = error?.code === PROFILE_ERROR_CODES.HANDLE_NOT_FOUND
    ? PROFILE_ERROR_CODES.HANDLE_NOT_FOUND
    : PROFILE_ERROR_CODES.PROFILE_UNAVAILABLE;
  return Object.freeze({ type: 'profile', code, message: String(error?.message || error || code), cause: error });
}

function ladderValue(value) {
  if (Array.isArray(value)) return { ladder: value, status: 'ready' };
  if (value?.status === 'ready' && Array.isArray(value.ladder)) return value;
  return { ladder: null, status: value?.status || 'unavailable', reason: value?.reason || 'LADDER_UNAVAILABLE' };
}

/**
 * Coordinates account reads without owning DOM state. Every external effect is
 * supplied as a port so stale requests can be rejected before commit/persist.
 */
export function createAccountSync({
  initialState = {},
  ports = {},
} = {}) {
  if (typeof ports.userInfo !== 'function') throw new TypeError('account sync requires a userInfo port');
  if (typeof ports.userStatus !== 'function') throw new TypeError('account sync requires a userStatus port');

  let state = {
    date: '',
    handle: '',
    profile: null,
    loadedHandle: '',
    level: 'newbie',
    levelProvenance: LEVEL_PROVENANCE.DEFAULT,
    levelOwnerHandle: '',
    ladder: null,
    ladderStatus: 'unavailable',
    verification: new Map(),
    syncError: null,
    ...initialState,
  };
  let requestOwnership = 0;

  const readContext = () => {
    const supplied = typeof ports.getContext === 'function' ? ports.getContext() : {};
    return {
      handle: supplied.handle ?? state.handle,
      date: supplied.date ?? state.date,
      ladder: supplied.ladder ?? state.ladder,
      ladderStatus: supplied.ladderStatus ?? state.ladderStatus,
      ladderDate: supplied.ladderDate,
      level: supplied.level ?? state.level,
      levelProvenance: supplied.levelProvenance ?? state.levelProvenance,
      levelOwnerHandle: supplied.levelOwnerHandle ?? state.levelOwnerHandle,
    };
  };
  const commit = (patch, meta) => {
    state = { ...state, ...patch };
    if (typeof ports.commit === 'function') ports.commit(patch, meta);
  };
  const isCurrent = (owned, context, expectedHandle) => {
    const now = readContext();
    return owned === requestOwnership
      && normalizeHandle(now.handle) === (expectedHandle || context.handle)
      && now.date === context.date
      && now.ladder === context.ladder;
  };
  const unavailableVerification = (reason) => ({ status: 'UNAVAILABLE', solvedIds: new Set(), unsuccessfulIds: new Set(), reason });

  async function syncHandle(rawHandle) {
    const displayHandle = String(rawHandle ?? '').trim();
    const normalized = normalizeHandle(displayHandle);
    if (!normalized) return { status: ACCOUNT_SYNC_STATUS.STALE, reason: 'EMPTY_HANDLE' };

    const context = readContext();
    const owned = ++requestOwnership;
    const key = `${normalized}|${context.date}`;
    const sameHandle = Boolean(state.loadedHandle && state.loadedHandle === normalized && state.profile);
    const preserveManualLevel = context.levelProvenance === LEVEL_PROVENANCE.MANUAL
      && (!context.levelOwnerHandle || context.levelOwnerHandle === normalized);
    commit({ handle: displayHandle, syncError: null, syncing: true, syncTarget: normalized }, { phase: 'start', request: owned });

    let user;
    try {
      const users = await ports.userInfo(displayHandle);
      if (!isCurrent(owned, context, normalized)) return { status: ACCOUNT_SYNC_STATUS.STALE };
      user = Array.isArray(users) ? users[0] : users;
      if (!user) throw Object.assign(new Error('No profile'), { code: PROFILE_ERROR_CODES.PROFILE_UNAVAILABLE });
    } catch (error) {
      if (!isCurrent(owned, context, normalized)) return { status: ACCOUNT_SYNC_STATUS.STALE };
      const typed = profileError(error);
      commit({ profile: null, syncError: typed, syncing: false, syncTarget: '' }, { phase: 'profile-error', request: owned });
      return { status: ACCOUNT_SYNC_STATUS.PROFILE_ERROR, error: typed };
    }

    const canonicalHandle = String(user.handle || displayHandle).trim();
    ports.rememberRecentHandle?.(canonicalHandle);
    const nextLevel = preserveManualLevel ? context.level : (ports.inferLevel || inferLadder)(user);
    const nextProvenance = preserveManualLevel ? LEVEL_PROVENANCE.MANUAL : LEVEL_PROVENANCE.INFERRED;
    const nextVerification = sameHandle ? state.verification : new Map();
    commit({
      profile: user,
      handle: canonicalHandle,
      loadedHandle: normalizeHandle(canonicalHandle),
      level: nextLevel,
      levelProvenance: nextProvenance,
      levelOwnerHandle: normalized,
      verification: nextVerification,
    }, { phase: 'profile', request: owned, recommendationApplied: !sameHandle && !preserveManualLevel });

    let ladder = context.ladder;
    let ladderStatus = context.ladderStatus;
    if (!ladder && typeof ports.loadLadder === 'function') {
      let loaded;
      try {
        loaded = ladderValue(await ports.loadLadder({ date: context.date, handle: normalized }));
      } catch (error) {
        if (!isCurrent(owned, context, normalized)) return { status: ACCOUNT_SYNC_STATUS.STALE };
        const result = unavailableVerification('LADDER_UNAVAILABLE');
        commit({ verification: new Map(state.verification).set(key, result), syncing: false, syncTarget: '', syncError: null }, { phase: 'unavailable', request: owned });
        return { status: ACCOUNT_SYNC_STATUS.UNAVAILABLE, reason: 'LADDER_UNAVAILABLE', error };
      }
      if (!isCurrent(owned, context, normalized)) return { status: ACCOUNT_SYNC_STATUS.STALE };
      ladder = loaded.ladder;
      ladderStatus = loaded.status;
      commit({ ladder, ladderStatus }, { phase: 'ladder', request: owned });
      if (!isCurrent(owned, { ...context, ladder }, normalized)) return { status: ACCOUNT_SYNC_STATUS.STALE };
    }
    if (!ladder) {
      const result = unavailableVerification(ladderStatus || 'LADDER_UNAVAILABLE');
      if (isCurrent(owned, { ...context, ladder }, normalized)) {
        commit({ verification: new Map(state.verification).set(key, result), syncing: false, syncTarget: '' }, { phase: 'unavailable', request: owned });
      }
      return { status: ACCOUNT_SYNC_STATUS.UNAVAILABLE, reason: ladderStatus || 'LADDER_UNAVAILABLE' };
    }

    let submissions;
    try {
      submissions = await ports.userStatus(displayHandle, { beforeSeconds: submissionDayBounds(context.date).start / 1000 });
    } catch (error) {
      if (!isCurrent(owned, { ...context, ladder }, normalized)) return { status: ACCOUNT_SYNC_STATUS.STALE };
      const result = unavailableVerification('STATUS_UNAVAILABLE');
      commit({ verification: new Map(state.verification).set(key, result), syncing: false, syncTarget: '' }, { phase: 'unavailable', request: owned });
      return { status: ACCOUNT_SYNC_STATUS.UNAVAILABLE, reason: 'STATUS_UNAVAILABLE', error };
    }
    if (!isCurrent(owned, { ...context, ladder }, normalized)) return { status: ACCOUNT_SYNC_STATUS.STALE };

    const knownActivity = ports.learnKnownActivity?.(canonicalHandle, submissions);
    const problemIds = ladder.filter(Boolean).map((item) => ports.problemId ? ports.problemId(item) : `${item.contestId}:${item.index}`);
    const rawResult = (ports.verifySubmissions || verifySubmissions)(submissions, { day: context.date, problemIds });
    const result = copyResult(rawResult);
    const visibleIds = ports.visibleProblemIds ? ports.visibleProblemIds(ladder, state.level) : problemIds;
    if (completionEstablished(rawResult, visibleIds)) ports.rememberCompletion?.(canonicalHandle, context.date);
    const verification = new Map(state.verification).set(key, result);
    commit({ verification, knownActivity, syncing: false, syncTarget: '', syncError: null }, { phase: 'complete', request: owned });
    return { status: ACCOUNT_SYNC_STATUS.COMPLETE, profile: user, verification: result };
  }

  return Object.freeze({
    syncHandle,
    getState: () => ({ ...state, verification: new Map(state.verification) }),
    invalidate: () => { requestOwnership += 1; },
  });
}

export { profileError as accountProfileError };

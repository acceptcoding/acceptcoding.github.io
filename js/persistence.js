import { COMPLETION_HISTORY_STORAGE_KEY, KNOWN_SOLVED_STORAGE_KEY } from '../domain/config.js';
import {
  activityFromSubmissions,
  hasCompletion,
  knownSolvedIds,
  knownUnsuccessfulIds,
  mergeKnownActivity,
  normalizeHandle,
  parseCompletionHistory,
  parseKnownSolved,
  recordCompletion,
  serializeCompletionHistory,
  serializeKnownSolved,
} from '../domain/account.js';
import { readLocal, removeLocal, writeLocal } from './storage.js?v=storage-v1';

const RECENT_HANDLES_STORAGE_KEY = 'accept-recent-handles-v1';
const MAX_RECENT_HANDLES = 12;

export function createPersistence({
  readLocalValue = readLocal,
  writeLocalValue = writeLocal,
  removeLocalValue = removeLocal,
  now = Date.now,
} = {}) {
  function readRecentHandles() {
    try {
      const parsed = JSON.parse(readLocalValue(RECENT_HANDLES_STORAGE_KEY, '[]'));
      if (!Array.isArray(parsed)) return [];
      const entries = new Map();
      for (const item of parsed) {
        const handle = typeof item === 'string' ? item : item?.handle;
        const normalized = normalizeHandle(handle);
        if (!normalized) continue;
        const timestamp = Number(typeof item === 'string' ? 0 : item?.lastUsed);
        const current = entries.get(normalized);
        const lastUsed = Number.isFinite(timestamp) ? timestamp : 0;
        if (!current || lastUsed > current.lastUsed) {
          entries.set(normalized, { handle: String(handle).trim(), lastUsed });
        }
      }
      return [...entries.values()]
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, MAX_RECENT_HANDLES);
    } catch {
      return [];
    }
  }

  function rememberRecentHandle(handle) {
    const display = String(handle ?? '').trim();
    const normalized = normalizeHandle(display);
    if (!normalized) return;
    const entries = readRecentHandles().filter((item) => normalizeHandle(item.handle) !== normalized);
    entries.unshift({ handle: display, lastUsed: now() });
    writeLocalValue(RECENT_HANDLES_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT_HANDLES)));
  }

  function recentHandleMatches(value) {
    const query = normalizeHandle(value);
    return readRecentHandles()
      .filter((item) => !query || normalizeHandle(item.handle).includes(query))
      .sort((a, b) => {
        const aPrefix = query && normalizeHandle(a.handle).startsWith(query) ? 0 : 1;
        const bPrefix = query && normalizeHandle(b.handle).startsWith(query) ? 0 : 1;
        return aPrefix - bPrefix || b.lastUsed - a.lastUsed;
      });
  }

  function readKnownSolved() {
    return parseKnownSolved(readLocalValue(KNOWN_SOLVED_STORAGE_KEY));
  }

  function learnKnownActivity(existing, handle, submissions) {
    const activity = activityFromSubmissions(submissions);
    if (!activity.accepted.length && !activity.unsuccessful.length) return existing || readKnownSolved();
    const next = mergeKnownActivity(existing || readKnownSolved(), handle, activity);
    writeLocalValue(KNOWN_SOLVED_STORAGE_KEY, serializeKnownSolved(next));
    return next;
  }

  function readCompletionHistory() {
    return parseCompletionHistory(readLocalValue(COMPLETION_HISTORY_STORAGE_KEY));
  }

  function rememberCompletion(existing, handle, date) {
    const next = recordCompletion(existing || readCompletionHistory(), handle, date);
    writeLocalValue(COMPLETION_HISTORY_STORAGE_KEY, serializeCompletionHistory(next));
    return next;
  }

  return Object.freeze({
    readRecentHandles,
    rememberRecentHandle,
    recentHandleMatches,
    clearRecentHandles: () => removeLocalValue(RECENT_HANDLES_STORAGE_KEY),
    readKnownSolved,
    learnKnownActivity,
    knownActivityForHandle: (state, handle) => {
      const known = state || readKnownSolved();
      return {
        accepted: knownSolvedIds(known, handle),
        unsuccessful: knownUnsuccessfulIds(known, handle),
      };
    },
    readCompletionHistory,
    rememberCompletion,
    completionForDate: (state, handle, date) => hasCompletion(state || readCompletionHistory(), handle, date),
  });
}

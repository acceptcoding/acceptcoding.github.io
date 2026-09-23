import { isSelectableDate, localDayBounds } from '../domain/dates.js';

const API = 'https://codeforces.com/api/';
export const API_TIMEOUT_MS = 8000;
export const API_MIN_INTERVAL_MS = 2000;
let requestQueue = Promise.resolve();
let lastRequestStartedAt = 0;
function enqueueRequest(request) {
  const turn = requestQueue.then(async () => {
    const delay = Math.max(0, API_MIN_INTERVAL_MS - (Date.now() - lastRequestStartedAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequestStartedAt = Date.now();
    return request();
  });
  requestQueue = turn.catch(() => {});
  return turn;
}
async function call(method, params = {}) {
  const query = new URLSearchParams(params);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), API_TIMEOUT_MS) : null;
  let response;
  try {
    response = await enqueueRequest(() => fetch(`${API}${method}?${query}`, { headers: { Accept: 'application/json' }, ...(controller ? { signal: controller.signal } : {}) }));
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Codeforces request timed out after ${API_TIMEOUT_MS / 1000}s`);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  let data = null;
  try { data = await response.json(); } catch { /* preserve the transport error below */ }
  if (!response.ok || data?.status !== 'OK') {
    const comment = String(data?.comment || '').trim();
    const error = new Error(comment || `Codeforces HTTP ${response.status}`);
    if (method === 'user.info' && /User with handle .* not found/i.test(comment)) error.code = 'HANDLE_NOT_FOUND';
    throw error;
  }
  return data.result;
}
let problemsetPromise;
export function problemsetProblems() {
  if (!problemsetPromise) {
    problemsetPromise = call('problemset.problems').then(result => result.problems || []).catch((error) => {
      problemsetPromise = undefined;
      throw error;
    });
  }
  return problemsetPromise;
}
let contestsPromise;
export function contestsBefore(date, today) {
  if (!isSelectableDate(date, today)) return Promise.reject(new RangeError('Illegal ACCEPT training date'));
  if (!contestsPromise) {
    contestsPromise = call('contest.list', { gym: 'false' }).catch((error) => {
      contestsPromise = undefined;
      throw error;
    });
  }
  return contestsPromise.then(list => list.filter(c => c.startTimeSeconds && c.startTimeSeconds < localDayBounds(date).end / 1000));
}
export function userInfo(handle) { return call('user.info', { handles: handle }); }
export async function userStatus(handle, { beforeSeconds = 0 } = {}) {
  const pageSize = 1000;
  const submissions = [];
  for (let page = 0; page < 10; page += 1) {
    const batch = await call('user.status', { handle, from: page * pageSize + 1, count: pageSize });
    submissions.push(...batch);
    const oldest = batch.at(-1)?.creationTimeSeconds;
    if (batch.length < pageSize || (beforeSeconds && Number.isFinite(oldest) && oldest < beforeSeconds)) break;
  }
  return submissions;
}
export function problemUrl(problem) { return `https://codeforces.com/problemset/problem/${encodeURIComponent(problem.contestId)}/${encodeURIComponent(problem.index)}`; }

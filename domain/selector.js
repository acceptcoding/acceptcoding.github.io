import {
  ALL_PROBLEMS_VIEW,
  LADDER_SIZE,
  LEVEL_STARTS,
  LAUNCH_DATE,
  SITE_SALT,
  SELECTION_EPOCH,
  TRAINING_STAGE_KEYS,
  VIEW_PROVENANCE,
} from './config.js';
import { assertTrainingDate, isValidDateString, shiftDate } from './dates.js';
import { buildRatingBuckets, stableProblemId } from './problems.js';

// SHA-256 uses WebCrypto when available. Plain HTTP over a LAN IP is not a
// secure browser context, so the equivalent local implementation below keeps
// the deterministic selector usable without changing its seed or rules.
const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const SHA256_H = Object.freeze([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
const rotateRight = (value, amount) => (value >>> amount) | (value << (32 - amount));
function sha256Fallback(bytes) {
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000) >>> 0);
  const hash = [...SHA256_H];
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) schedule[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(schedule[index - 15], 7) ^ rotateRight(schedule[index - 15], 18) ^ (schedule[index - 15] >>> 3);
      const s1 = rotateRight(schedule[index - 2], 17) ^ rotateRight(schedule[index - 2], 19) ^ (schedule[index - 2] >>> 10);
      schedule[index] = (schedule[index - 16] + s0 + schedule[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const S1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + choose + SHA256_K[index] + schedule[index]) >>> 0;
      const S0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + majority) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d + temp1) >>> 0, c, b, a, (temp1 + temp2) >>> 0];
    }
    hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0;
  }
  const result = new Uint8Array(32); const output = new DataView(result.buffer);
  hash.forEach((value, index) => output.setUint32(index * 4, value));
  return result;
}
export async function h32(...parts) {
  const subtle = globalThis.crypto?.subtle;
  const value = parts.map(String).join('\u0000');
  const bytes = new TextEncoder().encode(value);
  const digest = subtle ? new Uint8Array(await subtle.digest('SHA-256', bytes)) : sha256Fallback(bytes);
  return (((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0);
}

// This geometry is one fixed, inspectable contract. Production uses the soft
// mode so a sparse historical inventory can still produce a complete ladder.
// Hard mode is available to generators and validation tools.
export const SLOT_DIFFICULTY_WINDOWS = Object.freeze([
  Object.freeze([800, 800]), Object.freeze([900, 1000]), Object.freeze([1000, 1100]),
  Object.freeze([1200, 1300]), Object.freeze([1400, 1500]), Object.freeze([1500, 1700]),
  Object.freeze([1700, 1800]), Object.freeze([1900, 2000]), Object.freeze([2100, 2300]),
  Object.freeze([2400, 2600]), Object.freeze([2700, 2900]), Object.freeze([3000, 3200]),
  Object.freeze([3300, 3500]),
]);
export const SLOT_RATING_WINDOWS = SLOT_DIFFICULTY_WINDOWS;
export const DIFFICULTY_WINDOWS = SLOT_DIFFICULTY_WINDOWS;
export const ADJACENT_DELTA_RANGES = Object.freeze([
  Object.freeze([100, 200]), Object.freeze([100, 200]), Object.freeze([100, 200]),
  Object.freeze([100, 200]), Object.freeze([100, 200]), Object.freeze([100, 200]),
  Object.freeze([200, 300]), Object.freeze([200, 300]), Object.freeze([200, 400]),
  Object.freeze([200, 400]), Object.freeze([200, 500]), Object.freeze([200, 500]),
]);
export const DIFFICULTY_DELTA_RANGES = ADJACENT_DELTA_RANGES;
export const DELTA_RANGES = ADJACENT_DELTA_RANGES;

export const SELECTION_RULES = Object.freeze({
  ladderSize: 'hard', ratingOrder: 'hard', exactBucketCapacity: 'hard', distinctStableIds: 'hard',
  ratingWindows: 'soft-preference', adjacentDeltaRanges: 'soft-preference',
});
const J13_TARGET_PROFILE = Object.freeze(
  SLOT_DIFFICULTY_WINDOWS.map(([low, high]) => low === high ? low : Math.round((low + high) / 2)),
);
export { J13_TARGET_PROFILE };
// Compatibility alias for callers that adopted the earlier name.
export const DIVISION_AWARE_TARGET_PROFILE = J13_TARGET_PROFILE;
const SLOT_OUTSIDE_WEIGHT = 8;
const DELTA_OUTSIDE_WEIGHT = 1.5;
const DAILY_RATING_PROFILE_VERSION = 'simulator-prng-v1';
const TARGET_DISTANCE_WEIGHT = 1;

function validatePreferenceRange(range) {
  return Array.isArray(range) && range.length === 2
    && typeof range[0] === 'number' && Number.isFinite(range[0])
    && typeof range[1] === 'number' && (Number.isFinite(range[1]) || range[1] === Infinity)
    && range[1] >= range[0];
}
export function softIntervalPenalty(value, range, outsideWeight = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !validatePreferenceRange(range)) throw new Error('Invalid soft preference interval');
  const [low, high] = range;
  const outside = value < low ? low - value : Number.isFinite(high) && value > high ? value - high : 0;
  return outsideWeight * (outside / 100) ** 2;
}
export function slotWindowPenalty(rating, position) {
  if (!Number.isInteger(position) || position < 0 || position >= LADDER_SIZE) throw new Error('Invalid slot preference position');
  return softIntervalPenalty(rating, SLOT_DIFFICULTY_WINDOWS[position], SLOT_OUTSIDE_WEIGHT);
}
export const slotPreferencePenalty = slotWindowPenalty;
export function deltaPreferencePenalty(delta, transition) {
  if (!Number.isInteger(transition) || transition < 0 || transition >= LADDER_SIZE - 1) throw new Error('Invalid delta preference transition');
  return softIntervalPenalty(delta, ADJACENT_DELTA_RANGES[transition], DELTA_OUTSIDE_WEIGHT);
}
export const adjacentDeltaPenalty = deltaPreferencePenalty;

function targetDistancePenalty(rating, target) {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || typeof target !== 'number' || !Number.isFinite(target)) throw new Error('Invalid rating target');
  return TARGET_DISTANCE_WEIGHT * ((rating - target) / 100) ** 2;
}

function nextDailyRandom(state) {
  state.value ^= state.value << 13;
  state.value ^= state.value >>> 17;
  state.value ^= state.value << 5;
  return state.value >>> 0;
}

function gridValues([low, high]) {
  const values = [];
  for (let value = low; value <= high; value += 100) values.push(value);
  return values;
}

function oneSidedDeltaViolation(previous, rating, [low, high]) {
  const delta = rating - previous;
  return delta < low ? low - delta : delta > high ? delta - high : 0;
}

function targetCandidates(previous, window, deltaRange) {
  const values = gridValues(window);
  const valid = values.filter((value) => oneSidedDeltaViolation(previous, value, deltaRange) === 0);
  if (valid.length) return valid;
  const minimumViolation = Math.min(...values.map((value) => oneSidedDeltaViolation(previous, value, deltaRange)));
  return values.filter((value) => oneSidedDeltaViolation(previous, value, deltaRange) === minimumViolation);
}

// The research simulator previews a local sequential profile. Production uses
// a SHA-256-derived local stream for repeatability, and its global DP still
// resolves actual bucket capacity. The stream is not a copy of Python's
// module-global random state or sequence.
export async function buildJ13Targets(buckets, date, salt = SITE_SALT) {
  if (!isValidDateString(date)) throw new RangeError('Expected YYYY-MM-DD');
  if (!Array.isArray(buckets) || !buckets.length || buckets.some((bucket) => (
    typeof bucket?.rating !== 'number' || !Number.isFinite(bucket.rating)
    || !Array.isArray(bucket.items) || bucket.items.length < 1
  ))) {
    throw new Error('Invalid rating buckets for J13 targets');
  }
  const seed = await h32(salt, DAILY_RATING_PROFILE_VERSION, date);
  const random = { value: seed || 0x9e3779b9 };
  const targets = [SLOT_DIFFICULTY_WINDOWS[0][0]];
  for (let position = 1; position < LADDER_SIZE; position += 1) {
    const [low, high] = SLOT_DIFFICULTY_WINDOWS[position];
    const [deltaLow, deltaHigh] = ADJACENT_DELTA_RANGES[position - 1];
    const previous = targets[position - 1];
    const choices = targetCandidates(previous, [low, high], [deltaLow, deltaHigh]);
    targets.push(choices[nextDailyRandom(random) % choices.length]);
  }
  return targets;
}

// Keep earlier helper names source-compatible for existing callers.
export const buildDivisionAwareTargets = buildJ13Targets;
export const buildJ4Targets = buildJ13Targets;

function stateKey(bucketIndex, runLength) { return `${bucketIndex}:${runLength}`; }
function comparePath(a, b) {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}
function isBetterState(candidate, current) {
  if (!current || candidate.cost < current.cost) return true;
  if (candidate.cost > current.cost) return false;
  return comparePath(candidate.path, current.path) < 0;
}
function isBetterFinalState(candidate, current) {
  if (!current || candidate.cost < current.cost) return true;
  if (candidate.cost > current.cost) return false;
  return comparePath(candidate.path, current.path) < 0;
}

export function selectJ13BucketIndices(buckets, targetsOrOptions, maybeOptions = {}) {
  if (!Array.isArray(buckets) || !buckets.length) {
    throw new Error('Invalid J13 DP input');
  }
  if (buckets.some(bucket => !Array.isArray(bucket.items) || bucket.items.length < 1 || typeof bucket.rating !== 'number' || !Number.isFinite(bucket.rating))) {
    throw new Error('Invalid J13 DP buckets');
  }
  const targets = Array.isArray(targetsOrOptions) ? targetsOrOptions : [...J13_TARGET_PROFILE];
  if (targets && (targets.length !== LADDER_SIZE || targets.some(target => typeof target !== 'number' || !Number.isFinite(target)))) throw new Error('Invalid J13 DP targets');
  const options = Array.isArray(targetsOrOptions) ? maybeOptions : (targetsOrOptions || {});
  const allowEqual = options.allowEqual ?? options.allow_equal ?? true;
  const mode = options.mode || 'soft';
  if (mode !== 'soft' && mode !== 'hard') throw new Error('Invalid J13 selection mode');

  let states = new Map();
  for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
    const state = {
      bucketIndex,
      runLength: 1,
      cost: mode === 'hard' && slotWindowPenalty(buckets[bucketIndex].rating, 0) > 0 ? Infinity : slotWindowPenalty(buckets[bucketIndex].rating, 0) + targetDistancePenalty(buckets[bucketIndex].rating, targets[0]),
      path: [bucketIndex],
    };
    if (Number.isFinite(state.cost)) states.set(stateKey(bucketIndex, 1), state);
  }
  for (let position = 1; position < LADDER_SIZE; position += 1) {
    const next = new Map();
    for (const previous of states.values()) {
      for (let bucketIndex = previous.bucketIndex; bucketIndex < buckets.length; bucketIndex += 1) {
        const equal = bucketIndex === previous.bucketIndex;
        if (equal && !allowEqual) continue;
        const runLength = equal ? previous.runLength + 1 : 1;
        if (runLength > buckets[bucketIndex].items.length) continue;
        const delta = buckets[bucketIndex].rating - buckets[previous.bucketIndex].rating;
        if (mode === 'hard' && (slotWindowPenalty(buckets[bucketIndex].rating, position) > 0 || deltaPreferencePenalty(delta, position - 1) > 0)) continue;
        const state = {
          bucketIndex,
          runLength,
          cost: previous.cost
            + deltaPreferencePenalty(delta, position - 1)
            + slotWindowPenalty(buckets[bucketIndex].rating, position)
            + targetDistancePenalty(buckets[bucketIndex].rating, targets[position]),
          path: [...previous.path, bucketIndex],
        };
        const key = stateKey(bucketIndex, runLength);
        if (isBetterState(state, next.get(key))) next.set(key, state);
      }
    }
    if (!next.size) throw new Error('No feasible J13 ladder capacity');
    states = next;
  }
  let best = null;
  for (const state of states.values()) if (isBetterFinalState(state, best)) best = state;
  if (!best) throw new Error('No feasible J13 ladder capacity');
  return best.path;
}
export const selectDivisionAwareBucketIndices = selectJ13BucketIndices;
export const selectJ4BucketIndices = selectJ13BucketIndices;

export async function buildLadder(problems, date, salt = SITE_SALT, today = date, options = {}) {
  assertTrainingDate(date, today);
  const selectionOffsetDays = Math.round((Date.parse(`${SELECTION_EPOCH}T00:00:00Z`) - Date.parse(`${LAUNCH_DATE}T00:00:00Z`)) / 86400000);
  const selectionDate = date < LAUNCH_DATE ? date : shiftDate(date, selectionOffsetDays);
  const buckets = buildRatingBuckets(problems);
  if (!buckets.length) throw new Error('No eligible problems for daily ladder');
  const targets = await buildJ13Targets(buckets, selectionDate, salt);
  const bucketIndices = selectJ13BucketIndices(buckets, targets, { allowEqual: true, ...options });
  const used = new Set();
  const ladder = [];
  for (let position = 0; position < bucketIndices.length; position += 1) {
    const bucket = buckets[bucketIndices[position]];
    const start = await h32(salt, 'problem', selectionDate, position, bucket.rating) % bucket.items.length;
    let selected = null;
    for (let offset = 0; offset < bucket.items.length; offset += 1) {
      const candidate = bucket.items[(start + offset) % bucket.items.length];
      if (!used.has(stableProblemId(candidate))) {
        selected = candidate;
        break;
      }
    }
    if (!selected) throw new Error('No distinct candidate in selected J13 bucket');
    used.add(stableProblemId(selected));
    ladder.push(selected);
  }
  return ladder;
}

const NAMED_WINDOW_STARTS = Object.freeze(TRAINING_STAGE_KEYS.map((level) => LEVEL_STARTS[level]));
const NAMED_WINDOW_KEYS = TRAINING_STAGE_KEYS;
function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
export function ladderDiagnostics(ladder) {
  if (!Array.isArray(ladder) || ladder.length !== LADDER_SIZE || ladder.some(problem => !problem || typeof problem.rating !== 'number' || !Number.isFinite(problem.rating))) {
    throw new Error('Invalid ladder for diagnostics');
  }
  const ratings = ladder.map(problem => problem.rating);
  const globalQTransitionGaps = ratings.slice(1).map((rating, index) => rating - ratings[index]);
  const windows = Object.fromEntries(NAMED_WINDOW_KEYS.map((level, index) => {
    const windowRatings = ratings.slice(NAMED_WINDOW_STARTS[index], NAMED_WINDOW_STARTS[index] + 3);
    const internalAdjacentGaps = windowRatings.slice(1).map((rating, gapIndex) => rating - windowRatings[gapIndex]);
    return [level, {
      ratings: windowRatings,
      span: windowRatings.at(-1) - windowRatings[0],
      internalAdjacentGaps,
      maxInternalGap: Math.max(...internalAdjacentGaps),
      median: percentile(windowRatings, 0.5),
      p90: percentile(windowRatings, 0.9),
    }];
  }));
  return { windows, globalQTransitionGaps };
}
export const diagnoseLadder = ladderDiagnostics;

export function visibleProblems(ladder, { level = 'newbie', view = VIEW_PROVENANCE.WINDOW } = {}) {
  if (!Array.isArray(ladder)) return [];
  if (view === ALL_PROBLEMS_VIEW) return ladder.slice(0, LADDER_SIZE);
  const start = LEVEL_STARTS[level];
  return start === undefined ? [] : ladder.slice(start, start + 3);
}
export function ladderWindow(ladder, level, view = VIEW_PROVENANCE.WINDOW) {
  return visibleProblems(ladder, { level: level === ALL_PROBLEMS_VIEW ? 'newbie' : level, view: level === ALL_PROBLEMS_VIEW ? ALL_PROBLEMS_VIEW : view });
}

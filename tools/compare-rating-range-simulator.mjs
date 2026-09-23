import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as core from '../core.js';

const execFileAsync = promisify(execFile);
const SAMPLE_SIZE = Number(process.env.RATING_SAMPLE_SIZE ?? 128);
if (!Number.isInteger(SAMPLE_SIZE) || SAMPLE_SIZE < 1) throw new Error('RATING_SAMPLE_SIZE must be a positive integer');
const SIMULATOR_PATH = new URL('../../accept-research/rating-range-simulator/rating_simulator.py', import.meta.url).pathname;

const simulatorScript = `
import importlib.util
import json
import random
import sys

path = sys.argv[1]
spec = importlib.util.spec_from_file_location('rating_simulator', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
random.seed(20260915)
print(json.dumps([module.generate_ratings() for _ in range(int(sys.argv[2]))]))
`;

function dateFromOffset(offset) {
  return new Date(Date.UTC(2026, 8, 1 + offset)).toISOString().slice(0, 10);
}

function problem(contestId, index, rating) {
  return { contestId, index, name: `${contestId}-${index}`, rating, type: 'PROGRAMMING', tags: [] };
}

function denseInventory() {
  const records = [];
  let idIndex = 0;
  for (const [low, high] of core.SLOT_DIFFICULTY_WINDOWS) {
    for (let rating = low; rating <= high; rating += 100) {
      for (let copy = 0; copy < 4; copy += 1) {
        records.push(problem(core.APPROVED_CONTEST_IDS[idIndex], `D${copy}`, rating));
        idIndex += 1;
      }
    }
  }
  return records;
}

function sparseInventory() {
  const groups = [[800, 5], [1600, 3], [2400, 2], [3500, 3]];
  let idIndex = 0;
  return groups.flatMap(([rating, count]) => Array.from({ length: count }, (_, copy) => {
    const item = problem(core.APPROVED_CONTEST_IDS[idIndex], `S${copy}`, rating);
    idIndex += 1;
    return item;
  }));
}

function validateShape(ratings, windows, deltas) {
  const slotViolations = ratings.reduce((total, rating, position) => {
    const [low, high] = windows[position];
    return total + (rating < low || rating > high ? 1 : 0);
  }, 0);
  const realizedDeltas = ratings.slice(1).map((rating, index) => rating - ratings[index]);
  const deltaViolations = realizedDeltas.reduce((total, delta, transition) => {
    const [low, high] = deltas[transition];
    return total + (delta < low || delta > high ? 1 : 0);
  }, 0);
  return { slotViolations, deltaViolations, realizedDeltas };
}

function means(rows) {
  return rows[0].map((_, position) => rows.reduce((total, row) => total + row[position], 0) / rows.length);
}

function roundValues(values) {
  return values.map((value) => Number(value.toFixed(2)));
}

const { stdout } = await execFileAsync('python3', ['-c', simulatorScript, SIMULATOR_PATH, String(SAMPLE_SIZE)], { maxBuffer: 1024 * 1024 });
const simulatorRatings = JSON.parse(stdout);
const dense = denseInventory();
const productionLadders = [];
for (let offset = 0; offset < SAMPLE_SIZE; offset += 1) {
  productionLadders.push(await core.buildLadder(dense, dateFromOffset(offset), core.SITE_SALT, '2029-05-28'));
}
if (productionLadders.some((ladder) => ladder.length !== core.LADDER_SIZE)) {
  throw new Error('Production produced a ladder with the wrong slot count');
}
const productionRatings = productionLadders.map((ladder) => ladder.map((item) => item.rating));
const simulatorChecks = simulatorRatings.map((ratings) => {
  if (ratings.length !== core.LADDER_SIZE || ratings[0] !== 800) throw new Error('Simulator produced an invalid ladder shape');
  return validateShape(ratings, core.SLOT_DIFFICULTY_WINDOWS, core.ADJACENT_DELTA_RANGES);
});
const productionChecks = productionRatings.map((ratings) => validateShape(ratings, core.SLOT_DIFFICULTY_WINDOWS, core.ADJACENT_DELTA_RANGES));
const repeat = await core.buildLadder(dense, dateFromOffset(0), core.SITE_SALT, '2029-05-28');
const reordered = await core.buildLadder([...dense].reverse(), dateFromOffset(0), core.SITE_SALT, '2029-05-28');
if (repeat.length !== core.LADDER_SIZE || repeat.map(core.stableProblemId).join(',') !== reordered.map(core.stableProblemId).join(',')) {
  throw new Error('Production selection is not deterministic under input reordering');
}

const sparse = sparseInventory();
const sparseLadder = await core.buildLadder(sparse, '2026-09-01', core.SITE_SALT, '2029-05-28');
const sparseRatings = sparseLadder.map((item) => item.rating);
const sparsePath = core.selectJ13BucketIndices(core.buildRatingBuckets(sparse));
const sparseHardRejected = (() => {
  try {
    core.selectJ13BucketIndices(core.buildRatingBuckets(sparse), { mode: 'hard' });
    return false;
  } catch {
    return true;
  }
})();
if (sparseLadder.length !== core.LADDER_SIZE || new Set(sparseLadder.map(core.stableProblemId)).size !== core.LADDER_SIZE || !sparseHardRejected) {
  throw new Error('Sparse soft fallback contract failed');
}

const seen = new Set();
let repeatedExposures = 0;
let duplicateIdViolations = 0;
for (const ladder of productionLadders) {
  const ids = ladder.map(core.stableProblemId);
  duplicateIdViolations += ids.length - new Set(ids).size;
  for (const id of ids) {
    if (seen.has(id)) repeatedExposures += 1;
    seen.add(id);
  }
}
const simulatorMeans = means(simulatorRatings);
const productionMeans = means(productionRatings);
const meanDifference = simulatorMeans.reduce((total, value, position) => total + Math.abs(value - productionMeans[position]), 0) / core.LADDER_SIZE;
const report = {
  sampleSize: SAMPLE_SIZE,
  simulator: {
    slotCount: core.LADDER_SIZE,
    slotViolations: simulatorChecks.reduce((total, check) => total + check.slotViolations, 0),
    deltaViolations: simulatorChecks.reduce((total, check) => total + check.deltaViolations, 0),
    meanRatingByPosition: roundValues(simulatorMeans),
    uniqueRatingSignatures: new Set(simulatorRatings.map((ratings) => ratings.join(','))).size,
  },
  production: {
    slotCount: core.LADDER_SIZE,
    slotViolations: productionChecks.reduce((total, check) => total + check.slotViolations, 0),
    deltaViolations: productionChecks.reduce((total, check) => total + check.deltaViolations, 0),
    meanRatingByPosition: roundValues(productionMeans),
    uniqueRatingSignatures: new Set(productionRatings.map((ratings) => ratings.join(','))).size,
    duplicateIdViolations,
    repeatedExposures,
    deterministicUnderReordering: true,
  },
  meanAbsolutePositionMeanDifference: Number(meanDifference.toFixed(2)),
  sparseFallback: { ratings: sparseRatings, bucketPath: sparsePath, hardModeRejected: sparseHardRejected },
  interpretation: 'The Python preview is sequential and random; production is seeded, capacity-aware, and globally optimized. Compare shape and compact distributions, not exact sequences.',
};
console.log(JSON.stringify(report, null, 2));

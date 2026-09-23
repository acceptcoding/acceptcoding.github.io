import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const coreUrl = new URL('../core.js', import.meta.url).href;

async function runProbe(timezone, date, today) {
  const script = `
    import * as core from ${JSON.stringify(coreUrl)};
    const date = ${JSON.stringify(date)};
    const today = ${JSON.stringify(today)};
    const cutoff = Date.parse(date + 'T00:00:00Z');
    const records = [];
    const fixtureIds = core.APPROVED_CONTEST_IDS.slice(0, 26);
    for (let bucket = 0; bucket < 13; bucket += 1) {
      for (let copy = 0; copy < 2; copy += 1) {
        records.push({
          contestId: fixtureIds[bucket * 2 + copy],
          index: 'A',
          name: 'Fixture ' + bucket + '-' + copy,
          rating: 800 + bucket * 100,
          type: 'PROGRAMMING',
          tags: [],
        });
      }
    }
    const beforeId = core.APPROVED_CONTEST_IDS[22];
    const exactId = core.APPROVED_CONTEST_IDS[23];
    const afterId = core.APPROVED_CONTEST_IDS[24];
    records.push({ contestId: beforeId, index: 'A', name: 'Included before boundary', rating: 1900, type: 'PROGRAMMING', tags: [] });
    records.push({ contestId: exactId, index: 'A', name: 'Included at boundary', rating: 2000, type: 'PROGRAMMING', tags: [] });
    records.push({ contestId: afterId, index: 'A', name: 'Excluded after boundary', rating: 2100, type: 'PROGRAMMING', tags: [] });
    records.push({ contestId: 9901, index: 'A', name: 'Excluded unapproved contest', rating: 2200, type: 'PROGRAMMING', tags: [] });
    const contests = records.map((problem) => ({
      id: problem.contestId,
      startTimeSeconds: problem.contestId === beforeId ? (cutoff - 2000) / 1000 :
        problem.contestId === exactId || problem.contestId === afterId ? (cutoff - 1000) / 1000 :
        (cutoff - 86400000) / 1000,
      durationSeconds: problem.contestId === beforeId || problem.contestId === 9901 ? 1 :
        problem.contestId === exactId ? 1 :
        problem.contestId === afterId ? 2 : 1,
    }));
    const bounds = core.localDayBounds(date);
    const eligible = core.filterHistoricalProblems(records, contests, date, today);
    const buckets = core.buildRatingBuckets(eligible);
    const targets = await core.buildJ4Targets(buckets, date);
    const bucketIndices = core.selectJ4BucketIndices(buckets, targets);
    const ladder = await core.buildLadder(eligible, date, core.SITE_SALT, today);
    console.log(JSON.stringify({
      bounds,
      duration: bounds.end - bounds.start,
      eligible: eligible.map(core.stableProblemId).sort(),
      buckets: buckets.map((bucket) => [bucket.rating, bucket.items.map(core.stableProblemId)]),
      targets,
      bucketIndices,
      ladder: ladder.map(core.stableProblemId),
    }));
  `;
  console.error('PROBE_SCRIPT', timezone, script);
  let stdout;
  try {
    ({ stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }));
  } catch (error) {
    console.error(timezone, error);
    throw error;
  }
  console.error('PROBE_OUTPUT', timezone, JSON.stringify(stdout));
  return JSON.parse(stdout.trim());
}

test('explicit dates have identical UTC bounds, eligibility, buckets, J4 choices, and ladders across timezones', async () => {
  const probes = await Promise.all([
    runProbe('UTC', '2026-09-09', '2026-09-10'),
    runProbe('America/Sao_Paulo', '2026-09-09', '2026-09-10'),
    runProbe('Asia/Tokyo', '2026-09-09', '2026-09-10'),
  ]);
  const expectedBounds = { start: Date.UTC(2026, 8, 9), end: Date.UTC(2026, 8, 10) };
  for (const probe of probes) {
    assert.deepEqual(probe.bounds, expectedBounds);
    assert.equal(probe.duration, 86400000);
    assert.ok(probe.eligible.some(id => id.endsWith(':A')));
    assert.ok(probe.eligible.includes('377:A'));
    assert.ok(probe.eligible.includes('378:A'));
    assert.ok(!probe.eligible.includes('380:A'));
    assert.ok(!probe.eligible.includes('9901:A'));
    assert.equal(probe.bucketIndices.length, 13);
    assert.equal(probe.ladder.length, 13);
    assert.equal(new Set(probe.ladder).size, 13);
  }
  assert.deepEqual(probes[1], probes[0]);
  assert.deepEqual(probes[2], probes[0]);
});

test('canonical UTC boundaries remain 24 hours across a DST transition', async () => {
  const [newYork, utc] = await Promise.all([
    runProbe('America/New_York', '2026-11-01', '2026-11-02'),
    runProbe('UTC', '2026-11-01', '2026-11-02'),
  ]);
  assert.deepEqual(newYork, utc);
  assert.deepEqual(newYork.bounds, { start: Date.UTC(2026, 10, 1), end: Date.UTC(2026, 10, 2) });
  assert.equal(newYork.duration, 86400000);
});

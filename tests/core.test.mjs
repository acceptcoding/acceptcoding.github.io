import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';

const problem = (contestId, index, rating = 800, extra = {}) => ({ contestId, index, name: `${contestId}-${index}`, rating, type: 'PROGRAMMING', tags: [], ...extra });
const approvedFixtureId = (index) => core.APPROVED_CONTEST_IDS[index];
const poolFixture = Array.from({ length: 35 }, (_, index) => problem(approvedFixtureId(index), `A${index}`, 800 + index * 80));

test('local dates are strict, launch-relative, and bounded', () => {
  assert.equal(core.V6_EFFECTIVE_DATE, '2026-09-01');
  assert.equal(core.LAUNCH_DATE, '2026-09-21');
  assert.equal(core.CALENDAR_MIN_MONTH, '2026-09');
  assert.equal(core.SITE_SALT, 'accept-daily-selection-v5-language-aware-whole-rating');
  assert.equal(core.isValidDateString('2026-02-28'), true);
  assert.equal(core.isValidDateString('2026-2-28'), false);
  assert.equal(core.isValidDateString('2026-02-29'), false);
  assert.equal(core.dayIndexForDate('2026-09-01', '2026-09-09'), 0);
  assert.equal(core.dayIndexForDate('2026-09-02', '2026-09-09'), 1);
  assert.equal(core.dayIndexForDate('2026-09-07', '2026-09-09'), 6);
  assert.equal(core.dayIndexForDate('2026-09-08', '2026-09-09'), 7);
  assert.throws(() => core.dayIndexForDate('2026-08-31', '2026-09-09'), RangeError);
  assert.equal(core.todayAtLocal(new Date(2026, 8, 10, 0, 0, 0)), '2026-09-10');
  assert.equal(core.todayAtLocal(new Date(2026, 8, 10, 23, 59, 59)), '2026-09-10');
  assert.equal(core.isSelectableDate('2026-08-31', '2026-09-10'), false);
  assert.equal(core.isSelectableDate('2026-09-08', '2026-09-10'), true);
  assert.equal(core.isSelectableDate('2026-09-10', '2026-09-10'), true);
  assert.equal(core.isSelectableDate('2026-09-11', '2026-09-10'), false);
  assert.equal(core.sundayStart('2026-09-07'), '2026-09-06');
  assert.equal(core.sundayStart('2026-09-12'), '2026-09-06');
});

test('week navigation preserves weekdays and falls back within bounded weeks', () => {
  const today = '2026-09-11';
  assert.equal(core.weekNavigationTarget('2026-09-10', -1, today), '2026-09-03');
  assert.equal(core.weekNavigationTarget('2026-09-04', 1, today), '2026-09-11');
  assert.equal(core.weekNavigationTarget('2026-09-06', -1, today), '2026-09-01');
  assert.equal(core.weekNavigationTarget('2026-09-05', 1, today), '2026-09-11');
  assert.equal(core.weekNavigationTarget('2026-09-01', -1, today), null);
  assert.equal(core.weekNavigationTarget('2026-09-11', 1, today), null);
  assert.equal(core.weekNavigationTarget('2026-12-31', -1, '2027-01-10'), '2026-12-24');
  assert.equal(core.weekNavigationTarget('2026-12-27', 1, '2027-01-10'), '2027-01-03');
  assert.throws(() => core.weekNavigationTarget('2026-09-10', 0, today), RangeError);
});

test('one validator canonicalizes pre-launch, future, malformed, and impossible dates', () => {
  const today = '2026-09-09';
  assert.deepEqual(core.validateTrainingDate('2026-09-01', today), { valid: true, date: '2026-09-01', reason: null });
  assert.deepEqual(core.validateTrainingDate('2026-08-31', today), { valid: false, date: '2026-09-01', reason: 'prelaunch' });
  assert.deepEqual(core.validateTrainingDate('2026-09-10', today), { valid: false, date: today, reason: 'future' });
  assert.deepEqual(core.validateTrainingDate('banana', today), { valid: false, date: today, reason: 'invalid' });
  assert.deepEqual(core.validateTrainingDate('2026-02-30', today), { valid: false, date: today, reason: 'invalid' });
  assert.deepEqual(core.validateTrainingDate('2026-13-99', today), { valid: false, date: today, reason: 'invalid' });
  assert.equal(core.canonicalTrainingDate('2026-08-31', today), '2026-09-01');
  assert.equal(core.canonicalTrainingDate('2099-01-01', today), today);
});

test('URL state sanitizes dates without changing valid level semantics', () => {
  const cases = [
    ['2026-08-31', '2026-09-01'], ['2026-09-10', '2026-09-09'], ['2099-01-01', '2026-09-09'],
    ['1900-01-01', '2026-09-01'], ['banana', '2026-09-09'], ['', '2026-09-09'], ['2026-02-30', '2026-09-09'], ['2026-13-99', '2026-09-09'],
  ];
  for (const [requested, expected] of cases) assert.equal(core.parseUrlState(`https://example.test/?date=${requested}&level=master`, '2026-09-09').date, expected);
  assert.deepEqual(core.parseUrlState('https://example.test/?date=2026-09-10&level=master', '2026-09-09'), { date: '2026-09-09', level: 'master', view: 'window' });
  assert.equal(core.parseUrlState('https://example.test/?date=2026-09-10&level=div3', '2026-09-09').level, 'special');
});

test('selection and ladder reject dates outside the canonical range', async () => {
  await assert.rejects(() => core.buildLadder(poolFixture, '2026-08-31', core.SITE_SALT, '2026-09-09'), RangeError);
  await assert.rejects(() => core.buildLadder(poolFixture, '2026-09-10', core.SITE_SALT, '2026-09-09'), RangeError);
});

test('eligibility, stable IDs, and unrated exclusion remain explicit', () => {
  assert.equal(core.MIN_CONTEST_ID, 355);
  const records = [problem(354, 'A'), problem(355, 'A', 801), problem(356, 'A', 900), problem(357, 'A', 3500), problem(358, 'A', 3501), problem(359, 'A', 1200, { tags: ['*special'] }), problem(360, 'A', 1600, { type: 'GYM' }), problem(361, 'A', 1600), problem(362, 'B', 1600)];
  assert.deepEqual(core.filterEligibleProblems(records).map(core.stableProblemId), ['355:A', '356:A', '357:A', '358:A', '361:A', '362:B']);
  assert.equal(core.isEligibleProblem(problem('355', 'A')), true);
  assert.equal(core.isEligibleProblem(problem(354, 'A')), false);
  assert.equal(core.isEligibleProblem(problem('not-a-contest', 'A')), false);
  assert.equal(core.filterEligibleProblems([problem(363, 'A', null)]).length, 0);
});

test('English exclusion is flat, isolated, order-independent, and conservative', () => {
  const unavailable = problem(524, 'A', 1600);
  const sibling = problem(525, 'B', 1600);
  const normal = problem(525, 'A', 800);
  const records = [sibling, unavailable, normal];
  assert.equal(core.isEligibleProblem(unavailable), false);
  assert.equal(core.isEligibleProblem(sibling), true);
  assert.equal(core.isEligibleProblem(normal), true);
  assert.deepEqual(core.filterEligibleProblems(records).map(core.stableProblemId), ['525:B', '525:A']);
  assert.deepEqual(core.filterEligibleProblems([...records].reverse()).map(core.stableProblemId), ['525:A', '525:B']);
  assert.deepEqual(core.buildRatingBuckets(records).map(bucket => [bucket.rating, bucket.items.map(core.stableProblemId)]), [[800, ['525:A']], [1600, ['525:B']]]);
});

test('unknown audit state is not an exclusion and contest 524 remains mixed', () => {
  assert.equal(core.isEligibleProblem(problem(525, 'B', 1600)), true);
  assert.equal(core.filterEligibleProblems([problem(524, 'A', 1600), problem(525, 'B', 1600)]).length, 1);
  assert.equal(core.MANUAL_EXCLUSIONS.includes('524'), false);
  assert.deepEqual(core.MANUAL_EXCLUSIONS, ['524:A']);
});

test('Russian-only title contests are excluded without catching one-character homoglyphs', () => {
  const russianOnly = [
    problem(648, 'A', 900, { name: 'Наибольший подъем' }),
    problem(649, 'A', 1000, { name: 'Любимые числа Поликарпа' }),
    problem(929, 'D', 2400, { name: 'Пограничные врата' }),
  ];
  const mixedContest = [
    problem(524, 'A', 1600, { name: 'Возможно, вы знаете этих людей?' }),
    problem(524, 'C', 1900, { name: 'The Art of Dealing with ATM' }),
  ];
  const homoglyphs = [
    problem(554, 'E', 2700, { name: 'Vacuum Сleaner' }),
    problem(555, 'A', 1200, { name: 'Chewbaсca and Number' }),
    problem(1098, 'F', 3500, { name: 'Ж-function' }),
  ];
  assert.deepEqual(core.MANUAL_EXCLUDED_CONTESTS, ['648', '649', '929']);
  assert.deepEqual(core.filterEligibleProblems(russianOnly), []);
  assert.deepEqual(core.filterEligibleProblems(mixedContest).map(core.stableProblemId), ['524:C']);
  assert.deepEqual(core.filterEligibleProblems(homoglyphs).map(core.stableProblemId), ['554:E', '555:A', '1098:F']);
});

test('excluded records stay out of fully excluded contests, pools, ladders, and cache validation inputs', async () => {
  assert.deepEqual(core.filterEligibleProblems([problem(524, 'A', 1600)]), []);
  const records = [...poolFixture, problem(524, 'A', 3600)];
  const bucketIds = core.buildRatingBuckets(records).flatMap(bucket => bucket.items).map(core.stableProblemId);
  assert.equal(bucketIds.includes('524:A'), false);
  const ladder = await core.buildLadder(records, '2026-09-01', core.SITE_SALT, '2026-09-09');
  assert.equal(ladder.some((item) => core.stableProblemId(item) === '524:A'), false);
});

test('rating buckets are exact-rating, monotonic, order-independent, and complete', () => {
  const reversed = [...poolFixture].reverse();
  const buckets = core.buildRatingBuckets(poolFixture);
  const reordered = core.buildRatingBuckets(reversed);
  assert.equal(buckets.length, poolFixture.length);
  assert.deepEqual(buckets.flatMap(bucket => bucket.items).map(core.stableProblemId), poolFixture.map(core.stableProblemId));
  assert.deepEqual(reordered.map(bucket => bucket.items.map(core.stableProblemId)), buckets.map(bucket => bucket.items.map(core.stableProblemId)));
  assert.ok(buckets.every(bucket => bucket.items.every(item => item.rating === bucket.rating)));
  assert.ok(buckets.every((bucket, index) => index === 0 || bucket.rating > buckets[index - 1].rating));
  assert.deepEqual(buckets.map(bucket => bucket.rating), poolFixture.map(item => item.rating));
});

test('rating buckets keep repeated exact ratings together', () => {
  const tied = [...Array.from({ length: 10 }, (_, index) => problem(355 + index, 'A', 800 + index * 100)), ...Array.from({ length: 8 }, (_, index) => problem(365 + index, 'B', 1800))];
  const buckets = core.buildRatingBuckets([...tied].reverse());
  assert.equal(buckets.flatMap(bucket => bucket.items).length, tied.length);
  assert.deepEqual(buckets.map(bucket => [bucket.rating, bucket.items.length]), [[800, 1], [900, 1], [1000, 1], [1100, 1], [1200, 1], [1300, 1], [1400, 1], [1500, 1], [1600, 1], [1700, 1], [1800, 8]]);
  assert.equal(buckets.at(-1).items.every(item => item.rating === 1800), true);
});

test('duplicate identities select one canonical record before bucketing', () => {
  const duplicateId = approvedFixtureId(0);
  const canonical = problem(String(duplicateId), 'A', 800, { name: 'canonical record' });
  const alternate = problem(duplicateId, 'A', 3600, { name: 'z alternate record' });
  const canonicalized = core.canonicalizeEligibleProblems([alternate, canonical, poolFixture[1]]);
  assert.deepEqual(canonicalized.map(core.stableProblemId), [`${duplicateId}:A`, core.stableProblemId(poolFixture[1])]);
  assert.equal(canonicalized[0].name, 'canonical record');
  assert.equal(canonicalized[0].rating, 800);
  assert.equal(core.buildRatingBuckets([alternate, canonical]).flatMap(bucket => bucket.items).length, 1);
});

test('historical rating buckets use only the date-bounded eligible inventory', () => {
  const records = Array.from({ length: 22 }, (_, index) => problem(355 + index, 'A', 800 + index * 100));
  const bounds = core.localDayBounds('2026-09-01');
  const contests = records.map((item, index) => ({ id: item.contestId, startTimeSeconds: (bounds.start + (index < 11 ? -1000 : 1000)) / 1000, durationSeconds: 1 }));
  const historical = core.filterHistoricalProblems(records, contests, '2026-09-01', '2026-09-09');
  const buckets = core.buildRatingBuckets(historical);
  assert.equal(buckets.flatMap(bucket => bucket.items).length, 11);
  assert.deepEqual(buckets.flatMap(bucket => bucket.items).map(core.stableProblemId), records.slice(0, 11).map(core.stableProblemId));
});

test('historical filtering completes contests at or before UTC midnight only', () => {
  const date = '2026-09-09';
  const cutoff = core.localDayBounds(date).start / 1000;
  const ids = core.APPROVED_CONTEST_IDS.slice(0, 6);
  const records = [
    problem(ids[0], 'A', 800), problem(ids[1], 'A', 900), problem(ids[2], 'A', 1000),
    problem(ids[3], 'A', 1100), problem(ids[4], 'A', 1200), problem(9901, 'A', 1300),
  ];
  const contests = [
    { id: ids[0], startTimeSeconds: cutoff - 2000, durationSeconds: 1000 },
    { id: ids[1], startTimeSeconds: cutoff - 1000, durationSeconds: 1000 },
    { id: ids[2], startTimeSeconds: cutoff - 1000, durationSeconds: 1001 },
    { id: ids[3], startTimeSeconds: cutoff - 1000 },
    { id: ids[4], startTimeSeconds: Number.NaN, durationSeconds: 1000 },
    { id: 9901, startTimeSeconds: cutoff - 2000, durationSeconds: 1000 },
  ];
  assert.deepEqual(core.filterHistoricalProblems(records, contests, date).map(core.stableProblemId), [`${ids[0]}:A`, `${ids[1]}:A`]);
});

test('soft preferences and bucket positions are deterministic and capacity-aware', async () => {
  const date = '2026-09-09';
  const buckets = core.buildRatingBuckets(poolFixture);
  const targets = await core.buildJ4Targets(buckets, date);
  const repeatTargets = await core.buildJ4Targets(core.buildRatingBuckets([...poolFixture].reverse()), date);
  const positions = core.selectJ4BucketIndices(buckets);
  assert.equal(targets.length, 13);
  assert.deepEqual(targets, [800, 900, 1100, 1200, 1400, 1500, 1700, 2000, 2200, 2600, 2800, 3200, 3500]);
  assert.ok(targets.every((target, position) => {
    const [low, high] = core.SLOT_DIFFICULTY_WINDOWS[position];
    return target >= low && target <= high;
  }));
  assert.deepEqual(repeatTargets, targets);
  assert.equal(positions.length, 13);
  assert.ok(positions.every((index, position) => index >= 0 && index < buckets.length && (position === 0 || index >= positions[position - 1])));

  const ladder = await core.buildLadder(poolFixture, date, core.SITE_SALT, date);
  assert.equal(ladder.length, 13);
  assert.equal(new Set(ladder.map(core.stableProblemId)).size, 13);
  assert.ok(ladder.every((item, index) => item.rating >= (index ? ladder[index - 1].rating : -Infinity)));
});

test('daily rating profile varies when the inventory offers alternatives', async () => {
  const records = Array.from({ length: 13 }, (_, position) => {
    const [low, high] = core.SLOT_DIFFICULTY_WINDOWS[position];
    const ratings = low === high ? [low] : [low, high];
    return ratings.map((rating, choice) => problem(approvedFixtureId(position * 2 + choice), `P${choice}`, rating));
  }).flat();
  const signatures = new Set();
  for (let day = 1; day <= 30; day += 1) {
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    const ladder = await core.buildLadder(records, date, core.SITE_SALT, date);
    signatures.add(ladder.map(item => item.rating).join(','));
  }
  assert.ok(signatures.size > 1);
  const buckets = core.buildRatingBuckets(records);
  const saltA = await core.buildJ4Targets(buckets, '2026-09-15', 'salt-a');
  const saltB = await core.buildJ4Targets(buckets, '2026-09-15', 'salt-b');
  assert.notDeepEqual(saltA, saltB);
  const uniquePath = core.SLOT_DIFFICULTY_WINDOWS.map(([low], position) => problem(approvedFixtureId(position), 'U', low));
  const uniqueA = await core.buildLadder(uniquePath, '2026-09-01', core.SITE_SALT, '2026-09-01');
  const uniqueB = await core.buildLadder(uniquePath, '2026-09-02', core.SITE_SALT, '2026-09-02');
  assert.deepEqual(uniqueA.map(item => item.rating), uniqueB.map(item => item.rating));
});

test('slot and delta constants use soft interval preferences', () => {
  assert.deepEqual(core.SLOT_DIFFICULTY_WINDOWS, [
    [800, 800], [900, 1000], [1000, 1100], [1200, 1300], [1400, 1500], [1500, 1700],
    [1700, 1800], [1900, 2000], [2100, 2300], [2400, 2600], [2700, 2900], [3000, 3200], [3300, 3500],
  ]);
  assert.deepEqual(core.ADJACENT_DELTA_RANGES, [
    [100, 200], [100, 200], [100, 200], [100, 200], [100, 200], [100, 200],
    [200, 300], [200, 300], [200, 400], [200, 400], [200, 500], [200, 500],
  ]);
  assert.deepEqual(core.DIVISION_AWARE_TARGET_PROFILE, [800, 950, 1050, 1250, 1450, 1600, 1750, 1950, 2200, 2500, 2800, 3100, 3400]);
  assert.ok(core.slotWindowPenalty(850, 0) > 0);
  assert.ok(core.slotWindowPenalty(800, 0) < core.slotWindowPenalty(700, 0));
  assert.ok(core.slotWindowPenalty(1000, 0) < core.slotWindowPenalty(1100, 0));
  assert.ok(core.deltaPreferencePenalty(50, 4) > 0);
  assert.equal(core.deltaPreferencePenalty(150, 4), 0);
  assert.equal(core.deltaPreferencePenalty(150, 5), 0);
  assert.ok(core.deltaPreferencePenalty(50, 5) > core.deltaPreferencePenalty(200, 5));
  assert.equal(core.deltaPreferencePenalty(300, 9), 0);
  assert.ok(core.deltaPreferencePenalty(100, 9) > core.deltaPreferencePenalty(200, 9));
});

test('simulator boundaries are inclusive and transition indices exclude the leading placeholder', () => {
  for (const [position, [low, high]] of core.SLOT_DIFFICULTY_WINDOWS.entries()) {
    assert.equal(core.slotWindowPenalty(low, position), 0);
    assert.equal(core.slotWindowPenalty(high, position), 0);
  }
  for (const [transition, [low, high]] of core.ADJACENT_DELTA_RANGES.entries()) {
    assert.equal(core.deltaPreferencePenalty(low, transition), 0);
    assert.equal(core.deltaPreferencePenalty(high, transition), 0);
  }
  assert.equal(core.ADJACENT_DELTA_RANGES.length, core.LADDER_SIZE - 1);
  assert.throws(() => core.deltaPreferencePenalty(100, core.LADDER_SIZE - 1), /transition/);
});

test('hard selector mode enforces the fixed position contract', () => {
  const exactRatings = [800, 900, 1000, 1200, 1400, 1500, 1700, 1900, 2100, 2400, 2700, 3000, 3300];
  const records = exactRatings.map((rating, index) => problem(approvedFixtureId(index), 'A', rating));
  const buckets = core.buildRatingBuckets(records);
  assert.deepEqual(core.selectDivisionAwareBucketIndices(buckets, { mode: 'hard' }), [...Array(13).keys()]);
  assert.throws(() => core.selectDivisionAwareBucketIndices(
    core.buildRatingBuckets(records.map((item, index) => index === 0 ? { ...item, rating: 900 } : item)),
    { mode: 'hard' },
  ), /feasible/);
  assert.equal(core.SELECTION_RULES.ratingWindows, 'soft-preference');
  assert.equal(core.SELECTION_RULES.adjacentDeltaRanges, 'soft-preference');
});

test('dense inventory follows the candidate slot ladder and sparse inventory relaxes gracefully', async () => {
  const records = Array.from({ length: 28 }, (_, index) => problem(approvedFixtureId(index), `A${index}`, 800 + index * 100));
  const buckets = core.buildRatingBuckets(records);
  const selectedRatings = core.selectDivisionAwareBucketIndices(buckets).map((index) => buckets[index].rating);
  assert.ok(selectedRatings.every((rating, index) => {
    const [low, high] = core.SLOT_DIFFICULTY_WINDOWS[index];
    return rating >= low && rating <= high;
  }));
  const selectedDeltas = selectedRatings.slice(1).map((rating, index) => rating - selectedRatings[index]);
  assert.ok(selectedDeltas.every((delta, index) => {
    const [low, high] = core.ADJACENT_DELTA_RANGES[index];
    return delta >= low && delta <= high;
  }));
  const sparseRecords = Array.from({ length: 13 }, (_, index) => problem(approvedFixtureId(index), `S${index}`, index < 5 ? 800 : index < 8 ? 1600 : index < 10 ? 2400 : 3500));
  const sparseBuckets = core.buildRatingBuckets(sparseRecords);
  const sparseRatings = core.selectDivisionAwareBucketIndices(sparseBuckets).map((index) => sparseBuckets[index].rating);
  assert.deepEqual(sparseRatings, [800, 800, 800, 800, 800, 1600, 1600, 1600, 2400, 2400, 3500, 3500, 3500]);
  assert.equal(new Set(sparseRecords.map(core.stableProblemId)).size, 13);
});

test('soft mode falls back on a pathological single-rating inventory while hard mode reports infeasibility', () => {
  const pathological = [{
    rating: 3500,
    items: Array.from({ length: 13 }, (_, index) => problem(approvedFixtureId(index), `P${index}`, 3500)),
  }];
  const positions = core.selectJ13BucketIndices(pathological);
  assert.deepEqual(positions, Array(13).fill(0));
  assert.throws(() => core.selectJ13BucketIndices(pathological, { mode: 'hard' }), /capacity|feasible/);
});

test('ladder diagnostics expose division windows and global transitions', () => {
  const ladder = Array.from({ length: 13 }, (_, index) => problem(approvedFixtureId(index), `A${index}`, [800, 900, 1000, 1100, 1200, 1300, 1400, 2000, 2300, 2700, 3000, 3200, 3500][index]));
  const diagnostics = core.ladderDiagnostics(ladder);
  assert.deepEqual(diagnostics.windows.newbie, {
    ratings: [800, 900, 1000], span: 200, internalAdjacentGaps: [100, 100], maxInternalGap: 100,
    median: 900, p90: 980,
  });
  assert.equal(diagnostics.windows.pupil.span, 200);
  assert.equal(diagnostics.windows.expert.maxInternalGap, 600);
  assert.equal(diagnostics.windows.master.maxInternalGap, 400);
  assert.equal(diagnostics.windows.legend.maxInternalGap, 300);
  assert.deepEqual(diagnostics.globalQTransitionGaps, [100, 100, 100, 100, 100, 100, 600, 300, 400, 300, 200, 300]);
});

test('J4 repeated exact-rating selection respects capacity and rejects impossible capacity', () => {
  const buckets = [
    { rating: 800, items: Array.from({ length: 3 }, (_, index) => problem(approvedFixtureId(index), `A${index}`, 800)) },
    { rating: 1000, items: Array.from({ length: 10 }, (_, index) => problem(approvedFixtureId(index + 3), `A${index}`, 1000)) },
  ];
  const positions = core.selectJ4BucketIndices(buckets, Array(13).fill(800));
  assert.deepEqual(positions, [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.throws(() => core.selectJ4BucketIndices([{ rating: 800, items: Array(12).fill(problem(approvedFixtureId(0), 'A', 800)) }], Array(13).fill(800)), /capacity/);
  assert.throws(() => core.selectJ4BucketIndices(buckets, Array(13).fill(800), { allowEqual: false }), /capacity/);
});

test('future-only additions do not change a prior date inventory or ladder', async () => {
  const date = '2026-09-09';
  const bounds = core.localDayBounds(date);
  const contests = poolFixture.map(item => ({ id: item.contestId, startTimeSeconds: (bounds.start - 1000) / 1000, durationSeconds: 1 }));
  const future = problem(approvedFixtureId(40), 'A', 4000);
  const futureContest = { id: future.contestId, startTimeSeconds: (bounds.end + 1000) / 1000, durationSeconds: 1 };
  const prior = core.filterHistoricalProblems(poolFixture, contests, date);
  const withFuture = core.filterHistoricalProblems([...poolFixture, future], [...contests, futureContest], date);
  assert.deepEqual(withFuture.map(core.stableProblemId), prior.map(core.stableProblemId));
  assert.deepEqual(
    (await core.buildLadder(withFuture, date, core.SITE_SALT, date)).map(core.stableProblemId),
    (await core.buildLadder(prior, date, core.SITE_SALT, date)).map(core.stableProblemId),
  );
});

test('different selectable dates keep the soft objective and vary deterministic ratings and IDs', async () => {
  const records = Array.from({ length: 22 }, (_, index) => problem(approvedFixtureId(index), `D${index}`, 800 + Math.floor(index / 2) * 100));
  const signatures = [];
  const ratingSignatures = [];
  for (const date of ['2026-09-21', '2026-09-22', '2026-09-29', '2026-10-01']) {
    const ladder = await core.buildLadder(records, date, core.SITE_SALT, '2026-10-01');
    signatures.push(ladder.map(core.stableProblemId).join(','));
    ratingSignatures.push(ladder.map((item) => item.rating).join(','));
  }
  assert.ok(new Set(signatures).size > 1);
  assert.ok(new Set(ratingSignatures).size > 1);
});

test('public launch reuses the September 1 selection seed', async () => {
  const publicLadder = await core.buildLadder(poolFixture, '2026-09-21', core.SITE_SALT, '2026-09-30');
  const originalLadder = await core.buildLadder(poolFixture, '2026-09-01', core.SITE_SALT, '2026-09-09');
  assert.deepEqual(publicLadder.map(core.stableProblemId), originalLadder.map(core.stableProblemId));
});
test('preserved-salt selection is repeatable and uses thirteen distinct whole-rating members', async () => {
  const ladder = await core.buildLadder(poolFixture, '2026-09-01', core.SITE_SALT, '2026-09-09');
  const repeat = await core.buildLadder([...poolFixture].reverse(), '2026-09-01', core.SITE_SALT, '2026-09-09');
  assert.equal(ladder.length, 13);
  assert.equal(new Set(ladder.map(core.stableProblemId)).size, 13);
  assert.deepEqual(repeat.map(core.stableProblemId), ladder.map(core.stableProblemId));

  assert.ok(ladder.every((item, index) => item.rating >= (index ? ladder[index - 1].rating : -Infinity)));
  const items = [problem(2, 'B'), problem(1, 'A')];
  assert.equal(core.selectPoolItem(items, -1), items[items.length - 1]);
});

test('builds thirteen-problem ladder and six stride-two three-problem windows', async () => {
  const ladder = await core.buildLadder(poolFixture, '2026-09-09', core.SITE_SALT, '2026-09-09');
  assert.equal(ladder.length, 13);
  assert.deepEqual(core.LADDER_WINDOWS, {
    newbie: ['Q0', 'Q1', 'Q2'], pupil: ['Q2', 'Q3', 'Q4'], special: ['Q4', 'Q5', 'Q6'],
    expert: ['Q6', 'Q7', 'Q8'], master: ['Q8', 'Q9', 'Q10'], legend: ['Q10', 'Q11', 'Q12'],
  });
  const namedLevels = core.TRAINING_STAGE_KEYS;
  const windows = namedLevels.map((level) => core.ladderWindow(ladder, level).map(core.stableProblemId));
  for (let index = 0; index < windows.length - 1; index += 1) {
    assert.equal(windows[index].filter((id) => windows[index + 1].includes(id)).length, 1);
    for (let later = index + 2; later < windows.length; later += 1) assert.equal(windows[index].filter((id) => windows[later].includes(id)).length, 0);
  }
  assert.deepEqual(core.ladderWindow(ladder, 'expert').map(core.stableProblemId), ladder.slice(6, 9).map(core.stableProblemId));
  assert.deepEqual(core.LADDER_WINDOWS.master, ['Q8', 'Q9', 'Q10']);
  assert.deepEqual(core.LADDER_WINDOWS.legend, ['Q10', 'Q11', 'Q12']);
  assert.deepEqual(core.ladderWindow(ladder, 'all'), ladder);
});

test('default and inferred levels respect explicit overrides', () => {
  assert.equal(core.resolveLevel(), 'newbie');
  assert.equal(core.resolveLevel({ profile: { rank: 'specialist' } }), 'special');
  assert.equal(core.resolveLevel({ profile: { rank: 'expert' } }), 'expert');
  assert.equal(core.resolveLevel({ profile: { rank: 'grandmaster' } }), 'master');
  assert.equal(core.resolveLevel({ profile: { rank: 'legendary grandmaster' } }), 'legend');
  assert.equal(core.resolveLevel({ currentLevel: 'expert', explicit: true, profile: { rank: 'grandmaster' } }), 'expert');
  assert.equal(core.resolveLevel({ currentLevel: 'newbie', explicit: false, profile: { rank: 'specialist' } }), 'special');
});

test('level inference has explicit provenance and unrated profiles fall back to Newbie', () => {
  assert.equal(core.inferLadder({}), 'newbie');
  assert.equal(core.inferLadder({ rank: 'unknown' }), 'newbie');
  assert.equal(core.resolveLevel({ currentLevel: 'master', provenance: 'inferred', profile: { rank: 'expert' } }), 'expert');
  assert.equal(core.resolveLevel({ currentLevel: 'master', provenance: 'manual', profile: { rank: 'expert' } }), 'master');
  assert.equal(core.resolveLevel({ currentLevel: 'all', provenance: 'manual', profile: { rank: 'legendary grandmaster' } }), 'newbie');
});

test('rank uses rank first and rating fallback', () => {
  assert.equal(core.inferLadder({ rank: 'expert', rating: 800 }), 'expert');
  assert.equal(core.inferLadder({ rank: 'unknown', rating: 2150 }), 'master');
  assert.equal(core.inferLadder({ rating: 500 }), 'newbie');
});

test('URL parsing accepts only selectable date and visible level', () => {
  assert.deepEqual(core.parseUrlState('https://example.test/?date=2026-09-09&level=expert', '2026-09-10'), { date: '2026-09-09', level: 'expert', view: 'window' });
  assert.deepEqual(core.parseUrlState('https://example.test/?date=2026-09-09&level=all', '2026-09-10'), { date: '2026-09-09', level: 'newbie', view: 'all' });
  assert.deepEqual(core.parseUrlState('https://example.test/?date=2026-09-11&level=bad', '2026-09-10'), { date: '2026-09-10', level: 'newbie', view: 'window' });
});

test('submission verification is newest-first, one-AC-done, and half-open local day', () => {
  const bounds = core.submissionDayBounds('2026-09-09');
  const submissions = [
    { id: 4, creationTimeSeconds: bounds.end / 1000, verdict: 'OK', problem: { contestId: 2, index: 'A' } },
    { id: 3, creationTimeSeconds: (bounds.start + 2) / 1000, verdict: 'OK', problem: { contestId: 3, index: 'A' } },
    { id: 2, creationTimeSeconds: (bounds.start + 1) / 1000, verdict: 'OK', problem: { contestId: 1, index: 'A' } },
    { id: 1, creationTimeSeconds: (bounds.start - 1) / 1000, verdict: 'OK', problem: { contestId: 4, index: 'A' } },
  ];
  const result = core.verifySubmissions(submissions, { day: '2026-09-09', problemIds: ['1:A', '3:A', '2:A'] });
  assert.equal(result.status, 'CHECKED');
  assert.deepEqual(result.solvedIds, ['3:A', '1:A']);
  assert.equal(result.done, true);
  assert.equal(core.verifySubmissions(submissions, { day: '2026-09-10', problemIds: ['1:A'] }).done, false);
  assert.equal(core.verificationUnavailable(new Error('offline')).status, 'UNAVAILABLE');
});

test('Codeforces rating categories use current thresholds', () => {
  const cases = [[1199, 'newbie'], [1200, 'pupil'], [1399, 'pupil'], [1400, 'specialist'], [1599, 'specialist'], [1600, 'expert'], [1899, 'expert'], [1900, 'candidate'], [2099, 'candidate'], [2100, 'master'], [2399, 'master'], [2400, 'grandmaster'], [2999, 'grandmaster'], [3000, 'legendary'], [3500, 'legendary']];
  for (const [rating, category] of cases) assert.equal(core.codeforcesRatingCategory(rating), category);
});

test('Legendary Grandmaster problem color starts at 3000', () => {
  assert.equal(core.codeforcesRatingCategory(2900), 'grandmaster');
  assert.equal(core.codeforcesRatingCategory(3000), 'legendary');
  assert.equal(core.codeforcesRatingCategory(3500), 'legendary');
});

test('rank and rating inference matrix maps every supported class', () => {
  const ranks = {
    newbie: 'newbie', pupil: 'pupil', specialist: 'special', expert: 'expert',
    'candidate master': 'expert', master: 'master', 'international master': 'master',
    grandmaster: 'master', 'international grandmaster': 'master', 'legendary grandmaster': 'legend',
  };
  for (const [rank, level] of Object.entries(ranks)) assert.equal(core.inferLadder({ rank }), level);
  for (const [rating, level] of [[1199, 'newbie'], [1200, 'pupil'], [1399, 'pupil'], [1400, 'special'], [1599, 'special'], [1600, 'expert'], [1899, 'expert'], [1900, 'expert'], [2099, 'expert'], [2100, 'master'], [2399, 'master'], [2400, 'master'], [2999, 'master'], [3000, 'legend']]) assert.equal(core.inferLadder({ rating }), level);
  assert.equal(core.inferLadder({ rank: 'unknown', rating: undefined }), 'newbie');
  assert.equal(core.inferLadder({ rank: 'unknown', rating: 2400 }), 'master');
});

test('problem rows and status precedence are explicit', () => {
  assert.deepEqual(core.PROBLEM_ROW_ORDER, ['rating', 'title', 'id', 'status']);
  assert.equal(core.problemStatus('1:A', new Set(['1:A']), new Set(['1:A']), new Set(['1:A']), new Set(['1:A'])), 'current');
  assert.equal(core.problemStatus('1:A', new Set(), new Set(['1:A']), new Set(['1:A']), new Set(['1:A'])), 'current-wrong');
  assert.equal(core.problemStatus('1:A', new Set(), new Set(), new Set(['1:A']), new Set(['1:A'])), 'known');
  assert.equal(core.problemStatus('1:A', new Set(), new Set(), new Set(), new Set(['1:A'])), 'known-wrong');
  assert.equal(core.problemStatus('1:A', new Set(), new Set(), new Set(), new Set()), 'none');
});

test('known-solved cache is normalized, isolated, mergeable, and disposable', () => {
  const parsed = core.parseKnownSolved('{"Ivanilos":["1788A","1788A",4],"other":["424B"]}');
  assert.deepEqual(parsed, { ivanilos: { accepted: ['1788A'], unsuccessful: [] }, other: { accepted: ['424B'], unsuccessful: [] } });
  assert.deepEqual(core.knownSolvedIds(parsed, ' IVANILOS '), new Set(['1788A']));
  assert.deepEqual(core.knownSolvedIds(parsed, 'other'), new Set(['424B']));
  assert.deepEqual(core.mergeKnownActivity(parsed, 'ivanilos', { unsuccessful: ['99:C'] }), { ivanilos: { accepted: ['1788A'], unsuccessful: ['99:C'] }, other: { accepted: ['424B'], unsuccessful: [] } });
  assert.deepEqual(core.parseKnownSolved('{broken'), {});
  assert.deepEqual(core.parseKnownSolved('[]'), {});
  assert.equal(core.normalizeHandle('  Ivanilos '), 'ivanilos');
});

test('OK submissions encountered during verification become known solved IDs', () => {
  const submissions = [
    { verdict: 'OK', problem: { contestId: 1788, index: 'A' } },
    { verdict: 'WRONG_ANSWER', problem: { contestId: 424, index: 'B' } },
    { verdict: 'OK', problem: { contestId: 424, index: 'B' } },
    { verdict: 'OK', problem: { index: 'C' } },
  ];
  assert.deepEqual(core.solvedProblemIdsFromSubmissions(submissions), ['1788:A', '424:B']);
});

test('All is a separate view and is never inferred as a training level', () => {
  assert.notEqual(core.resolveLevel({ profile: { rank: 'legendary grandmaster' } }), 'all');
  assert.equal(core.resolveLevel({ currentLevel: 'all', explicit: true, profile: { rank: 'newbie' } }), 'newbie');
  assert.equal(core.canonicalView('all'), 'all');
});

test('canonical levels preserve windows and old Div URL aliases', () => {
  assert.deepEqual(core.TRAINING_STAGE_KEYS, ['newbie', 'pupil', 'special', 'expert', 'master', 'legend']);
  assert.deepEqual(core.LADDER_WINDOWS, {
    newbie: ['Q0', 'Q1', 'Q2'], pupil: ['Q2', 'Q3', 'Q4'], special: ['Q4', 'Q5', 'Q6'],
    expert: ['Q6', 'Q7', 'Q8'], master: ['Q8', 'Q9', 'Q10'], legend: ['Q10', 'Q11', 'Q12'],
  });
  assert.deepEqual(Object.fromEntries(['div4', 'div3', 'div2', 'div1'].map(alias => [alias, core.canonicalLevel(alias)])), {
    div4: 'pupil', div3: 'special', div2: 'expert', div1: 'master',
  });
  assert.deepEqual(core.parseUrlState('https://example.test/?level=div4', '2026-09-10').level, 'pupil');
  assert.deepEqual(core.parseUrlState('https://example.test/?level=div1', '2026-09-10').level, 'master');
  assert.deepEqual(core.parseUrlState('https://example.test/?level=specialist', '2026-09-10'), { date: '2026-09-10', level: 'special', view: 'window' });
  assert.deepEqual(core.parseUrlState('https://example.test/?level=all', '2026-09-10'), { date: '2026-09-10', level: 'newbie', view: 'all' });
});

test('rank inference uses rank preference and exact numeric fallback boundaries', () => {
  for (const [rank, expected] of [['newbie', 'newbie'], ['pupil', 'pupil'], ['specialist', 'special'], ['expert', 'expert'], ['candidate master', 'expert'], ['master', 'master'], ['international master', 'master'], ['grandmaster', 'master'], ['international grandmaster', 'master'], ['legendary grandmaster', 'legend']]) assert.equal(core.inferLadder({ rank }), expected);
  for (const [rating, expected] of [[1199, 'newbie'], [1200, 'pupil'], [1399, 'pupil'], [1400, 'special'], [1599, 'special'], [1600, 'expert'], [1899, 'expert'], [1900, 'expert'], [2099, 'expert'], [2100, 'master'], [2399, 'master'], [2400, 'master'], [2999, 'master'], [3000, 'legend']]) assert.equal(core.inferLadder({ rank: 'unexpected', rating }), expected);
  assert.equal(core.inferLadder({ rank: 'expert', rating: 800 }), 'expert');
});

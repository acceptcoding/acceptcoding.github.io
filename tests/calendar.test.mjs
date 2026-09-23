import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRetainedQueryContext,
  clampMonth,
  completionMarkers,
  dateAvailability,
  monthBounds,
  monthCells,
  monthDates,
  retainedQueryContext,
  selectableDates,
  weekDatesForCalendar,
} from '../domain/calendar.js';

const TODAY = '2026-09-30';

test('calendar weeks and month cells are Sunday-first', () => {
  assert.deepEqual(weekDatesForCalendar('2026-09-01'), [
    '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    '2026-09-03', '2026-09-04', '2026-09-05',
  ]);
  assert.deepEqual(monthCells('2026-09').slice(0, 3), [null, null, '2026-09-01']);
  assert.equal(monthCells('2026-09').length, 32);
});

test('month bounds and cursor clamping honor launch and current-month limits', () => {
  assert.deepEqual(monthBounds(TODAY), { minMonth: '2026-09', maxMonth: '2026-09' });
  assert.deepEqual(monthBounds('2026-12-02'), { minMonth: '2026-09', maxMonth: '2026-12' });
  assert.equal(clampMonth('2025-12', monthBounds('2026-12-02')), '2026-09');
  assert.equal(clampMonth('2026-10', monthBounds('2026-12-02')), '2026-10');
  assert.equal(clampMonth('2027-01', monthBounds('2026-12-02')), '2026-12');
});

test('selectable dates apply launch and future bounds without timezone formatting', () => {
  assert.deepEqual(selectableDates('2026-09', TODAY).slice(0, 3), ['2026-09-21', '2026-09-22', '2026-09-23']);
  assert.deepEqual(selectableDates('2026-09', TODAY).slice(-2), ['2026-09-29', '2026-09-30']);
  assert.deepEqual(dateAvailability('2026-09', TODAY).slice(20, 22).map(({ date, selectable, reason }) => ({ date, selectable, reason })), [
    { date: '2026-09-21', selectable: true, reason: null },
    { date: '2026-09-22', selectable: true, reason: null },
  ]);
  assert.deepEqual(dateAvailability('2026-08', TODAY).map(({ selectable, reason }) => ({ selectable, reason })),
    Array.from({ length: 31 }, () => ({ selectable: false, reason: 'prelaunch' })));
  assert.equal(dateAvailability('2026-10', TODAY).every(({ selectable, reason }) => !selectable && reason === 'future'), true);
  assert.equal(monthDates('2028-02').length, 29);
});

test('retained query context keeps only canonical level, inferred source, and all view', () => {
  const context = retainedQueryContext('https://accept.invalid/challenges/?level=specialist&level-source=inferred&view=all&date=2026-09-10');
  assert.deepEqual(context, { level: 'special', levelSource: 'inferred', view: 'all' });
  const target = applyRetainedQueryContext('https://accept.invalid/en/challenges/2026-09-11?date=2026-09-11', context);
  assert.equal(target.search, '?date=2026-09-11&level=special&level-source=inferred&view=all');
  const defaultTarget = applyRetainedQueryContext(target, { level: null, view: 'window' });
  assert.equal(defaultTarget.search, '?date=2026-09-11');
});

test('completion markers are isolated by normalized handle', () => {
  const history = {
    tourist: { '2026-09-17': true },
    other: { '2026-09-18': true },
  };
  const dates = ['2026-09-17', '2026-09-18'];
  assert.deepEqual(completionMarkers(history, ' TOURIST ', dates), {
    '2026-09-17': true,
    '2026-09-18': false,
  });
  assert.deepEqual(completionMarkers(history, 'other', dates), {
    '2026-09-17': false,
    '2026-09-18': true,
  });
});

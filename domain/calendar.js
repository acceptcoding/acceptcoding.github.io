import { CALENDAR_MIN_MONTH, LAUNCH_DATE, ALL_PROBLEMS_VIEW } from './config.js';
import { isSelectableDate, isValidDateString, shiftDate, todayAtLocal } from './dates.js';
import { canonicalLevel, canonicalView } from './url-state.js';
import { hasCompletion } from './account.js';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function assertMonth(month) {
  if (typeof month !== 'string' || !MONTH_RE.test(month)) throw new RangeError('Expected YYYY-MM');
  return month;
}

function monthDate(month, day = 1) {
  const [year, value] = assertMonth(month).split('-').map(Number);
  return new Date(Date.UTC(year, value - 1, day));
}

export function monthKey(date) {
  if (!isValidDateString(date)) throw new RangeError('Expected YYYY-MM-DD');
  return date.slice(0, 7);
}

export function monthBounds(today = todayAtLocal(), launchMonth = CALENDAR_MIN_MONTH) {
  if (!isValidDateString(today)) throw new RangeError('Expected a valid today date');
  assertMonth(launchMonth);
  const maxMonth = monthKey(today);
  return {
    minMonth: launchMonth,
    maxMonth: maxMonth < launchMonth ? launchMonth : maxMonth,
  };
}

export function clampMonth(month, bounds) {
  assertMonth(month);
  const { minMonth, maxMonth } = bounds || {};
  assertMonth(minMonth);
  assertMonth(maxMonth);
  if (minMonth > maxMonth) throw new RangeError('Invalid month bounds');
  return month < minMonth ? minMonth : month > maxMonth ? maxMonth : month;
}

export function monthDates(month) {
  const start = monthDate(month);
  const days = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
}

// Calendar cells are Sunday-first; null entries are leading layout blanks.
export function monthCells(month) {
  const dates = monthDates(month);
  const leadingEmpty = monthDate(month).getUTCDay();
  return [...Array.from({ length: leadingEmpty }, () => null), ...dates];
}

export function selectableDates(month, today = todayAtLocal()) {
  return monthDates(month).filter((date) => isSelectableDate(date, today));
}

export function dateAvailability(month, today = todayAtLocal()) {
  return monthDates(month).map((date) => ({
    date,
    selectable: isSelectableDate(date, today),
    reason: date < LAUNCH_DATE ? 'prelaunch' : date > today ? 'future' : null,
  }));
}

export function retainedQueryContext(url) {
  const params = new URL(url, 'https://accept.invalid').searchParams;
  const level = canonicalLevel(params.get('level'));
  const view = canonicalView(params.get('view') || params.get('level'));
  return {
    level,
    levelSource: level && params.get('level-source') === 'inferred' ? 'inferred' : null,
    view,
  };
}

export function applyRetainedQueryContext(url, context = {}) {
  const target = new URL(url, 'https://accept.invalid');
  const level = canonicalLevel(context.level);
  const view = canonicalView(context.view);
  if (level) {
    target.searchParams.set('level', level);
    if (context.levelSource === 'inferred') target.searchParams.set('level-source', 'inferred');
    else target.searchParams.delete('level-source');
  } else {
    target.searchParams.delete('level');
    target.searchParams.delete('level-source');
  }
  if (view === ALL_PROBLEMS_VIEW) target.searchParams.set('view', ALL_PROBLEMS_VIEW);
  else target.searchParams.delete('view');
  return target;
}

export function completionMarkers(history, handle, dates) {
  const candidates = Array.isArray(dates) ? dates : [];
  return Object.fromEntries(candidates.map((date) => [date, hasCompletion(history, handle, date)]));
}

export function weekDatesForCalendar(date) {
  if (!isValidDateString(date)) return [];
  const start = shiftDate(date, -new Date(`${date}T12:00:00Z`).getUTCDay());
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
}

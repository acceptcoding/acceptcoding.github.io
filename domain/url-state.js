import {
  ALL_PROBLEMS_VIEW,
  LEVEL_ALIASES,
  LEVEL_STARTS,
  VIEW_PROVENANCE,
} from './config.js';
import { todayAtLocal, validateTrainingDate } from './dates.js';

export function canonicalLevel(value) {
  return Object.hasOwn(LEVEL_STARTS, value) ? value : LEVEL_ALIASES[value] || null;
}

export function canonicalView(value) {
  return value === ALL_PROBLEMS_VIEW ? ALL_PROBLEMS_VIEW : VIEW_PROVENANCE.WINDOW;
}

export function parseUrlState(url, today = todayAtLocal()) {
  const params = new URL(url, 'https://accept.invalid').searchParams;
  const boundary = validateTrainingDate(params.get('date'), today);
  const requestedLevel = params.get('level');
  const view = canonicalView(params.get('view') || requestedLevel);
  const level = canonicalLevel(requestedLevel) || 'newbie';
  return { date: boundary.date, level, view };
}

export function canonicalizeUrl(url, today = todayAtLocal()) {
  const target = new URL(url, 'https://accept.invalid');
  const requestedLevel = target.searchParams.get('level');
  const requestedView = target.searchParams.get('view');
  const canonical = canonicalLevel(requestedLevel);
  const view = canonicalView(requestedView || requestedLevel);

  if (view === ALL_PROBLEMS_VIEW) {
    target.searchParams.delete('level');
    target.searchParams.set('view', ALL_PROBLEMS_VIEW);
  } else {
    target.searchParams.delete('view');
    if (requestedLevel && canonical) target.searchParams.set('level', canonical);
    else target.searchParams.delete('level');
  }
  return target;
}

export function shareUrlState(url, date, level, today = todayAtLocal(), view = VIEW_PROVENANCE.WINDOW) {
  const boundary = validateTrainingDate(date, today);
  const canonical = canonicalLevel(level);
  if (!boundary.valid || !canonical) return null;
  const target = new URL(url, 'https://accept.invalid');
  target.search = '';
  target.hash = '';
  target.searchParams.set('date', boundary.date);
  target.searchParams.set('level', canonical);
  if (canonicalView(view) === ALL_PROBLEMS_VIEW) target.searchParams.set('view', ALL_PROBLEMS_VIEW);
  return target;
}



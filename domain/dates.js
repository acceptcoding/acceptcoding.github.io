import { LAUNCH_DATE, V6_EFFECTIVE_DATE } from './config.js';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateParts(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) throw new RangeError('Expected YYYY-MM-DD');
  const [, y, m, d] = value.match(DATE_RE).map(Number);
  const timestamp = Date.UTC(y, m - 1, d);
  if (new Date(timestamp).toISOString().slice(0, 10) !== value) throw new RangeError('Invalid calendar date');
  return { year: y, month: m, day: d, timestamp };
}
export function isValidDateString(value) { try { dateParts(value); return true; } catch { return false; } }
export function todayAtLocal(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }

// One boundary authority for every requested ACCEPT training date.
export function validateTrainingDate(date, today = todayAtLocal()) {
  if (!isValidDateString(today)) return { valid: false, date: LAUNCH_DATE, reason: 'invalid-today' };
  if (!isValidDateString(date)) return { valid: false, date: today, reason: 'invalid' };
  const minimumDate = today < LAUNCH_DATE ? V6_EFFECTIVE_DATE : LAUNCH_DATE;
  if (date < minimumDate) return { valid: false, date: minimumDate, reason: 'prelaunch' };
  if (date > today) return { valid: false, date: today, reason: 'future' };
  return { valid: true, date, reason: null };
}
export function canonicalTrainingDate(date, today = todayAtLocal()) { return validateTrainingDate(date, today).date; }
export function assertTrainingDate(date, today = todayAtLocal()) {
  const result = validateTrainingDate(date, today);
  if (!result.valid) throw new RangeError(`Date is not a valid ACCEPT training date: ${date}`);
  return result.date;
}
export function dayIndexForDate(date, today = todayAtLocal()) {
  const selected = assertTrainingDate(date, today);
  const epoch = today < LAUNCH_DATE ? V6_EFFECTIVE_DATE : LAUNCH_DATE;
  return Math.round((dateParts(selected).timestamp - dateParts(epoch).timestamp) / 86400000);
}
export function isSelectableDate(date, today = todayAtLocal()) { return validateTrainingDate(date, today).valid; }
// Explicit training dates use UTC midnight, regardless of visitor timezone.
export function localDayBounds(date) {
  const { year, month, day } = dateParts(date);
  const start = Date.UTC(year, month - 1, day);
  const end = Date.UTC(year, month - 1, day + 1);
  return { start, end };
}
export function dayWindow(date) { const { start, end } = localDayBounds(date); return [start, end]; }
export function shiftDate(date, amount) { const shifted = new Date(dateParts(date).timestamp); shifted.setUTCDate(shifted.getUTCDate() + amount); return shifted.toISOString().slice(0, 10); }
export function sundayStart(date) { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return shiftDate(date, -day); }
export function weekNavigationTarget(date, direction, today = todayAtLocal()) {
  assertTrainingDate(date, today);
  if (direction !== -1 && direction !== 1) throw new RangeError('Expected week navigation direction -1 or 1');
  const targetStart = shiftDate(sundayStart(date), direction * 7);
  const targetDates = Array.from({ length: 7 }, (_, index) => shiftDate(targetStart, index));
  const sameWeekday = shiftDate(date, direction * 7);
  if (isSelectableDate(sameWeekday, today)) return sameWeekday;
  const candidates = direction < 0 ? targetDates : [...targetDates].reverse();
  return candidates.find(candidate => isSelectableDate(candidate, today)) || null;
}

export function weekDates(date) {
  if (!isValidDateString(date)) return [];
  const start = sundayStart(date);
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
}

// Shared ACCEPT domain constants and compatibility aliases.
export const V6_EFFECTIVE_DATE = '2026-09-01';
export const LAUNCH_DATE = '2026-09-21';
export const CALENDAR_MIN_MONTH = LAUNCH_DATE.slice(0, 7);
// Keep the first public day on the existing September 1 selection stream.
export const SELECTION_EPOCH = V6_EFFECTIVE_DATE;
// The selector uses a versioned salt and curated contest policy.
export const SITE_SALT = 'accept-daily-selection-v5-language-aware-whole-rating';
export const MIN_CONTEST_ID = 355;
export const LADDER_SIZE = 13;
export const KNOWN_SOLVED_STORAGE_KEY = 'accept-known-solved';
export const COMPLETION_HISTORY_STORAGE_KEY = 'accept-completion-history-v1';
export const PROBLEM_ROW_ORDER = Object.freeze(['rating', 'title', 'id', 'status']);
export const J13_SELECTOR_VERSION = 'j13-six-stage-trial-v2-seeded-profile';
export const SELECTOR_VERSION = J13_SELECTOR_VERSION;
// Compatibility aliases for callers that adopted earlier selector names.
export const DIVISION_AWARE_SELECTOR_VERSION = J13_SELECTOR_VERSION;
export const J4_SELECTOR_VERSION = SELECTOR_VERSION;
export const CANONICAL_HISTORY_SCHEMA = 'accept-canonical-history-v1';
export const POOL_IDS = Object.freeze(Array.from({ length: LADDER_SIZE }, (_, index) => `Q${index}`));
export const TRAINING_STAGE_KEYS = Object.freeze(['newbie', 'pupil', 'special', 'expert', 'master', 'legend']);
export const LADDER_WINDOWS = Object.freeze({
  newbie: ['Q0', 'Q1', 'Q2'], pupil: ['Q2', 'Q3', 'Q4'], special: ['Q4', 'Q5', 'Q6'],
  expert: ['Q6', 'Q7', 'Q8'], master: ['Q8', 'Q9', 'Q10'], legend: ['Q10', 'Q11', 'Q12'],
});
export const LEVEL_STARTS = Object.freeze({ newbie: 0, pupil: 2, special: 4, expert: 6, master: 8, legend: 10 });
export const LEVEL_ALIASES = Object.freeze({ div4: 'pupil', div3: 'special', div2: 'expert', div1: 'master', specialist: 'special' });
export const ALL_PROBLEMS_VIEW = 'all';
export const VIEW_KEYS = Object.freeze([ALL_PROBLEMS_VIEW]);
export const VIEW_PROVENANCE = Object.freeze({ WINDOW: 'window', ALL: ALL_PROBLEMS_VIEW });
export const LEVEL_PROVENANCE = Object.freeze({ DEFAULT: 'default', INFERRED: 'inferred', MANUAL: 'manual' });

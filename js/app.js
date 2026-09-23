import * as core from '../core.js?v=ladder-v17-feature-wave';
import { COPY } from './i18n.js?v=ui-polish-33';
import { userInfo, userStatus, problemUrl } from './codeforces.js?v=ui-polish-29';
import { readLocal, writeLocal } from './storage.js?v=storage-v1';
import { createLadderRepository } from './ladder-repository.js?v=ladder-repository-v1';
import { createPersistence } from './persistence.js?v=persistence-v1';
import { localizedRoute, parseRoute, routeLanguage, routePath } from './routes.js?v=routes-v1';
import { canonicalStateUrl, calendarDateUrl, calendarUrl, canonicalDateUrl, challengePath, challengeUrl, clearTransientChallengeState, getToday as resolveToday, isDevelopmentHost, navigate as navigateState, readNavigationState } from '../application/navigation.js';
import { chooseTheme, effectiveTheme as resolveEffectiveTheme, persistenceDecision, resolveLanguage, resolvePreferences } from '../application/preferences.js';
import * as calendarPolicy from '../domain/calendar.js';
import { createShareCommand, createShareViewModel } from '../application/share.js';
import { createApplicationController } from '../application/controller.js';
import { createAccountSync } from '../application/account-sync.js';
import { createInitialSession, LADDER_STATUS } from '../application/session.js';
import { createChallengeViewModel } from '../application/view-model.js';
import { officialRankName, rankClass, readableRankName, RANK_CLASSES } from '../application/account-view-model.js';
import { renderProblemList } from '../ui/problem-list-renderer.js';
import { createAccountRenderer } from '../ui/account-renderer.js';
import { createShareAdapter } from '../ui/share-adapter.js';
import { createPreferencesControls } from '../ui/preferences-controls.js';
import { createFormKeyboardWiring } from '../ui/form-keyboard-wiring.js';
import { createDailyPageAdapter } from '../ui/daily-page.js';
import { createHomePageAdapter } from '../ui/home-page.js';

const $ = (selector) => document.querySelector(selector);
const DOCUMENT_TITLE = 'ACCEPT Coding Club';
if (typeof MutationObserver !== 'undefined' && document.head) {
  new MutationObserver(() => {
    if (document.title !== DOCUMENT_TITLE) document.title = DOCUMENT_TITLE;
  }).observe(document.head, { childList: true, subtree: true, characterData: true });
}
const pageIsCalendar = Boolean($('#calendar'));
const pageIsHome = Boolean($('#home'));
const pageIsHowTo = Boolean($('#how-to'));
const pageIsGuide = Boolean($('#home'));
const pageIsDaily = Boolean($('.daily-shell'));
function movePreferenceMenusBelowMain() {
  const menus = [...document.querySelectorAll('.preference-menu')];
  if (!menus.length) return;
  const target = pageIsHome ? $('.home-content') : pageIsCalendar ? $('.calendar-card') : pageIsDaily ? $('.daily-stage') : document.querySelector('main');
  if (!target) return;
  const row = document.createElement('div');
  row.className = 'preference-tools-below';
  menus.forEach((menu) => row.append(menu));
  target.insertAdjacentElement('afterend', row);
}
movePreferenceMenusBelowMain();
const LANGUAGE_NAMES = Object.freeze({ pt: 'Português', en: 'English', es: 'Español' });

// The composition root keeps browser effects here while the application and
// domain modules own canonical state, preference, and calendar policy.
const compositionRoot = Object.freeze({
  navigation: Object.freeze({ canonicalStateUrl, canonicalDateUrl, calendarDateUrl, calendarUrl, challengePath, challengeUrl, getToday: resolveToday, isDevelopmentHost, navigate: navigateState, readState: readNavigationState }),
  preferences: Object.freeze({ choose: resolvePreferences, resolveLanguage, chooseTheme, effectiveTheme: resolveEffectiveTheme, persistenceDecision }),
  calendar: calendarPolicy,
});

function currentLanguage() {
  return compositionRoot.preferences.resolveLanguage({
    routeLanguage: parseRoute(location.pathname).language,
    storedLanguage: readLocal('accept-language'),
    primaryLanguage: navigator.languages?.[0] || navigator.language || '',
  });
}

const state = {
  today: '', date: '', level: 'newbie', view: core.VIEW_PROVENANCE.WINDOW, levelProvenance: core.LEVEL_PROVENANCE.DEFAULT, levelOwnerHandle: '',
  route: null, ladder: null, ladderDate: '', ladderError: null, profile: null, knownSolved: null, completionHistory: null, syncError: '', identityStatus: '',
  loadedHandle: '',
  verification: new Map(), loadingLadder: false, ladderPromise: null, syncing: false, syncTarget: '', syncKind: 'load',
};
const accountRenderer = createAccountRenderer({
  root: document,
  state,
  translate: t,
  normalizeHandle: core.normalizeHandle,
  rankPresentation: { officialRankName, rankClass, RANK_CLASSES },
  visibleProblemIds: (ladder, accountState) => core.visibleProblems(ladder, { level: accountState.level, view: accountState.view }).filter(Boolean).map(core.stableProblemId),
});
let redrawCalendar = null;
let suggestionIndex = -1;
const ladderRepository = createLadderRepository();
const persistence = createPersistence();
const application = createApplicationController({
  today: core.todayAtLocal(),
  initialState: createInitialSession({ today: core.todayAtLocal() }),
  ladderRepository,
});

function pullApplicationState() {
  const session = application.getState();
  state.date = session.date;
  state.today = session.today;
  state.level = session.level;
  state.view = session.view;
  state.levelProvenance = session.levelProvenance;
  state.ladder = session.ladder;
  state.ladderDate = session.ladderDate;
  state.loadingLadder = session.ladderStatus === LADDER_STATUS.LOADING;
  state.ladderError = session.error;
}

function syncApplicationState() {
  application.dispatch({ type: 'select-date', date: state.date, today: state.today });
  if (state.view === core.ALL_PROBLEMS_VIEW) application.dispatch({ type: 'select-all-view' });
  else if (state.levelProvenance === core.LEVEL_PROVENANCE.INFERRED) application.dispatch({ type: 'infer-level', level: state.level });
  else if (state.levelProvenance === core.LEVEL_PROVENANCE.MANUAL) application.dispatch({ type: 'select-level', level: state.level });
  pullApplicationState();
}

// Compatibility notes for the preserved UI contract: the controller now owns
// these transitions instead of assigning state directly.
// state.levelProvenance = core.LEVEL_PROVENANCE.MANUAL;
// state.levelProvenance = core.LEVEL_PROVENANCE.INFERRED;
// state.level = core.inferLadder(profile);

function t(key) { return COPY[currentLanguage()][key] ?? key; }
const WEEKDAY_LABELS = Object.freeze({ pt: ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], es: ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.'] });
function dateObject(date) { return new Date(`${date}T12:00:00Z`); }
function weekdayLabel(date) { return WEEKDAY_LABELS[currentLanguage()][dateObject(date).getUTCDay()]; }
function monthLabel(date) {
  let label = new Intl.DateTimeFormat(currentLanguage(), { month: 'short', timeZone: 'UTC' }).format(dateObject(date)).trim();
  if (currentLanguage() !== 'en' && !label.endsWith('.')) label += '.';
  return label;
}
function inputHandle() { return core.normalizeHandle($('#handle')?.value || ''); }
function currentHandle() { return inputHandle(); }
function loadedProjectionHandle() { const input = inputHandle(); return state.loadedHandle && input === state.loadedHandle ? state.loadedHandle : ''; }

function closeHandleSuggestions() {
  const panel = $('#handle-suggestions-panel'); const input = $('#handle');
  suggestionIndex = -1;
  if (!panel || !input) return;
  panel.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
}
function updateSuggestionSelection() {
  const box = $('#handle-suggestions'); const input = $('#handle'); if (!box || !input) return;
  const options = [...box.querySelectorAll('[role="option"]')];
  options.forEach((option, index) => { const active = index === suggestionIndex; option.classList.toggle('is-active', active); option.setAttribute('aria-selected', String(active)); });
  if (suggestionIndex >= 0 && options[suggestionIndex]) input.setAttribute('aria-activedescendant', options[suggestionIndex].id);
  else input.removeAttribute('aria-activedescendant');
}
function renderHandleSuggestions() {
  const panel = $('#handle-suggestions-panel'); const box = $('#handle-suggestions'); const input = $('#handle'); if (!panel || !box || !input) return;
  const matches = persistence.recentHandleMatches(input.value);
  box.replaceChildren(); suggestionIndex = -1; input.removeAttribute('aria-activedescendant');
  if (document.activeElement !== input || !matches.length) { closeHandleSuggestions(); return; }
  matches.forEach((item, index) => {
    const option = document.createElement('div'); option.id = `recent-handle-${index}`; option.className = 'handle-suggestion'; option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false'); option.dataset.handle = item.handle; option.textContent = item.handle; box.append(option);
  });
  panel.hidden = false; input.setAttribute('aria-expanded', 'true');
}
function chooseRecentHandle(handle) {
  const input = $('#handle'); if (!input) return;
  input.value = handle; input.dispatchEvent(new Event('input', { bubbles: true })); closeHandleSuggestions(); input.focus();
}
function clearRecentHandles() {
  persistence.clearRecentHandles();
  closeHandleSuggestions();
  $('#handle')?.focus();
}
function updateSessionStateVisibility() {
  const session = $('.session-state'); if (!session) return;
  session.classList.toggle('is-empty', !session.textContent.trim());
}
function knownActivityForHandle(handle = loadedProjectionHandle()) {
  if (!state.knownSolved) state.knownSolved = persistence.readKnownSolved();
  return persistence.knownActivityForHandle(state.knownSolved, handle);
}
function learnKnownActivity(handle, submissions) {
  state.knownSolved = persistence.learnKnownActivity(state.knownSolved, handle, submissions);
}
function rememberCompletion(handle, date) {
  state.completionHistory = persistence.rememberCompletion(state.completionHistory, handle, date);
}
function completionForDate(handle, date) {
  if (!state.completionHistory) state.completionHistory = persistence.readCompletionHistory();
  return persistence.completionForDate(state.completionHistory, handle, date);
}

function getToday() {
  return resolveToday(location.href, location.hostname);
}
function dateText(date) {
  return new Intl.DateTimeFormat(currentLanguage(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateObject(date));
}
function homeDateText(date) {
  const [year, month, day] = date.split('-');
  return currentLanguage() === 'en' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}
function fullDateText(date) {
  return new Intl.DateTimeFormat(currentLanguage(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateObject(date));
}
function updateDocumentTitle() {
  document.title = DOCUMENT_TITLE;
}
function pageWasReloaded() {
  const navigation = globalThis.performance?.getEntriesByType?.('navigation')?.[0];
  return navigation?.type === 'reload' || globalThis.performance?.navigation?.type === 1;
}
function clearReloadState() {
  if (!pageWasReloaded()) return;
  const current = new URL(location.href);
  const cleared = clearTransientChallengeState(current);
  if (cleared.href !== current.href) history.replaceState(history.state, '', `${cleared.pathname}${cleared.search}${cleared.hash}`);
}
function canonicalizeDateUrl(date) {
  const current = new URL(location.href);
  const canonical = canonicalDateUrl(current, date);
  if (canonical.href !== current.href) history.replaceState(history.state, '', `${canonical.pathname}${canonical.search}${canonical.hash}`);
}
function canonicalizeStateUrl(today) {
  const current = new URL(location.href);
  const canonical = compositionRoot.navigation.canonicalStateUrl(location.href, today);
  if (canonical.href === current.href) return;
  history.replaceState(history.state, '', `${canonical.pathname}${canonical.search}${canonical.hash}`);
}
function isHistoricalDate(date = state.date) { return Boolean(date && state.today && date < state.today); }
function challengeContextLabel() { return t(isHistoricalDate() ? 'historicalChallenge' : 'homeDailyHeading'); }
function urlFor(date, level = null, source = null, view = state.view) {
  return new URL(compositionRoot.navigation.challengeUrl({
    url: location.href,
    date,
    today: state.today,
    level,
    source,
    view,
    language: routeLanguage(location.pathname, currentLanguage()),
  }), location.href);
}
function navigate(date, level = state.levelProvenance !== core.LEVEL_PROVENANCE.DEFAULT ? state.level : null, replace = false, view = state.view) {
  const source = state.levelProvenance === core.LEVEL_PROVENANCE.INFERRED ? core.LEVEL_PROVENANCE.INFERRED : null;
  const result = compositionRoot.navigation.navigate({ location: location.href, url: location.href, date, today: state.today, level, source, view, replace, language: routeLanguage(location.pathname, currentLanguage()) });
  if (!result.accepted) return;
  history[result.history === 'replace' ? 'replaceState' : 'pushState']({}, '', result.url);
  renderHome();
}
function applyPrefs() {
  const language = currentLanguage();
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  const shareButton = $('#share-challenge');
  if (shareButton) {
    shareAdapter?.resetFeedback();
    shareButton.dataset.defaultLabel = t('shareChallenge');
    shareButton.innerHTML = `${shareIcon('share')}<span data-i18n="shareChallenge">${t('shareChallenge')}</span>`;
    $('#share-status')?.replaceChildren();
  }
  const preference = themePreference();
  const theme = effectiveTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  preferenceControls?.render({ language, theme: preference });
  document.querySelectorAll('.home-setting-current').forEach((element) => {
    element.textContent = LANGUAGE_NAMES[language] || language;
  });
  applyGuideLinkSemantics();
  document.documentElement.classList.remove('language-pending');
}
function applyGuideLinkSemantics() {
  const hint = t('externalLinkHint');
  document.querySelectorAll('.how-to-content a[target="_blank"], .guide-content a[target="_blank"], .problem-link[target="_blank"]').forEach((link) => {
    const base = link.dataset.ariaBase || link.getAttribute('aria-label') || link.textContent.trim();
    link.dataset.ariaBase = base;
    link.setAttribute('aria-label', `${base} (${hint})`);
  });
}
function wirePrefs() {
  const themeLabels = { light: t('themeLight'), dark: t('themeDark') };
  preferenceControls = createPreferencesControls({
    root: document,
    document,
    translate: t,
    themeLabels,
    getLanguage: currentLanguage,
    getTheme: themePreference,
    onLanguageChange: (language) => {
      if (language === currentLanguage()) return;
      const decision = compositionRoot.preferences.persistenceDecision('language', language);
      if (decision.persist) writeLocal(decision.key, decision.value);
      const localized = localizedRoute(location.pathname, language);
      if (localized) {
        const target = new URL(localized, location.href);
        target.search = location.search;
        target.hash = location.hash;
        const oldLanguage = routeLanguage(location.pathname, currentLanguage());
        history.replaceState({}, '', `${target.pathname}${target.search}${target.hash}`);
        document.querySelectorAll('main a[href]').forEach((link) => {
          link.href = link.href.replace(`/${oldLanguage}/`, `/${language}/`);
        });
        themeLabels.light = t('themeLight'); themeLabels.dark = t('themeDark');
        applyPrefs();
        renderLocalizedState();
        return;
      }
      themeLabels.light = t('themeLight'); themeLabels.dark = t('themeDark');
      applyPrefs();
      renderLocalizedState();
    },
    onThemeChange: (choice) => {
      const decision = compositionRoot.preferences.persistenceDecision('theme', choice);
      if (decision.persist) writeLocal(decision.key, decision.value);
      applyPrefs();
      renderLocalizedState();
    },
  });
  document.querySelector('#theme [data-theme-choice="system"]')?.remove();
  preferenceControls.wire();
  document.querySelectorAll('#help .help-close, #help .help-backdrop').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const help = $('#help');
      if (!help) return;
      help.open = false;
      help.querySelector('.help-trigger')?.focus();
    });
  });
  const help = $('#help');
  const helpPopover = help?.querySelector('.help-popover');
  helpPopover?.setAttribute('aria-modal', 'true');
  help?.addEventListener('toggle', () => {
    if (help.open) {
      helpPopover?.style.setProperty('top', '50vh', 'important');
      helpPopover?.style.setProperty('left', '50vw', 'important');
      helpPopover?.style.setProperty('right', 'auto', 'important');
      helpPopover?.style.setProperty('bottom', 'auto', 'important');
      helpPopover?.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      setTimeout(() => helpPopover?.querySelector('.help-close')?.focus(), 0);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (help?.open) {
      help.open = false;
      help.querySelector('.help-trigger')?.focus();
    }
  });
  helpPopover?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...helpPopover.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}
let preferenceControls = null;
function themePreference() {
  return compositionRoot.preferences.chooseTheme(readLocal('accept-theme'));
}
function effectiveTheme() {
  return compositionRoot.preferences.effectiveTheme(themePreference());
}
function labelForLevel(level) { return ({ newbie: 'newbie', pupil: 'pupil', special: 'special', expert: 'expert', master: 'master', legend: 'legend' })[level]; }
function accessibleLevelLabel(level) { return ({ newbie: 'Newbie', pupil: 'Pupil', special: 'Special', expert: 'Expert', master: 'Master', legend: 'legend' })[level]; }
function renderWeek() {
  const week = $('#week'); if (!week) return;
  week.replaceChildren();
  week.setAttribute('aria-label', `${t('recentDays')} — ${challengeContextLabel()}`);
  week.dataset.context = isHistoricalDate() ? 'historical' : 'current';
  const start = core.sundayStart(state.date);
  for (let index = 0; index < 7; index += 1) {
    const date = core.shiftDate(start, index);
    const button = document.createElement('button');
    button.type = 'button'; button.className = `day${isHistoricalDate(date) ? ' historical' : ''}${date === state.today ? ' today' : ''}`;
    button.disabled = !core.isSelectableDate(date, state.today);
    button.tabIndex = button.disabled ? -1 : 0;
    button.setAttribute('aria-disabled', String(button.disabled));
    button.innerHTML = `<span class="weekday">${weekdayLabel(date)}</span><b>${date.slice(8)}</b><small>${monthLabel(date)}</small>`;
    const historyHandle = loadedProjectionHandle();
    const hasSelectableHistory = Boolean(historyHandle && core.isSelectableDate(date, state.today));
    if (hasSelectableHistory) {
      const completed = completionForDate(historyHandle, date);
      const marker = document.createElement('span');
      marker.className = `day-completion${completed ? ' is-done' : ''}`;
      marker.textContent = completed ? '✓' : '·';
      marker.setAttribute('aria-label', completed ? t('dayAcRecorded') : t('dayNoRecordedAc'));
      button.append(marker);
    }
    const unavailableReason = date < core.LAUNCH_DATE ? t('unavailableDate') : date > state.today ? t('future') : '';
    const historyLabel = hasSelectableHistory ? `, ${completionForDate(historyHandle, date) ? t('dayAcRecorded') : t('dayNoRecordedAc')}` : '';
    button.setAttribute('aria-label', `${fullDateText(date)}${date === state.date ? `, ${t('selected')}` : ''}${date === state.today && date !== state.date ? `, ${t('current')}` : ''}${historyLabel}${unavailableReason ? `, ${unavailableReason}` : ''}`);
    if (date === state.date) { button.classList.add('selected'); if (date === state.today) button.classList.add('current'); button.setAttribute('aria-current', 'date'); }
    button.dataset.dateContext = date === state.today ? 'current' : date < state.today ? 'historical' : 'future';
    if (date > state.today) { button.classList.add('future'); button.title = t('future'); }
    if (!button.disabled) button.addEventListener('click', () => navigate(date));
    week.append(button);
  }
  const configureWeekButton = (selector, date, labelKey) => {
    const button = $(selector); if (!button) return;
    const enabled = core.isSelectableDate(date, state.today);
    button.disabled = !enabled;
    button.tabIndex = enabled ? 0 : -1;
    button.setAttribute('aria-disabled', String(!enabled));
    button.setAttribute('aria-label', t(labelKey));
    button.title = t(labelKey);
    button.onclick = enabled ? () => navigate(date) : null;
  };
  configureWeekButton('#prev-week', core.weekNavigationTarget(state.date, -1, state.today), 'weekPrev');
  configureWeekButton('#next-week', core.weekNavigationTarget(state.date, 1, state.today), 'weekNext');
  const todayLink = $('#today-link');
  if (todayLink) {
    todayLink.title = t('current');
    todayLink.disabled = state.date === state.today;
    todayLink.setAttribute('aria-disabled', String(todayLink.disabled));
    todayLink.onclick = () => { if (state.date !== state.today) navigate(state.today); };
  }
  const calendarLink = $('.calendar-link');
  if (calendarLink) {
    const historyUrl = compositionRoot.navigation.calendarUrl({
      url: location.href,
      date: state.date,
      level: state.levelProvenance !== core.LEVEL_PROVENANCE.DEFAULT ? state.level : null,
      source: state.levelProvenance === core.LEVEL_PROVENANCE.INFERRED ? core.LEVEL_PROVENANCE.INFERRED : null,
      view: state.view,
      language: routeLanguage(location.pathname, currentLanguage()),
    });
    calendarLink.href = `${historyUrl.pathname}${historyUrl.search}`;
  }
}
function homeDateHasCompletion(date) {
  if (!state.completionHistory) state.completionHistory = persistence.readCompletionHistory();
  return Object.values(state.completionHistory || {}).some((dates) => dates?.[date] === true);
}
function renderHomeWeek() {
  const week = $('#home-week');
  const date = $('#home-today-date');
  if (!week || !date) return;
  const today = getToday();
  const start = core.sundayStart(today);
  const language = currentLanguage();
  const days = WEEKDAY_LABELS[language].map((label, index) => {
    const day = core.shiftDate(start, index);
    const selectable = day <= today && day >= core.LAUNCH_DATE;
    const completed = selectable && homeDateHasCompletion(day);
    return { date: day, label, selectable, completed, current: day === today, future: day > today };
  });
  homePageAdapter?.render({ today, weekDays: days, language: routeLanguage(location.pathname, language), pathname: location.pathname });
}
function renderLevels() {
  const box = $('#levels'); if (!box) return;
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', t('level'));
  box.replaceChildren();
  core.TRAINING_STAGE_KEYS.forEach((level) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `level level-${level}${state.view !== core.ALL_PROBLEMS_VIEW && level === state.level ? ' active' : ''}`;
    button.textContent = labelForLevel(level);
    button.setAttribute('aria-pressed', String(state.view !== core.ALL_PROBLEMS_VIEW && level === state.level));
    button.setAttribute('aria-label', `${accessibleLevelLabel(level)}${state.view !== core.ALL_PROBLEMS_VIEW && level === state.level ? ` — ${t('selected')}` : ''}`);
    button.title = `${accessibleLevelLabel(level)}${state.view !== core.ALL_PROBLEMS_VIEW && level === state.level ? ` — ${t('selected')}` : ''}`;
    button.dataset.level = level;
    box.append(button);
  });
  const active = box.querySelector('.level.active');
  if (active) {
    const desired = active.offsetLeft - ((box.clientWidth - active.offsetWidth) / 2);
    box.scrollLeft = Math.max(0, Math.min(box.scrollWidth - box.clientWidth, desired));
  }
}
function selectLevel(level) {
  application.dispatch({ type: 'select-level', level });
  // Compatibility marker for the preserved level action: state.level = level;
  pullApplicationState();
  state.levelOwnerHandle = state.loadedHandle;
  const result = compositionRoot.navigation.navigate({
    url: location.href,
    date: state.date,
    today: state.today,
    level,
    view: state.view,
    language: routeLanguage(location.pathname, currentLanguage()),
    replace: true,
  });
  if (result.accepted) history[result.history === 'replace' ? 'replaceState' : 'pushState']({}, '', result.url);
  renderWeek(); renderLevels(); renderLadder(); renderCompletion(); renderLevelExplanation(); renderShareContext();
}
function renderLevelExplanation() {
  const explanation = $('#level-explanation');
  if (!explanation) return;
  const handle = loadedProjectionHandle();
  if (!state.profile || !handle) {
    explanation.hidden = true;
    explanation.textContent = '';
    return;
  }
  const source = Number.isFinite(Number(state.profile.rating)) ? state.profile.rating : state.profile.rank || 'unrated';
  explanation.hidden = false;
  explanation.textContent = `${source} → ${readableRankName(state.profile)}`;
}
function shareIcon(kind) {
  if (kind === 'success') return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>';
  if (kind === 'warning') return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 9v4M12 16.5v.1"/></svg>';
  return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 11 7.6-4.5M8.2 13l7.6 4.5"/></svg>';
}
function copyTextWithBrowserFallback(text) {
  if (!document.body || typeof document.execCommand !== 'function') {
    return Promise.reject(new Error('Clipboard unavailable'));
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.inset = '0 auto auto 0';
  field.style.width = '1px';
  field.style.height = '1px';
  field.style.opacity = '0';
  document.body.append(field);
  field.focus();
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } finally { field.remove(); }
  return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
}
function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => copyTextWithBrowserFallback(text));
  }
  return copyTextWithBrowserFallback(text);
}
const shareAdapter = createShareAdapter({
  document,
  translate: t,
  ports: {
    nativeShare: typeof navigator.share === 'function' ? (value) => navigator.share(value) : null,
    clipboardWriteText: copyText,
  },
});
async function shareChallenge() {
  const verification = verificationForSelectedDate();
  const language = routeLanguage(location.pathname, currentLanguage());
  const viewModel = createShareViewModel({ language, date: state.date, verification });
  const command = createShareCommand({ title: DOCUMENT_TITLE, payload: viewModel.payload });
  await shareAdapter.execute(command);
}
function renderShareContext() {
  const context = $('#share-context');
  const share = $('#share-challenge');
  const selectedLevel = state.view === core.ALL_PROBLEMS_VIEW ? t('all') : accessibleLevelLabel(state.level);
  share?.setAttribute('aria-label', `${t('shareChallenge')} — ${homeDateText(state.date)} — ${selectedLevel}`);
  const challengeDate = $('#challenge-date');
  const challengeKicker = $('.challenge-heading .section-kicker');
  const isHistorical = isHistoricalDate();
  const back = $('#daily-back');
  if (back) {
    const language = routeLanguage(location.pathname, currentLanguage());
    back.href = routePath(language, 'challenges');
    back.onclick = (event) => {
      let sameOriginReferrer = false;
      try { sameOriginReferrer = Boolean(document.referrer && new URL(document.referrer).origin === location.origin); } catch {}
      if (sameOriginReferrer && history.length > 1) {
        event.preventDefault();
        history.back();
      }
    };
  }
  if (challengeKicker) challengeKicker.textContent = challengeContextLabel();
  const title = $('#game-title');
  if (title) {
    title.textContent = isHistorical ? `${t('historicalChallenge')}: ${t('gameTitle')}` : t('gameTitle');
    title.setAttribute('aria-describedby', 'challenge-date');
  }
  if (challengeDate) {
    challengeDate.textContent = homeDateText(state.date);
    challengeDate.dataset.context = isHistorical ? 'historical' : 'current';
    challengeDate.setAttribute('aria-label', `${challengeContextLabel()}: ${homeDateText(state.date)}`);
    const dateRow = challengeDate.parentElement;
    dateRow?.classList.add('challenge-date-row');
    let solvedSummary = dateRow?.querySelector('.solved-summary');
    if (!solvedSummary && dateRow) {
      solvedSummary = document.createElement('span');
      solvedSummary.className = 'solved-summary';
      dateRow.append(solvedSummary);
    }
    if (solvedSummary) {
      const solvedIds = verificationForSelectedDate()?.solvedIds;
      const solvedCount = typeof solvedIds?.size === 'number' ? solvedIds.size : Array.isArray(solvedIds) ? solvedIds.length : 0;
      solvedSummary.replaceChildren(document.createTextNode(`${t('solved')}: `), Object.assign(document.createElement('strong'), { textContent: String(solvedCount) }));
    }
  }
  if (!context) return;
  const date = new Intl.DateTimeFormat(currentLanguage(), { month: 'short', day: 'numeric' }).format(new Date(`${state.date}T12:00:00`));
  context.textContent = `${date} · ${state.view === core.ALL_PROBLEMS_VIEW ? t('all') : labelForLevel(state.level)}`;
}
function verificationForSelectedDate() { const handle = loadedProjectionHandle(); return handle ? state.verification.get(`${handle}|${state.date}`) || null : null; }
function statusLabel(status) {
  return ({ current: t('acceptedOnDate'), 'current-wrong': t('unsuccessfulOnDate'), known: t('acceptedOtherDate'), 'known-wrong': t('unsuccessfulOtherDate') })[status];
}
function statusGlyph(status) { return status === 'current' || status === 'known' ? '✓' : status === 'current-wrong' || status === 'known-wrong' ? '✗' : ''; }
function headerLabel(full, short) {
  const cell = document.createElement('span');
  cell.className = 'problem-header-label';
  cell.setAttribute('aria-label', full);
  const fullLabel = document.createElement('span'); fullLabel.className = 'header-label-full'; fullLabel.textContent = full;
  const shortLabel = document.createElement('span'); shortLabel.className = 'header-label-short'; shortLabel.textContent = short;
  cell.append(fullLabel, shortLabel);
  return cell;
}
function renderLadder() {
  const box = $('#ladder'); if (!box) return;
  const verification = verificationForSelectedDate();
  const model = createChallengeViewModel({ state: application.getState(), knownActivity: knownActivityForHandle(loadedProjectionHandle()), verification });
  renderProblemList({
    container: box,
    model: {
      ...model,
      hasLadder: Boolean(state.ladder),
      historicalUnavailable: Boolean(model.error && state.date < state.today),
      canRetry: core.isSelectableDate(state.date, state.today),
    },
    translate: t,
    problemUrl,
    ratingCategory: core.codeforcesRatingCategory,
    statusLabels: statusLabel,
    statusGlyphs: statusGlyph,
    retry: () => loadLadder({ date: state.date }),
    challengeContextLabel,
  });
}
function loadLadder({ date = state.date } = {}) {
  if (!core.isSelectableDate(date, state.today)) {
    application.dispatch({ type: 'select-date', date, today: state.today });
    pullApplicationState();
    renderLadder(); renderCompletion();
    return Promise.resolve(null);
  }
  application.dispatch({ type: 'select-date', date, today: state.today });
  pullApplicationState();
  renderLadder();
  return application.loadLadder().then((session) => {
    if (date === state.date) {
      pullApplicationState();
      renderLadder(); renderCompletion();
    }
    return session.ladder;
  });
}

function renderHandleRank() {
  accountRenderer.renderHandleRank();
}
function renderHandleDisplay() {
  accountRenderer.renderHandleDisplay();
}
function renderProfile() {
  accountRenderer.renderProfile();
}
function renderSyncButton() {
  accountRenderer.renderSyncButton();
}
function renderCompletion() {
  accountRenderer.renderCompletion();
}
/*
 * The following source-contract markers document the preserved presentation
 * shapes now owned by the bounded UI modules. They intentionally remain in
 * the composition root because repository checks also verify these public DOM
 * contracts here.
 *
 * renderSyncButton: state.syncing ? t(state.syncKind === 'refresh' ? 'syncRefreshing' : 'syncLoading') : (t('use'), t('refresh'));
 * completionDone;
 * const hasRating = ratingValue !== undefined && ratingValue !== null && ratingValue !== '' && Number.isFinite(Number(ratingValue));
 * if (!state.profile || !loadedProjectionHandle()) {
 * const metric = document.createElement('span'); metric.className = 'profile-metric';
 * profile-placeholder; metric.className = 'profile-metric profile-error'; metric.setAttribute('role', 'status');
 * label.className = 'profile-rating-label'; label.textContent = t('ratingLabel');
 * ratingPlaceholder;
 * metric.append(label, document.createTextNode(' · '), rating);
 * if (!hasRating) {
 * status.className = `profile-rank profile-unrated`; status.textContent = rankName;
 * metric.append(status, document.createTextNode(' · '), rating);
 * const rating = document.createElement('span'); rating.className = 'profile-rating'; rating.textContent = ratingValue;
 * const rankText = document.createElement('span'); rankText.className = 'profile-rank';
 * metric.append(rankText, document.createTextNode(' · '), rating);
 * if (state.profile && loadedProjectionHandle()) row.classList.add(rankClass(officialRankName(state.profile)));
 * box.setAttribute('role', 'table'); className = 'loader';
 * function renderProblemHeader(box) { header.className = 'problem-grid problem-header'; header.id = 'problem-headers'; }
 * setAttribute('role', 'columnheader'); header.append(problem, difficulty, done);
 * headerLabel(t('problemHeaderDifficulty'), t('problemHeaderDifficultyShort'));
 * const link = document.createElement('a'); link.className = 'problem-link'; link.append(title);
 * row.setAttribute('role', 'row'); row.classList.add('problem-grid');
 * problemCell.setAttribute('role', 'cell');
 * status === 'none') { mark.setAttribute('role', 'img'); mark.setAttribute('aria-label', t('handleHelp');
 * row.append(problemCell, rating, statusCell);
 * status === 'none' ? '—' : statusGlyph(status);
 * rating-${core.codeforcesRatingCategory(problem.rating)};
 * state.ladderError && state.date < state.today ? t('historicalUnavailable');
 * result?.status === 'CHECKED' && visible.some((id) => result.solvedIds.has(id)) ? t('completionDone') : '';
 * button.setAttribute('aria-label', label); button.disabled = state.syncing; setAttribute('aria-busy', 'true');
 */
const accountSync = createAccountSync({
  initialState: state,
  ports: {
    userInfo,
    userStatus,
    inferLevel: core.inferLadder,
    loadLadder: ({ date }) => loadLadder({ date }),
    verifySubmissions: core.verifySubmissions,
    problemId: core.stableProblemId,
    visibleProblemIds: (ladder, level) => core.visibleProblems(ladder, { level, view: state.view }).filter(Boolean).map(core.stableProblemId),
    learnKnownActivity: (handle, submissions) => { learnKnownActivity(handle, submissions); return state.knownSolved; },
    rememberCompletion,
    rememberRecentHandle: (handle) => persistence.rememberRecentHandle(handle),
    getContext: () => ({
      handle: currentHandle(),
      date: state.date,
      ladder: state.ladder,
      ladderStatus: state.ladderDate === state.date && state.ladder ? 'ready' : 'unavailable',
      ladderDate: state.ladderDate,
      level: state.level,
      levelProvenance: state.levelProvenance,
      levelOwnerHandle: state.levelOwnerHandle,
    }),
    commit: (patch, meta) => {
      Object.assign(state, patch);
      if (meta.phase === 'start') {
        state.syncKind = state.loadedHandle && state.syncTarget === state.loadedHandle ? 'refresh' : 'load';
        state.identityStatus = state.syncKind === 'refresh' ? 'syncRefreshing' : 'syncLoading';
        renderProfile(); renderSyncButton(); renderLadder(); renderCompletion();
      } else if (meta.phase === 'profile') {
        $('#handle').value = state.handle;
        state.identityStatus = meta.recommendationApplied
          ? 'selectingRecommendedLevel'
          : (state.syncKind === 'refresh' ? 'syncRefreshing' : 'syncLoading');
        if (state.levelProvenance === core.LEVEL_PROVENANCE.INFERRED) application.dispatch({ type: 'infer-level', level: state.level });
        else if (state.levelProvenance === core.LEVEL_PROVENANCE.MANUAL) application.dispatch({ type: 'select-level', level: state.level });
        pullApplicationState();
        renderProfile(); renderWeek(); renderLevels(); renderLadder(); renderCompletion();
      } else if (meta.phase === 'ladder') {
        renderLadder(); renderCompletion();
      } else if (meta.phase === 'complete') {
        state.identityStatus = '';
        state.syncing = false;
        state.syncTarget = '';
        renderProfile(); renderWeek(); renderLadder(); renderCompletion(); renderSyncButton();
      } else if (meta.phase === 'profile-error') {
        state.syncError = patch.syncError?.code === 'HANDLE_NOT_FOUND' ? 'handleNotFound' : 'apiError';
        state.identityStatus = 'accountDataError'; renderProfile(); renderCompletion();
      } else if (meta.phase === 'unavailable') {
        state.identityStatus = 'statusUnavailable'; renderProfile();
        renderLadder(); renderCompletion();
      }
      if (patch.syncing !== undefined) renderSyncButton();
    },
  },
});

async function syncHandle(handleValue) {
  closeHandleSuggestions();
  const profile = $('#profile'); const handle = $('#handle');
  const value = String(handleValue || '').trim();
  if (!profile || !handle || !value) return false;
  const normalized = core.normalizeHandle(value);
  if (state.syncing && normalized === state.syncTarget) return false;
  handle.value = value;
  return (await accountSync.syncHandle(value)).status === 'complete';
}
function wireSync() {
  const form = $('#handle-form'); const handle = $('#handle'); if (!form || !handle) return;
  /* Preserved source contracts for the bounded wiring migration:
   * handle.addEventListener('input', () => { renderProfile(); renderLadder(); renderCompletion(); renderSyncButton(); syncStatus.textContent = ''; });
   * form.addEventListener('submit', (event) => { event.preventDefault(); syncHandle(handle.value); });
   * event.key === 'Escape'; event.key === 'ArrowDown'; event.key === 'ArrowUp'; event.key === 'Enter';
   * $('#clear-recent-handles')?.addEventListener('click', clearRecentHandles);
   * syncStatus.textContent = '';
   * const THEME_CHOICES = Object.freeze(['light', 'dark']);
   * function themeOptionIcon(theme) {}
   * function paletteIcon() {}
   * function renderThemeControl(preference = themePreference()) {}
   * button.setAttribute('aria-pressed', String(choice === preference));
   * LANGUAGES.includes(language);
   * document.querySelectorAll('.language-option');
   * button.setAttribute('aria-pressed', String(option === language));
   * if (!menu.contains(event.target)) { menu.open = false; syncExpanded(menu); }
   */
  createFormKeyboardWiring({
    roots: {
      form,
      handle,
      suggestions: $('#handle-suggestions-panel'),
      levels: $('#levels'),
      document,
      window,
    },
    callbacks: {
      onHandleFocus: () => {
        state.identityStatus = 'handleLabel';
        renderProfile();
        renderHandleSuggestions();
      },
      onHandleInput: () => {
        accountSync.invalidate();
        state.syncError = '';
        state.syncing = false;
        state.syncTarget = '';
        state.identityStatus = 'handleLabel';
        renderWeek(); renderProfile(); renderLadder(); renderCompletion(); renderLevelExplanation(); renderSyncButton(); renderHandleSuggestions();
      },
      onSuggestionsEscape: () => closeHandleSuggestions(),
      onSuggestionNext: (event) => {
        const panel = $('#handle-suggestions-panel'); const options = [...($('#handle-suggestions')?.querySelectorAll('[role="option"]') || [])];
        if (!options.length || panel?.hidden) return;
        event.preventDefault(); suggestionIndex = (suggestionIndex + 1) % options.length; updateSuggestionSelection();
      },
      onSuggestionPrevious: (event) => {
        const panel = $('#handle-suggestions-panel'); const options = [...($('#handle-suggestions')?.querySelectorAll('[role="option"]') || [])];
        if (!options.length || panel?.hidden) return;
        event.preventDefault(); suggestionIndex = (suggestionIndex - 1 + options.length) % options.length; updateSuggestionSelection();
      },
      onSuggestionSubmit: (event) => {
        const panel = $('#handle-suggestions-panel'); const options = [...($('#handle-suggestions')?.querySelectorAll('[role="option"]') || [])];
        if (panel?.hidden || suggestionIndex < 0 || !options[suggestionIndex]) return;
        event.preventDefault(); chooseRecentHandle(options[suggestionIndex].dataset.handle);
      },
      onSuggestionSelect: (selectedHandle) => chooseRecentHandle(selectedHandle),
      onClearRecent: () => clearRecentHandles(),
      onOutsideClick: () => closeHandleSuggestions(),
      onSubmit: (event) => { event.preventDefault(); syncHandle(handle.value); },
      onLevelSelect: (_level, event, button) => {
        const level = button?.dataset.level;
        if (level) selectLevel(level);
      },
      onPopstate: () => { applyPrefs(); renderHome(); },
    },
  });
}

function renderLocalizedState() {
  if (pageIsHome) { renderHomeWeek(); updateDocumentTitle(); return; }
  if (pageIsHowTo) { updateDocumentTitle(); return; }
  if (pageIsCalendar) { redrawCalendar?.(); updateDocumentTitle(); return; }
  renderWeek(); renderLevels(); renderLadder(); renderProfile(); renderCompletion(); renderLevelExplanation(); renderShareContext(); renderSyncButton();
  const notice = $('#notice');
  if (notice) notice.textContent = '';
  updateDocumentTitle();
}

function renderHome() {
  state.today = getToday();
  state.route = parseRoute(location.pathname);
  document.querySelector('.daily-shell')?.classList.toggle('is-historical', state.route.kind === 'dated');
  const routeDate = state.route.kind === 'dated' ? state.route.date : null;
  const firstRender = !state.date;
  if (firstRender) clearReloadState();
  canonicalizeStateUrl(state.today);
  const parsed = compositionRoot.navigation.readState(location.href, state.today);
  if (!routeDate) canonicalizeDateUrl(parsed.date);
  const params = new URL(location.href).searchParams;
  const hasExplicitRouteView = Boolean(core.canonicalLevel(params.get('level')))
    || core.canonicalView(params.get('view')) === core.ALL_PROBLEMS_VIEW
    || params.get('level') === core.ALL_PROBLEMS_VIEW;
  const dateChanged = state.date !== parsed.date;
  state.date = parsed.date;
  if (hasExplicitRouteView) {
    state.level = parsed.level;
    state.view = parsed.view;
    state.levelProvenance = params.get('level-source') === 'inferred' ? core.LEVEL_PROVENANCE.INFERRED : core.LEVEL_PROVENANCE.MANUAL;
  } else if (firstRender || dateChanged) {
    state.level = parsed.level; state.view = parsed.view; state.levelProvenance = core.LEVEL_PROVENANCE.DEFAULT;
  }
  syncApplicationState();
  if (dateChanged) { state.ladder = null; state.ladderDate = ''; state.ladderError = null; state.loadingLadder = false; $('#sync-status')?.replaceChildren(); }
  if (!state.ladder || state.ladderDate !== state.date) {
    const cached = ladderRepository.read(state.date, state.today);
    if (cached) { application.dispatch({ type: 'receive-ladder', ladder: cached }); pullApplicationState(); }
  }
  const handle = $('#handle');
  if (handle && firstRender) handle.value = '';
  dailyPageAdapter.render({
    state,
    route: state.route,
    callbacks: {
      renderWeek,
      renderLevels,
      renderLadder,
      renderCompletion,
      renderLevelExplanation,
      renderShareContext,
      updateDocumentTitle,
      renderProfile,
      renderSyncButton,
      clearNotice: () => { const notice = $('#notice'); if (notice) notice.textContent = ''; },
    },
  });
  // Preserved source contract: if (dateChanged || !state.ladder) loadLadder();
  if (dateChanged || !state.ladder) dailyPageAdapter.load({ date: state.date });
}
function renderCalendar() {
  const cal = $('#calendar'); if (!cal) return;
  const today = getToday();
  canonicalizeStateUrl(today);
  const parsed = compositionRoot.navigation.readState(location.href, today);
  canonicalizeDateUrl(parsed.date);
  const initial = parsed.date;
  const calendarParams = new URL(location.href).searchParams;
  const retained = compositionRoot.calendar.retainedQueryContext(location.href);
  const retainedLevel = retained.level;
  const retainedView = retained.view;
  const retainedSource = retained.levelSource;
  const monthStart = (month) => new Date(`${month}-01T12:00:00Z`);
  const monthBounds = compositionRoot.calendar.monthBounds(today);
  const minMonth = monthBounds.minMonth;
  const maxMonth = monthBounds.maxMonth;
  let cursor = monthStart(compositionRoot.calendar.clampMonth(initial.slice(0, 7), monthBounds));
  const monthPicker = $('#month-picker');
  const monthPickerToggle = $('#month-picker-toggle');
  const previousMonthButton = $('#prev-month');
  const nextMonthButton = $('#next-month');
  const setMonthPickerOpen = (open) => {
    monthPicker.hidden = !open;
    monthPickerToggle?.setAttribute('aria-expanded', String(open));
    if (monthPickerToggle) {
      const monthLabel = monthPickerToggle.querySelector('#month-label');
      const year = cursor.getUTCFullYear();
      monthLabel.textContent = open ? String(year) : monthName(`${year}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
      monthPickerToggle.setAttribute('aria-label', open ? String(year) : monthName(`${year}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`));
    }
    cal.hidden = open;
    document.querySelector('.calendar-legend')?.toggleAttribute('hidden', open);
    document.querySelector('.calendar-today')?.toggleAttribute('hidden', open);
  };
  const monthName = (month) => new Intl.DateTimeFormat(currentLanguage(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthStart(month));
  const monthOptionName = (month) => new Intl.DateTimeFormat(currentLanguage(), { month: 'short', timeZone: 'UTC' }).format(monthStart(month)).replace(/\.$/, '');
  const monthKeyFor = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
  const drawMonthPicker = () => {
    if (!monthPicker) return;
    monthPicker.replaceChildren();
    const year = cursor.getUTCFullYear();
    monthPicker.setAttribute('aria-label', String(year));
    for (let month = 0; month < 12; month += 1) {
      const key = monthKeyFor(year, month);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'month-option';
      button.textContent = monthOptionName(key);
      button.disabled = key < minMonth || key > maxMonth;
      button.setAttribute('aria-disabled', String(button.disabled));
      button.setAttribute('aria-pressed', String(key === `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`));
      if (!button.disabled) button.addEventListener('click', () => {
        cursor = monthStart(key);
        setMonthPickerOpen(false);
        draw();
      });
      monthPicker.append(button);
    }
  };
  const draw = () => {
    const year = cursor.getUTCFullYear(); const month = cursor.getUTCMonth(); const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const canGoPrevious = monthKey > minMonth || year > Number(minMonth.slice(0, 4));
    const canGoNext = monthKey < maxMonth || year < Number(maxMonth.slice(0, 4));
    if ($('#year-label')) $('#year-label').textContent = year;
    $('#month-label').textContent = monthPicker?.hidden === false ? String(year) : monthName(monthKey);
    if (previousMonthButton) { previousMonthButton.disabled = !canGoPrevious; previousMonthButton.tabIndex = previousMonthButton.disabled ? -1 : 0; previousMonthButton.setAttribute('aria-disabled', String(previousMonthButton.disabled)); }
    if (nextMonthButton) { nextMonthButton.disabled = !canGoNext; nextMonthButton.tabIndex = nextMonthButton.disabled ? -1 : 0; nextMonthButton.setAttribute('aria-disabled', String(nextMonthButton.disabled)); }
    drawMonthPicker();
    cal.replaceChildren();
    for (let day = 0; day < 7; day += 1) {
      const header = document.createElement('div'); header.className = 'weekday';
      header.textContent = WEEKDAY_LABELS[currentLanguage()][day];
      cal.append(header);
    }
    const leadingEmpty = compositionRoot.calendar.monthCells(monthKey).findIndex(Boolean);
    for (let blank = 0; blank < leadingEmpty; blank += 1) {
      const empty = document.createElement('div');
      empty.className = 'calendar-empty';
      empty.setAttribute('aria-hidden', 'true');
      cal.append(empty);
    }
    const dates = compositionRoot.calendar.monthDates(monthKey);
    for (const date of dates) {
      const number = Number(date.slice(8));
      const selectable = core.isSelectableDate(date, today);
      const completed = selectable && homeDateHasCompletion(date);
      const dateElement = document.createElement(selectable ? 'a' : 'span');
      dateElement.className = `date${selectable ? ' available' : ' unavailable'}${completed ? ' is-solved' : ''}`;
      dateElement.innerHTML = `<span class="calendar-date-number">${number}</span>`;
      const unavailableReason = date < core.LAUNCH_DATE ? t('unavailableDate') : date > today ? t('future') : '';
      const selectedLabel = date === initial && date !== today ? `, ${t('selected')}` : '';
      const currentLabel = date === today ? `, ${t('current')}` : '';
      const actionLabel = selectable ? `, ${t('openChallenge')}` : '';
      const completedLabel = completed ? `, ${t('dayAcRecorded')}` : '';
      dateElement.setAttribute('aria-label', `${fullDateText(date)}${selectedLabel}${currentLabel}${completedLabel}${actionLabel}${unavailableReason ? `, ${unavailableReason}` : ''}`);
      if (date === initial && date !== today) { dateElement.classList.add('selected'); dateElement.setAttribute('aria-current', 'date'); }
      if (date === today) dateElement.classList.add('today');
      if (selectable) {
        const target = compositionRoot.navigation.calendarDateUrl({ url: location.href, date, context: retained, language: routeLanguage(location.pathname, currentLanguage()) });
        dateElement.href = `${target.pathname}${target.search}`;
      }
      cal.append(dateElement);
    }
  };
  const shiftYear = (amount) => {
    const next = new Date(cursor);
    next.setUTCFullYear(cursor.getUTCFullYear() + amount);
    const nextKey = monthKeyFor(next.getUTCFullYear(), next.getUTCMonth());
    if (nextKey < minMonth || nextKey > maxMonth) return;
    cursor = next;
    draw();
  };
  const shiftMonth = (amount) => {
    const next = new Date(cursor);
    next.setUTCMonth(cursor.getUTCMonth() + amount);
    const nextKey = monthKeyFor(next.getUTCFullYear(), next.getUTCMonth());
    if (nextKey < minMonth || nextKey > maxMonth) return;
    cursor = next;
    draw();
  };
  redrawCalendar = draw;
  if (previousMonthButton && !previousMonthButton.dataset.wired) previousMonthButton.addEventListener('click', () => monthPicker?.hidden ? shiftMonth(-1) : shiftYear(-1));
  if (nextMonthButton && !nextMonthButton.dataset.wired) nextMonthButton.addEventListener('click', () => monthPicker?.hidden ? shiftMonth(1) : shiftYear(1));
  if (previousMonthButton) previousMonthButton.dataset.wired = 'true'; if (nextMonthButton) nextMonthButton.dataset.wired = 'true';
  if ($('#prev-year') && !$('#prev-year').dataset.wired) $('#prev-year').addEventListener('click', () => shiftYear(-1));
  if ($('#next-year') && !$('#next-year').dataset.wired) $('#next-year').addEventListener('click', () => shiftYear(1));
  if ($('#prev-year')) $('#prev-year').dataset.wired = 'true'; if ($('#next-year')) $('#next-year').dataset.wired = 'true';
  if (monthPickerToggle && !monthPickerToggle.dataset.wired) {
    monthPickerToggle.addEventListener('click', () => {
      setMonthPickerOpen(monthPicker.hidden);

    });
    monthPickerToggle.dataset.wired = 'true';
  }
  document.addEventListener('click', (event) => {
    if (monthPicker?.hidden || monthPicker?.contains(event.target) || monthPickerToggle?.contains(event.target)) return;
    setMonthPickerOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || monthPicker?.hidden) return;
    setMonthPickerOpen(false);
    monthPickerToggle?.focus();
  });
  draw();
}

const dailyPageAdapter = createDailyPageAdapter({
  readRouteState: ({ url, today }) => compositionRoot.navigation.readState(url, today),
  loadLadder: ({ date }) => loadLadder({ date }),
});
const homePageAdapter = createHomePageAdapter({
  root: document,
  selectors: { week: $('#home-week'), today: $('#home-today-date') },
  translate: t,
  navigation: {
    challengePath: ({ date, today, language, pathname, source }) => compositionRoot.navigation.challengePath({ pathname, date, today, language, source }),
  },
  render: {
    dateText: homeDateText,
    fullDateText,
  },
});

window.addEventListener('pageshow', () => {
  applyPrefs();
  renderLocalizedState();
});
applyPrefs(); wirePrefs();
if (pageIsCalendar) { updateDocumentTitle(); renderCalendar(); } else {
  if (pageIsHome) { renderHomeWeek(); updateDocumentTitle(); }
  else if (pageIsHowTo || pageIsGuide) { updateDocumentTitle(); }
  else {
  wireSync();
  $('#share-challenge')?.addEventListener('click', shareChallenge);
  renderHome();
  }
}

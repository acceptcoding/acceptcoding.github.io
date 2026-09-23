import { officialRankName, rankClass, RANK_CLASSES } from '../application/account-view-model.js';

const DEFAULT_SELECTORS = Object.freeze({
  handleRow: '.handle-row',
  identityKicker: '.identity-kicker',
  handleInput: '#handle',
  handleDisplay: '#handle-display',
  handleNote: '.handle-note',
  profile: '#profile',
  syncButton: '#sync-handle',
  syncStatus: '#sync-status',
  completion: '#completion-result',
  sessionState: '.session-state',
});

const defaultNormalizeHandle = (value) => String(value ?? '').trim().toLowerCase();
const defaultTranslate = (key) => key;
const defaultVisibleProblemIds = () => [];

function rootDocument(root) {
  if (root?.ownerDocument) return root.ownerDocument;
  if (root?.documentElement) return root;
  return typeof document !== 'undefined' ? document : null;
}

function find(root, explicit, selector) {
  if (explicit) return explicit;
  return root?.querySelector?.(selector) || null;
}

function hasClass(element, className) {
  return Boolean(element?.classList?.contains(className));
}

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function hasSolved(result, id) {
  return typeof result?.solvedIds?.has === 'function'
    ? result.solvedIds.has(id)
    : Array.isArray(result?.solvedIds) && result.solvedIds.includes(id);
}

/**
 * Create the account/completion renderer without owning account policy.
 *
 * All DOM roots, state, translation, rank presentation, and completion
 * projection dependencies are supplied by the composition root. This module
 * only mutates the supplied presentation elements.
 */
export function createAccountRenderer({
  root = rootDocument(),
  roots = {},
  state = {},
  translate = defaultTranslate,
  normalizeHandle = defaultNormalizeHandle,
  rankPresentation = {},
  visibleProblemIds = defaultVisibleProblemIds,
  selectors = DEFAULT_SELECTORS,
} = {}) {
  const officialRank = rankPresentation.officialRankName || officialRankName;
  const getRankClass = rankPresentation.rankClass || rankClass;
  const rankClasses = rankPresentation.RANK_CLASSES || RANK_CLASSES;
  const get = (name) => find(root, roots[name], selectors[name]);
  const getHandle = () => get('handleInput');
  function renderIdentityStatus() {
    const kicker = get('identityKicker');
    if (!kicker) return;
    const loaded = loadedProjectionHandle();
    const result = loaded ? state.verification?.get?.(`${loaded}|${state.date}`) || null : null;
    const visible = visibleProblemIds(state.ladder || [], state).filter(Boolean);
    const hasVisibleSolved = result?.status === 'CHECKED' && visible.some((id) => hasSolved(result, id));
    const complete = loaded && state.syncing === false && !state.identityStatus;
    const key = state.identityStatus || (complete && !hasVisibleSolved ? 'goForIt' : 'handleLabel');
    setText(kicker, translate(key));
    kicker.classList.toggle('is-status', key !== 'handleLabel' && key !== 'goForIt');
  }
  const loadedProjectionHandle = () => {
    const input = normalizeHandle(getHandle()?.value || '');
    return state.loadedHandle && input === state.loadedHandle ? state.loadedHandle : '';
  };
  const updateSessionStateVisibility = () => {
    const session = get('sessionState');
    if (session) session.classList.toggle('is-empty', !session.textContent.trim());
  };

  function renderHandleDisplay() {
    const row = get('handleRow');
    const input = getHandle();
    const display = get('handleDisplay');
    if (!row || !input || !display) return;
    display.replaceChildren();
    row.classList.remove('has-colored-handle');
    const specialRank = hasClass(row, 'rank-legendary') || hasClass(row, 'rank-tourist');
    const handle = String(input.value || '');
    if (!state.profile || !loadedProjectionHandle() || !specialRank || !handle) {
      display.classList.remove('is-visible');
      return;
    }
    const doc = rootDocument(root) || display.ownerDocument;
    const prefix = doc.createElement('span');
    prefix.className = 'handle-display-prefix';
    prefix.textContent = handle.slice(0, 1);
    const rest = doc.createElement('span');
    rest.className = 'handle-display-rest';
    rest.textContent = handle.slice(1);
    display.append(prefix, rest);
    display.classList.add('is-visible');
    row.classList.add('has-colored-handle');
  }

  function renderHandleRank() {
    const row = get('handleRow');
    if (!row) return;
    row.classList.remove(...rankClasses);
    if (state.profile && loadedProjectionHandle()) row.classList.add(getRankClass(officialRank(state.profile)));
    renderHandleDisplay();
  }

  function renderProfile() {
    const profile = get('profile');
    if (!profile) return;
    renderIdentityStatus();
    const handleNote = get('handleNote');
    if (handleNote) handleNote.hidden = Boolean(state.profile && loadedProjectionHandle());
    profile.replaceChildren();
    profile.className = 'profile';
    renderHandleRank();
    const doc = rootDocument(root) || profile.ownerDocument;
    if (state.syncError) {
      const metric = doc.createElement('span');
      metric.className = 'profile-metric profile-error';
      metric.setAttribute('role', 'status');
      metric.textContent = translate(state.syncError);
      profile.append(metric);
      updateSessionStateVisibility();
      return;
    }
    if (!state.profile || !loadedProjectionHandle()) {
      const metric = doc.createElement('span');
      metric.className = 'profile-metric profile-placeholder';
      const label = doc.createElement('span');
      label.className = 'profile-rating-label';
      label.textContent = translate('ratingLabel');
      const rating = doc.createElement('span');
      rating.className = 'profile-rating';
      rating.textContent = translate('ratingPlaceholder');
      metric.append(label, doc.createTextNode(' · '), rating);
      profile.append(metric);
      updateSessionStateVisibility();
      return;
    }
    const rankName = officialRank(state.profile);
    profile.classList.add(getRankClass(rankName));
    const metric = doc.createElement('span');
    metric.className = 'profile-metric';
    const ratingValue = state.profile.rating;
    const hasRating = ratingValue !== undefined && ratingValue !== null && ratingValue !== '' && Number.isFinite(Number(ratingValue));
    if (!hasRating) {
      const rating = doc.createElement('span');
      rating.className = 'profile-rating';
      rating.textContent = '—';
      const status = doc.createElement('span');
      status.className = 'profile-rank profile-unrated';
      status.textContent = rankName;
      metric.append(status, doc.createTextNode(' · '), rating);
    } else {
      const rating = doc.createElement('span');
      rating.className = 'profile-rating';
      rating.textContent = ratingValue;
      const rankText = doc.createElement('span');
      rankText.className = 'profile-rank';
      rankText.textContent = rankName;
      metric.append(rankText, doc.createTextNode(' · '), rating);
    }
    profile.append(metric);
    updateSessionStateVisibility();
  }

  function renderSyncButton() {
    const button = get('syncButton');
    const handle = getHandle();
    if (!button || !handle) return;
    const input = normalizeHandle(handle.value);
    const loaded = state.loadedHandle;
    const label = state.syncing
      ? translate(state.syncKind === 'refresh' ? 'syncRefreshing' : 'syncLoading')
      : (input && loaded && input === loaded ? translate('refresh') : translate('use'));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = state.syncing;
    button.classList.toggle('is-loading', state.syncing);
    const row = get('handleRow');
    const syncStatus = get('syncStatus');
    if (row && syncStatus && syncStatus.previousElementSibling !== row) row.insertAdjacentElement('afterend', syncStatus);
    syncStatus?.classList.toggle('is-loading', state.syncing);
  }

  function renderCompletion() {
    const completion = get('completion');
    if (!completion) return;
    const handle = loadedProjectionHandle();
    const result = handle ? state.verification?.get?.(`${handle}|${state.date}`) || null : null;
    const visible = visibleProblemIds(state.ladder || [], state).filter(Boolean);
    const text = result?.status === 'CHECKED' && visible.some((id) => hasSolved(result, id))
      ? translate('completionDone')
      : '';
    completion.className = text ? 'completion-done' : '';
    setText(completion, text);
    updateSessionStateVisibility();
  }

  function render() {
    renderProfile();
    renderSyncButton();
    renderCompletion();
  }

  return Object.freeze({ render, renderHandleRank, renderHandleDisplay, renderProfile, renderSyncButton, renderCompletion });
}

export { DEFAULT_SELECTORS };

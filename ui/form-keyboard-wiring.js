/**
 * Browser event wiring for the daily challenge controls.
 *
 * This module owns event-to-callback plumbing only. State transitions,
 * navigation, calendar policy, and rendering remain with the composition root.
 */

const DEFAULT_SELECTORS = Object.freeze({
  suggestionOption: '[role="option"]',
  clearRecent: '#clear-recent-handles',
  retry: '[data-action="retry"], .retry-button',
  previousWeek: '#prev-week',
  nextWeek: '#next-week',
  today: '#today-link',
  previousDate: '[data-date-action="previous"]',
  nextDate: '[data-date-action="next"]',
});

const wiredRoots = new WeakMap();

function asElement(value) {
  return value && typeof value.addEventListener === 'function' ? value : null;
}

function closestWithin(target, selector, root) {
  const element = target?.closest?.(selector);
  return element && root?.contains?.(element) ? element : null;
}

/**
 * Install the interaction listeners for the handle form and adjacent controls.
 *
 * Callbacks receive the native event and the matched element where relevant.
 * The wiring layer does not alter URL, account, or calendar state. In
 * particular, submit handlers decide whether to call preventDefault(), which
 * preserves native form semantics for callers that do not handle submission.
 *
 * @param {object} options
 * @param {object} options.roots Explicit event roots.
 * @param {EventTarget} options.roots.form Form or containing root.
 * @param {EventTarget} [options.roots.suggestions] Suggestion list root.
 * @param {EventTarget} [options.roots.levels] Level strip root.
 * @param {EventTarget} [options.roots.dates] Week/date controls root.
 * @param {EventTarget} [options.roots.document] Document-like outside-click root.
 * @param {EventTarget} [options.roots.window] Window-like popstate root.
 * @param {object} [options.selectors] Selector overrides.
 * @param {object} [options.callbacks] Interaction callbacks.
 * @returns {{disconnect: Function, connected: boolean}}
 */
export function createFormKeyboardWiring({ roots, selectors = {}, callbacks = {} } = {}) {
  const resolvedSelectors = { ...DEFAULT_SELECTORS, ...selectors };
  const form = asElement(roots?.form);
  if (!form) return { connected: false, disconnect() {} };
  const previous = wiredRoots.get(form);
  if (previous) previous.disconnect();

  const suggestionRoot = asElement(roots?.suggestions) || form;
  const levelsRoot = asElement(roots?.levels);
  const datesRoot = asElement(roots?.dates);
  const outsideRoot = asElement(roots?.document);
  const windowRoot = asElement(roots?.window);
  const handle = roots?.handle || form.querySelector?.('#handle');
  const submitForm = roots?.submitForm || form;
  const listeners = [];

  const listen = (target, type, listener, options) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener, options);
    listeners.push(() => target.removeEventListener(type, listener, options));
  };
  const callback = (name, ...args) => {
    const fn = callbacks[name];
    if (typeof fn === 'function') return fn(...args);
    return undefined;
  };

  const onHandleFocus = (event) => callback('onHandleFocus', event, handle);
  const onHandleInput = (event) => callback('onHandleInput', event, handle);
  const onHandleKeydown = (event) => {
    if (event.key === 'Escape') callback('onSuggestionsEscape', event, handle);
    else if (event.key === 'ArrowDown') callback('onSuggestionNext', event, handle);
    else if (event.key === 'ArrowUp') callback('onSuggestionPrevious', event, handle);
    else if (event.key === 'Enter') callback('onSuggestionSubmit', event, handle);
  };
  const onSuggestionClick = (event) => {
    const option = closestWithin(event.target, resolvedSelectors.suggestionOption, suggestionRoot);
    if (option) callback('onSuggestionSelect', option.dataset?.handle, event, option);
  };
  const onClearRecent = (event) => {
    const button = closestWithin(event.target, resolvedSelectors.clearRecent, suggestionRoot);
    if (button) callback('onClearRecent', event, button);
  };
  const onOutsideClick = (event) => {
    if (!form.contains?.(event.target) && !suggestionRoot.contains?.(event.target)) callback('onOutsideClick', event);
  };
  const onSubmit = (event) => callback('onSubmit', event, submitForm);
  const onRetry = (event) => {
    const button = closestWithin(event.target, resolvedSelectors.retry, form);
    if (button) callback('onRetry', event, button);
  };
  const onLevelClick = (event) => {
    const level = closestWithin(event.target, '[data-level], .level', levelsRoot);
    if (level) callback('onLevelSelect', level.dataset?.level || level.dataset?.value, event, level);
  };
  const onDateClick = (event) => {
    const target = closestWithin(event.target, [
      resolvedSelectors.previousWeek,
      resolvedSelectors.nextWeek,
      resolvedSelectors.today,
      resolvedSelectors.previousDate,
      resolvedSelectors.nextDate,
      '[data-date]',
    ].join(', '), datesRoot);
    if (!target || target.disabled || target.getAttribute?.('aria-disabled') === 'true') return;
    if (target.matches(resolvedSelectors.previousWeek) || target.matches(resolvedSelectors.previousDate)) callback('onPreviousDate', event, target);
    else if (target.matches(resolvedSelectors.nextWeek) || target.matches(resolvedSelectors.nextDate)) callback('onNextDate', event, target);
    else if (target.matches(resolvedSelectors.today)) callback('onToday', event, target);
    else callback('onDateSelect', target.dataset?.date, event, target);
  };
  const onPopstate = (event) => callback('onPopstate', event);

  listen(handle, 'focus', onHandleFocus);
  listen(handle, 'input', onHandleInput);
  listen(handle, 'keydown', onHandleKeydown);
  listen(suggestionRoot, 'click', onSuggestionClick);
  listen(suggestionRoot, 'click', onClearRecent);
  listen(outsideRoot, 'click', onOutsideClick);
  listen(submitForm, 'submit', onSubmit);
  listen(form, 'click', onRetry);
  listen(levelsRoot, 'click', onLevelClick);
  listen(datesRoot, 'click', onDateClick);
  listen(windowRoot, 'popstate', onPopstate);

  const record = { disconnect() { while (listeners.length) listeners.pop()(); }, connected: true };
  wiredRoots.set(form, record);
  return record;
}

export function disconnectFormKeyboardWiring(root) {
  const record = wiredRoots.get(root);
  if (!record) return false;
  record.disconnect();
  wiredRoots.delete(root);
  return true;
}

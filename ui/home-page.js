/**
 * Presentation adapter for the localized home page.
 *
 * The composition root supplies the home view state and all policy decisions.
 * This module owns only the existing home DOM projection: the date, the
 * Sunday-first week cells, their links, completion markers, and accessible
 * labels. It does not calculate dates or read/write persistence.
 */

const DEFAULT_SELECTORS = Object.freeze({
  root: '#home',
  week: '#home-week',
  today: '#home-today-date',
});

const DEFAULT_LABELS = Object.freeze({
  current: 'current',
  future: 'future',
  unavailableDate: 'unavailableDate',
  dayAcRecorded: 'dayAcRecorded',
  recentDays: 'recentDays',
});

function resolveRoot(root) {
  if (root?.querySelector) return root;
  return typeof document !== 'undefined' ? document : null;
}

function resolveValue(value, ...args) {
  return typeof value === 'function' ? value(...args) : value;
}

function translate(translateFn, key) {
  return typeof translateFn === 'function' ? translateFn(key) : key;
}

function find(root, explicit, selector) {
  return explicit || root?.querySelector?.(selector) || null;
}

function normalizeDay(day, index, state, options) {
  if (typeof day === 'string') {
    return {
      date: day,
      label: resolveValue(options.weekdayLabel, day, index, state),
      selectable: resolveValue(options.isSelectable, day, index, state),
      completed: resolveValue(options.hasCompletion, day, index, state),
      current: day === state.today,
      future: false,
    };
  }
  return {
    ...(day || {}),
    date: day?.date || day?.day,
    label: day?.label ?? resolveValue(options.weekdayLabel, day?.date || day?.day, index, state),
    selectable: day?.selectable ?? resolveValue(options.isSelectable, day?.date || day?.day, index, state),
    completed: day?.completed ?? resolveValue(options.hasCompletion, day?.date || day?.day, index, state),
    current: day?.current ?? ((day?.date || day?.day) === state.today),
    future: day?.future ?? false,
  };
}

function dayAriaLabel(day, state, options, text) {
  const parts = [text.fullDate(day.date)];
  if (day.current) parts.push(translate(options.translate, options.labels.current));
  if (day.completed) parts.push(translate(options.translate, options.labels.dayAcRecorded));
  if (!day.selectable) {
    parts.push(translate(options.translate, day.future ? options.labels.future : options.labels.unavailableDate));
  }
  return parts.join(', ');
}

/**
 * Render the home page from already prepared state.
 *
 * @param {object} options
 * @param {Element|Document} [options.root]
 * @param {object|Function} options.state Current home state or state getter.
 * @param {Function} options.translate Translation callback receiving a key.
 * @param {object} options.navigation Navigation callbacks; no URL is built here.
 * @param {object} options.render Formatting and policy callbacks supplied by the root.
 * @returns {{render: Function}}
 */
export function createHomePage({
  root,
  state = {},
  translate: translateFn,
  navigation = {},
  render = {},
  selectors = DEFAULT_SELECTORS,
  labels = DEFAULT_LABELS,
} = {}) {
  const pageRoot = resolveRoot(root);
  const getState = () => resolveValue(state) || {};
  const options = {
    ...render,
    translate: translateFn,
    labels: { ...DEFAULT_LABELS, ...labels },
  };
  const get = (name) => find(pageRoot, selectors[name], selectors[name]);
  const text = {
    date: options.dateText || ((date) => date),
    fullDate: options.fullDateText || ((date) => date),
  };

  function renderWeek(currentState) {
    const week = get('week');
    if (!week) return;
    const days = resolveValue(options.weekDays, currentState) || currentState.weekDays || currentState.week || [];
    week.replaceChildren();
    days.map((day, index) => normalizeDay(day, index, currentState, options)).forEach((day) => {
      if (!day.date) return;
      const cell = pageRoot.ownerDocument?.createElement?.(day.selectable ? 'a' : 'span')
        || document.createElement(day.selectable ? 'a' : 'span');
      cell.className = `home-day${day.current ? ' is-today' : ''}${day.future ? ' is-future' : ''}${day.completed ? ' is-solved' : ''}`;
      if (day.selectable) {
        const href = navigation.challengePath
          ? navigation.challengePath({ date: day.date, today: currentState.today, language: currentState.language, pathname: currentState.pathname })
          : navigation.challengeUrl?.({ date: day.date, today: currentState.today, language: currentState.language, pathname: currentState.pathname });
        if (href) cell.href = String(href);
        cell.dataset.date = day.date;
      }
      const label = day.label ?? '';
      cell.append(
        Object.assign(cell.ownerDocument.createElement('span'), { textContent: label }),
        Object.assign(cell.ownerDocument.createElement('b'), { textContent: day.date.slice(8) }),
      );
      if (day.completed) {
        const marker = cell.ownerDocument.createElement('span');
        marker.className = 'home-day-solved';
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = '✓';
        cell.append(marker);
      }
      cell.setAttribute('aria-label', day.ariaLabel || dayAriaLabel(day, currentState, options, text));
      if (day.current) cell.setAttribute('aria-current', 'date');
      week.append(cell);
    });
    options.onWeekRendered?.(week, currentState);
  }

  function renderPage(nextState = getState()) {
    const date = get('today');
    if (date && nextState.today) date.textContent = text.date(nextState.today, nextState);
    renderWeek(nextState);
    options.onRendered?.({ root: pageRoot, state: nextState });
    return nextState;
  }

  return Object.freeze({ render: renderPage, renderWeek });
}

export function renderHomePage(options = {}) {
  return createHomePage(options).render();
}

export const createHomePageAdapter = createHomePage;

export { DEFAULT_LABELS, DEFAULT_SELECTORS };

function labelFor(translate, key) {
  return typeof translate === 'function' ? translate(key) : key;
}

function resolveValue(value, key) {
  return typeof value === 'function' ? value(key) : value?.[key];
}

function headerLabel(doc, full, short) {
  const cell = doc.createElement('span');
  cell.className = 'problem-header-label';
  cell.setAttribute('aria-label', full);
  const fullLabel = doc.createElement('span');
  fullLabel.className = 'header-label-full';
  fullLabel.textContent = full;
  const shortLabel = doc.createElement('span');
  shortLabel.className = 'header-label-short';
  shortLabel.textContent = short;
  cell.append(fullLabel, shortLabel);
  return cell;
}

function renderHeader(doc, container, translate) {
  const header = doc.createElement('div');
  header.className = 'problem-grid problem-header';
  header.id = 'problem-headers';
  header.setAttribute('role', 'row');

  const difficulty = doc.createElement('span');
  difficulty.className = 'problem-header-cell problem-header-difficulty';
  difficulty.setAttribute('role', 'columnheader');
  difficulty.append(headerLabel(doc, labelFor(translate, 'problemHeaderDifficulty'), labelFor(translate, 'problemHeaderDifficultyShort')));

  const problem = doc.createElement('span');
  problem.className = 'problem-header-cell problem-header-problem';
  problem.setAttribute('role', 'columnheader');
  problem.append(headerLabel(doc, labelFor(translate, 'problemHeaderProblem'), labelFor(translate, 'problemHeaderProblem')));

  const done = doc.createElement('span');
  done.className = 'problem-header-cell problem-header-done';
  done.setAttribute('role', 'columnheader');
  done.append(headerLabel(doc, labelFor(translate, 'problemHeaderDone'), labelFor(translate, 'problemHeaderDone')));

  header.append(problem, difficulty, done);
  container.append(header);
}

function renderUnavailable(container, doc, model, translate, retry, challengeContextLabel) {
  const message = doc.createElement('span');
  const historical = model.error && model.historicalUnavailable;
  message.textContent = historical ? labelFor(translate, 'historicalUnavailable') : labelFor(translate, 'unavailable');
  message.setAttribute('role', model.error ? 'alert' : 'status');
  container.append(message);

  if (typeof retry === 'function' && model.canRetry !== false) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'retry-button';
    button.textContent = labelFor(translate, 'retry');
    const context = typeof challengeContextLabel === 'function' ? challengeContextLabel() : challengeContextLabel;
    button.setAttribute('aria-label', context ? `${labelFor(translate, 'retry')} — ${context}` : labelFor(translate, 'retry'));
    button.addEventListener('click', retry);
    container.append(button);
  }
}

function renderRow(doc, container, problem, row, translate, problemUrl, ratingCategory, statusLabels, statusGlyphs) {
  const element = doc.createElement('div');
  element.className = 'problem problem-grid';
  element.setAttribute('role', 'row');
  if (!problem) {
    const cell = doc.createElement('span');
    cell.setAttribute('role', 'cell');
    cell.textContent = labelFor(translate, 'empty');
    element.append(cell);
    container.append(element);
    return;
  }

  const status = row?.status || problem.status || 'none';
  const rating = doc.createElement('span');
  rating.className = `rating rating-${ratingCategory(problem.rating)}`;
  rating.textContent = problem.rating;
  rating.setAttribute('role', 'cell');

  const title = doc.createElement('span');
  title.className = 'problem-title';
  title.append(doc.createTextNode(problem.name));
  const link = doc.createElement('a');
  link.className = 'problem-link';
  link.href = problemUrl(problem);
  link.target = '_blank';
  link.rel = 'noopener';
  link.append(title);
  const problemCell = doc.createElement('span');
  problemCell.className = 'problem-cell';
  problemCell.setAttribute('role', 'cell');
  problemCell.append(link);

  const mark = doc.createElement('span');
  mark.className = `problem-status status-${status}`;
  mark.textContent = status === 'none' ? '—' : (resolveValue(statusGlyphs, status) ?? '');
  mark.setAttribute('role', 'img');
  const statusLabel = status === 'none'
    ? labelFor(translate, 'handleHelp')
    : (resolveValue(statusLabels, status) ?? status);
  mark.setAttribute('aria-label', statusLabel);
  mark.title = statusLabel;
  const statusCell = doc.createElement('span');
  statusCell.className = 'problem-status-cell';
  statusCell.setAttribute('role', 'cell');
  statusCell.append(mark);

  element.append(problemCell, rating, statusCell);
  container.append(element);
}

/** Render the problem-list DOM from an already prepared challenge view model. */
export function renderProblemList({
  container,
  model,
  translate,
  problemUrl,
  ratingCategory,
  statusLabels,
  statusGlyphs = { current: '✓', 'current-wrong': '✗', known: '✓', 'known-wrong': '✗' },
  retry,
  challengeContextLabel,
}) {
  if (!container) return;
  if (!model) throw new TypeError('renderProblemList requires a model');
  if (typeof problemUrl !== 'function') throw new TypeError('renderProblemList requires problemUrl');
  if (typeof ratingCategory !== 'function') throw new TypeError('renderProblemList requires ratingCategory');

  const doc = container.ownerDocument;
  container.replaceChildren();
  container.className = 'ladder';
  container.setAttribute('role', 'table');
  container.setAttribute('aria-label', labelFor(translate, 'problemTable'));

  if (model.status === 'unavailable') {
    container.textContent = labelFor(translate, 'unavailable');
    container.classList.add('empty');
    return;
  }
  if (model.loading || model.status === 'loading') {
    container.classList.add('is-loading');
    container.setAttribute('aria-busy', 'true');
    const loader = doc.createElement('span');
    loader.className = 'loader';
    loader.setAttribute('role', 'status');
    const context = typeof challengeContextLabel === 'function' ? challengeContextLabel() : challengeContextLabel;
    loader.setAttribute('aria-label', context ? `${labelFor(translate, 'loading')} — ${context}` : labelFor(translate, 'loading'));
    loader.textContent = labelFor(translate, 'loading');
    container.append(loader);
    return;
  }

  container.removeAttribute('aria-busy');
  const hasLadder = model.hasLadder ?? (model.status === 'ready' || model.items?.some(Boolean));
  if (!hasLadder) {
    renderUnavailable(container, doc, model, translate, retry, challengeContextLabel);
    container.classList.add('empty');
    return;
  }

  const items = model.items || [];
  if (!items.length || items.every((item) => !item)) {
    container.textContent = labelFor(translate, 'empty');
    container.classList.add('empty');
    return;
  }

  renderHeader(doc, container, translate);
  items.forEach((problem, index) => renderRow(doc, container, problem, model.rows?.[index], translate, problemUrl, ratingCategory, statusLabels, statusGlyphs));
}

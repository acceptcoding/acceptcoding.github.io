import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProblemList } from '../ui/problem-list-renderer.js';

class Node {
  constructor(tag, ownerDocument) { this.tagName = tag; this.ownerDocument = ownerDocument; this.children = []; this.attributes = {}; this.className = ''; this.textContent = ''; this.listeners = {}; this.classList = { add: (...names) => { this.className = `${this.className} ${names.join(' ')}`.trim(); } }; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  get classListValue() { return this.className.split(/\s+/).filter(Boolean); }
}
class Document {
  createElement(tag) { return new Node(tag, this); }
  createTextNode(text) { return { nodeType: 3, textContent: String(text) }; }
}

const doc = new Document();
const translate = (key) => ({ problemTable: 'Problems', problemHeaderDifficulty: 'Difficulty', problemHeaderDifficultyShort: 'Rating', problemHeaderProblem: 'Problem', problemHeaderDone: 'Done', loading: 'Loading', unavailable: 'Unavailable', empty: 'Empty', retry: 'Retry', handleHelp: 'Not checked', acceptedOnDate: 'Accepted today' }[key] || key);
const dependencies = { translate, problemUrl: (problem) => `https://example.test/${problem.contestId}/${problem.index}`, ratingCategory: () => 'newbie', statusLabels: { current: 'Accepted today' } };

function container() { return new Node('div', doc); }
function problem(name = 'A problem') { return { contestId: 1, index: 'A', name, rating: 800 }; }

test('renders header order, one title anchor, and row cell order', () => {
  const box = container();
  renderProblemList({ ...dependencies, container: box, model: { status: 'ready', items: [problem('First'), problem('Second')], rows: [{ status: 'current' }, { status: 'none' }] } });
  assert.deepEqual(box.children.map((child) => child.className), ['problem-grid problem-header', 'problem problem-grid', 'problem problem-grid']);
  assert.deepEqual(box.children[0].children.map((child) => child.className), ['problem-header-cell problem-header-problem', 'problem-header-cell problem-header-difficulty', 'problem-header-cell problem-header-done']);
  assert.equal(box.children[1].children[0].children[0].children[0].children[0].textContent, 'First');
  assert.equal(box.children[2].children[0].children[0].children[0].children[0].textContent, 'Second');
  const row = box.children[1];
  assert.deepEqual(row.children.map((child) => child.className), ['problem-cell', 'rating rating-newbie', 'problem-status-cell']);
  assert.equal(row.children[0].children.length, 1);
  assert.equal(row.children[0].children[0].className, 'problem-link');
  assert.equal(row.children[0].children[0].children[0].className, 'problem-title');
});

test('preserves loading, unavailable, error retry, and empty states', () => {
  const loading = container();
  renderProblemList({ ...dependencies, container: loading, model: { loading: true, status: 'loading' } });
  assert.equal(loading.attributes['aria-busy'], 'true');
  assert.equal(loading.children[0].className, 'loader');

  const unavailable = container();
  renderProblemList({ ...dependencies, container: unavailable, model: { status: 'unavailable' } });
  assert.equal(unavailable.textContent, 'Unavailable');
  assert.ok(unavailable.classListValue.includes('empty'));

  const error = container();
  let retried = false;
  renderProblemList({ ...dependencies, container: error, model: { status: 'error', error: true, hasLadder: false, canRetry: true }, retry: () => { retried = true; } });
  assert.equal(error.children[0].attributes.role, 'alert');
  error.children[1].listeners.click();
  assert.equal(retried, true);

  const empty = container();
  renderProblemList({ ...dependencies, container: empty, model: { status: 'ready', items: [] } });
  assert.equal(empty.textContent, 'Empty');
});

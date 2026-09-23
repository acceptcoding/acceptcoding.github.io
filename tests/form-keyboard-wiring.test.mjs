import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormKeyboardWiring } from '../ui/form-keyboard-wiring.js';

class Node {
  constructor({ id = '', dataset = {}, matches = [] } = {}) {
    this.id = id;
    this.dataset = dataset;
    this.matchesSet = new Set(matches);
    this.listeners = new Map();
    this.children = [];
    this.disabled = false;
    this.attributes = new Map();
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
  }
  dispatch(type, target = this, init = {}) {
    const event = {
      type, target, key: init.key, prevented: false,
      preventDefault() { this.prevented = true; },
    };
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
    return event;
  }
  contains(node) { return node === this || this.children.includes(node); }
  querySelector(selector) { return selector === '#handle' ? this.handle : null; }
  closest(selector) {
    return selector.split(',').map((item) => item.trim()).some((item) => this.matchesSet.has(item)) ? this : null;
  }
  matches(selector) { return this.matchesSet.has(selector); }
}

function fixture() {
  const form = new Node();
  const handle = new Node({ id: 'handle' });
  const suggestions = new Node();
  const levels = new Node();
  const dates = new Node();
  const outside = new Node();
  const windowRoot = new Node();
  form.handle = handle;
  form.children.push(handle);
  return { form, handle, suggestions, levels, dates, outside, window: windowRoot };
}

test('wiring keeps one listener set and routes keyboard callbacks', () => {
  const roots = fixture();
  const calls = [];
  const options = {
    roots,
    callbacks: {
      onHandleFocus: () => calls.push('focus'),
      onSuggestionNext: () => calls.push('down'),
      onSuggestionsEscape: () => calls.push('escape'),
      onSubmit: (event) => calls.push(['submit', event.prevented]),
    },
  };
  const first = createFormKeyboardWiring(options);
  const second = createFormKeyboardWiring(options);
  assert.equal(first.connected, true);
  assert.equal(second.connected, true);

  roots.handle.dispatch('focus');
  roots.handle.dispatch('keydown', roots.handle, { key: 'ArrowDown' });
  roots.handle.dispatch('keydown', roots.handle, { key: 'Escape' });
  roots.form.dispatch('submit');

  assert.deepEqual(calls, ['focus', 'down', 'escape', ['submit', false]]);
  second.disconnect();
  assert.equal(roots.handle.listeners.get('focus')?.length, 0);
});

test('delegates level, date, retry, and popstate actions without owning state', () => {
  const roots = fixture();
  const level = new Node({ dataset: { level: 'pupil' }, matches: ['[data-level]', '.level'] });
  const date = new Node({ dataset: { date: '2026-09-18' }, matches: ['[data-date]'] });
  const retry = new Node({ matches: ['[data-action="retry"]', '.retry-button'] });
  roots.levels.children.push(level);
  roots.dates.children.push(date);
  roots.form.children.push(retry);
  const calls = [];
  createFormKeyboardWiring({
    roots,
    callbacks: {
      onLevelSelect: (_, event, element) => calls.push(['level', element.dataset.level]),
      onDateSelect: (value) => calls.push(['date', value]),
      onRetry: () => calls.push('retry'),
      onPopstate: () => calls.push('popstate'),
    },
  });
  roots.levels.dispatch('click', level);
  roots.dates.dispatch('click', date);
  roots.form.dispatch('click', retry);
  roots.window.dispatch('popstate');
  assert.deepEqual(calls, [['level', 'pupil'], ['date', '2026-09-18'], 'retry', 'popstate']);
});

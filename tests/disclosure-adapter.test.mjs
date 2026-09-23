import test from 'node:test';
import assert from 'node:assert/strict';
import { wireHelpDialog, wireMonthPickerDisclosure, wirePreferenceDetails } from '../ui/disclosure-adapter.js';

class FakeEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init); this.defaultPrevented = false; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

class FakeElement {
  constructor({ id = '', className = '', children = [] } = {}) {
    this.id = id; this.className = className; this.children = children; this.parentNode = null;
    this.hidden = false; this.open = false; this.disabled = false; this.dataset = {}; this.attributes = {};
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
    this.listeners = new Map(); this.ownerDocument = null; this.focusCount = 0;
    children.forEach((child) => { child.parentNode = this; });
  }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) { event.target ||= this; for (const listener of this.listeners.get(event.type) || []) listener(event); return !event.defaultPrevented; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() { this.focusCount += 1; this.ownerDocument.activeElement = this; }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  matches(selector) {
    return selector.startsWith('.') && this.className.split(' ').includes(selector.slice(1))
      || selector === 'button:not([disabled])' && this.tagName === 'BUTTON' && !this.disabled
      || selector === 'a[href]' && this.tagName === 'A' && Boolean(this.href)
      || selector === 'input:not([disabled])' && this.tagName === 'INPUT' && !this.disabled;
  }
  querySelectorAll(selector) {
    if (selector.includes(', ')) return selector.split(', ').flatMap((part) => this.querySelectorAll(part));
    const found = [];
    const visit = (node) => { node.children.forEach((child) => { if (child.matches(selector) || selector === '.preference-close' && child.className === 'preference-close') found.push(child); visit(child); }); };
    visit(this);
    return found;
  }
  querySelector(selector) {
    if (selector.startsWith('#')) return this.ownerDocument?.elements[selector.slice(1)] || null;
    return this.querySelectorAll(selector)[0] || null;
  }
  prepend(node) { node.parentNode = this; this.children.unshift(node); }
}

class FakeDocument extends FakeElement {
  constructor(elements = {}) { super(); this.elements = elements; this.activeElement = null; this.ownerDocument = this; this.created = []; Object.values(elements).flat().forEach((element) => this.adopt(element)); }
  adopt(element) { if (!element?.children) return; element.ownerDocument = this; element.children.forEach((child) => this.adopt(child)); }
  createElement(tagName) { const element = new FakeElement(); element.tagName = tagName.toUpperCase(); this.created.push(element); this.adopt(element); return element; }
  querySelector(selector) { if (selector.startsWith('#')) return this.elements[selector.slice(1)] || null; return super.querySelector(selector); }
  querySelectorAll(selector) {
    if (selector === '.preference-menu') return this.elements.preferenceMenus || [];
    if (selector.includes('.help-close')) return super.querySelectorAll('.help-close').concat(super.querySelectorAll('.help-backdrop'));
    return super.querySelectorAll(selector);
  }
}

function button(className = '') { const element = new FakeElement({ className }); element.tagName = 'BUTTON'; return element; }

function helpFixture() {
  const trigger = button('help-trigger');
  const close = button('help-close');
  const backdrop = button('help-backdrop');
  const link = new FakeElement(); link.tagName = 'A'; link.href = '/x';
  const popover = new FakeElement({ className: 'help-popover', children: [close, link] });
  const help = new FakeElement({ id: 'help', className: 'help-menu', children: [trigger, backdrop, popover] });
  const document = new FakeDocument({ help });
  document.children = [help];
  help.parentNode = document;
  document.adopt(help);
  return { document, help, trigger, close, backdrop, popover, link };
}

test('help adapter preserves dialog semantics, focus restoration, trap, and outside close', () => {
  const fixture = helpFixture();
  const cleanup = wireHelpDialog({ root: fixture.document });
  assert.equal(fixture.popover.getAttribute('role'), 'dialog');
  assert.equal(fixture.popover.getAttribute('aria-modal'), 'true');
  fixture.popover.setAttribute('aria-labelledby', 'help-title');
  fixture.help.open = true;
  fixture.help.dispatchEvent(new FakeEvent('toggle'));
  fixture.document.activeElement = fixture.link;
  const tab = new FakeEvent('keydown', { key: 'Tab' });
  fixture.popover.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true);
  fixture.backdrop.dispatchEvent(new FakeEvent('click'));
  assert.equal(fixture.help.open, false);
  assert.equal(fixture.document.activeElement, fixture.trigger);
  assert.equal(fixture.popover.getAttribute('aria-labelledby'), 'help-title');
  cleanup();
});

test('preference adapter keeps details state and traps focus through Escape and close', () => {
  const trigger = button('preference-trigger');
  const option = button('language-option');
  const panel = new FakeElement({ className: 'preference-options', children: [option] });
  const menu = new FakeElement({ className: 'preference-menu', children: [trigger, panel] });
  menu.tagName = 'DETAILS';
  const document = new FakeDocument({ preferenceMenus: [menu] });
  document.adopt(menu);
  wirePreferenceDetails({ root: document, translate: () => 'Close' });
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  assert.equal(menu.open, false);
  menu.open = true;
  menu.dispatchEvent(new FakeEvent('toggle'));
  document.activeElement = option;
  const tab = new FakeEvent('keydown', { key: 'Tab' });
  panel.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true);
  document.dispatchEvent(new FakeEvent('keydown', { key: 'Escape' }));
  assert.equal(menu.open, false);
  assert.equal(document.activeElement, trigger);
});

test('month picker adapter preserves hidden containment and Escape focus', () => {
  const toggle = button();
  const panel = new FakeElement({ id: 'month-picker' }); panel.hidden = true;
  const calendar = new FakeElement({ id: 'calendar' });
  const legend = new FakeElement({ className: 'calendar-legend' });
  const today = new FakeElement({ className: 'calendar-today' });
  const document = new FakeDocument({ 'month-picker-toggle': toggle, 'month-picker': panel, calendar });
  document.elements['calendar-legend'] = legend;
  document.elements['calendar-today'] = today;
  document.querySelector = (selector) => selector === '.calendar-legend' ? legend : selector === '.calendar-today' ? today : selector.startsWith('#') ? document.elements[selector.slice(1)] || null : null;
  wireMonthPickerDisclosure({ root: document });
  toggle.dispatchEvent(new FakeEvent('click'));
  assert.equal(panel.hidden, false);
  assert.equal(calendar.hidden, true);
  assert.equal(legend.hidden, true);
  assert.equal(today.hidden, true);
  document.dispatchEvent(new FakeEvent('keydown', { key: 'Escape' }));
  assert.equal(panel.hidden, true);
  assert.equal(calendar.hidden, false);
  assert.equal(document.activeElement, toggle);
});

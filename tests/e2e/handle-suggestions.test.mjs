import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const ROOT = new URL('../../', import.meta.url).pathname;
const BASE_URL = 'http://127.0.0.1';
const VIEWPORTS = [300, 360, 1280];

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForUrl(url, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpPage {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const resolve = this.pending.get(message.id);
      if (!resolve) return;
      this.pending.delete(message.id);
      if (message.error) resolve.reject(new Error(message.error.message));
      else resolve.resolve(message);
    });
  }

  command(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result.result?.result?.value;
  }

  async close() {
    for (const { reject } of this.pending.values()) reject(new Error('CDP page closed'));
    this.pending.clear();
    this.socket.close();
  }
}

async function createPage(cdpPort, url) {
  const response = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  assert.ok(response.ok, `could not create CDP page: ${response.status}`);
  const descriptor = await response.json();
  const socket = new WebSocket(descriptor.webSocketDebuggerUrl);
  await once(socket, 'open');
  const page = new CdpPage(socket);
  await page.command('Runtime.enable');
  await page.command('Page.enable');
  await page.command('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await page.command('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('accept-recent-handles-v1', ${JSON.stringify(JSON.stringify([
      { handle: 'tourist', lastUsed: 3 },
      { handle: 'touring', lastUsed: 2 },
      { handle: 'alpha', lastUsed: 1 },
    ]))});`,
  });
  await page.command('Page.navigate', { url });
  await waitForPredicate(page, 'document.readyState === "complete"');
  return page;
}

async function waitForPredicate(page, predicate, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(`Boolean(${predicate})`)) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(`Timed out waiting for predicate: ${predicate}`);
}

async function press(page, key) {
  await page.command('Input.dispatchKeyEvent', { type: 'keyDown', key });
  await page.command('Input.dispatchKeyEvent', { type: 'keyUp', key });
}

async function clickRect(page, selector) {
  const rect = await page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.command('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await page.command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
}

async function clickPoint(page, x, y) {
  await page.command('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await page.command('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function typeValue(page, value) {
  await page.evaluate(`(() => { const input = document.querySelector('#handle'); input.focus(); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitForPredicate(page, 'document.querySelectorAll("#handle-suggestions [role=option]").length > 0');
}

function snapshotExpression() {
  return `(() => { const input = document.querySelector('#handle'); const panel = document.querySelector('#handle-suggestions-panel'); const options = [...document.querySelectorAll('#handle-suggestions [role=option]')]; const r = panel.getBoundingClientRect(); return { value: input.value, focused: document.activeElement === input, hidden: panel.hidden, expanded: input.getAttribute('aria-expanded'), active: input.getAttribute('aria-activedescendant'), selected: options.map(option => option.getAttribute('aria-selected')), labels: options.map(option => option.textContent), panel: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, viewport: { width: innerWidth, scrollWidth: document.documentElement.scrollWidth } }; })()`;
}

test('handle suggestions remain attached and accessible across viewports', async t => {
  const httpPort = await freePort();
  const cdpPort = await freePort();
  const profile = await mkdtemp(join(tmpdir(), 'accept-e2e-'));
  const server = spawn('python3', ['-m', 'http.server', String(httpPort), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  const browser = spawn('chromium', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  let page;
  t.after(async () => {
    await page?.close().catch(() => {});
    browser.kill('SIGKILL');
    server.kill('SIGKILL');
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  await waitForUrl(`http://127.0.0.1:${httpPort}/pt/daily/`);
  await waitForUrl(`http://127.0.0.1:${cdpPort}/json/version`);

  for (const width of VIEWPORTS) {
    page = await createPage(cdpPort, `http://127.0.0.1:${httpPort}/pt/daily/`);
    await page.command('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
    await waitForPredicate(page, 'document.querySelector(".problem-header") && document.querySelector(".problem")');
    const layout = await page.evaluate(`(() => {
      const header = document.querySelector('.problem-header');
      const row = document.querySelector('.problem');
      if (!header || !row) return null;
      const headers = [...header.children].map(element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, text: element.innerText }; });
      const cells = [...row.children].map(element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, className: element.className }; });
      return { headers, cells, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth };
    })()`);
    assert.ok(layout, `problem grid is rendered at ${width}px`);
    assert.ok(layout.scrollWidth <= layout.viewport, `problem grid overflows at ${width}px`);
    assert.ok(layout.headers[2].width >= 44, `completion column is squeezed at ${width}px`);
    assert.ok(layout.headers[1].width >= 48, `rating column is squeezed at ${width}px`);
    assert.equal(layout.headers[0].left, layout.cells[0].left, `problem header and title drift at ${width}px`);
    assert.ok(layout.headers[1].right <= layout.headers[2].left, `rating and problem headers overlap at ${width}px`);
    assert.ok(layout.headers[0].right <= layout.headers[1].left, `problem and rating headers overlap at ${width}px`);
    await typeValue(page, 'tour');
    let state = await page.evaluate(snapshotExpression());
    assert.deepEqual(state.labels, ['tourist', 'touring']);
    assert.equal(state.expanded, 'true');
    assert.equal(state.hidden, false);
    assert.equal(state.panel.left, await page.evaluate('document.querySelector("#handle").getBoundingClientRect().left'));
    assert.ok(state.panel.right <= state.viewport.width);
    assert.ok(state.viewport.scrollWidth <= state.viewport.width);

    await press(page, 'ArrowDown');
    state = await page.evaluate(snapshotExpression());
    assert.equal(state.active, 'recent-handle-0');
    assert.deepEqual(state.selected, ['true', 'false']);
    await press(page, 'ArrowDown');
    await press(page, 'ArrowUp');
    state = await page.evaluate(snapshotExpression());
    assert.deepEqual(state.selected, ['true', 'false']);
    await press(page, 'Enter');
    state = await page.evaluate(snapshotExpression());
    assert.equal(state.value, 'tourist');
    assert.equal(state.focused, true);
    assert.equal(state.hidden, true);
    assert.equal(state.active, null);

    await typeValue(page, 'tour');
    await clickRect(page, '#handle-suggestions [role=option]');
    state = await page.evaluate(snapshotExpression());
    assert.equal(state.value, 'tourist');
    assert.equal(state.hidden, true);

    await typeValue(page, 'tour');
    await press(page, 'Escape');
    state = await page.evaluate(snapshotExpression());
    assert.equal(state.hidden, true);
    assert.equal(state.expanded, 'false');
    assert.equal(state.active, null);

    await typeValue(page, 'tour');
    await clickPoint(page, 5, 790);
    state = await page.evaluate(snapshotExpression());
    assert.equal(state.hidden, true);

    await typeValue(page, 'tour');
    await clickRect(page, '#clear-recent-handles');
    state = await page.evaluate(snapshotExpression());
    assert.equal(state.hidden, true);
    assert.equal(state.focused, true);
    assert.equal(await page.evaluate("localStorage.getItem('accept-recent-handles-v1')"), null);
    await page.close();
    page = null;
  }

  page = await createPage(cdpPort, `http://127.0.0.1:${httpPort}/pt/`);
  await waitForPredicate(page, 'document.querySelectorAll("#home-week a[data-date]").length > 0');
  const homeRoute = await page.evaluate(`(() => { const links = [...document.querySelectorAll('#home-week a[data-date]')]; const link = links.find(a => a.dataset.date !== '${new Date().toISOString().slice(0, 10)}') || links[0]; const url = new URL(link.href); return { href: link.href, date: link.dataset.date, hasOriginQuery: url.searchParams.has('from'), path: url.pathname }; })()`);
  assert.equal(homeRoute.hasOriginQuery, false);
  assert.match(homeRoute.path, /^\/pt\/challenges\/\d{4}-\d{2}-\d{2}\/$/);
  await page.evaluate(`document.querySelector('#home-week a[data-date="${homeRoute.date}"]').click()`);
  await waitForPredicate(page, 'document.readyState === "complete" && document.querySelector("#daily-back")');
  const datedRoute = await page.evaluate('({ url: location.href, back: document.querySelector("#daily-back").href })');
  assert.equal(new URL(datedRoute.url).searchParams.has('from'), false);
  assert.equal(new URL(datedRoute.back).pathname, '/pt/challenges/');
  await page.evaluate('document.querySelector("#levels button[data-level]").click()');
  await waitForPredicate(page, 'new URL(location.href).searchParams.has("level")');
  await page.evaluate('document.querySelector("#daily-back").click()');
  await waitForPredicate(page, 'location.pathname === "/pt/"');
  await page.close();
  page = null;
});

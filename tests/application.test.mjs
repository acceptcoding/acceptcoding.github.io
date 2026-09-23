import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LADDER_STATUS,
  createInitialSession,
  selectDate,
  selectLevel,
  selectAllView,
  receiveLadder,
} from '../application/session.js';
import { createApplicationController } from '../application/controller.js';

const ladder = Array.from({ length: 13 }, (_, index) => ({ id: `355:${String.fromCharCode(65 + index)}`, contestId: 355, index: String.fromCharCode(65 + index), name: `Problem ${index}`, rating: 800 + index * 100, tags: [], type: 'PROGRAMMING' }));

test('application session keeps view and level provenance separate', () => {
  const initial = createInitialSession({ today: '2026-09-18', date: '2026-09-17' });
  const manual = selectLevel(initial, 'expert');
  assert.equal(manual.level, 'expert');
  assert.equal(manual.levelProvenance, 'manual');
  const all = selectAllView(manual);
  assert.equal(all.view, 'all');
  assert.equal(all.level, 'expert');
});

test('date transition invalidates ladder state without changing the public contract', () => {
  const ready = receiveLadder(createInitialSession({ today: '2026-09-18' }), ladder);
  const next = selectDate(ready, '2026-09-17', '2026-09-18');
  assert.equal(next.date, '2026-09-17');
  assert.equal(next.ladder, null);
  assert.equal(next.ladderStatus, LADDER_STATUS.IDLE);
});

test('controller ignores a stale repository result after a date change', async () => {
  let resolveFirst;
  const repository = { resolve: () => new Promise((resolve) => { resolveFirst = resolve; }) };
  const controller = createApplicationController({ today: '2026-09-18', ladderRepository: repository });
  const pending = controller.loadLadder();
  controller.dispatch({ type: 'select-date', date: '2026-09-17', today: '2026-09-18' });
  resolveFirst(ladder);
  await pending;
  assert.equal(controller.getState().date, '2026-09-17');
  assert.equal(controller.getState().ladder, null);
});

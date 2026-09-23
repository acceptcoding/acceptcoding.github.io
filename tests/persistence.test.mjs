import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersistence } from '../js/persistence.js';

function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    read(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; },
    write(key, value) { values.set(key, value); },
    remove(key) { values.delete(key); },
  };
}

test('persistence keeps recent handles compatible and bounded', () => {
  const store = memoryStore({
    'accept-recent-handles-v1': JSON.stringify([
      'LegacyUser',
      { handle: 'legacyuser', lastUsed: 4 },
      { handle: 'NewUser', lastUsed: 8 },
    ]),
  });
  const persistence = createPersistence({
    readLocalValue: store.read,
    writeLocalValue: store.write,
    removeLocalValue: store.remove,
    now: () => 12,
  });

  assert.deepEqual(persistence.readRecentHandles(), [
    { handle: 'NewUser', lastUsed: 8 },
    { handle: 'legacyuser', lastUsed: 4 },
  ]);
  persistence.rememberRecentHandle('NEWUSER');
  assert.deepEqual(persistence.readRecentHandles(), [
    { handle: 'NEWUSER', lastUsed: 12 },
    { handle: 'legacyuser', lastUsed: 4 },
  ]);
  assert.deepEqual(persistence.recentHandleMatches('new'), [{ handle: 'NEWUSER', lastUsed: 12 }]);
});

test('persistence delegates activity and completion semantics to the domain', () => {
  const store = memoryStore();
  const persistence = createPersistence({
    readLocalValue: store.read,
    writeLocalValue: store.write,
    removeLocalValue: store.remove,
  });
  const nextActivity = persistence.learnKnownActivity(null, 'User', [{
    verdict: 'OK',
    problem: { contestId: 1, index: 'A' },
  }]);
  const activity = persistence.knownActivityForHandle(nextActivity, 'user');
  assert.deepEqual([...activity.accepted], ['1:A']);
  assert.deepEqual([...activity.unsuccessful], []);

  const nextHistory = persistence.rememberCompletion(null, 'User', '2026-09-09');
  assert.equal(persistence.completionForDate(nextHistory, 'user', '2026-09-09'), true);
  assert.equal(JSON.parse(store.values.get('accept-completion-history-v1')).user['2026-09-09'], true);
});

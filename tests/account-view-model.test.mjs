import test from 'node:test';
import assert from 'node:assert/strict';
import { officialRankName, rankClass, readableRankName, RANK_CLASSES } from '../application/account-view-model.js';

test('account view model preserves special and rating-derived rank presentation', () => {
  assert.equal(officialRankName({ handle: 'mikemirzayanov', rating: 3500 }), 'Headquarters');
  assert.equal(officialRankName({ handle: 'tourist', rating: 4000 }), 'tourist');
  assert.equal(officialRankName({ rating: 1900 }), 'candidate master');
  assert.equal(rankClass('candidate master'), 'rank-candidate');
  assert.equal(readableRankName({ rank: 'international grandmaster' }), 'International Grandmaster');
});

test('account view model exposes only the presentation classes used by the existing renderer', () => {
  assert.deepEqual([...RANK_CLASSES], [
    'rank-unknown', 'rank-unrated', 'rank-newbie', 'rank-pupil', 'rank-specialist',
    'rank-expert', 'rank-candidate', 'rank-master', 'rank-grandmaster',
    'rank-legendary', 'rank-tourist', 'rank-headquarters',
  ]);
});
